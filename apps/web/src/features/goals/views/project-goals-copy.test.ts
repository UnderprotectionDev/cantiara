import { expect, test } from "vitest";

import {
	PROJECT_GOAL_COPY,
	projectGoalWriteNotice,
} from "./project-goals-copy";

const FORBIDDEN_SURFACE =
	/Key Result|OKR|progress percent|health score|Milestone|Project Release/i;

test("English Project Goal copy is Project Goal", () => {
	expect(PROJECT_GOAL_COPY.projectGoal).toBe("Project Goal");
	expect(PROJECT_GOAL_COPY.intendedOutcome).toBe("Intended outcome");
	expect(PROJECT_GOAL_COPY.observedOutcome).toBe("Observed outcome / learning");
	expect(PROJECT_GOAL_COPY.create).toBe("Create Project Goal");
	expect(PROJECT_GOAL_COPY.contributesToGoal).toBe("Contributes to Goal");
	expect(PROJECT_GOAL_COPY.inGoal).toBe("In Goal");
	expect(PROJECT_GOAL_COPY.openSourceRecord).toBe("Open source record");
	expect(PROJECT_GOAL_COPY.unavailable).toBe("Project Goal is unavailable.");
	expect(JSON.stringify(PROJECT_GOAL_COPY)).not.toMatch(FORBIDDEN_SURFACE);
});

test("Create Project Goal shows a write notice instead of staying empty", () => {
	expect(
		projectGoalWriteNotice({
			goal: { id: "goal-1" },
			status: "committed",
		})
	).toBeNull();
	expect(
		projectGoalWriteNotice({
			reason: PROJECT_GOAL_COPY.titleRequired,
			status: "invalid",
		})
	).toBe("Title is required.");
	expect(
		projectGoalWriteNotice({
			reason: PROJECT_GOAL_COPY.descriptionRequired,
			status: "invalid",
		})
	).toBe("Description is required.");
	expect(projectGoalWriteNotice({ status: "not-found" })).toBe(
		"Project Goal is unavailable."
	);
	expect(
		projectGoalWriteNotice({
			reason: "Conflict",
			status: "conflict",
		})
	).toBe("Conflict");
	expect(
		projectGoalWriteNotice({
			reason: "ends-not-allowed",
			status: "rejected",
		})
	).toBe("ends-not-allowed");
});
