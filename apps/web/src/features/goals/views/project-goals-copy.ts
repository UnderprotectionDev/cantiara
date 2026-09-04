export const PROJECT_GOAL_COPY = {
	contributesToGoal: "Contributes to Goal",
	create: "Create Project Goal",
	description: "Description",
	descriptionRequired: "Description is required.",
	empty: "No Project Goal yet.",
	inGoal: "In Goal",
	intendedOutcome: "Intended outcome",
	loading: "Loading…",
	noContributions: "No Contributes to Goal yet.",
	observedOutcome: "Observed outcome / learning",
	openQuestion: "Open Question",
	openSourceRecord: "Open source record",
	projectGoal: "Project Goal",
	remove: "Remove",
	risk: "Risk",
	save: "Save",
	title: "Title",
	titleRequired: "Title is required.",
	unavailable: "Project Goal is unavailable.",
} as const;

export type ProjectGoalWriteOutcome =
	| { goal: { id: string }; status: "committed" }
	| { reason: "Conflict"; status: "conflict" }
	| { reason: string; status: "invalid" }
	| { reason?: string; status: "rejected" }
	| { status: "not-found" };

export function projectGoalWriteNotice(
	outcome: ProjectGoalWriteOutcome,
	copy: { unavailable: string } = PROJECT_GOAL_COPY
): string | null {
	if (outcome.status === "committed") {
		return null;
	}
	if (outcome.status === "invalid" || outcome.status === "conflict") {
		return outcome.reason;
	}
	return copy.unavailable;
}
