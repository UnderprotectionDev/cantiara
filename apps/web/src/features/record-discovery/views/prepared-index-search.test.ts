import { expect, test } from "vitest";
import {
	PREPARED_INDEX_LABELS,
	preparedIndexHref,
	preparedIndexSearch,
	preparedIndexTypeFilters,
	preparedIndexUsesFolderFilters,
	preparedIndexUsesStatusFilters,
} from "./prepared-index-search";
import { RECORD_DISCOVERY_COPY } from "./record-discovery-copy";

test("prepared indexes open from a type selector path, not per-type main nav", () => {
	expect(PREPARED_INDEX_LABELS).toEqual([
		"All Work",
		"All Documents",
		"All Decisions",
		"All Risks",
		"All Research Sessions",
		"All Tests",
		"All Designs",
		"All Technical Diagrams",
		"All Project Releases",
		"All Sources",
		"All Files",
	]);
	expect(preparedIndexHref(RECORD_DISCOVERY_COPY.allWork)).toBe(
		"/indexes?index=All+Work"
	);
	expect(
		preparedIndexSearch({ folder: "Research", index: "All Documents" })
	).toEqual({
		folder: "Research",
		index: "All Documents",
	});
	expect(preparedIndexSearch({}).index).toBe("All Work");
	expect(preparedIndexUsesFolderFilters("All Documents")).toBe(true);
	expect(preparedIndexUsesFolderFilters("All Files")).toBe(true);
	expect(preparedIndexUsesFolderFilters("All Work")).toBe(false);
	expect(preparedIndexUsesStatusFilters("All Decisions")).toBe(true);
	expect(preparedIndexUsesStatusFilters("All Work")).toBe(false);
	expect(preparedIndexTypeFilters("All Tests")).toEqual([
		"Planned Test Case",
		"Test Handoff",
		"Test Session",
		"Session Test",
		"Test Gap",
		"Test assessment",
	]);
	expect(preparedIndexTypeFilters("All Technical Diagrams")).toEqual([
		"Technical Architecture",
		"Data Model",
		"Technical Sequence",
	]);
});
