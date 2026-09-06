import { expect, test } from "vitest";

import { FLOW_NODE_KINDS, USER_FLOW_COPY } from "./user-flow-copy";

const FOREIGN_SURFACE = /Moodboard|Project Wall|Lifeline|state machine|xyflow/i;

test("English User Flow labels stay the closed semantic set and Fit View", () => {
	expect(USER_FLOW_COPY.userFlow).toBe("User Flow");
	expect(USER_FLOW_COPY.screen).toBe("Screen");
	expect(USER_FLOW_COPY.action).toBe("Action");
	expect(USER_FLOW_COPY.decision).toBe("Decision");
	expect(USER_FLOW_COPY.stateOutcome).toBe("State/Outcome");
	expect(USER_FLOW_COPY.section).toBe("Section");
	expect(USER_FLOW_COPY.fitView).toBe("Fit View");
	expect(USER_FLOW_COPY.undo).toBe("Undo");
	expect(FLOW_NODE_KINDS).toEqual([
		"Screen",
		"Action",
		"Decision",
		"State/Outcome",
		"Section",
	]);
	expect(JSON.stringify(USER_FLOW_COPY)).not.toMatch(FOREIGN_SURFACE);
});
