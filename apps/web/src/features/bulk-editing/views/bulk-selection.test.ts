import { expect, test } from "vitest";

import { BULK_EDITING_COPY } from "./bulk-editing-copy";
import { bulkEditTargetIds, nextBulkSelectedWorkIds } from "./bulk-selection";

const SCHEMA_IMPORT_PATTERN =
	/schema migration|create field|import records|select all unspecified/i;

test("English Bulk Edit has no schema, import, or select-all-unspecified copy", () => {
	expect(BULK_EDITING_COPY.bulkEdit).toBe("Bulk Edit");
	expect(JSON.stringify(BULK_EDITING_COPY)).not.toMatch(SCHEMA_IMPORT_PATTERN);
});

test("filter-visible Work is not an implicit Bulk Edit selection", () => {
	expect(
		bulkEditTargetIds({
			selectedWorkIds: [],
			visibleWorkIds: ["work-1", "work-2"],
		})
	).toEqual([]);
	expect(
		bulkEditTargetIds({
			selectedWorkIds: ["work-2", "work-3"],
			visibleWorkIds: ["work-1", "work-2"],
		})
	).toEqual(["work-2"]);
});

test("Bulk Edit selection toggles only the clicked Work", () => {
	expect(nextBulkSelectedWorkIds([], "work-1", true)).toEqual(["work-1"]);
	expect(nextBulkSelectedWorkIds(["work-1"], "work-2", true)).toEqual([
		"work-1",
		"work-2",
	]);
	expect(
		nextBulkSelectedWorkIds(["work-1", "work-2"], "work-1", false)
	).toEqual(["work-2"]);
});
