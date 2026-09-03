import {
	calendarDay,
	formatDateTime,
	getAccountPreferences,
} from "@cantiara/auth";
import type { Prisma, PrismaClient } from "@cantiara/db";

import {
	lockMutation,
	readDurableReceipt,
	writeDurableReceipt,
} from "../../mutation-core/server/durable-mutation";
import { MUTATION_COPY } from "../../mutation-core/server/mutation-shared";
import {
	projectSourceHref,
	RETURN_TO_WORK_COPY,
	RETURN_TO_WORK_RESTORES,
	RETURN_TO_WORK_SESSION,
	RETURN_TO_WORK_SNAPSHOT,
	type ReturnSourceRecord,
	type ReturnToWorkSummary,
	selectReturnCards,
	workSourceHref,
} from "./return-to-work-model";

type MutationDb = PrismaClient | Prisma.TransactionClient;

function hasDelegate(
	db: MutationDb,
	name: "nextConcreteStepChange" | "returnToWorkVisibleOpen"
): boolean {
	const delegate = (db as unknown as Record<string, { findMany?: unknown }>)[
		name
	];
	return typeof delegate?.findMany === "function";
}

export type NextConcreteStepOutcome =
	| { status: "committed"; summary: ReturnToWorkSummary }
	| { reason: typeof MUTATION_COPY.conflict; status: "conflict" }
	| { status: "not-found" };

export interface ReturnToWork {
	noteVisibleOpen: (input: {
		projectId?: string;
		workId?: string;
	}) => Promise<{ status: "committed" } | { status: "not-found" }>;
	setNextConcreteStep: (input: {
		idempotencyKey: string;
		projectId?: string;
		text: string;
		workId?: string;
	}) => Promise<NextConcreteStepOutcome>;
	summary: (input: {
		projectId: string;
		workId?: string;
	}) => Promise<ReturnToWorkSummary | null>;
}

export interface CreateReturnToWorkInput {
	accountId: string;
	clock?: { now: () => Date };
	prisma: PrismaClient;
	workspaceId: string;
}

export function createReturnToWork(
	input: CreateReturnToWorkInput
): ReturnToWork {
	const now = () => (input.clock ? input.clock.now() : new Date());

	async function summary(query: {
		projectId: string;
		workId?: string;
	}): Promise<ReturnToWorkSummary | null> {
		return await loadSummary(
			input.prisma,
			input.accountId,
			input.workspaceId,
			query.projectId,
			query.workId,
			now()
		);
	}

	async function setNextConcreteStep(command: {
		idempotencyKey: string;
		projectId?: string;
		text: string;
		workId?: string;
	}): Promise<NextConcreteStepOutcome> {
		const text = command.text.trim();
		const payload = {
			accountId: input.accountId,
			projectId: command.projectId ?? null,
			text,
			workId: command.workId ?? null,
		};
		return await input.prisma.$transaction(async (tx) => {
			await lockMutation(
				tx,
				`return-to-work-step:${input.accountId}:${command.workId ?? command.projectId}`
			);
			const existing = await readDurableReceipt(
				tx,
				command.idempotencyKey,
				payload
			);
			if (existing?.kind === "conflict") {
				return { reason: MUTATION_COPY.conflict, status: "conflict" };
			}
			if (existing?.kind === "replay") {
				return JSON.parse(existing.resultValue) as NextConcreteStepOutcome;
			}
			const target = await resolveWriteTarget(
				tx,
				input.workspaceId,
				command.projectId,
				command.workId
			);
			if (!target) {
				return { status: "not-found" };
			}
			await persistNextConcreteStep(tx, target, text, now());
			const next = await loadSummary(
				tx,
				input.accountId,
				input.workspaceId,
				target.projectId,
				target.kind === "work" ? target.id : undefined,
				now()
			);
			if (!next) {
				return { status: "not-found" };
			}
			const outcome: NextConcreteStepOutcome = {
				status: "committed",
				summary: next,
			};
			await writeDurableReceipt(tx, {
				actorId: input.accountId,
				commandKey: command.idempotencyKey,
				kind: "return-to-work-next-concrete-step",
				payload,
				resultValue: JSON.stringify(outcome),
				targetId: target.id,
			});
			return outcome;
		});
	}

	async function noteVisibleOpen(command: {
		projectId?: string;
		workId?: string;
	}): Promise<{ status: "committed" } | { status: "not-found" }> {
		let source: { sourceId: string; sourceKind: "project" | "work" } | null =
			null;
		if (command.workId) {
			source = { sourceId: command.workId, sourceKind: "work" };
		} else if (command.projectId) {
			source = { sourceId: command.projectId, sourceKind: "project" };
		}
		if (!source) {
			return { status: "not-found" };
		}
		const exists = command.workId
			? await input.prisma.work.findFirst({
					where: {
						id: command.workId,
						project: { workspaceId: input.workspaceId },
						retiredIntoId: null,
						trashedAt: null,
					},
				})
			: await input.prisma.project.findFirst({
					where: {
						id: command.projectId,
						workspaceId: input.workspaceId,
					},
				});
		if (!exists) {
			return { status: "not-found" };
		}
		if (!hasDelegate(input.prisma, "returnToWorkVisibleOpen")) {
			return { status: "committed" };
		}
		await input.prisma.returnToWorkVisibleOpen.upsert({
			create: {
				accountId: input.accountId,
				id: crypto.randomUUID(),
				sourceId: source.sourceId,
				sourceKind: source.sourceKind,
				viewedAt: now(),
			},
			update: { viewedAt: now() },
			where: {
				accountId_sourceKind_sourceId: {
					accountId: input.accountId,
					sourceId: source.sourceId,
					sourceKind: source.sourceKind,
				},
			},
		});
		return { status: "committed" };
	}

	return { noteVisibleOpen, setNextConcreteStep, summary };
}

interface NextConcreteStepRow {
	nextConcreteStep: string | null;
	nextConcreteStepUpdatedAt: Date | null;
}

async function readNextConcreteStep(
	db: MutationDb,
	kind: "project" | "work",
	id: string
): Promise<{ text: string | null; updatedAt: Date | null }> {
	const rows =
		kind === "work"
			? await db.$queryRaw<NextConcreteStepRow[]>`
					SELECT "nextConcreteStep", "nextConcreteStepUpdatedAt"
					FROM "work"
					WHERE "id" = ${id}
				`
			: await db.$queryRaw<NextConcreteStepRow[]>`
					SELECT "nextConcreteStep", "nextConcreteStepUpdatedAt"
					FROM "project"
					WHERE "id" = ${id}
				`;
	const [row] = rows;
	return {
		text: row?.nextConcreteStep ?? null,
		updatedAt: row?.nextConcreteStepUpdatedAt ?? null,
	};
}

async function persistNextConcreteStep(
	tx: MutationDb,
	target: {
		id: string;
		kind: "project" | "work";
		nextConcreteStep: string | null;
	},
	text: string,
	occurredAt: Date
): Promise<void> {
	const nextValue = text.length > 0 ? text : null;
	const current = await readNextConcreteStep(tx, target.kind, target.id);
	if (current.text === nextValue) {
		return;
	}
	if (target.kind === "work") {
		await tx.$executeRaw`
			UPDATE "work"
			SET
				"nextConcreteStep" = ${nextValue},
				"nextConcreteStepUpdatedAt" = ${occurredAt},
				"revision" = "revision" + 1
			WHERE "id" = ${target.id}
		`;
	} else {
		await tx.$executeRaw`
			UPDATE "project"
			SET
				"nextConcreteStep" = ${nextValue},
				"nextConcreteStepUpdatedAt" = ${occurredAt},
				"revision" = "revision" + 1
			WHERE "id" = ${target.id}
		`;
	}
	if (hasDelegate(tx, "nextConcreteStepChange")) {
		await tx.nextConcreteStepChange.create({
			data: {
				id: crypto.randomUUID(),
				nextValue,
				previousValue: current.text,
				...(target.kind === "work"
					? { workId: target.id }
					: { projectId: target.id }),
			},
		});
		return;
	}
	await tx.$executeRaw`
		INSERT INTO "next_concrete_step_change"
			(id, "workId", "projectId", "previousValue", "nextValue", "createdAt")
		VALUES (
			${crypto.randomUUID()},
			${target.kind === "work" ? target.id : null},
			${target.kind === "project" ? target.id : null},
			${current.text},
			${nextValue},
			CURRENT_TIMESTAMP
		)
	`;
}

async function loadNextConcreteStepHistory(
	db: MutationDb,
	source: { projectId: string } | { workId: string }
): Promise<Array<{ createdAt: Date; previousValue: string | null }>> {
	if (hasDelegate(db, "nextConcreteStepChange")) {
		if ("workId" in source) {
			return await db.nextConcreteStepChange.findMany({
				orderBy: { createdAt: "desc" },
				where: { workId: source.workId },
			});
		}
		return await db.nextConcreteStepChange.findMany({
			orderBy: { createdAt: "desc" },
			where: { projectId: source.projectId },
		});
	}
	if ("workId" in source) {
		return await db.$queryRaw<
			Array<{ createdAt: Date; previousValue: string | null }>
		>`
			SELECT "previousValue", "createdAt"
			FROM "next_concrete_step_change"
			WHERE "workId" = ${source.workId}
			ORDER BY "createdAt" DESC
		`;
	}
	return await db.$queryRaw<
		Array<{ createdAt: Date; previousValue: string | null }>
	>`
		SELECT "previousValue", "createdAt"
		FROM "next_concrete_step_change"
		WHERE "projectId" = ${source.projectId}
		ORDER BY "createdAt" DESC
	`;
}

async function resolveWriteTarget(
	db: MutationDb,
	workspaceId: string,
	projectId: string | undefined,
	workId: string | undefined
): Promise<{
	id: string;
	kind: "project" | "work";
	nextConcreteStep: string | null;
	projectId: string;
} | null> {
	if (workId) {
		const work = await db.work.findFirst({
			where: {
				id: workId,
				project: { workspaceId },
				retiredIntoId: null,
				trashedAt: null,
			},
		});
		if (!work) {
			return null;
		}
		return {
			id: work.id,
			kind: "work",
			nextConcreteStep: work.nextConcreteStep,
			projectId: work.projectId,
		};
	}
	if (projectId) {
		const project = await db.project.findFirst({
			where: { id: projectId, workspaceId },
		});
		if (!project) {
			return null;
		}
		return {
			id: project.id,
			kind: "project",
			nextConcreteStep: project.nextConcreteStep,
			projectId: project.id,
		};
	}
	return null;
}

async function loadSummary(
	db: MutationDb,
	accountId: string,
	workspaceId: string,
	projectId: string,
	workId: string | undefined,
	at: Date
): Promise<ReturnToWorkSummary | null> {
	const project = await db.project.findFirst({
		where: { id: projectId, workspaceId },
	});
	if (!project) {
		return null;
	}
	const work = workId
		? await db.work.findFirst({
				where: {
					id: workId,
					projectId,
					retiredIntoId: null,
					trashedAt: null,
				},
			})
		: null;
	if (workId && !work) {
		return null;
	}
	const preferences = await getAccountPreferences(
		db as PrismaClient,
		accountId
	);
	const today = calendarDay(at, preferences);
	const records = await loadCurrentRecords(db, accountId, projectId);
	const contextId = work?.id ?? project.id;
	const cards = selectReturnCards(records, { contextId, today });
	const step = await readNextConcreteStep(
		db,
		work ? "work" : "project",
		work?.id ?? project.id
	);
	const activeText = step.text;
	const historyRows = await loadNextConcreteStepHistory(
		db,
		work ? { workId: work.id } : { projectId: project.id }
	);
	const previousValues = historyRows
		.filter(
			(row) => row.previousValue !== null && row.previousValue !== activeText
		)
		.map((row) => ({
			replacedAt: row.createdAt.toISOString(),
			text: row.previousValue ?? "",
		}));
	return {
		cards,
		context: {
			id: contextId,
			kind: work ? "work" : "project",
			title: work?.title ?? project.name,
		},
		copy: {
			empty: RETURN_TO_WORK_COPY.empty,
			lastUpdated: RETURN_TO_WORK_COPY.lastUpdated,
			nextConcreteStep: RETURN_TO_WORK_COPY.nextConcreteStep,
			openSourceRecord: RETURN_TO_WORK_COPY.openSourceRecord,
			returnToWork: RETURN_TO_WORK_COPY.returnToWork,
			save: RETURN_TO_WORK_COPY.save,
		},
		nextConcreteStep:
			activeText && step.updatedAt
				? {
						openSourceRecord: RETURN_TO_WORK_COPY.openSourceRecord,
						sourceHref: work
							? workSourceHref(project.id, work.id)
							: projectSourceHref(project.id),
						sourceKey: work?.key ?? project.shortCode,
						sourceTitle: work?.title ?? project.name,
						text: activeText,
						updatedAt: step.updatedAt.toISOString(),
						updatedAtDisplay: formatDateTime(step.updatedAt, preferences),
					}
				: null,
		nextConcreteStepHistory: previousValues,
		restores: RETURN_TO_WORK_RESTORES,
		session: RETURN_TO_WORK_SESSION,
		snapshot: RETURN_TO_WORK_SNAPSHOT,
	};
}

async function loadCurrentRecords(
	db: MutationDb,
	accountId: string,
	projectId: string
): Promise<ReturnSourceRecord[]> {
	const works = await db.work.findMany({
		where: {
			archived: false,
			projectId,
			retiredIntoId: null,
			trashedAt: null,
		},
	});
	const views = hasDelegate(db, "returnToWorkVisibleOpen")
		? await db.returnToWorkVisibleOpen.findMany({
				where: {
					accountId,
					sourceId: { in: works.map((row) => row.id) },
					sourceKind: "work",
				},
			})
		: [];
	const viewedAtByWork = new Map(
		views.map((row) => [row.sourceId, row.viewedAt.toISOString()])
	);
	const workRecords: ReturnSourceRecord[] = works.map((row) => ({
		editedAt: row.updatedAt.toISOString(),
		href: workSourceHref(row.projectId, row.id),
		id: row.id,
		key: row.key,
		kind: "work",
		openRisk: false,
		pendingGitHubDevelopmentSignal: false,
		title: row.title,
		upcomingDate: upcomingDateOf(row),
		viewedAt: viewedAtByWork.get(row.id) ?? null,
	}));
	return [
		...workRecords,
		...loadOpenRiskRecords(),
		...loadPendingGitHubSignalRecords(),
	];
}

function upcomingDateOf(row: {
	plannedStart: string | null;
	reappearDate: string | null;
	targetDate: string | null;
}): string | null {
	return row.targetDate ?? row.plannedStart ?? row.reappearDate;
}

function loadOpenRiskRecords(): ReturnSourceRecord[] {
	return [];
}

function loadPendingGitHubSignalRecords(): ReturnSourceRecord[] {
	return [];
}
