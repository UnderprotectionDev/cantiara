import { UNIFIED_CALENDAR_COPY } from "./unified-calendar-copy";

export interface CalendarKindMark {
	date: string;
	kind: string;
}

export interface CalendarVisibleRow {
	href: string;
	id: string;
	kinds: CalendarKindMark[];
	projectName: string;
	title: string;
}

export function calendarVisibleRows(input: {
	positions: readonly {
		date: string;
		id: string;
		key: string;
		kind: string;
		projectId: string;
		projectName: string;
		title: string;
	}[];
	ranges: readonly {
		end: { date: string; kind: string };
		id: string;
		key: string;
		projectId: string;
		projectName: string;
		start: { date: string; kind: string };
		title: string;
	}[];
}): CalendarVisibleRow[] {
	return [
		...input.ranges.map((row) => ({
			href: workHref(row.projectId, row.id),
			id: `${row.id}-range`,
			kinds: [row.start, row.end],
			projectName: row.projectName,
			title: `${row.key} ${row.title}`,
		})),
		...input.positions.map((row) => ({
			href: workHref(row.projectId, row.id),
			id: `${row.id}-${row.kind}`,
			kinds: [{ date: row.date, kind: row.kind }],
			projectName: row.projectName,
			title: `${row.key} ${row.title}`,
		})),
	];
}

export function kindsStaySeparate(
	rows: readonly CalendarVisibleRow[]
): boolean {
	return rows.every((row) =>
		row.kinds.every(
			(mark) =>
				mark.kind === UNIFIED_CALENDAR_COPY.plannedStart ||
				mark.kind === UNIFIED_CALENDAR_COPY.targetDate ||
				mark.kind === UNIFIED_CALENDAR_COPY.reappearDate
		)
	);
}

function workHref(projectId: string, workId: string): string {
	return `/projects/${projectId}?work=${encodeURIComponent(workId)}#work`;
}
