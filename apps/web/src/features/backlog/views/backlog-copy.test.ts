import { expect, test } from "vitest";

import { BACKLOG_COPY, BACKLOG_SORTS } from "./backlog-copy";

const FOLDER_SPRINT_PATTERN = /folder|sprint|staticList|tagAsBacklog/i;

test("English UI uses Backlog, Manual order, Deferred, and Reappear date", () => {
	expect(BACKLOG_COPY.backlog).toBe("Backlog");
	expect(BACKLOG_COPY.manualOrder).toBe("Manual order");
	expect(BACKLOG_COPY.deferred).toBe("Deferred");
	expect(BACKLOG_COPY.reappearDate).toBe("Reappear date");
	expect(BACKLOG_COPY.notifyOnReappearDate).toBe("Notify on Reappear date");
	expect(BACKLOG_SORTS).toEqual(["Manual order", "Priority", "Date", "Field"]);
	expect(JSON.stringify(BACKLOG_COPY)).not.toMatch(FOLDER_SPRINT_PATTERN);
});
