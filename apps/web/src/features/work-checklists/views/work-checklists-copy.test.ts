import { expect, test } from "vitest";

import { WORK_CHECKLISTS_COPY } from "./work-checklists-copy";

const FORBIDDEN_PRODUCT =
	/subtask|epic|Test Scenario|Handoff|checklist-as-Work/i;

test("English UI uses Checklist for the owned Work component", () => {
	expect(WORK_CHECKLISTS_COPY).toMatchObject({
		addItem: "Add item",
		checklist: "Checklist",
		item: "Item",
		moveDown: "Move down",
		moveUp: "Move up",
		remove: "Remove",
		save: "Save",
	});
	expect(JSON.stringify(WORK_CHECKLISTS_COPY)).not.toMatch(FORBIDDEN_PRODUCT);
});
