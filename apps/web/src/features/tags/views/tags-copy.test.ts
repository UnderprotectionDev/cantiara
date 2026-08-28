import { expect, test } from "vitest";

import { TAGS_COPY } from "./tags-copy";

test("English UI uses Tags for the Workspace dictionary", () => {
	expect(TAGS_COPY).toMatchObject({
		allTags: "All tags",
		applyTag: "Apply tag",
		createTag: "Create tag",
		filterByTag: "Filter by tag",
		noMatchingTags: "No matching tags.",
		noTags: "No tags yet.",
		removeTag: "Remove tag",
		suggestedInThisProject: "Suggested in this Project",
		tags: "Tags",
	});
});
