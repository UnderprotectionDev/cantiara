import { expect, test } from "vitest";

import { nextExpandedNodeIds } from "./scope-tree-state";

test("Scope Tree nodes open and close without creating a new parent", () => {
	expect(nextExpandedNodeIds([], "feature-1")).toEqual(["feature-1"]);
	expect(nextExpandedNodeIds(["feature-1"], "feature-1")).toEqual([]);
	expect(nextExpandedNodeIds(["feature-1"], "work-1")).toEqual([
		"feature-1",
		"work-1",
	]);
});
