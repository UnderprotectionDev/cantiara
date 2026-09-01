import {
	type AccountPreferences,
	calendarDay,
	getAccountPreferences,
	instantFromCalendarDate,
	startOfWeekCalendarDate,
} from "@cantiara/auth";
import { Prisma, type PrismaClient } from "@cantiara/db";

import { lockMutation } from "../../mutation-core/server/durable-mutation";
import {
	HUMAN_ORIGIN,
	MUTATION_ACTOR,
	MUTATION_COPY,
	payloadFingerprint,
} from "../../mutation-core/server/mutation-shared";
import { getWork } from "../../work-lifecycle/server/work-lifecycle";
import type { WorkView } from "../../work-lifecycle/server/work-lifecycle-model";
import {
	addCalendarDays,
	CALENDAR_COUNTERPARTS,
	CALENDAR_EVENT_RECORD,
	type CalendarDateKind,
	type CalendarViewName,
	calendarDateKindSchema,
	calendarDaySchema,
	calendarViewNameSchema,
	DATE_MOVE_COUNTERPARTS,
	type DatedCalendarWork,
	fieldForDateKind,
	monthWindow,
	PLANNED_START_EFFECTS,
	presentCalendarDays,
	presentCalendarWindow,
	previewRepresentedDateMove,
	type RepresentedDateMovePreview,
	UNIFIED_CALENDAR_COPY,
	type UnifiedCalendarView,
	unifiedCalendarCatalog,
} from "./unified-calendar-model";

type MutationDb = PrismaClient | Prisma.TransactionClient;

export type DateMovePreviewOutcome =
	| { preview: RepresentedDateMovePreview; status: "ready" }
	| { status: "not-found" };

export type DateMoveOutcome =
	| {
			historyEntryId: string;
			status: "committed" | "replayed";
			undo: typeof UNIFIED_CALENDAR_COPY.undo;
			work: WorkView;
	  }
	| {
			currentValueLabel: typeof MUTATION_COPY.currentValue;
			status: "stale";
	  }
	| { conflict: typeof MUTATION_COPY.conflict; status: "conflict" }
	| {
			reason: "kind-not-represented" | "target-not-found" | "undo-not-safe";
			status: "rejected";
	  };

export interface DateMoveCommand {
	baseRevision: number;
	idempotencyKey: string;
	kind: CalendarDateKind;
	toDate: string;
	workId: string;
}

export interface DateMoveUndoCommand {
	baseRevision: number;
	historyEntryId: string;
	idempotencyKey: string;
	workId: string;
}

export interface UnifiedCalendar {
	catalog: () => ReturnType<typeof unifiedCalendarCatalog>;
	moveRepresentedDate: (input: DateMoveCommand) => Promise<DateMoveOutcome>;
	previewDateMove: (input: {
		kind: CalendarDateKind;
		toDate: string;
		workId: string;
	}) => Promise<DateMovePreviewOutcome>;
	undoRepresentedDateMove: (
		input: DateMoveUndoCommand
	) => Promise<DateMoveOutcome>;
	view: (input?: {
		calendarDay?: string;
		projectId?: string | null;
		view?: CalendarViewName;
	}) => Promise<UnifiedCalendarView>;
}

export interface CreateUnifiedCalendarInput {
	accountId: string;
	clock?: { now: () => Date };
	prisma: PrismaClient;
	workspaceId: string;
}

export function createUnifiedCalendar(
	input: CreateUnifiedCalendarInput
): UnifiedCalendar {
	const now = () => {
		if (input.clock) {
			return input.clock.now();
		}
		return new Date();
	};

	async function view(
		query: {
			calendarDay?: string;
			projectId?: string | null;
			view?: CalendarViewName;
		} = {}
	): Promise<UnifiedCalendarView> {
		const preferences = await getAccountPreferences(
			input.prisma,
			input.accountId
		);
		const calendarDayValue = query.calendarDay
			? calendarDaySchema.parse(query.calendarDay)
			: calendarDay(now(), preferences);
		const viewName = calendarViewNameSchema.parse(
			query.view ?? UNIFIED_CALENDAR_COPY.week
		);
		const window = visibleWindow(viewName, calendarDayValue, preferences);
		const projectId = query.projectId ?? null;
		const projects = await input.prisma.project.findMany({
			orderBy: { name: "asc" },
			select: { id: true, name: true },
			where: { workspaceId: input.workspaceId },
		});
		const works = await loadDatedWork(
			input.prisma,
			input.workspaceId,
			projectId
		);
		const windowInput = {
			calendarDay: calendarDayValue,
			rangeEnd: window.rangeEnd,
			rangeStart: window.rangeStart,
			view: viewName,
			works,
		};
		const presented = presentCalendarWindow(windowInput);
		return {
			calendarDay: calendarDayValue,
			copy: UNIFIED_CALENDAR_COPY,
			counterparts: CALENDAR_COUNTERPARTS,
			dateMove: DATE_MOVE_COUNTERPARTS,
			days: presentCalendarDays(windowInput),
			eventRecord: CALENDAR_EVENT_RECORD,
			plannedStart: PLANNED_START_EFFECTS,
			positions: presented.positions,
			projectId,
			projects,
			rangeEnd: window.rangeEnd,
			rangeStart: window.rangeStart,
			ranges: presented.ranges,
			view: viewName,
			views: [
				UNIFIED_CALENDAR_COPY.day,
				UNIFIED_CALENDAR_COPY.week,
				UNIFIED_CALENDAR_COPY.month,
			],
		};
	}

	async function previewDateMove(query: {
		kind: CalendarDateKind;
		toDate: string;
		workId: string;
	}): Promise<DateMovePreviewOutcome> {
		const kind = calendarDateKindSchema.parse(query.kind);
		const toDate = calendarDaySchema.parse(query.toDate);
		const dated = await loadDatedWorkById(
			input.prisma,
			input.workspaceId,
			query.workId
		);
		if (!dated) {
			return { status: "not-found" };
		}
		const fromDate = dated[fieldForDateKind(kind)];
		if (!fromDate) {
			return { status: "not-found" };
		}
		return {
			preview: previewRepresentedDateMove({ fromDate, kind, toDate }),
			status: "ready",
		};
	}

	async function moveRepresentedDate(
		command: DateMoveCommand
	): Promise<DateMoveOutcome> {
		const kind = calendarDateKindSchema.parse(command.kind);
		const toDate = calendarDaySchema.parse(command.toDate);
		const fingerprint = payloadFingerprint({
			kind,
			toDate,
			workId: command.workId,
		});
		const commandKey = commandKeyFor(input.accountId, command.idempotencyKey);
		return await input.prisma.$transaction((tx) =>
			moveInTransaction(tx, {
				accountId: input.accountId,
				baseRevision: command.baseRevision,
				commandKey,
				fingerprint,
				kind,
				toDate,
				workId: command.workId,
				workspaceId: input.workspaceId,
			})
		);
	}

	async function undoRepresentedDateMove(
		command: DateMoveUndoCommand
	): Promise<DateMoveOutcome> {
		const fingerprint = payloadFingerprint({
			historyEntryId: command.historyEntryId,
			undo: true,
			workId: command.workId,
		});
		const commandKey = commandKeyFor(input.accountId, command.idempotencyKey);
		return await input.prisma.$transaction((tx) =>
			undoInTransaction(tx, {
				accountId: input.accountId,
				baseRevision: command.baseRevision,
				commandKey,
				fingerprint,
				historyEntryId: command.historyEntryId,
				workId: command.workId,
				workspaceId: input.workspaceId,
			})
		);
	}

	return {
		catalog: unifiedCalendarCatalog,
		moveRepresentedDate,
		previewDateMove,
		undoRepresentedDateMove,
		view,
	};
}

function visibleWindow(
	view: CalendarViewName,
	day: string,
	preferences: Pick<AccountPreferences, "firstDayOfWeek" | "timeZone">
): { rangeEnd: string; rangeStart: string } {
	if (view === UNIFIED_CALENDAR_COPY.day) {
		return { rangeEnd: day, rangeStart: day };
	}
	if (view === UNIFIED_CALENDAR_COPY.month) {
		return monthWindow(day);
	}
	const rangeStart = startOfWeekCalendarDate(
		instantFromCalendarDate(day, preferences),
		preferences
	);
	return { rangeEnd: addCalendarDays(rangeStart, 6), rangeStart };
}

async function loadDatedWork(
	db: MutationDb,
	workspaceId: string,
	projectId: string | null
): Promise<DatedCalendarWork[]> {
	const rows = await db.work.findMany({
		include: {
			project: { select: { id: true, name: true, workspaceId: true } },
		},
		orderBy: [{ projectId: "asc" }, { number: "asc" }],
		where: {
			archived: false,
			project: {
				workspaceId,
				...(projectId ? { id: projectId } : {}),
			},
			retiredIntoId: null,
			trashedAt: null,
		},
	});
	const dated = await withWorkPlanningDates(db, rows);
	return dated
		.filter((row) => row.plannedStart || row.targetDate || row.reappearDate)
		.map((row) => ({
			id: row.id,
			key: row.key,
			plannedStart: row.plannedStart ?? null,
			projectId: row.projectId,
			projectName: row.project.name,
			reappearDate: row.reappearDate ?? null,
			revision: row.revision,
			targetDate: row.targetDate ?? null,
			title: row.title,
		}));
}

async function withWorkPlanningDates<
	T extends {
		id: string;
		plannedStart?: string | null;
		reappearDate?: string | null;
		targetDate?: string | null;
	},
>(db: MutationDb, rows: T[]): Promise<T[]> {
	if (rows.length === 0) {
		return rows;
	}
	const dates = await db.$queryRaw<
		Array<{
			id: string;
			plannedStart: string | null;
			reappearDate: string | null;
			targetDate: string | null;
		}>
	>`
		SELECT id, "plannedStart", "reappearDate", "targetDate"
		FROM work
		WHERE id IN (${Prisma.join(
			rows.map((row) => Prisma.sql`${row.id}`),
			", "
		)})
	`;
	const byId = new Map(dates.map((row) => [row.id, row]));
	return rows.map((row) => {
		const found = byId.get(row.id);
		if (!found) {
			return row;
		}
		return { ...row, ...found };
	});
}

async function loadDatedWorkById(
	db: MutationDb,
	workspaceId: string,
	workId: string
): Promise<
	| (DatedCalendarWork & {
			status: string;
	  })
	| null
> {
	const row = await db.work.findFirst({
		include: {
			project: { select: { id: true, name: true, workspaceId: true } },
		},
		where: {
			archived: false,
			id: workId,
			project: { workspaceId },
			retiredIntoId: null,
			trashedAt: null,
		},
	});
	if (!row) {
		return null;
	}
	const [dated] = await withWorkPlanningDates(db, [row]);
	if (!dated) {
		return null;
	}
	return {
		id: dated.id,
		key: dated.key,
		plannedStart: dated.plannedStart ?? null,
		projectId: dated.projectId,
		projectName: dated.project.name,
		reappearDate: dated.reappearDate ?? null,
		revision: dated.revision,
		status: dated.status,
		targetDate: dated.targetDate ?? null,
		title: dated.title,
	};
}

async function moveInTransaction(
	tx: Prisma.TransactionClient,
	input: {
		accountId: string;
		baseRevision: number;
		commandKey: string;
		fingerprint: string;
		kind: CalendarDateKind;
		toDate: string;
		workId: string;
		workspaceId: string;
	}
): Promise<DateMoveOutcome> {
	await lockMutation(tx, `unified-calendar:${input.workId}`);
	const replayed = await replayDateMove(
		tx,
		input.commandKey,
		input.fingerprint
	);
	if (replayed) {
		return replayed;
	}
	const dated = await loadDatedWorkById(tx, input.workspaceId, input.workId);
	if (!dated) {
		return { reason: "target-not-found", status: "rejected" };
	}
	if (dated.revision !== input.baseRevision) {
		return {
			currentValueLabel: MUTATION_COPY.currentValue,
			status: "stale",
		};
	}
	const field = fieldForDateKind(input.kind);
	const fromDate = dated[field];
	if (!fromDate) {
		return { reason: "kind-not-represented", status: "rejected" };
	}
	await tx.work.update({
		data: {
			[field]: input.toDate,
			revision: dated.revision + 1,
		},
		where: { id: dated.id },
	});
	const work = await getWork(tx as PrismaClient, dated.id);
	if (!work) {
		return { reason: "target-not-found", status: "rejected" };
	}
	const historyEntryId = crypto.randomUUID();
	await writeDateMoveReceipt(tx, {
		actorId: input.accountId,
		commandKey: input.commandKey,
		fingerprint: input.fingerprint,
		historyEntryId,
		kind: input.kind,
		nextDate: input.toDate,
		previousDate: fromDate,
		work,
	});
	return {
		historyEntryId,
		status: "committed",
		undo: UNIFIED_CALENDAR_COPY.undo,
		work,
	};
}

async function undoInTransaction(
	tx: Prisma.TransactionClient,
	input: {
		accountId: string;
		baseRevision: number;
		commandKey: string;
		fingerprint: string;
		historyEntryId: string;
		workId: string;
		workspaceId: string;
	}
): Promise<DateMoveOutcome> {
	await lockMutation(tx, `unified-calendar:${input.workId}`);
	const replayed = await replayDateMove(
		tx,
		input.commandKey,
		input.fingerprint
	);
	if (replayed) {
		return replayed;
	}
	const dated = await loadDatedWorkById(tx, input.workspaceId, input.workId);
	if (!dated) {
		return { reason: "target-not-found", status: "rejected" };
	}
	if (dated.revision !== input.baseRevision) {
		return {
			currentValueLabel: MUTATION_COPY.currentValue,
			status: "stale",
		};
	}
	const history = await tx.mutationReceipt.findUnique({
		where: { id: input.historyEntryId },
	});
	if (!history || history.targetId !== dated.id) {
		return { reason: "target-not-found", status: "rejected" };
	}
	const stored = storedDateMove(history.resultValue);
	if (!stored || stored.work.id !== dated.id) {
		return { reason: "undo-not-safe", status: "rejected" };
	}
	const field = fieldForDateKind(stored.kind);
	if (dated[field] !== stored.nextDate) {
		return { reason: "undo-not-safe", status: "rejected" };
	}
	await tx.work.update({
		data: {
			[field]: stored.previousDate,
			revision: dated.revision + 1,
		},
		where: { id: dated.id },
	});
	const work = await getWork(tx as PrismaClient, dated.id);
	if (!work) {
		return { reason: "target-not-found", status: "rejected" };
	}
	const historyEntryId = crypto.randomUUID();
	await writeDateMoveReceipt(tx, {
		actorId: input.accountId,
		commandKey: input.commandKey,
		fingerprint: input.fingerprint,
		historyEntryId,
		kind: stored.kind,
		nextDate: stored.previousDate,
		previousDate: stored.nextDate,
		work,
	});
	return {
		historyEntryId,
		status: "committed",
		undo: UNIFIED_CALENDAR_COPY.undo,
		work,
	};
}

async function replayDateMove(
	tx: MutationDb,
	commandKey: string,
	fingerprint: string
): Promise<DateMoveOutcome | null> {
	const existing = await tx.mutationReceipt.findUnique({
		where: { commandKey },
	});
	if (!existing) {
		return null;
	}
	if (existing.payloadFingerprint !== fingerprint) {
		return { conflict: MUTATION_COPY.conflict, status: "conflict" };
	}
	const stored = storedDateMove(existing.resultValue);
	if (!stored) {
		return { conflict: MUTATION_COPY.conflict, status: "conflict" };
	}
	return {
		historyEntryId: stored.historyEntryId,
		status: "replayed",
		undo: UNIFIED_CALENDAR_COPY.undo,
		work: stored.work,
	};
}

async function writeDateMoveReceipt(
	tx: MutationDb,
	input: {
		actorId: string;
		commandKey: string;
		fingerprint: string;
		historyEntryId: string;
		kind: CalendarDateKind;
		nextDate: string;
		previousDate: string;
		work: WorkView;
	}
): Promise<void> {
	await tx.mutationReceipt.create({
		data: {
			actorId: input.actorId,
			actorType: MUTATION_ACTOR.user,
			commandKey: input.commandKey,
			committedRevision: input.work.revision,
			id: input.historyEntryId,
			kind: "field",
			origin: HUMAN_ORIGIN,
			payloadFingerprint: input.fingerprint,
			resultValue: JSON.stringify({
				historyEntryId: input.historyEntryId,
				kind: input.kind,
				nextDate: input.nextDate,
				previousDate: input.previousDate,
				undo: UNIFIED_CALENDAR_COPY.undo,
				work: input.work,
			}),
			targetId: input.work.id,
		},
	});
}

function storedDateMove(value: string): {
	historyEntryId: string;
	kind: CalendarDateKind;
	nextDate: string;
	previousDate: string;
	work: WorkView;
} | null {
	try {
		const parsed = JSON.parse(value) as {
			historyEntryId?: string;
			kind?: CalendarDateKind;
			nextDate?: string;
			previousDate?: string;
			work?: WorkView;
		};
		if (
			!(
				parsed.historyEntryId &&
				parsed.kind &&
				parsed.nextDate &&
				parsed.previousDate &&
				parsed.work
			)
		) {
			return null;
		}
		return {
			historyEntryId: parsed.historyEntryId,
			kind: parsed.kind,
			nextDate: parsed.nextDate,
			previousDate: parsed.previousDate,
			work: parsed.work,
		};
	} catch {
		return null;
	}
}

function commandKeyFor(actorId: string, idempotencyKey: string): string {
	return `human:${actorId}:${idempotencyKey}`;
}
