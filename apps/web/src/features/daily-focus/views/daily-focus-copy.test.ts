import { expect, test } from "vitest";

import { DAILY_FOCUS_COPY } from "./daily-focus-copy";

const FORBIDDEN_SURFACE = /Focus Period|sprint|Active Work Set|Daily Note/;

test("English Daily Focus copy is Daily Focus", () => {
	expect(DAILY_FOCUS_COPY.dailyFocus).toBe("Daily Focus");
	expect(DAILY_FOCUS_COPY.add).toBe("Add");
	expect(DAILY_FOCUS_COPY.remove).toBe("Remove");
	expect(DAILY_FOCUS_COPY.selectedDay).toBe("Selected day");
	expect(DAILY_FOCUS_COPY.empty).toBe("No Work in Daily Focus for this day.");
	expect(DAILY_FOCUS_COPY.closeFocus).toBe("Close focus");
	expect(DAILY_FOCUS_COPY.openSourceRecord).toBe("Open source record");
	expect(DAILY_FOCUS_COPY.completed).toBe("Completed");
	expect(DAILY_FOCUS_COPY.abandoned).toBe("Abandoned");
	expect(DAILY_FOCUS_COPY.deferred).toBe("Deferred");
	expect(DAILY_FOCUS_COPY.stillOpen).toBe("Still open");
	expect(JSON.stringify(DAILY_FOCUS_COPY)).not.toMatch(FORBIDDEN_SURFACE);
});
