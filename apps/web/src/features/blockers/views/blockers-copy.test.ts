import { expect, test } from "vitest";

import { BLOCKERS_COPY } from "./blockers-copy";

const KANBAN_TAG_PRIORITY_PATTERN =
	/kanbanColumn|columnColor|priorityScore|tagAsBlocker/i;

test("English UI uses Active, Resolved, Mark blocker resolved, and Remove relation", () => {
	expect(BLOCKERS_COPY).toEqual({
		active: "Active",
		blockedBy: "Blocked by",
		blocks: "Blocks",
		markBlockerResolved: "Mark blocker resolved",
		note: "Note",
		removeRelation: "Remove relation",
		resolved: "Resolved",
		sourceClosedSuggestion:
			"Source is closed. Mark blocker resolved is a separate act.",
	});
	expect(JSON.stringify(BLOCKERS_COPY)).not.toMatch(
		KANBAN_TAG_PRIORITY_PATTERN
	);
});
