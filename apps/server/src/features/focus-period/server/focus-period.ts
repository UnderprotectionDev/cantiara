import { getAccountPreferences, instantFromCalendarDate } from "@cantiara/auth";
import type { Prisma, PrismaClient } from "@cantiara/db";

import {
	lockMutation,
	readDurableReceipt,
	writeDurableReceipt,
} from "../../mutation-core/server/durable-mutation";
import { MUTATION_COPY } from "../../mutation-core/server/mutation-shared";
import { WORK_STATUS } from "../../work-lifecycle/server/work-lifecycle-model";
import {
	calendarDaySchema,
	FOCUS_PERIOD_COPY,
	FOCUS_PERIOD_COUNTERPARTS,
	FOCUS_PERIOD_LEFTOVER,
	FOCUS_PERIOD_PLANNING_WRITES,
	FOCUS_PERIOD_STATUS,
	type FocusPeriodStatus,
	type FocusPeriodView,
	type FocusPeriodWork,
	focusPeriodCatalog,
	isFocusPeriodWindow,
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

export interface FocusPeriod {
	activePeriodIdForWork: (workId: string) => Promise<string | null>;
	add: (input: MembershipCommand) => Promise<FocusPeriodOutcome>;
	cancel: (input: PeriodCommand) => Promise<FocusPeriodOutcome>;
	catalog: () => ReturnType<typeof focusPeriodCatalog>;
	close: (input: PeriodCommand) => Promise<FocusPeriodOutcome>;
	create: (input: CreateCommand) => Promise<FocusPeriodOutcome>;
	get: (periodId: string) => Promise<FocusPeriodView | null>;
	list: () => Promise<FocusPeriodView[]>;
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
			const instant = now();
			const active = await hasReachedStart(
				tx,
				input.accountId,
				startDate.data,
				instant
			);
			const created = await tx.focusPeriod.create({
				data: {
					endDate: endDate.data,
					id: crypto.randomUUID(),
					purpose,
					startDate: startDate.data,
					startScopeLocked: active,
					startScopeWorkIds: [],
					status: active
						? FOCUS_PERIOD_STATUS.active
						: FOCUS_PERIOD_STATUS.planned,
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
		create,
		get,
		list,
		remove,
	};
}

async function mutateMembership(
	input: CreateFocusPeriodInput,
	now: () => Date,
	command: MembershipCommand,
	operation: "add" | "remove"
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
				where: { focusPeriodId: current.id, workId: command.workId },
			});
		} else {
			const already = await tx.focusPeriodMembership.findUnique({
				where: {
					focusPeriodId_workId: {
						focusPeriodId: current.id,
						workId: command.workId,
					},
				},
			});
			if (!already) {
				await tx.focusPeriodMembership.create({
					data: {
						focusPeriodId: current.id,
						id: crypto.randomUUID(),
						workId: command.workId,
					},
				});
			}
		}
		const next = await loadPeriod(tx, input.workspaceId, current.id);
		if (!next) {
			return { status: "not-found" };
		}
		const period = await toView(tx, input, next);
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
							closeScopeLocked: true,
							closeScopeWorkIds: workIds,
							leftoverDecisionOpened: true,
							status: FOCUS_PERIOD_STATUS.closed,
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
	const startScope = row.startScopeLocked
		? { workIds: asWorkIds(row.startScopeWorkIds) }
		: null;
	const closeScope = row.closeScopeLocked
		? { workIds: asWorkIds(row.closeScopeWorkIds) }
		: null;
	const stillOpen = row.leftoverDecisionOpened
		? members
				.filter((member) => member.status !== WORK_STATUS.closed)
				.map(withoutStatus)
		: [];
	return {
		closeScope,
		copy: FOCUS_PERIOD_COPY,
		counterparts: FOCUS_PERIOD_COUNTERPARTS,
		eligibleWork,
		endDate: row.endDate,
		id: row.id,
		leftoverDecision: {
			autoRollover: FOCUS_PERIOD_LEFTOVER.autoRollover,
			opened: row.leftoverDecisionOpened,
			stillOpen,
		},
		members: memberViews,
		optional: true,
		planningWrites: FOCUS_PERIOD_PLANNING_WRITES,
		purpose: row.purpose,
		startDate: row.startDate,
		startScope,
		status: row.status as FocusPeriodStatus,
	};
}

async function loadMembers(
	db: MutationDb,
	focusPeriodId: string
): Promise<Array<FocusPeriodWork & { status: string }>> {
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

function withoutStatus(
	work: FocusPeriodWork & { status: string }
): FocusPeriodWork {
	return {
		id: work.id,
		key: work.key,
		projectId: work.projectId,
		projectName: work.projectName,
		title: work.title,
	};
}

function toWork(work: {
	id: string;
	key: string;
	project: { id: string; name: string };
	projectId: string;
	status: string;
	title: string;
}): FocusPeriodWork & { status: string } {
	return {
		id: work.id,
		key: work.key,
		projectId: work.projectId,
		projectName: work.project.name,
		status: work.status,
		title: work.title,
	};
}

function asWorkIds(value: Prisma.JsonValue): string[] {
	if (!Array.isArray(value)) {
		return [];
	}
	return value.filter((id): id is string => typeof id === "string");
}

interface PeriodRow {
	closeScopeLocked: boolean;
	closeScopeWorkIds: Prisma.JsonValue;
	endDate: string;
	id: string;
	leftoverDecisionOpened: boolean;
	purpose: string;
	startDate: string;
	startScopeLocked: boolean;
	startScopeWorkIds: Prisma.JsonValue;
	status: string;
	workspaceId: string;
}
