export interface CalendarKindMark {
	date: string;
	kind: string;
}

export interface CalendarVisibleRow {
	href: string;
	id: string;
	kinds: CalendarKindMark[];
	projectName: string;
	revision: number;
	title: string;
	workId: string;
}

export interface CalendarDaySection {
	date: string;
	rows: CalendarVisibleRow[];
}

export function calendarVisibleRows(input: {
	positions: readonly {
		date: string;
		id: string;
		key: string;
		kind: string;
		projectId: string;
		projectName: string;
		revision: number;
		title: string;
	}[];
	ranges: readonly {
		end: { date: string; kind: string };
		id: string;
		key: string;
		projectId: string;
		projectName: string;
		revision: number;
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
			revision: row.revision,
			title: `${row.key} ${row.title}`,
			workId: row.id,
		})),
		...input.positions.map((row) => ({
			href: workHref(row.projectId, row.id),
			id: `${row.id}-${row.kind}`,
			kinds: [{ date: row.date, kind: row.kind }],
			projectName: row.projectName,
			revision: row.revision,
			title: `${row.key} ${row.title}`,
			workId: row.id,
		})),
	];
}

export function calendarDaySections(
	days: readonly {
		date: string;
		positions: Parameters<typeof calendarVisibleRows>[0]["positions"];
		ranges: Parameters<typeof calendarVisibleRows>[0]["ranges"];
	}[]
): CalendarDaySection[] {
	return days
		.map((day) => ({
			date: day.date,
			rows: calendarVisibleRows({
				positions: day.positions,
				ranges: day.ranges,
			}).map((row) => ({
				...row,
				id: `${row.id}-${day.date}`,
			})),
		}))
		.filter((section) => section.rows.length > 0);
}

function workHref(projectId: string, workId: string): string {
	return `/projects/${projectId}?work=${encodeURIComponent(workId)}#work`;
}
