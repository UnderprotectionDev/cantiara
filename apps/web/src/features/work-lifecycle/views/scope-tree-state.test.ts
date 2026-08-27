import { expect, test } from "vitest";

import { nextExpandedNodeIds } from "./scope-tree-state";

test("Scope Tree nodes open and close without creating a new parent", () => {
	expect(nextExpandedNodeIds([], "project-1")).toEqual(["project-1"]);
	expect(nextExpandedNodeIds(["project-1"], "project-1")).toEqual([]);
	expect(nextExpandedNodeIds(["project-1"], "feature-1")).toEqual([
		"project-1",
		"feature-1",
	]);
});
