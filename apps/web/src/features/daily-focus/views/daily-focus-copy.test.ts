import { expect, test } from "vitest";

import { DAILY_FOCUS_COPY } from "./daily-focus-copy";

const FORBIDDEN_SURFACE = /Focus Period|sprint|Active Work Set|Daily Note/;

test("English Daily Focus copy is Daily Focus", () => {
	expect(DAILY_FOCUS_COPY.dailyFocus).toBe("Daily Focus");
	expect(DAILY_FOCUS_COPY.add).toBe("Add");
	expect(DAILY_FOCUS_COPY.remove).toBe("Remove");
	expect(DAILY_FOCUS_COPY.selectedDay).toBe("Selected day");
	expect(DAILY_FOCUS_COPY.empty).toBe("No Work in Daily Focus for this day.");
	expect(DAILY_FOCUS_COPY.whatHappenedToday).toBe("What happened today?");
	expect(DAILY_FOCUS_COPY.openSourceRecord).toBe("Open source record");
	expect(JSON.stringify(DAILY_FOCUS_COPY)).not.toMatch(FORBIDDEN_SURFACE);
});
