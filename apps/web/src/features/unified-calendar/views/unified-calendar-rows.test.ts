import { expect, test } from "vitest";

import { UNIFIED_CALENDAR_COPY } from "./unified-calendar-copy";
import {
	calendarVisibleRows,
	kindsStaySeparate,
} from "./unified-calendar-rows";

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
