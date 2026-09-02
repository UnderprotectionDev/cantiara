import { expect, test } from "vitest";

import { UNIFIED_CALENDAR_COPY } from "./unified-calendar-copy";
import { presentCalendarDateMovePreview } from "./unified-calendar-date-move";

test("date-move preview shows kind plus old and new values before a write", () => {
	expect(
		presentCalendarDateMovePreview({
			fromDate: "2026-09-04",
			kind: UNIFIED_CALENDAR_COPY.targetDate,
			toDate: "2026-09-06",
		})
	).toEqual({
		fromDate: "2026-09-04",
		kind: "Target date",
		label: "Target date 2026-09-04 → 2026-09-06",
		toDate: "2026-09-06",
	});
});
