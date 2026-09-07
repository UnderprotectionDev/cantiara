import { expect, test } from "vitest";

import {
	DEFAULT_FLOW_NODE_KIND,
	FLOW_NODE_KINDS,
	flowCanvasColorMode,
	placeNodeNeedsScreen,
	shouldFitViewAfterPlace,
	USER_FLOW_COPY,
} from "./user-flow-copy";

const FOREIGN_SURFACE = /Moodboard|Project Wall|Lifeline|state machine|xyflow/i;

test("English User Flow labels stay the closed semantic set and Fit View", () => {
	expect(USER_FLOW_COPY.userFlow).toBe("User Flow");
	expect(USER_FLOW_COPY.screen).toBe("Screen");
	expect(USER_FLOW_COPY.action).toBe("Action");
	expect(USER_FLOW_COPY.decision).toBe("Decision");
	expect(USER_FLOW_COPY.stateOutcome).toBe("State/Outcome");
	expect(USER_FLOW_COPY.section).toBe("Section");
	expect(USER_FLOW_COPY.fitView).toBe("Fit View");
	expect(USER_FLOW_COPY.outline).toBe("Outline");
	expect(USER_FLOW_COPY.inspect).toBe("Inspect");
	expect(USER_FLOW_COPY.unbind).toBe("Unbind");
	expect(USER_FLOW_COPY.undo).toBe("Undo");
	expect(USER_FLOW_COPY.convertAndBind).toBe("Convert and Bind");
	expect(USER_FLOW_COPY.originLocation).toBe("Origin Location");
	expect(USER_FLOW_COPY.promoteToScreen).toBe("Promote to Screen");
	expect(USER_FLOW_COPY.saveAsTemplate).toBe("Save as template");
	expect(USER_FLOW_COPY.createFromTemplate).toBe("Create from template");
	expect(USER_FLOW_COPY.placeLiveCard).toBe("Place live card");
	expect(USER_FLOW_COPY.rebind).toBe("Rebind");
	expect(FLOW_NODE_KINDS).toEqual([
		"Screen",
		"Action",
		"Decision",
		"State/Outcome",
		"Section",
	]);
	expect(JSON.stringify(USER_FLOW_COPY)).not.toMatch(FOREIGN_SURFACE);
});

test("User Flow canvas follows Dark appearance unless Light is resolved", () => {
	expect(flowCanvasColorMode("dark")).toBe("dark");
	expect(flowCanvasColorMode(undefined)).toBe("dark");
	expect(flowCanvasColorMode("light")).toBe("light");
});

test("Place node starts as Action so the canvas can receive a node without a Screen", () => {
	expect(DEFAULT_FLOW_NODE_KIND).toBe(USER_FLOW_COPY.action);
	expect(placeNodeNeedsScreen(USER_FLOW_COPY.screen, "")).toBe(true);
	expect(placeNodeNeedsScreen(USER_FLOW_COPY.screen, "screen-1")).toBe(false);
	expect(placeNodeNeedsScreen(USER_FLOW_COPY.action, "")).toBe(false);
	expect(shouldFitViewAfterPlace(0, 1)).toBe(true);
	expect(shouldFitViewAfterPlace(1, 2)).toBe(false);
});
