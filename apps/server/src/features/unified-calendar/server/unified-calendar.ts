import {
	type AccountPreferences,
	calendarDay,
	getAccountPreferences,
	instantFromCalendarDate,
	startOfWeekCalendarDate,
} from "@cantiara/auth";
import { Prisma, type PrismaClient } from "@cantiara/db";

import {
	addCalendarDays,
	CALENDAR_COUNTERPARTS,
	CALENDAR_EVENT_RECORD,
	type CalendarViewName,
	calendarDaySchema,
	calendarViewNameSchema,
	type DatedCalendarWork,
	monthWindow,
	PLANNED_START_EFFECTS,
	presentCalendarDays,
	presentCalendarWindow,
	UNIFIED_CALENDAR_COPY,
	type UnifiedCalendarView,
	unifiedCalendarCatalog,
} from "./unified-calendar-model";

type MutationDb = PrismaClient | Prisma.TransactionClient;

export interface UnifiedCalendar {
	catalog: () => ReturnType<typeof unifiedCalendarCatalog>;
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

	return {
		catalog: unifiedCalendarCatalog,
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
