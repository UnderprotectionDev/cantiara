import { MUTATION_COPY } from "../../../lib/mutation";

import { PROJECT_SHELL_COPY } from "./project-shell-copy";

export type ConfigureProjectOutcome =
	| { status: "committed" }
	| { status: "replayed" }
	| { status: "conflict" }
	| { currentValueLabel: string; status: "stale" }
	| { reason: string; status: "rejected" };

export function configureProjectError(
	outcome: ConfigureProjectOutcome
): string | null {
	if (outcome.status === "committed" || outcome.status === "replayed") {
		return null;
	}
	if (outcome.status === "conflict") {
		return MUTATION_COPY.conflict;
	}
	if (outcome.status === "stale") {
		return MUTATION_COPY.currentValue;
	}
	if (outcome.reason === "stage-name-invalid") {
		return PROJECT_SHELL_COPY.stageNameRequired;
	}
	if (outcome.reason === "work-status-label-invalid") {
		return PROJECT_SHELL_COPY.workStatusLabelRequired;
	}
	return PROJECT_SHELL_COPY.unavailable;
}
