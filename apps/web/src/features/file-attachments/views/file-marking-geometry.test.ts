import { expect, test } from "vitest";

import {
	isMarkingTool,
	normalizePoint,
	regionFromDrag,
	undoDrawnMarks,
} from "./file-marking-geometry";

test("marking tools stay pen, highlighter, arrow, and rectangle", () => {
	expect(isMarkingTool("pen")).toBe(true);
	expect(isMarkingTool("comment")).toBe(false);
	expect(
		undoDrawnMarks([
			{ geometry: {}, id: "1", tool: "pen" },
			{ geometry: {}, id: "2", tool: "arrow" },
		])
	).toEqual([{ geometry: {}, id: "1", tool: "pen" }]);
	expect(normalizePoint(50, 25, 100, 100)).toEqual({ x: 0.5, y: 0.25 });
	expect(regionFromDrag({ x: 0.5, y: 0.4 }, { x: 0.2, y: 0.2 })).toEqual({
		height: 0.2,
		width: 0.3,
		x: 0.2,
		y: 0.2,
	});
});
