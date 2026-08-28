import { expect, test } from "vitest";

import { TAGS_COPY } from "./tags-copy";

const MERGE_UI_PATTERN = /mergeTags|tagMerge|archiveTag|usageSuggestion/i;
const CONSUMER_UI_PATTERN =
	/universalSearch|saveSmartCollection|importTagsUi|lineContext|sourceLine/i;

test("English UI uses Tags for the Workspace dictionary", () => {
	expect(TAGS_COPY).toMatchObject({
		allTags: "All tags",
		applyTag: "Apply tag",
		createTag: "Create tag",
		filterByTag: "Filter by tag",
		noMatchingTags: "No matching tags.",
		noTags: "No tags yet.",
		removeTag: "Remove tag",
		renameTag: "Rename Tag",
		suggestedInThisProject: "Suggested in this Project",
		tags: "Tags",
		undo: "Undo",
	});
	expect(JSON.stringify(TAGS_COPY)).not.toMatch(MERGE_UI_PATTERN);
	expect(JSON.stringify(TAGS_COPY)).not.toMatch(CONSUMER_UI_PATTERN);
});
