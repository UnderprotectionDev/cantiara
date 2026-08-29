import type { Prisma, PrismaClient } from "@cantiara/db";

import {
	advisoryKeys,
	HUMAN_ORIGIN,
	isRecord,
	MUTATION_ACTOR,
	MUTATION_COPY,
	payloadFingerprint,
} from "../../mutation-core/server/mutation-shared";
import type { WorkType } from "../../work-lifecycle/server/work-lifecycle-model";
import {
	type ApplyWorkContextLayoutPayload,
	applyWorkContextLayoutPayloadSchema,
	defaultLayoutSections,
	type LayoutSection,
	layoutSectionSchema,
	WORK_CONTEXT_COPY,
	type WorkContextCardLayoutView,
} from "./work-context-model";

type PrismaTransaction = Prisma.TransactionClient;

export type WorkContextLayoutOutcome =
	| { layout: WorkContextCardLayoutView; status: "committed" }
	| { layout: WorkContextCardLayoutView; status: "replayed" }
	| { conflict: "Conflict"; status: "conflict" }
	| { reason: WorkContextLayoutRejection; status: "rejected" };

export type WorkContextLayoutRejection =
	| "free-query-not-allowed"
	| "missing-idempotency-key"
	| "target-not-found"
	| "unsupported-condition"
	| "unknown-work-type";

export interface LayoutChangePreview {
	affectedWorkTypes: WorkType[];
	copy: {
		impactPreview: typeof WORK_CONTEXT_COPY.impactPreview;
	};
	sectionDiff: {
		added: string[];
		hidden: string[];
		reordered: boolean;
		shown: string[];
	};
	shareScope: {
		buildInPublic: false;
		linkSharing: false;
	};
}

export async function getWorkContextCardLayout(
	prisma: PrismaClient | PrismaTransaction,
	projectId: string,
	workType: WorkType
): Promise<WorkContextCardLayoutView> {
	const row = await prisma.projectWorkContextLayout.findUnique({
		where: {
			projectId_workType: { projectId, workType },
		},
	});
	if (!row) {
		return {
			projectId,
			revision: 1,
			sections: defaultLayoutSections(workType),
			workType,
		};
	}
	return {
		projectId,
		revision: row.revision,
		sections: parseSections(row.sections),
		workType,
	};
}

export async function listWorkContextCardLayoutSummaries(
	prisma: PrismaClient | PrismaTransaction,
	projectId: string
): Promise<Array<{ revision: number; workType: string }>> {
	const rows = await prisma.projectWorkContextLayout.findMany({
		orderBy: { workType: "asc" },
		select: { revision: true, workType: true },
		where: { projectId },
	});
	return rows.map((row) => ({
		revision: row.revision,
		workType: row.workType,
	}));
}

export function previewWorkContextLayoutChange(
	current: readonly LayoutSection[],
	proposed: readonly LayoutSection[],
	workType: WorkType
): LayoutChangePreview {
	const currentShown = current
		.filter((section) => !section.hidden)
		.map((section) => section.name);
	const proposedShown = proposed
		.filter((section) => !section.hidden)
		.map((section) => section.name);
	const currentSet = new Set(currentShown);
	const proposedSet = new Set(proposedShown);
	return {
		affectedWorkTypes: [workType],
		copy: { impactPreview: WORK_CONTEXT_COPY.impactPreview },
		sectionDiff: {
			added: proposedShown.filter((name) => !currentSet.has(name)),
			hidden: currentShown.filter((name) => !proposedSet.has(name)),
			reordered: currentShown.join("|") !== proposedShown.join("|"),
			shown: proposedShown.filter((name) => !currentSet.has(name)),
		},
		shareScope: { buildInPublic: false, linkSharing: false },
	};
}

export async function applyWorkContextLayout(
	prisma: PrismaClient,
	command: unknown
): Promise<WorkContextLayoutOutcome> {
	const parsed = parseApplyCommand(command);
	if (parsed.status !== "ok") {
		return parsed.outcome;
	}
	const fingerprint = payloadFingerprint(parsed.command.payload);
	const commandKey = commandKeyFor(
		parsed.command.actorId,
		parsed.command.idempotencyKey
	);
	return await prisma.$transaction((tx) =>
		applyInTransaction(tx, parsed.command, commandKey, fingerprint)
	);
}

export async function undoWorkContextLayout(
	prisma: PrismaClient,
	command: unknown
): Promise<WorkContextLayoutOutcome> {
	if (!isRecord(command)) {
		return { reason: "missing-idempotency-key", status: "rejected" };
	}
	if (
		typeof command.idempotencyKey !== "string" ||
		command.idempotencyKey.length === 0
	) {
		return { reason: "missing-idempotency-key", status: "rejected" };
	}
	const { actorId, idempotencyKey, projectId, workType: rawWorkType } = command;
	if (typeof actorId !== "string" || typeof projectId !== "string") {
		return { reason: "target-not-found", status: "rejected" };
	}
	if (typeof rawWorkType !== "string") {
		return { reason: "unknown-work-type", status: "rejected" };
	}
	const workType = parseWorkType(rawWorkType);
	if (!workType) {
		return { reason: "unknown-work-type", status: "rejected" };
	}
	const fingerprint = payloadFingerprint({
		projectId,
		undo: true,
		workType,
	});
	const commandKey = commandKeyFor(actorId, idempotencyKey);
	return await prisma.$transaction((tx) =>
		undoInTransaction(
			tx,
			{
				actorId,
				idempotencyKey,
				projectId,
				workType,
			},
			commandKey,
			fingerprint
		)
	);
}

export async function cloneWorkContextCardLayouts(
	tx: PrismaTransaction,
	sourceProjectId: string,
	targetProjectId: string
): Promise<Array<{ revision: number; workType: string }>> {
	const source = await tx.projectWorkContextLayout.findMany({
		orderBy: { workType: "asc" },
		where: { projectId: sourceProjectId },
	});
	if (source.length === 0) {
		return [];
	}
	const cloned = source.map((layout) => {
		const id = crypto.randomUUID();
		return {
			id,
			projectId: targetProjectId,
			revision: 1,
			sections: parseSections(layout.sections),
			workType: layout.workType,
		};
	});
	await tx.projectWorkContextLayout.createMany({ data: cloned });
	await tx.projectWorkContextLayoutRevision.createMany({
		data: cloned.map((layout) => ({
			id: crypto.randomUUID(),
			layoutId: layout.id,
			revision: 1,
			sections: layout.sections,
		})),
	});
	return cloned.map((layout) => ({
		revision: layout.revision,
		workType: layout.workType,
	}));
}

function parseApplyCommand(command: unknown):
	| {
			command: {
				actorId: string;
				idempotencyKey: string;
				payload: ApplyWorkContextLayoutPayload;
			};
			status: "ok";
	  }
	| { outcome: WorkContextLayoutOutcome; status: "rejected" } {
	if (!isRecord(command)) {
		return {
			outcome: { reason: "missing-idempotency-key", status: "rejected" },
			status: "rejected",
		};
	}
	if (
		typeof command.idempotencyKey !== "string" ||
		command.idempotencyKey.length === 0
	) {
		return {
			outcome: { reason: "missing-idempotency-key", status: "rejected" },
			status: "rejected",
		};
	}
	if (hasFreeQuery(command) || hasFreeQuery(command.payload)) {
		return {
			outcome: { reason: "free-query-not-allowed", status: "rejected" },
			status: "rejected",
		};
	}
	const payload = applyWorkContextLayoutPayloadSchema.safeParse(
		command.payload
	);
	if (!payload.success || typeof command.actorId !== "string") {
		return {
			outcome: { reason: "unsupported-condition", status: "rejected" },
			status: "rejected",
		};
	}
	const sections = validateSections(payload.data.sections);
	if (sections.status !== "ok") {
		return { outcome: sections.outcome, status: "rejected" };
	}
	return {
		command: {
			actorId: command.actorId,
			idempotencyKey: command.idempotencyKey,
			payload: { ...payload.data, sections: sections.sections },
		},
		status: "ok",
	};
}

function validateSections(
	sections: readonly LayoutSection[]
):
	| { outcome: WorkContextLayoutOutcome; status: "rejected" }
	| { sections: LayoutSection[]; status: "ok" } {
	const parsed: LayoutSection[] = [];
	for (const section of sections) {
		const result = layoutSectionSchema.safeParse(section);
		if (!(result.success && customConditionOk(result.data))) {
			return {
				outcome: { reason: "unsupported-condition", status: "rejected" },
				status: "rejected",
			};
		}
		parsed.push(result.data);
	}
	return { sections: parsed, status: "ok" };
}

function customConditionOk(section: LayoutSection): boolean {
	if (section.kind !== "custom") {
		return true;
	}
	const { condition } = section;
	if (!condition) {
		return false;
	}
	return (
		condition.recordType !== undefined ||
		condition.relationType !== undefined ||
		condition.evidenceRole !== undefined ||
		condition.status !== undefined
	);
}

function hasFreeQuery(value: unknown): boolean {
	if (!isRecord(value)) {
		return false;
	}
	return (
		"query" in value ||
		"formula" in value ||
		"chart" in value ||
		"operator" in value ||
		"workspaceQuery" in value
	);
}

async function applyInTransaction(
	tx: PrismaTransaction,
	command: {
		actorId: string;
		idempotencyKey: string;
		payload: ApplyWorkContextLayoutPayload;
	},
	commandKey: string,
	fingerprint: string
): Promise<WorkContextLayoutOutcome> {
	const project = await tx.project.findUnique({
		where: { id: command.payload.projectId },
	});
	if (!project) {
		return { reason: "target-not-found", status: "rejected" };
	}
	await lockLayout(tx, project.id, command.payload.workType);
	const replayed = await replayOrConflict(tx, commandKey, fingerprint);
	if (replayed) {
		return replayed;
	}
	const existing = await tx.projectWorkContextLayout.findUnique({
		where: {
			projectId_workType: {
				projectId: project.id,
				workType: command.payload.workType,
			},
		},
	});
	const nextRevision = existing ? existing.revision + 1 : 1;
	const layoutId = existing?.id ?? crypto.randomUUID();
	if (existing) {
		await tx.projectWorkContextLayout.update({
			data: {
				revision: nextRevision,
				sections: command.payload.sections,
			},
			where: { id: existing.id },
		});
	} else {
		await tx.projectWorkContextLayout.create({
			data: {
				id: layoutId,
				projectId: project.id,
				revision: nextRevision,
				sections: command.payload.sections,
				workType: command.payload.workType,
			},
		});
	}
	await tx.projectWorkContextLayoutRevision.create({
		data: {
			id: crypto.randomUUID(),
			layoutId,
			revision: nextRevision,
			sections: command.payload.sections,
		},
	});
	const layout: WorkContextCardLayoutView = {
		projectId: project.id,
		revision: nextRevision,
		sections: command.payload.sections,
		workType: command.payload.workType,
	};
	await writeReceipt(tx, {
		actorId: command.actorId,
		commandKey,
		fingerprint,
		layout,
	});
	return { layout, status: "committed" };
}

async function undoInTransaction(
	tx: PrismaTransaction,
	command: {
		actorId: string;
		idempotencyKey: string;
		projectId: string;
		workType: WorkType;
	},
	commandKey: string,
	fingerprint: string
): Promise<WorkContextLayoutOutcome> {
	const project = await tx.project.findUnique({
		where: { id: command.projectId },
	});
	if (!project) {
		return { reason: "target-not-found", status: "rejected" };
	}
	await lockLayout(tx, project.id, command.workType);
	const replayed = await replayOrConflict(tx, commandKey, fingerprint);
	if (replayed) {
		return replayed;
	}
	const existing = await tx.projectWorkContextLayout.findUnique({
		where: {
			projectId_workType: {
				projectId: project.id,
				workType: command.workType,
			},
		},
	});
	const previous = existing
		? await tx.projectWorkContextLayoutRevision.findUnique({
				where: {
					layoutId_revision: {
						layoutId: existing.id,
						revision: existing.revision - 1,
					},
				},
			})
		: null;
	const sections = previous
		? parseSections(previous.sections)
		: defaultLayoutSections(command.workType);
	const layoutId = existing?.id ?? crypto.randomUUID();
	const nextRevision = existing ? existing.revision + 1 : 1;
	if (existing) {
		await tx.projectWorkContextLayout.update({
			data: { revision: nextRevision, sections },
			where: { id: existing.id },
		});
	} else {
		await tx.projectWorkContextLayout.create({
			data: {
				id: layoutId,
				projectId: project.id,
				revision: nextRevision,
				sections,
				workType: command.workType,
			},
		});
	}
	await tx.projectWorkContextLayoutRevision.create({
		data: {
			id: crypto.randomUUID(),
			layoutId,
			revision: nextRevision,
			sections,
		},
	});
	const layout: WorkContextCardLayoutView = {
		projectId: project.id,
		revision: nextRevision,
		sections,
		workType: command.workType,
	};
	await writeReceipt(tx, {
		actorId: command.actorId,
		commandKey,
		fingerprint,
		layout,
	});
	return { layout, status: "committed" };
}

async function replayOrConflict(
	tx: PrismaTransaction,
	commandKey: string,
	fingerprint: string
): Promise<WorkContextLayoutOutcome | null> {
	const existing = await tx.mutationReceipt.findUnique({
		where: { commandKey },
	});
	if (!existing) {
		return null;
	}
	if (existing.payloadFingerprint !== fingerprint) {
		return { conflict: MUTATION_COPY.conflict, status: "conflict" };
	}
	const stored = storedLayout(existing.resultValue);
	if (!stored) {
		return { conflict: MUTATION_COPY.conflict, status: "conflict" };
	}
	return { layout: stored, status: "replayed" };
}

async function writeReceipt(
	tx: PrismaTransaction,
	input: {
		actorId: string;
		commandKey: string;
		fingerprint: string;
		layout: WorkContextCardLayoutView;
	}
): Promise<void> {
	await tx.mutationReceipt.create({
		data: {
			actorId: input.actorId,
			actorType: MUTATION_ACTOR.user,
			commandKey: input.commandKey,
			committedRevision: input.layout.revision,
			id: crypto.randomUUID(),
			origin: HUMAN_ORIGIN,
			payloadFingerprint: input.fingerprint,
			resultValue: JSON.stringify(input.layout),
			targetId: `${input.layout.projectId}:${input.layout.workType}`,
		},
	});
}

async function lockLayout(
	tx: PrismaTransaction,
	projectId: string,
	workType: string
): Promise<void> {
	const [lockA, lockB] = advisoryKeys(
		`work-context:layout:${projectId}:${workType}`
	);
	await tx.$executeRaw`SELECT pg_advisory_xact_lock(${lockA}, ${lockB})`;
}

function storedLayout(value: string): WorkContextCardLayoutView | null {
	try {
		const parsed: unknown = JSON.parse(value);
		if (!isRecord(parsed)) {
			return null;
		}
		return {
			projectId: String(parsed.projectId),
			revision: Number(parsed.revision),
			sections: parseSections(parsed.sections),
			workType: String(parsed.workType) as WorkType,
		};
	} catch {
		return null;
	}
}

function parseSections(value: unknown): LayoutSection[] {
	if (!Array.isArray(value)) {
		return [];
	}
	return value.flatMap((item) => {
		const parsed = layoutSectionSchema.safeParse(item);
		return parsed.success ? [parsed.data] : [];
	});
}

function parseWorkType(value: string): WorkType | null {
	if (
		value === "Bug" ||
		value === "Feature" ||
		value === "Improvement" ||
		value === "Research" ||
		value === "Task"
	) {
		return value;
	}
	return null;
}

function commandKeyFor(actorId: string, idempotencyKey: string): string {
	return `human:${actorId}:${idempotencyKey}`;
}
