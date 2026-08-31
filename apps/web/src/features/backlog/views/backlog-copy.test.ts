import { expect, test } from "vitest";

import { BACKLOG_COPY } from "./backlog-copy";

const FOLDER_SPRINT_PATTERN = /folder|sprint|staticList|tagAsBacklog/i;

test("English UI uses Backlog", () => {
	expect(BACKLOG_COPY.backlog).toBe("Backlog");
	expect(JSON.stringify(BACKLOG_COPY)).not.toMatch(FOLDER_SPRINT_PATTERN);
});
