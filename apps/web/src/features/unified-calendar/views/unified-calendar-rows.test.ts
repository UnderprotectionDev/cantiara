import { expect, test } from "vitest";

import { UNIFIED_CALENDAR_COPY } from "./unified-calendar-copy";
import {
	calendarDaySections,
	calendarVisibleRows,
} from "./unified-calendar-rows";

function kindsStaySeparate(
	rows: ReturnType<typeof calendarVisibleRows>
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

test("week range keeps Planned start and Target date as separate kinds", () => {
	const rows = calendarVisibleRows({
		positions: [
			{
				date: "2026-09-02",
				id: "work-1",
				key: "PAY-1",
				kind: UNIFIED_CALENDAR_COPY.reappearDate,
				projectId: "p1",
				projectName: "Payments",
				title: "Checkout",
			},
		],
		ranges: [
			{
				end: { date: "2026-09-04", kind: UNIFIED_CALENDAR_COPY.targetDate },
				id: "work-1",
				key: "PAY-1",
				projectId: "p1",
				projectName: "Payments",
				start: { date: "2026-08-31", kind: UNIFIED_CALENDAR_COPY.plannedStart },
				title: "Checkout",
			},
		],
	});
	expect(rows[0]?.kinds).toEqual([
		{ date: "2026-08-31", kind: "Planned start" },
		{ date: "2026-09-04", kind: "Target date" },
	]);
	expect(rows[1]?.kinds).toEqual([
		{ date: "2026-09-02", kind: "Reappear date" },
	]);
	expect(kindsStaySeparate(rows)).toBe(true);
	expect(JSON.stringify(rows)).not.toMatch("Planned start–Target date");
});

test("week sections show the same range on each spanned day", () => {
	const range = {
		end: { date: "2026-09-04", kind: UNIFIED_CALENDAR_COPY.targetDate },
		id: "work-1",
		key: "PAY-1",
		projectId: "p1",
		projectName: "Payments",
		start: { date: "2026-08-31", kind: UNIFIED_CALENDAR_COPY.plannedStart },
		title: "Checkout",
	};
	const sections = calendarDaySections([
		{ date: "2026-08-31", positions: [], ranges: [range] },
		{ date: "2026-09-01", positions: [], ranges: [range] },
		{
			date: "2026-09-02",
			positions: [
				{
					date: "2026-09-02",
					id: "work-1",
					key: "PAY-1",
					kind: UNIFIED_CALENDAR_COPY.reappearDate,
					projectId: "p1",
					projectName: "Payments",
					title: "Checkout",
				},
			],
			ranges: [range],
		},
		{ date: "2026-09-05", positions: [], ranges: [] },
	]);
	expect(sections.map((section) => section.date)).toEqual([
		"2026-08-31",
		"2026-09-01",
		"2026-09-02",
	]);
	expect(sections[1]?.rows[0]?.kinds).toEqual([
		{ date: "2026-08-31", kind: "Planned start" },
		{ date: "2026-09-04", kind: "Target date" },
	]);
	expect(JSON.stringify(sections)).not.toMatch("Planned start–Target date");
});

test("Agenda rows keep the source Work id and show one date kind", () => {
	const rows = calendarVisibleRows({
		positions: [
			{
				date: "2026-09-02",
				id: "work-1",
				key: "PAY-1",
				kind: UNIFIED_CALENDAR_COPY.reappearDate,
				projectId: "p1",
				projectName: "Payments",
				title: "Checkout",
			},
			{
				date: "2026-09-04",
				id: "work-1",
				key: "PAY-1",
				kind: UNIFIED_CALENDAR_COPY.targetDate,
				projectId: "p1",
				projectName: "Payments",
				title: "Checkout",
			},
		],
		ranges: [],
	});
	expect(rows).toEqual([
		{
			href: "/projects/p1?work=work-1#work",
			id: "work-1-Reappear date",
			kinds: [{ date: "2026-09-02", kind: "Reappear date" }],
			openSourceRecord: true,
			projectName: "Payments",
			sourceId: "work-1",
			title: "PAY-1 Checkout",
		},
		{
			href: "/projects/p1?work=work-1#work",
			id: "work-1-Target date",
			kinds: [{ date: "2026-09-04", kind: "Target date" }],
			openSourceRecord: true,
			projectName: "Payments",
			sourceId: "work-1",
			title: "PAY-1 Checkout",
		},
	]);
	expect(new Set(rows.map((row) => row.sourceId))).toEqual(new Set(["work-1"]));
});
