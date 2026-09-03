import { expect, test } from "vitest";

import { PROJECT_GOAL_COPY } from "./project-goals-copy";

const FORBIDDEN_SURFACE =
	/Key Result|OKR|progress percent|health score|Milestone|Project Release/i;

test("English Project Goal copy is Project Goal", () => {
	expect(PROJECT_GOAL_COPY.projectGoal).toBe("Project Goal");
	expect(PROJECT_GOAL_COPY.intendedOutcome).toBe("Intended outcome");
	expect(PROJECT_GOAL_COPY.observedOutcome).toBe("Observed outcome / learning");
	expect(PROJECT_GOAL_COPY.create).toBe("Create Project Goal");
	expect(JSON.stringify(PROJECT_GOAL_COPY)).not.toMatch(FORBIDDEN_SURFACE);
});
