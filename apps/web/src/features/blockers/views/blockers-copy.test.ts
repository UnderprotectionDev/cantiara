import { expect, test } from "vitest";

import { BLOCKERS_COPY } from "./blockers-copy";

const KANBAN_TAG_PRIORITY_PATTERN =
	/kanbanColumn|columnColor|priorityScore|tagAsBlocker/i;

test("English UI uses Active and Remove relation", () => {
	expect(BLOCKERS_COPY).toEqual({
		active: "Active",
		blockedBy: "Blocked by",
		blocks: "Blocks",
		removeRelation: "Remove relation",
	});
	expect(JSON.stringify(BLOCKERS_COPY)).not.toMatch(
		KANBAN_TAG_PRIORITY_PATTERN
	);
});
