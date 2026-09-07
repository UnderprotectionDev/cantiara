import { describe, expect, it } from "vitest";

import {
	outlineShowsConvertAndBind,
	SCREENS_COPY,
	WIREFRAME_NODE_KINDS,
	WIREFRAME_PANE_CLASS,
	WIREFRAME_STAGE_TYPEFACE,
	wireframeCanvasInk,
	wireframeKindMarks,
	wireframeWriteRefetch,
} from "./screens-copy";

const OUT_OF_SCOPE_COPY = /User Flow editor|Moodboard|Document/;

describe("Screens copy", () => {
	it("uses Screen English UI and keeps User Flow editor out", () => {
		expect(SCREENS_COPY.screen).toBe("Screen");
		expect(SCREENS_COPY.createScreen).toBe("Create Screen");
		expect(SCREENS_COPY.titleRequired).toBe("Title is required.");
		expect(SCREENS_COPY.detachLink).toBe("Detach Link");
		expect(SCREENS_COPY.convertAndBind).toBe("Convert and Bind");
		expect(SCREENS_COPY.originLocation).toBe("Origin Location");
		expect(SCREENS_COPY.project).toBe("Project");
		expect(SCREENS_COPY.createFromTemplate).toBe("Create Screen from template");
		expect(SCREENS_COPY.openSourceRecord).toBe("Open Source Record");
		expect(SCREENS_COPY.sourceItemIsGone).toBe("Source item is gone");
		expect(SCREENS_COPY.broken).toBe("Broken");
		expect(SCREENS_COPY.button).toBe("Button");
		expect(SCREENS_COPY.presentationMode).toBe("Presentation Mode");
		expect(SCREENS_COPY.exitPresentationMode).toBe("Exit Presentation Mode");
		expect(SCREENS_COPY.unresolved).toBe("Unresolved");
		expect(SCREENS_COPY.fitView).toBe("Fit View");
		expect(SCREENS_COPY.outline).toBe("Outline");
		expect(SCREENS_COPY.openSourceRecord).toBe("Open Source Record");
		expect(SCREENS_COPY.moveToTrash).toBe("Move to Trash");
		expect(SCREENS_COPY.wireframe).toBe("Wireframe");
		expect(WIREFRAME_NODE_KINDS).toEqual([
			"Button",
			"Input",
			"Card",
			"Table",
			"Navigation",
			"Chart",
			"Text",
		]);
		expect(WIREFRAME_PANE_CLASS).toContain("w-full");
		expect(WIREFRAME_PANE_CLASS).toContain("min-h-[32rem]");
		expect(JSON.stringify(SCREENS_COPY)).not.toMatch(OUT_OF_SCOPE_COPY);
	});

	it("draws Wireframe ink that stays visible on Dark appearance", () => {
		expect(wireframeCanvasInk("dark").box).toBe("#262626");
		expect(wireframeCanvasInk("dark").stroke).toBe("#e5e5e5");
		expect(wireframeCanvasInk(undefined).stroke).toBe("#e5e5e5");
		expect(wireframeCanvasInk("light").stroke).toBe("#171717");
		expect(WIREFRAME_STAGE_TYPEFACE).toBe("sans-serif");
		expect(wireframeKindMarks(SCREENS_COPY.button, 120, 40)).toEqual([]);
		expect(wireframeKindMarks(SCREENS_COPY.input, 120, 40)[0]).toMatchObject({
			id: "input-baseline",
			points: [8, 32, 112, 32],
			type: "line",
		});
		expect(wireframeKindMarks(SCREENS_COPY.table, 90, 90)).toHaveLength(3);
	});

	it("keeps Convert and Bind on the selected Outline block only", () => {
		expect(
			outlineShowsConvertAndBind({
				hasLiveRecord: false,
				selected: false,
				toolsHidden: false,
				versionNumber: 1,
			})
		).toBe(false);
		expect(
			outlineShowsConvertAndBind({
				hasLiveRecord: false,
				selected: true,
				toolsHidden: false,
				versionNumber: 1,
			})
		).toBe(true);
		expect(
			outlineShowsConvertAndBind({
				hasLiveRecord: true,
				selected: true,
				toolsHidden: false,
				versionNumber: 1,
			})
		).toBe(false);
	});

	it("does not refetch Screen list or viewport after Wireframe geometry writes", () => {
		expect(wireframeWriteRefetch("geometry")).toEqual({
			get: false,
			getVersion: true,
			getViewport: false,
			list: false,
			parentScreen: false,
		});
		expect(wireframeWriteRefetch("viewport").getViewport).toBe(false);
		expect(wireframeWriteRefetch("outline")).toEqual({
			get: false,
			getVersion: true,
			getViewport: false,
			list: false,
			parentScreen: false,
		});
	});
});
