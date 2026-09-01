import { z } from "zod";

export const UNIFIED_CALENDAR_COPY = {
	agenda: "Agenda",
	allProjects: "All Projects",
	calendar: "Calendar",
	day: "Day",
	empty: "No dated Work in this Calendar view.",
	loading: "Loading…",
	month: "Month",
	openSourceRecord: "Open source record",
	plannedStart: "Planned start",
	project: "Project",
	reappearDate: "Reappear date",
	selectedDay: "Selected day",
	targetDate: "Target date",
	week: "Week",
} as const;

export const CALENDAR_VIEWS = [
	UNIFIED_CALENDAR_COPY.day,
	UNIFIED_CALENDAR_COPY.week,
	UNIFIED_CALENDAR_COPY.month,
	UNIFIED_CALENDAR_COPY.agenda,
] as const;

export type CalendarViewName = (typeof CALENDAR_VIEWS)[number];

export const DATE_KINDS = [
	UNIFIED_CALENDAR_COPY.plannedStart,
	UNIFIED_CALENDAR_COPY.targetDate,
	UNIFIED_CALENDAR_COPY.reappearDate,
] as const;

export type CalendarDateKind = (typeof DATE_KINDS)[number];

export const CALENDAR_DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export const calendarDaySchema = z.string().regex(CALENDAR_DAY_PATTERN);

export const calendarViewNameSchema = z.enum(CALENDAR_VIEWS);

export const CALENDAR_EVENT_RECORD = false;

export const CALENDAR_AGENDA = {
	membership: false,
	newDateField: false,
} as const;

export const CALENDAR_COUNTERPARTS = {
	dailyFocus: false,
	kanban: false,
	releaseCommitment: false,
	roadmap: false,
	sprint: false,
	statusBoard: false,
} as const;

export const calendarDateKindSchema = z.enum(DATE_KINDS);

export const PLANNED_START_EFFECTS = {
	autoStarts: false,
	hidesWork: false,
	writesStatus: false,
} as const;

export const calendarWorkSchema = z.object({
	id: z.string().min(1),
	key: z.string().min(1),
	projectId: z.string().min(1),
	projectName: z.string().min(1),
	title: z.string().min(1),
});

export type CalendarWork = z.infer<typeof calendarWorkSchema>;

export const calendarPositionSchema = calendarWorkSchema.extend({
	date: calendarDaySchema,
	kind: z.enum(DATE_KINDS),
});

export type CalendarPosition = z.infer<typeof calendarPositionSchema>;

export const calendarRangeSchema = calendarWorkSchema.extend({
	end: z.object({
		date: calendarDaySchema,
		kind: z.literal(UNIFIED_CALENDAR_COPY.targetDate),
	}),
	start: z.object({
		date: calendarDaySchema,
		kind: z.literal(UNIFIED_CALENDAR_COPY.plannedStart),
	}),
});

export type CalendarRange = z.infer<typeof calendarRangeSchema>;

export const calendarDaySliceSchema = z.object({
	date: calendarDaySchema,
	positions: z.array(calendarPositionSchema),
	ranges: z.array(calendarRangeSchema),
});

export type CalendarDaySlice = z.infer<typeof calendarDaySliceSchema>;

export const calendarProjectSchema = z.object({
	id: z.string().min(1),
	name: z.string().min(1),
});

export type CalendarProject = z.infer<typeof calendarProjectSchema>;

export const unifiedCalendarViewSchema = z.object({
	agenda: z.object({
		membership: z.literal(false),
		newDateField: z.literal(false),
	}),
	calendarDay: calendarDaySchema,
	copy: z.object({
		agenda: z.literal(UNIFIED_CALENDAR_COPY.agenda),
		allProjects: z.literal(UNIFIED_CALENDAR_COPY.allProjects),
		calendar: z.literal(UNIFIED_CALENDAR_COPY.calendar),
		day: z.literal(UNIFIED_CALENDAR_COPY.day),
		empty: z.literal(UNIFIED_CALENDAR_COPY.empty),
		loading: z.literal(UNIFIED_CALENDAR_COPY.loading),
		month: z.literal(UNIFIED_CALENDAR_COPY.month),
		openSourceRecord: z.literal(UNIFIED_CALENDAR_COPY.openSourceRecord),
		plannedStart: z.literal(UNIFIED_CALENDAR_COPY.plannedStart),
		project: z.literal(UNIFIED_CALENDAR_COPY.project),
		reappearDate: z.literal(UNIFIED_CALENDAR_COPY.reappearDate),
		selectedDay: z.literal(UNIFIED_CALENDAR_COPY.selectedDay),
		targetDate: z.literal(UNIFIED_CALENDAR_COPY.targetDate),
		week: z.literal(UNIFIED_CALENDAR_COPY.week),
	}),
	counterparts: z.object({
		dailyFocus: z.literal(false),
		kanban: z.literal(false),
		releaseCommitment: z.literal(false),
		roadmap: z.literal(false),
		sprint: z.literal(false),
		statusBoard: z.literal(false),
	}),
	dateKinds: z.array(calendarDateKindSchema),
	days: z.array(calendarDaySliceSchema),
	eventRecord: z.literal(false),
	plannedStart: z.object({
		autoStarts: z.literal(false),
		hidesWork: z.literal(false),
		writesStatus: z.literal(false),
	}),
	positions: z.array(calendarPositionSchema),
	projectId: z.string().min(1).nullable(),
	projects: z.array(calendarProjectSchema),
	rangeEnd: calendarDaySchema,
	rangeStart: calendarDaySchema,
	ranges: z.array(calendarRangeSchema),
	view: calendarViewNameSchema,
	views: z.tuple([
		z.literal(UNIFIED_CALENDAR_COPY.day),
		z.literal(UNIFIED_CALENDAR_COPY.week),
		z.literal(UNIFIED_CALENDAR_COPY.month),
		z.literal(UNIFIED_CALENDAR_COPY.agenda),
	]),
});

export type UnifiedCalendarView = z.infer<typeof unifiedCalendarViewSchema>;

export interface DatedCalendarWork extends CalendarWork {
	plannedStart: string | null;
	reappearDate: string | null;
	targetDate: string | null;
}

function dateInWindow(
	date: string | null,
	start: string,
	end: string
): date is string {
	return date !== null && date >= start && date <= end;
}

function rangeOverlapsWindow(
	plannedStart: string,
	targetDate: string,
	start: string,
	end: string
): boolean {
	const rangeStart = plannedStart <= targetDate ? plannedStart : targetDate;
	const rangeEnd = plannedStart <= targetDate ? targetDate : plannedStart;
	return rangeStart <= end && rangeEnd >= start;
}

export function selectedDateKinds(
	dateKinds?: readonly CalendarDateKind[]
): CalendarDateKind[] {
	if (dateKinds === undefined) {
		return [...DATE_KINDS];
	}
	return DATE_KINDS.filter((kind) => dateKinds.includes(kind));
}

export function presentCalendarWindow(input: {
	calendarDay: string;
	dateKinds?: readonly CalendarDateKind[];
	rangeEnd: string;
	rangeStart: string;
	view: CalendarViewName;
	works: readonly DatedCalendarWork[];
}): { positions: CalendarPosition[]; ranges: CalendarRange[] } {
	const kinds = new Set(selectedDateKinds(input.dateKinds));
	const positions: CalendarPosition[] = [];
	const ranges: CalendarRange[] = [];
	const dayView = input.view === UNIFIED_CALENDAR_COPY.day;
	const agendaView = input.view === UNIFIED_CALENDAR_COPY.agenda;
	const windowStart = dayView ? input.calendarDay : input.rangeStart;
	const windowEnd = dayView ? input.calendarDay : input.rangeEnd;
	const useRange =
		!(dayView || agendaView) &&
		kinds.has(UNIFIED_CALENDAR_COPY.plannedStart) &&
		kinds.has(UNIFIED_CALENDAR_COPY.targetDate);
	for (const work of input.works) {
		const asWork = {
			id: work.id,
			key: work.key,
			projectId: work.projectId,
			projectName: work.projectName,
			title: work.title,
		};
		if (
			useRange &&
			work.plannedStart &&
			work.targetDate &&
			rangeOverlapsWindow(
				work.plannedStart,
				work.targetDate,
				windowStart,
				windowEnd
			)
		) {
			ranges.push({
				...asWork,
				end: {
					date: work.targetDate,
					kind: UNIFIED_CALENDAR_COPY.targetDate,
				},
				start: {
					date: work.plannedStart,
					kind: UNIFIED_CALENDAR_COPY.plannedStart,
				},
			});
		} else {
			if (
				kinds.has(UNIFIED_CALENDAR_COPY.plannedStart) &&
				dateInWindow(work.plannedStart, windowStart, windowEnd)
			) {
				positions.push({
					...asWork,
					date: work.plannedStart,
					kind: UNIFIED_CALENDAR_COPY.plannedStart,
				});
			}
			if (
				kinds.has(UNIFIED_CALENDAR_COPY.targetDate) &&
				dateInWindow(work.targetDate, windowStart, windowEnd)
			) {
				positions.push({
					...asWork,
					date: work.targetDate,
					kind: UNIFIED_CALENDAR_COPY.targetDate,
				});
			}
		}
		if (
			kinds.has(UNIFIED_CALENDAR_COPY.reappearDate) &&
			dateInWindow(work.reappearDate, windowStart, windowEnd)
		) {
			positions.push({
				...asWork,
				date: work.reappearDate,
				kind: UNIFIED_CALENDAR_COPY.reappearDate,
			});
		}
	}
	if (agendaView) {
		positions.sort(
			(left, right) =>
				left.date.localeCompare(right.date) ||
				DATE_KINDS.indexOf(left.kind) - DATE_KINDS.indexOf(right.kind) ||
				left.key.localeCompare(right.key)
		);
	}
	return { positions, ranges };
}

function rangeCoversDate(range: CalendarRange, date: string): boolean {
	const start =
		range.start.date <= range.end.date ? range.start.date : range.end.date;
	const end =
		range.start.date <= range.end.date ? range.end.date : range.start.date;
	return start <= date && date <= end;
}

function eachCalendarDateInclusive(start: string, end: string): string[] {
	const dates: string[] = [];
	let current = start;
	while (current <= end) {
		dates.push(current);
		current = addCalendarDays(current, 1);
	}
	return dates;
}

/** Day: one slice, ranges empty. Week/month: every date in the window; a start–target range appears on each day it covers. Agenda: dense days, positions only. */
export function presentCalendarDays(input: {
	calendarDay: string;
	dateKinds?: readonly CalendarDateKind[];
	rangeEnd: string;
	rangeStart: string;
	view: CalendarViewName;
	works: readonly DatedCalendarWork[];
}): CalendarDaySlice[] {
	const presented = presentCalendarWindow(input);
	const dayView = input.view === UNIFIED_CALENDAR_COPY.day;
	const agendaView = input.view === UNIFIED_CALENDAR_COPY.agenda;
	const windowStart = dayView ? input.calendarDay : input.rangeStart;
	const windowEnd = dayView ? input.calendarDay : input.rangeEnd;
	const slices = eachCalendarDateInclusive(windowStart, windowEnd).map(
		(date) => ({
			date,
			positions: presented.positions.filter(
				(position) => position.date === date
			),
			ranges:
				dayView || agendaView
					? []
					: presented.ranges.filter((range) => rangeCoversDate(range, date)),
		})
	);
	if (agendaView) {
		return slices.filter((slice) => slice.positions.length > 0);
	}
	return slices;
}

export function addCalendarDays(day: string, days: number): string {
	const [year, month, date] = day.split("-").map(Number);
	const utc = new Date(
		Date.UTC(year ?? 0, (month ?? 1) - 1, (date ?? 1) + days)
	);
	const pad = (value: number) => String(value).padStart(2, "0");
	return `${utc.getUTCFullYear()}-${pad(utc.getUTCMonth() + 1)}-${pad(utc.getUTCDate())}`;
}

export function monthWindow(day: string): {
	rangeEnd: string;
	rangeStart: string;
} {
	const [year, month] = day.split("-").map(Number);
	const pad = (value: number) => String(value).padStart(2, "0");
	const rangeStart = `${year}-${pad(month ?? 1)}-01`;
	const last = new Date(Date.UTC(year ?? 0, month ?? 1, 0)).getUTCDate();
	return { rangeEnd: `${year}-${pad(month ?? 1)}-${pad(last)}`, rangeStart };
}

export function unifiedCalendarCatalog() {
	return {
		copy: UNIFIED_CALENDAR_COPY,
		counterparts: CALENDAR_COUNTERPARTS,
		dateKinds: DATE_KINDS,
		eventRecord: CALENDAR_EVENT_RECORD,
		kind: "unified-calendar" as const,
		plannedStart: PLANNED_START_EFFECTS,
		views: CALENDAR_VIEWS,
	};
}
