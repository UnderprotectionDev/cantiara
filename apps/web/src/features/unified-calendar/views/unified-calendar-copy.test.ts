import { expect, test } from "vitest";

import { UNIFIED_CALENDAR_COPY } from "./unified-calendar-copy";

const FORBIDDEN_SURFACE = /sprint|ICS|iCal|Google Calendar|Outlook/;

test("English Calendar copy is Calendar, Day, Week, and Month", () => {
	expect(UNIFIED_CALENDAR_COPY.calendar).toBe("Calendar");
	expect(UNIFIED_CALENDAR_COPY.day).toBe("Day");
	expect(UNIFIED_CALENDAR_COPY.week).toBe("Week");
	expect(UNIFIED_CALENDAR_COPY.month).toBe("Month");
	expect(UNIFIED_CALENDAR_COPY.plannedStart).toBe("Planned start");
	expect(UNIFIED_CALENDAR_COPY.targetDate).toBe("Target date");
	expect(UNIFIED_CALENDAR_COPY.reappearDate).toBe("Reappear date");
	expect(UNIFIED_CALENDAR_COPY.selectedDay).toBe("Selected day");
	expect(UNIFIED_CALENDAR_COPY.allProjects).toBe("All Projects");
	expect(UNIFIED_CALENDAR_COPY.empty).toBe(
		"No dated Work in this Calendar view."
	);
	expect(JSON.stringify(UNIFIED_CALENDAR_COPY)).not.toMatch(FORBIDDEN_SURFACE);
});
