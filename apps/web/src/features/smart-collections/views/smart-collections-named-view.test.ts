import { expect, test } from "vitest";

import {
	draftFromView,
	isDraftDirty,
	liveNewWorkMiss,
	type NamedViewSummary,
} from "./smart-collections-named-view-model";

const saved: NamedViewSummary = {
	filterText: "",
	groupField: null,
	id: "view-default",
	isDefault: true,
	name: "Default",
	presentation: "List",
	purpose: null,
	sortDirection: null,
	sortField: null,
	visibleFields: ["title"],
};

test("named view stays dirty when purpose or visible fields change", () => {
	const draft = draftFromView(saved);
	expect(isDraftDirty(saved, draft)).toBe(false);
	expect(isDraftDirty(saved, { ...draft, purpose: "Daily triage" })).toBe(true);
	expect(
		isDraftDirty(saved, { ...draft, visibleFields: ["title", "status"] })
	).toBe(true);
});

test("New work warns while a prefilled equals value would miss", () => {
	expect(
		liveNewWorkMiss(
			{ status: "In Progress", type: "Task" },
			{ status: "Not Started", type: "Task" }
		)
	).toBe(true);
	expect(
		liveNewWorkMiss(
			{ status: "In Progress", type: "Task" },
			{ status: "In Progress", type: "Task" }
		)
	).toBe(false);
});
