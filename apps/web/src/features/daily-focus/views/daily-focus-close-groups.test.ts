import { expect, test } from "vitest";

import { dailyFocusCloseGroups } from "./daily-focus-close-groups";
import { DAILY_FOCUS_COPY } from "./daily-focus-copy";

test("Close focus groups completed, abandoned, deferred, and still-open Work", () => {
	expect(dailyFocusCloseGroups(DAILY_FOCUS_COPY)).toEqual([
		{ heading: "Completed", key: "completed" },
		{ heading: "Abandoned", key: "abandoned" },
		{ heading: "Deferred", key: "reappearDeferred" },
		{ heading: "Still open", key: "stillOpen" },
	]);
});
