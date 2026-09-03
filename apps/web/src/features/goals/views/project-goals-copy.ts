import type { MUTATION_COPY } from "@/lib/mutation";

export const PROJECT_GOAL_COPY = {
	create: "Create Project Goal",
	description: "Description",
	descriptionRequired: "Description is required.",
	empty: "No Project Goal yet.",
	intendedOutcome: "Intended outcome",
	loading: "Loading…",
	observedOutcome: "Observed outcome / learning",
	projectGoal: "Project Goal",
	save: "Save",
	title: "Title",
	titleRequired: "Title is required.",
	unavailable: "Project Goal is unavailable.",
} as const;

export type ProjectGoalWriteOutcome =
	| { goal: { id: string }; status: "committed" }
	| { reason: typeof MUTATION_COPY.conflict; status: "conflict" }
	| { reason: string; status: "invalid" }
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
