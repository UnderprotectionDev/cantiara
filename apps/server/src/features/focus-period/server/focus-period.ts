import {
	calendarDay,
	getAccountPreferences,
	instantFromCalendarDate,
} from "@cantiara/auth";
import type { Prisma, PrismaClient } from "@cantiara/db";

import { projectDependencies } from "../../blockers/server/blockers";
import {
	lockMutation,
	readDurableReceipt,
	writeDurableReceipt,
} from "../../mutation-core/server/durable-mutation";
import {
	HUMAN_ORIGIN,
	MUTATION_COPY,
} from "../../mutation-core/server/mutation-shared";
import {
	applyPlanningMembership,
	closeWorkInTransaction,
	createWorkInTransaction,
} from "../../work-lifecycle/server/work-lifecycle";
import {
	CLOSURE_RESULT,
	WORK_STATUS,
} from "../../work-lifecycle/server/work-lifecycle-model";
import {
	calendarDaySchema,
	emptyFocusPeriodDependencies,
	FOCUS_PERIOD_CLOSE_JUDGEMENT,
	FOCUS_PERIOD_COPY,
	FOCUS_PERIOD_COUNTERPARTS,
	FOCUS_PERIOD_LEFTOVER_DESTINATION,
	FOCUS_PERIOD_PLANNING_WRITES,
	FOCUS_PERIOD_STATUS,
	FOCUS_PERIOD_STILL_OPEN,
	type FocusPeriodLeftoverDestination,
	type FocusPeriodStatus,
	type FocusPeriodView,
	type FocusPeriodWork,
	focusPeriodCatalog,
	isFocusPeriodWindow,
	sourceRecordHref,
} from "./focus-period-model";

type MutationDb = PrismaClient | Prisma.TransactionClient;

function hasDelegate(
	db: MutationDb,
	name: "focusPeriod" | "focusPeriodMembership"
): boolean {
	const delegate = (db as unknown as Record<string, { findMany?: unknown }>)[
		name
	];
	return typeof delegate?.findMany === "function";
}

export type FocusPeriodOutcome =
	| { period: FocusPeriodView; status: "committed" }
	| { reason: typeof MUTATION_COPY.conflict; status: "conflict" }
	| { reason: string; status: "invalid" }
	| { status: "not-found" };

interface CreateCommand {
	endDate: string;
	idempotencyKey: string;
	purpose: string;
	startDate: string;
}

interface MembershipCommand {
	idempotencyKey: string;
	periodId: string;
	workId: string;
}

interface PeriodCommand {
	idempotencyKey: string;
	periodId: string;
}

interface LeftoverSelection {
	destination: FocusPeriodLeftoverDestination;
	periodId?: string;
	workId: string;
}

interface DecideStillOpenCommand {
	idempotencyKey: string;
	periodId: string;
	selections: LeftoverSelection[];
}

interface EvaluateCommand {
	change?: string;
	idempotencyKey: string;
	keep?: string;
	periodId: string;
	skipped: boolean;
	tryNext?: string;
}

interface FollowUpCommand {
	idempotencyKey: string;
	periodId: string;
	previewAcknowledged?: boolean;
	projectId: string;
	title: string;
}

export type FollowUpPreviewOutcome =
	| {
			preview: {
				generatedActionItems: false;
				projectId: string;
				relation: {
					kind: "source-period";
					sourcePeriodId: string;
				};
				sourcePeriodId: string;
				title: string;
			};
			status: "committed";
	  }
	| { reason: string; status: "invalid" }
	| { status: "not-found" };

export interface FocusPeriod {
	activePeriodIdForWork: (workId: string) => Promise<string | null>;
	add: (input: MembershipCommand) => Promise<FocusPeriodOutcome>;
	cancel: (input: PeriodCommand) => Promise<FocusPeriodOutcome>;
	catalog: () => ReturnType<typeof focusPeriodCatalog>;
	close: (input: PeriodCommand) => Promise<FocusPeriodOutcome>;
	confirmFollowUp: (input: FollowUpCommand) => Promise<FocusPeriodOutcome>;
	create: (input: CreateCommand) => Promise<FocusPeriodOutcome>;
	decideStillOpen: (
		input: DecideStillOpenCommand
	) => Promise<FocusPeriodOutcome>;
	evaluate: (input: EvaluateCommand) => Promise<FocusPeriodOutcome>;
	get: (periodId: string) => Promise<FocusPeriodView | null>;
	list: () => Promise<FocusPeriodView[]>;
	move: (input: MembershipCommand) => Promise<FocusPeriodOutcome>;
	previewFollowUp: (input: FollowUpCommand) => Promise<FollowUpPreviewOutcome>;
	remove: (input: MembershipCommand) => Promise<FocusPeriodOutcome>;
}

export interface CreateFocusPeriodInput {
	accountId: string;
	clock?: { now: () => Date };
	prisma: PrismaClient;
	workspaceId: string;
}

export function createFocusPeriod(input: CreateFocusPeriodInput): FocusPeriod {
	const now = () => {
		if (input.clock) {
			return input.clock.now();
		}
		return new Date();
	};

	async function list(): Promise<FocusPeriodView[]> {
		if (!hasDelegate(input.prisma, "focusPeriod")) {
			return [];
		}
		return await input.prisma.$transaction(async (tx) => {
			await activateDuePeriods(tx, input, now());
			const rows = await tx.focusPeriod.findMany({
				orderBy: { startDate: "asc" },
				where: { workspaceId: input.workspaceId },
			});
			return await Promise.all(rows.map((row) => toView(tx, input, row)));
		});
	}

	async function get(periodId: string): Promise<FocusPeriodView | null> {
		if (!hasDelegate(input.prisma, "focusPeriod")) {
			return null;
		}
		return await input.prisma.$transaction(async (tx) => {
			const row = await loadPeriod(tx, input.workspaceId, periodId);
			if (!row) {
				return null;
			}
			const current = await activateIfDue(tx, input, row, now());
			return await toView(tx, input, current);
		});
	}

	async function create(command: CreateCommand): Promise<FocusPeriodOutcome> {
		const purpose = command.purpose.trim();
		const startDate = calendarDaySchema.safeParse(command.startDate);
		const endDate = calendarDaySchema.safeParse(command.endDate);
		if (
			!(
				startDate.success &&
				endDate.success &&
				isFocusPeriodWindow(startDate.data, endDate.data)
			)
		) {
			return {
				reason: FOCUS_PERIOD_COPY.windowMustBeOneToEightWeeks,
				status: "invalid",
			};
		}
		if (purpose.length === 0) {
			return {
				reason: FOCUS_PERIOD_COPY.purposeRequired,
				status: "invalid",
			};
		}
		if (!hasDelegate(input.prisma, "focusPeriod")) {
			return { status: "not-found" };
		}
		const payload = {
			endDate: endDate.data,
			purpose,
			startDate: startDate.data,
			workspaceId: input.workspaceId,
		};
		return await input.prisma.$transaction(async (tx) => {
			await lockMutation(tx, `focus-period:${input.workspaceId}:create`);
			const existing = await readDurableReceipt(
				tx,
				command.idempotencyKey,
				payload
			);
			if (existing?.kind === "conflict") {
				return { reason: MUTATION_COPY.conflict, status: "conflict" };
			}
			if (existing?.kind === "replay") {
				return JSON.parse(existing.resultValue) as FocusPeriodOutcome;
			}
			const created = await tx.focusPeriod.create({
				data: {
					endDate: endDate.data,
					id: crypto.randomUUID(),
					purpose,
					startDate: startDate.data,
					status: FOCUS_PERIOD_STATUS.planned,
					workspaceId: input.workspaceId,
				},
			});
			const period = await toView(tx, input, created);
			const outcome: FocusPeriodOutcome = { period, status: "committed" };
			await writeDurableReceipt(tx, {
				actorId: input.accountId,
				commandKey: command.idempotencyKey,
				kind: "focus-period-create",
				payload,
				resultValue: JSON.stringify(outcome),
				targetId: created.id,
			});
			return outcome;
		});
	}

	async function add(command: MembershipCommand): Promise<FocusPeriodOutcome> {
		return await mutateMembership(input, now, command, "add");
	}

	async function move(command: MembershipCommand): Promise<FocusPeriodOutcome> {
		return await mutateMembership(input, now, command, "move");
	}

	async function remove(
		command: MembershipCommand
	): Promise<FocusPeriodOutcome> {
		return await mutateMembership(input, now, command, "remove");
	}

	async function close(command: PeriodCommand): Promise<FocusPeriodOutcome> {
		return await endPeriod(input, now, command, "close");
	}

	async function cancel(command: PeriodCommand): Promise<FocusPeriodOutcome> {
		return await endPeriod(input, now, command, "cancel");
	}

	async function decideStillOpen(
		command: DecideStillOpenCommand
	): Promise<FocusPeriodOutcome> {
		return await decideLeftovers(input, now, command);
	}

	async function evaluate(
		command: EvaluateCommand
	): Promise<FocusPeriodOutcome> {
		return await saveEvaluation(input, now, command);
	}

	async function previewFollowUp(
		command: FollowUpCommand
	): Promise<FollowUpPreviewOutcome> {
		if (!hasDelegate(input.prisma, "focusPeriod")) {
			return { status: "not-found" };
		}
		const row = await loadPeriod(
			input.prisma,
			input.workspaceId,
			command.periodId
		);
		if (!row || row.status !== FOCUS_PERIOD_STATUS.closed) {
			return { status: "not-found" };
		}
		const title = command.title.trim();
		if (title.length === 0) {
			return {
				reason: FOCUS_PERIOD_COPY.purposeRequired,
				status: "invalid",
			};
		}
		const project = await input.prisma.project.findFirst({
			where: { id: command.projectId, workspaceId: input.workspaceId },
		});
		if (!project) {
			return { status: "not-found" };
		}
		return {
			preview: {
				generatedActionItems: false,
				projectId: command.projectId,
				relation: {
					kind: "source-period" as const,
					sourcePeriodId: command.periodId,
				},
				sourcePeriodId: command.periodId,
				title,
			},
			status: "committed",
		};
	}

	async function confirmFollowUp(
		command: FollowUpCommand
	): Promise<FocusPeriodOutcome> {
		return await createFollowUp(input, now, command);
	}

	async function activePeriodIdForWork(workId: string): Promise<string | null> {
		if (!hasDelegate(input.prisma, "focusPeriodMembership")) {
			return null;
		}
		return await input.prisma.$transaction(async (tx) => {
			await activateDuePeriods(tx, input, now());
			const membership = await tx.focusPeriodMembership.findFirst({
				include: { focusPeriod: true },
				where: {
					focusPeriod: {
						status: FOCUS_PERIOD_STATUS.active,
						workspaceId: input.workspaceId,
					},
					workId,
				},
			});
			return membership?.focusPeriodId ?? null;
		});
	}

	return {
		activePeriodIdForWork,
		add,
		cancel,
		catalog: () => focusPeriodCatalog(),
		close,
		confirmFollowUp,
		create,
		decideStillOpen,
		evaluate,
		get,
		list,
		move,
		previewFollowUp,
		remove,
	};
}

async function mutateMembership(
	input: CreateFocusPeriodInput,
	now: () => Date,
	command: MembershipCommand,
	operation: "add" | "move" | "remove"
): Promise<FocusPeriodOutcome> {
	if (!hasDelegate(input.prisma, "focusPeriod")) {
		return { status: "not-found" };
	}
	const payload = {
		operation,
		periodId: command.periodId,
		workId: command.workId,
		workspaceId: input.workspaceId,
	};
	return await input.prisma.$transaction(async (tx) => {
		await lockMutation(
			tx,
			`focus-period:${input.workspaceId}:work:${command.workId}`
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
			return JSON.parse(existing.resultValue) as FocusPeriodOutcome;
		}
		const membershipError = await applyMembership(
			tx,
			input,
			command,
			operation
		);
		if (membershipError) {
			return membershipError;
		}
		const next = await loadPeriod(tx, input.workspaceId, command.periodId);
		if (!next) {
			return { status: "not-found" };
		}
		const activated = await activateIfDue(tx, input, next, now());
		const period = await toView(tx, input, activated);
		const outcome: FocusPeriodOutcome = { period, status: "committed" };
		await writeDurableReceipt(tx, {
			actorId: input.accountId,
			commandKey: command.idempotencyKey,
			kind: `focus-period-${operation}`,
			payload,
			resultValue: JSON.stringify(outcome),
			targetId: command.periodId,
		});
		return outcome;
	});
}

async function applyMembership(
	tx: MutationDb,
	input: CreateFocusPeriodInput,
	command: MembershipCommand,
	operation: "add" | "move" | "remove"
): Promise<FocusPeriodOutcome | null> {
	const row = await loadPeriod(tx, input.workspaceId, command.periodId);
	if (!row) {
		return { status: "not-found" };
	}
	if (
		row.status === FOCUS_PERIOD_STATUS.closed ||
		row.status === FOCUS_PERIOD_STATUS.canceled
	) {
		return { status: "not-found" };
	}
	const work = await tx.work.findFirst({
		where: {
			archived: false,
			id: command.workId,
			project: { workspaceId: input.workspaceId },
			retiredIntoId: null,
			trashedAt: null,
		},
	});
	if (!work) {
		return { status: "not-found" };
	}
	if (operation === "remove") {
		await tx.focusPeriodMembership.deleteMany({
			where: { focusPeriodId: row.id, workId: command.workId },
		});
		return null;
	}
	const otherActiveId = await otherActivePeriodId(
		tx,
		input.workspaceId,
		command.workId,
		row.id
	);
	if (otherActiveId && operation === "add") {
		return {
			reason: FOCUS_PERIOD_COPY.alreadyInAnActivePeriod,
			status: "invalid",
		};
	}
	if (otherActiveId && operation === "move") {
		await tx.focusPeriodMembership.deleteMany({
			where: {
				focusPeriodId: otherActiveId,
				workId: command.workId,
			},
		});
	}
	await ensureMembership(tx, row.id, command.workId);
	return null;
}

async function ensureMembership(
	tx: MutationDb,
	focusPeriodId: string,
	workId: string
) {
	const already = await tx.focusPeriodMembership.findUnique({
		where: {
			focusPeriodId_workId: {
				focusPeriodId,
				workId,
			},
		},
	});
	if (already) {
		return;
	}
	await tx.focusPeriodMembership.create({
		data: {
			focusPeriodId,
			id: crypto.randomUUID(),
			workId,
		},
	});
}

async function endPeriod(
	input: CreateFocusPeriodInput,
	now: () => Date,
	command: PeriodCommand,
	operation: "cancel" | "close"
): Promise<FocusPeriodOutcome> {
	if (!hasDelegate(input.prisma, "focusPeriod")) {
		return { status: "not-found" };
	}
	const payload = {
		operation,
		periodId: command.periodId,
		workspaceId: input.workspaceId,
	};
	return await input.prisma.$transaction(async (tx) => {
		await lockMutation(
			tx,
			`focus-period:${input.workspaceId}:${command.periodId}`
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
			return JSON.parse(existing.resultValue) as FocusPeriodOutcome;
		}
		const row = await loadPeriod(tx, input.workspaceId, command.periodId);
		if (!row) {
			return { status: "not-found" };
		}
		const current = await activateIfDue(tx, input, row, now());
		if (
			current.status === FOCUS_PERIOD_STATUS.closed ||
			current.status === FOCUS_PERIOD_STATUS.canceled
		) {
			return { status: "not-found" };
		}
		if (
			operation === "close" &&
			current.status !== FOCUS_PERIOD_STATUS.active
		) {
			return { status: "not-found" };
		}
		const members = await loadMembers(tx, current.id);
		const workIds = members.map((member) => member.id);
		const updated =
			operation === "close"
				? await tx.focusPeriod.update({
						data: {
							closeCompletedWorkIds: members
								.filter(
									(member) =>
										member.status === WORK_STATUS.closed &&
										member.closureResult === CLOSURE_RESULT.completed
								)
								.map((member) => member.id),
							closedAt: now(),
							closeScopeLocked: true,
							closeScopeWorkIds: workIds,
							closeStillOpenWorkIds: members
								.filter((member) => member.status !== WORK_STATUS.closed)
								.map((member) => member.id),
							status: FOCUS_PERIOD_STATUS.closed,
							stillOpenDecisionOpened: true,
						},
						where: { id: current.id },
					})
				: await tx.focusPeriod.update({
						data: {
							status: FOCUS_PERIOD_STATUS.canceled,
						},
						where: { id: current.id },
					});
		const period = await toView(tx, input, updated);
		const outcome: FocusPeriodOutcome = { period, status: "committed" };
		await writeDurableReceipt(tx, {
			actorId: input.accountId,
			commandKey: command.idempotencyKey,
			kind: `focus-period-${operation}`,
			payload,
			resultValue: JSON.stringify(outcome),
			targetId: current.id,
		});
		return outcome;
	});
}

async function activateDuePeriods(
	tx: MutationDb,
	input: CreateFocusPeriodInput,
	instant: Date
) {
	if (!hasDelegate(tx, "focusPeriod")) {
		return;
	}
	const planned = await tx.focusPeriod.findMany({
		where: {
			status: FOCUS_PERIOD_STATUS.planned,
			workspaceId: input.workspaceId,
		},
	});
	await Promise.all(
		planned.map((row) => activateIfDue(tx, input, row, instant))
	);
}

async function activateIfDue(
	tx: MutationDb,
	input: CreateFocusPeriodInput,
	row: PeriodRow,
	instant: Date
): Promise<PeriodRow> {
	if (row.status !== FOCUS_PERIOD_STATUS.planned) {
		return row;
	}
	const due = await hasReachedStart(
		tx,
		input.accountId,
		row.startDate,
		instant
	);
	if (!due) {
		return row;
	}
	const members = await loadMembers(tx, row.id);
	return await tx.focusPeriod.update({
		data: {
			startScopeLocked: true,
			startScopeTargetDates: members.map((member) => ({
				targetDate: member.targetDate,
				workId: member.id,
			})),
			startScopeWorkIds: members.map((member) => member.id),
			status: FOCUS_PERIOD_STATUS.active,
		},
		where: { id: row.id },
	});
}

async function hasReachedStart(
	db: MutationDb,
	accountId: string,
	startDate: string,
	instant: Date
): Promise<boolean> {
	const preferences = await getAccountPreferences(
		db as PrismaClient,
		accountId
	);
	return (
		instant.getTime() >=
		instantFromCalendarDate(startDate, preferences).getTime()
	);
}

async function loadPeriod(
	db: MutationDb,
	workspaceId: string,
	periodId: string
) {
	return await db.focusPeriod.findFirst({
		where: { id: periodId, workspaceId },
	});
}

async function toView(
	db: MutationDb,
	input: CreateFocusPeriodInput,
	row: PeriodRow
): Promise<FocusPeriodView> {
	const members = await loadMembers(db, row.id);
	const memberViews = members.map(withoutStatus);
	const memberIds = new Set(memberViews.map((member) => member.id));
	const eligibleWork = (await loadEligibleWork(db, input.workspaceId)).filter(
		(work) => !memberIds.has(work.id)
	);
	const activeByWork = await activePeriodIdsForWorks(
		db,
		input.workspaceId,
		eligibleWork.map((work) => work.id)
	);
	const eligible = eligibleWork.map((work) => ({
		...work,
		activePeriodId: activeByWork.get(work.id) ?? null,
	}));
	const startScope = row.startScopeLocked
		? { workIds: asWorkIds(row.startScopeWorkIds) }
		: null;
	const closeScope = row.closeScopeLocked
		? { workIds: asWorkIds(row.closeScopeWorkIds) }
		: null;
	const decidedWorkIds = new Set(
		leftoverDecisions(row).map((decision) => decision.workId)
	);
	const stillOpenIds = new Set(
		row.stillOpenDecisionOpened
			? members
					.filter((member) => member.status !== WORK_STATUS.closed)
					.filter((member) => !decidedWorkIds.has(member.id))
					.map((member) => member.id)
			: []
	);
	const stillOpen = members
		.filter((member) => stillOpenIds.has(member.id))
		.map(withoutStatus);
	const destinations = await leftoverDestinations(db, input.workspaceId, row);
	const comparison =
		row.status === FOCUS_PERIOD_STATUS.closed
			? await closeComparison(db, row, members)
			: null;
	const dateComparison =
		row.status === FOCUS_PERIOD_STATUS.closed
			? await dateComparisonFor(db, input, row, members)
			: null;
	const evaluation =
		row.status === FOCUS_PERIOD_STATUS.closed
			? await evaluationView(db, row)
			: null;
	const dependencies = await periodDependencies(db, memberViews);
	return {
		closeScope,
		comparison,
		copy: FOCUS_PERIOD_COPY,
		counterparts: FOCUS_PERIOD_COUNTERPARTS,
		dateComparison,
		dependencies,
		eligibleWork: eligible,
		endDate: row.endDate,
		evaluation,
		id: row.id,
		members: memberViews,
		optional: true,
		planningWrites: FOCUS_PERIOD_PLANNING_WRITES,
		purpose: row.purpose,
		startDate: row.startDate,
		startScope,
		status: row.status as FocusPeriodStatus,
		stillOpenWork: {
			autoRollover: FOCUS_PERIOD_STILL_OPEN.autoRollover,
			decisions: leftoverDecisions(row),
			destinations,
			opened: row.stillOpenDecisionOpened,
			stillOpen,
			writesManualOrder: FOCUS_PERIOD_STILL_OPEN.writesManualOrder,
		},
	};
}

async function periodDependencies(
	db: MutationDb,
	members: readonly FocusPeriodWork[]
) {
	const empty = emptyFocusPeriodDependencies();
	if (members.length === 0) {
		return empty;
	}
	const graph = await projectDependencies(
		db,
		members.map((member) => member.id)
	);
	const workById = new Map(members.map((member) => [member.id, member]));
	const missingWorkIds = graph.nodes
		.filter((node) => node.kind === "Work" && !workById.has(node.id))
		.map((node) => node.id);
	if (missingWorkIds.length > 0) {
		const extra = await db.work.findMany({
			include: { project: true },
			where: { id: { in: missingWorkIds } },
		});
		for (const row of extra) {
			workById.set(row.id, withoutStatus(toWork(row)));
		}
	}
	const nodes = graph.nodes.flatMap((node) => {
		const outgoing = graph.edges.find((edge) => edge.from.id === node.id);
		const projectId =
			node.kind === "Work"
				? workById.get(node.id)?.projectId
				: (workById.get(outgoing?.to.id ?? "")?.projectId ??
					members[0]?.projectId);
		if (!projectId) {
			return [];
		}
		const work = node.kind === "Work" ? workById.get(node.id) : undefined;
		return [
			{
				href: sourceRecordHref(node.kind, node.id, projectId),
				id: node.id,
				kind: node.kind,
				label: work ? `${work.key} ${work.title}` : node.kind,
				openSourceRecord: FOCUS_PERIOD_COPY.openSourceRecord,
			},
		];
	});
	return {
		...empty,
		cycles: graph.cycles,
		edges: graph.edges,
		nodes,
	};
}

async function loadMembers(
	db: MutationDb,
	focusPeriodId: string
): Promise<
	Array<
		FocusPeriodWork & {
			closureResult: string | null;
			status: string;
			targetDate: string | null;
		}
	>
> {
	if (!hasDelegate(db, "focusPeriodMembership")) {
		return [];
	}
	const rows = await db.focusPeriodMembership.findMany({
		include: {
			work: { include: { project: true } },
		},
		orderBy: { createdAt: "asc" },
		where: { focusPeriodId },
	});
	return rows.flatMap((row) => {
		if (row.work.retiredIntoId || row.work.trashedAt) {
			return [];
		}
		return [toWork(row.work)];
	});
}

async function loadEligibleWork(
	db: MutationDb,
	workspaceId: string
): Promise<FocusPeriodWork[]> {
	const rows = await db.work.findMany({
		include: { project: true },
		orderBy: [{ project: { name: "asc" } }, { number: "asc" }],
		where: {
			archived: false,
			project: { workspaceId },
			retiredIntoId: null,
			trashedAt: null,
		},
	});
	return rows.map((row) => withoutStatus(toWork(row)));
}

function withoutStatus(work: FocusPeriodWork): FocusPeriodWork {
	return {
		id: work.id,
		key: work.key,
		projectId: work.projectId,
		projectName: work.projectName,
		title: work.title,
	};
}

function toWork(work: {
	closureResult: string | null;
	id: string;
	key: string;
	project: { id: string; name: string };
	projectId: string;
	status: string;
	targetDate: string | null;
	title: string;
}): FocusPeriodWork & {
	closureResult: string | null;
	status: string;
	targetDate: string | null;
} {
	return {
		closureResult: work.closureResult,
		id: work.id,
		key: work.key,
		projectId: work.projectId,
		projectName: work.project.name,
		status: work.status,
		targetDate: work.targetDate,
		title: work.title,
	};
}

function asWorkIds(value: Prisma.JsonValue): string[] {
	if (!Array.isArray(value)) {
		return [];
	}
	return value.filter((id): id is string => typeof id === "string");
}

async function otherActivePeriodId(
	db: MutationDb,
	workspaceId: string,
	workId: string,
	exceptPeriodId: string
): Promise<string | null> {
	if (!hasDelegate(db, "focusPeriodMembership")) {
		return null;
	}
	const membership = await db.focusPeriodMembership.findFirst({
		where: {
			focusPeriod: {
				id: { not: exceptPeriodId },
				status: FOCUS_PERIOD_STATUS.active,
				workspaceId,
			},
			workId,
		},
	});
	return membership?.focusPeriodId ?? null;
}

async function activePeriodIdsForWorks(
	db: MutationDb,
	workspaceId: string,
	workIds: string[]
): Promise<Map<string, string>> {
	const byWork = new Map<string, string>();
	if (workIds.length === 0 || !hasDelegate(db, "focusPeriodMembership")) {
		return byWork;
	}
	const rows = await db.focusPeriodMembership.findMany({
		where: {
			focusPeriod: {
				status: FOCUS_PERIOD_STATUS.active,
				workspaceId,
			},
			workId: { in: workIds },
		},
	});
	for (const row of rows) {
		byWork.set(row.workId, row.focusPeriodId);
	}
	return byWork;
}

interface PeriodRow {
	closeCompletedWorkIds: Prisma.JsonValue;
	closedAt: Date | null;
	closeScopeLocked: boolean;
	closeScopeWorkIds: Prisma.JsonValue;
	closeStillOpenWorkIds: Prisma.JsonValue;
	endDate: string;
	evaluationChange: string;
	evaluationKeep: string;
	evaluationSkipped: boolean;
	evaluationTryNext: string;
	followUpWorkIds: Prisma.JsonValue;
	id: string;
	leftoverDecisions: Prisma.JsonValue;
	purpose: string;
	startDate: string;
	startScopeLocked: boolean;
	startScopeTargetDates: Prisma.JsonValue;
	startScopeWorkIds: Prisma.JsonValue;
	status: string;
	stillOpenDecisionOpened: boolean;
	workspaceId: string;
}

async function decideLeftovers(
	input: CreateFocusPeriodInput,
	now: () => Date,
	command: DecideStillOpenCommand
): Promise<FocusPeriodOutcome> {
	if (!hasDelegate(input.prisma, "focusPeriod")) {
		return { status: "not-found" };
	}
	const payload = {
		operation: "decide-still-open",
		periodId: command.periodId,
		selections: command.selections,
		workspaceId: input.workspaceId,
	};
	return await input.prisma.$transaction(async (tx) => {
		await lockMutation(
			tx,
			`focus-period:${input.workspaceId}:${command.periodId}`
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
			return JSON.parse(existing.resultValue) as FocusPeriodOutcome;
		}
		const row = await loadPeriod(tx, input.workspaceId, command.periodId);
		if (!row || row.status !== FOCUS_PERIOD_STATUS.closed) {
			return { status: "not-found" };
		}
		const current = await activateIfDue(tx, input, row, now());
		const members = await loadMembers(tx, current.id);
		const memberIds = new Set(members.map((member) => member.id));
		const destinations = await leftoverDestinations(
			tx,
			input.workspaceId,
			current
		);
		const decided = leftoverDecisions(current);
		const decidedIds = new Set(decided.map((item) => item.workId));
		for (const selection of command.selections) {
			if (
				!memberIds.has(selection.workId) ||
				decidedIds.has(selection.workId)
			) {
				return { status: "not-found" };
			}
			const member = members.find((item) => item.id === selection.workId);
			if (!member || member.status === WORK_STATUS.closed) {
				return { status: "not-found" };
			}
			// biome-ignore lint/performance/noAwaitInLoops: leftover destinations share one lock and must apply in selection order
			const applied = await applyLeftoverSelection(
				tx,
				input,
				current,
				destinations,
				selection
			);
			if (applied.status !== "ok") {
				return applied.outcome;
			}
			decided.push(applied.decision);
			decidedIds.add(selection.workId);
		}
		const updated = await tx.focusPeriod.update({
			data: { leftoverDecisions: decided },
			where: { id: current.id },
		});
		const period = await toView(tx, input, updated);
		const outcome: FocusPeriodOutcome = { period, status: "committed" };
		await writeDurableReceipt(tx, {
			actorId: input.accountId,
			commandKey: command.idempotencyKey,
			kind: "focus-period-decide-still-open",
			payload,
			resultValue: JSON.stringify(outcome),
			targetId: current.id,
		});
		return outcome;
	});
}

async function applyLeftoverSelection(
	tx: MutationDb,
	input: CreateFocusPeriodInput,
	current: PeriodRow,
	destinations: Awaited<ReturnType<typeof leftoverDestinations>>,
	selection: LeftoverSelection
): Promise<
	| {
			decision: {
				destination: FocusPeriodLeftoverDestination;
				periodId: string | null;
				workId: string;
			};
			status: "ok";
	  }
	| { outcome: FocusPeriodOutcome; status: "error" }
> {
	if (selection.destination === FOCUS_PERIOD_LEFTOVER_DESTINATION.backlog) {
		const membership = await applyPlanningMembership(tx as PrismaClient, {
			surface: FOCUS_PERIOD_COPY.backlog,
			workId: selection.workId,
		});
		if (membership.status !== "committed") {
			return { outcome: { status: "not-found" }, status: "error" };
		}
		return {
			decision: {
				destination: selection.destination,
				periodId: null,
				workId: selection.workId,
			},
			status: "ok",
		};
	}
	if (selection.destination === FOCUS_PERIOD_LEFTOVER_DESTINATION.abandon) {
		const work = await tx.work.findFirst({
			where: {
				id: selection.workId,
				project: { workspaceId: input.workspaceId },
			},
		});
		if (!work) {
			return { outcome: { status: "not-found" }, status: "error" };
		}
		const closed = await closeWorkInTransaction(tx, {
			actorId: input.accountId,
			baseRevision: work.revision,
			idempotencyKey: `focus-period-abandon:${current.id}:${selection.workId}`,
			origin: HUMAN_ORIGIN,
			result: CLOSURE_RESULT.abandoned,
			workId: selection.workId,
		});
		if (closed.status !== "committed") {
			return { outcome: { status: "not-found" }, status: "error" };
		}
		return {
			decision: {
				destination: selection.destination,
				periodId: null,
				workId: selection.workId,
			},
			status: "ok",
		};
	}
	const targetId =
		selection.periodId ??
		(selection.destination === FOCUS_PERIOD_LEFTOVER_DESTINATION.nextPeriod
			? destinations.nextPeriod?.id
			: undefined);
	if (!targetId) {
		return { outcome: { status: "not-found" }, status: "error" };
	}
	const allowed =
		selection.destination === FOCUS_PERIOD_LEFTOVER_DESTINATION.nextPeriod
			? destinations.nextPeriod?.id === targetId
			: destinations.anotherPeriod.some((period) => period.id === targetId);
	if (!allowed) {
		return { outcome: { status: "not-found" }, status: "error" };
	}
	const otherActiveId = await otherActivePeriodId(
		tx,
		input.workspaceId,
		selection.workId,
		targetId
	);
	if (otherActiveId) {
		return {
			outcome: {
				reason: FOCUS_PERIOD_COPY.alreadyInAnActivePeriod,
				status: "invalid",
			},
			status: "error",
		};
	}
	await ensureMembership(tx, targetId, selection.workId);
	return {
		decision: {
			destination: selection.destination,
			periodId: targetId,
			workId: selection.workId,
		},
		status: "ok",
	};
}

async function saveEvaluation(
	input: CreateFocusPeriodInput,
	now: () => Date,
	command: EvaluateCommand
): Promise<FocusPeriodOutcome> {
	if (!hasDelegate(input.prisma, "focusPeriod")) {
		return { status: "not-found" };
	}
	const payload = {
		change: command.change ?? "",
		keep: command.keep ?? "",
		operation: "evaluate",
		periodId: command.periodId,
		skipped: command.skipped,
		tryNext: command.tryNext ?? "",
		workspaceId: input.workspaceId,
	};
	return await input.prisma.$transaction(async (tx) => {
		await lockMutation(
			tx,
			`focus-period:${input.workspaceId}:${command.periodId}`
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
			return JSON.parse(existing.resultValue) as FocusPeriodOutcome;
		}
		const row = await loadPeriod(tx, input.workspaceId, command.periodId);
		if (!row || row.status !== FOCUS_PERIOD_STATUS.closed) {
			return { status: "not-found" };
		}
		await activateIfDue(tx, input, row, now());
		const { change, keep, skipped, tryNext } = command;
		const updated = await tx.focusPeriod.update({
			data: {
				evaluationChange: skipped ? "" : (change ?? "").trim(),
				evaluationKeep: skipped ? "" : (keep ?? "").trim(),
				evaluationSkipped: skipped,
				evaluationTryNext: skipped ? "" : (tryNext ?? "").trim(),
			},
			where: { id: row.id },
		});
		const period = await toView(tx, input, updated);
		const outcome: FocusPeriodOutcome = { period, status: "committed" };
		await writeDurableReceipt(tx, {
			actorId: input.accountId,
			commandKey: command.idempotencyKey,
			kind: "focus-period-evaluate",
			payload,
			resultValue: JSON.stringify(outcome),
			targetId: row.id,
		});
		return outcome;
	});
}

async function createFollowUp(
	input: CreateFocusPeriodInput,
	now: () => Date,
	command: FollowUpCommand
): Promise<FocusPeriodOutcome> {
	if (!command.previewAcknowledged) {
		return { status: "not-found" };
	}
	const preview = await input.prisma.$transaction(async (tx) => {
		await activateDuePeriods(tx, input, now());
		return loadPeriod(tx, input.workspaceId, command.periodId);
	});
	if (!preview || preview.status !== FOCUS_PERIOD_STATUS.closed) {
		return { status: "not-found" };
	}
	const title = command.title.trim();
	if (title.length === 0) {
		return { status: "not-found" };
	}
	const payload = {
		operation: "confirm-follow-up",
		periodId: command.periodId,
		projectId: command.projectId,
		title,
		workspaceId: input.workspaceId,
	};
	return await input.prisma.$transaction(async (tx) => {
		await lockMutation(
			tx,
			`focus-period:${input.workspaceId}:${command.periodId}`
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
			return JSON.parse(existing.resultValue) as FocusPeriodOutcome;
		}
		const row = await loadPeriod(tx, input.workspaceId, command.periodId);
		if (!row || row.status !== FOCUS_PERIOD_STATUS.closed) {
			return { status: "not-found" };
		}
		const created = await createWorkInTransaction(tx, {
			actorId: input.accountId,
			idempotencyKey: `${command.idempotencyKey}:work`,
			origin: HUMAN_ORIGIN,
			payload: {
				projectId: command.projectId,
				title,
			},
		});
		if (created.status !== "committed") {
			return { status: "not-found" };
		}
		const followUpIds = [...asWorkIds(row.followUpWorkIds), created.work.id];
		const updated = await tx.focusPeriod.update({
			data: { followUpWorkIds: followUpIds },
			where: { id: row.id },
		});
		const period = await toView(tx, input, updated);
		const outcome: FocusPeriodOutcome = { period, status: "committed" };
		await writeDurableReceipt(tx, {
			actorId: input.accountId,
			commandKey: command.idempotencyKey,
			kind: "focus-period-confirm-follow-up",
			payload,
			resultValue: JSON.stringify(outcome),
			targetId: row.id,
		});
		return outcome;
	});
}

function leftoverDecisions(row: PeriodRow): Array<{
	destination: FocusPeriodLeftoverDestination;
	periodId: string | null;
	workId: string;
}> {
	if (!Array.isArray(row.leftoverDecisions)) {
		return [];
	}
	return row.leftoverDecisions.flatMap((item) => {
		if (!item || typeof item !== "object" || Array.isArray(item)) {
			return [];
		}
		const record = item as Record<string, unknown>;
		const { destination, periodId, workId } = record;
		if (
			typeof destination !== "string" ||
			typeof workId !== "string" ||
			!(
				destination === FOCUS_PERIOD_LEFTOVER_DESTINATION.nextPeriod ||
				destination === FOCUS_PERIOD_LEFTOVER_DESTINATION.backlog ||
				destination === FOCUS_PERIOD_LEFTOVER_DESTINATION.anotherPeriod ||
				destination === FOCUS_PERIOD_LEFTOVER_DESTINATION.abandon
			)
		) {
			return [];
		}
		return [
			{
				destination,
				periodId: typeof periodId === "string" ? periodId : null,
				workId,
			},
		];
	});
}

async function leftoverDestinations(
	db: MutationDb,
	workspaceId: string,
	row: PeriodRow
) {
	const others = (
		await db.focusPeriod.findMany({
			orderBy: { startDate: "asc" },
			where: {
				id: { not: row.id },
				status: {
					in: [FOCUS_PERIOD_STATUS.planned, FOCUS_PERIOD_STATUS.active],
				},
				workspaceId,
			},
		})
	).map((period) => ({
		endDate: period.endDate,
		id: period.id,
		purpose: period.purpose,
		startDate: period.startDate,
		status: period.status as FocusPeriodStatus,
	}));
	const nextPeriod =
		others.find((period) => period.startDate >= row.endDate) ?? null;
	return {
		abandon: true as const,
		anotherPeriod: others.filter((period) => period.id !== nextPeriod?.id),
		backlog: true as const,
		nextPeriod,
	};
}

async function closeComparison(
	db: MutationDb,
	row: PeriodRow,
	members: Array<
		FocusPeriodWork & { closureResult: string | null; status: string }
	>
) {
	const startIds = asWorkIds(row.startScopeWorkIds);
	const closeIds = asWorkIds(row.closeScopeWorkIds);
	const startSet = new Set(startIds);
	const closeSet = new Set(closeIds);
	const byId = new Map(
		members.map((member) => [member.id, withoutStatus(member)])
	);
	const missingIds = [...new Set([...startIds, ...closeIds])].filter(
		(id) => !byId.has(id)
	);
	for (const work of await loadWorkViews(db, missingIds)) {
		byId.set(work.id, work);
	}
	const views = (ids: string[]) =>
		ids.flatMap((id) => {
			const work = byId.get(id);
			return work ? [work] : [];
		});
	const completed = views(asWorkIds(row.closeCompletedWorkIds));
	const stillOpen = views(asWorkIds(row.closeStillOpenWorkIds));
	return {
		addedLater: views(closeIds.filter((id) => !startSet.has(id))),
		completed,
		inStartSnapshot: views(startIds),
		performanceNote: FOCUS_PERIOD_CLOSE_JUDGEMENT.performanceNote,
		removed: views(startIds.filter((id) => !closeSet.has(id))),
		score: FOCUS_PERIOD_CLOSE_JUDGEMENT.score,
		stillOpen,
		velocity: FOCUS_PERIOD_CLOSE_JUDGEMENT.velocity,
	};
}

async function dateComparisonFor(
	db: MutationDb,
	input: CreateFocusPeriodInput,
	row: PeriodRow,
	members: Array<
		FocusPeriodWork & { status: string; targetDate: string | null }
	>
) {
	const empty = {
		actualDateField: FOCUS_PERIOD_CLOSE_JUDGEMENT.actualDateField,
		completedAfter: [] as FocusPeriodWork[],
		completedOnTarget: [] as FocusPeriodWork[],
		health: FOCUS_PERIOD_CLOSE_JUDGEMENT.health,
		movedEarlier: [] as FocusPeriodWork[],
		movedLater: [] as FocusPeriodWork[],
		optional: true as const,
		score: FOCUS_PERIOD_CLOSE_JUDGEMENT.score,
		stillOpen: [] as FocusPeriodWork[],
	};
	const targets = startTargetDates(row);
	if (targets.length === 0) {
		return empty;
	}
	const preferences = await getAccountPreferences(
		db as PrismaClient,
		input.accountId
	);
	const memberById = new Map(members.map((member) => [member.id, member]));
	const missing = targets
		.map((item) => item.workId)
		.filter((id) => !memberById.has(id));
	const extra = await db.work.findMany({
		include: { project: true },
		where: { id: { in: missing } },
	});
	for (const work of extra) {
		memberById.set(work.id, toWork(work));
	}
	const events = await db.workLifecycleEvent.findMany({
		orderBy: { createdAt: "asc" },
		where: {
			kind: "closed",
			workId: { in: targets.map((item) => item.workId) },
		},
	});
	const closedOn = new Map<string, string>();
	for (const event of events) {
		if (!closedOn.has(event.workId)) {
			closedOn.set(event.workId, calendarDay(event.createdAt, preferences));
		}
	}
	const stillOpenAtClose = new Set(asWorkIds(row.closeStillOpenWorkIds));
	for (const target of targets) {
		placeDateComparison(
			empty,
			memberById.get(target.workId),
			target,
			closedOn,
			stillOpenAtClose
		);
	}
	return empty;
}

function placeDateComparison(
	buckets: {
		completedAfter: FocusPeriodWork[];
		completedOnTarget: FocusPeriodWork[];
		movedEarlier: FocusPeriodWork[];
		movedLater: FocusPeriodWork[];
		stillOpen: FocusPeriodWork[];
	},
	work: (FocusPeriodWork & { targetDate: string | null }) | undefined,
	target: { targetDate: string | null; workId: string },
	closedOn: Map<string, string>,
	stillOpenAtClose: Set<string>
) {
	if (!(target.targetDate && work)) {
		return;
	}
	const view = withoutStatus(work);
	if (work.targetDate && work.targetDate < target.targetDate) {
		buckets.movedEarlier.push(view);
	}
	if (work.targetDate && work.targetDate > target.targetDate) {
		buckets.movedLater.push(view);
	}
	if (stillOpenAtClose.has(work.id)) {
		buckets.stillOpen.push(view);
		return;
	}
	const completedOn = closedOn.get(work.id);
	if (completedOn && completedOn === target.targetDate) {
		buckets.completedOnTarget.push(view);
	} else if (completedOn && completedOn > target.targetDate) {
		buckets.completedAfter.push(view);
	}
}

function startTargetDates(row: PeriodRow): Array<{
	targetDate: string | null;
	workId: string;
}> {
	if (!Array.isArray(row.startScopeTargetDates)) {
		return [];
	}
	return row.startScopeTargetDates.flatMap((item) => {
		if (!item || typeof item !== "object" || Array.isArray(item)) {
			return [];
		}
		const record = item as Record<string, unknown>;
		if (typeof record.workId !== "string") {
			return [];
		}
		return [
			{
				targetDate:
					typeof record.targetDate === "string" ? record.targetDate : null,
				workId: record.workId,
			},
		];
	});
}

async function evaluationView(db: MutationDb, row: PeriodRow) {
	const followUpIds = asWorkIds(row.followUpWorkIds);
	return {
		change: row.evaluationChange,
		followUpWork: await loadWorkViews(db, followUpIds),
		generatedActionItems: FOCUS_PERIOD_CLOSE_JUDGEMENT.generatedActionItems,
		keep: row.evaluationKeep,
		previewRequired: true as const,
		skippable: true as const,
		skipped: row.evaluationSkipped,
		tryNext: row.evaluationTryNext,
	};
}

async function loadWorkViews(
	db: MutationDb,
	workIds: string[]
): Promise<FocusPeriodWork[]> {
	if (workIds.length === 0) {
		return [];
	}
	const rows = await db.work.findMany({
		include: { project: true },
		where: { id: { in: workIds } },
	});
	const byId = new Map(rows.map((row) => [row.id, withoutStatus(toWork(row))]));
	return workIds.flatMap((id) => {
		const work = byId.get(id);
		return work ? [work] : [];
	});
}
