import { MUTATION_COPY } from "../../../lib/mutation";

import { PROJECT_SHELL_COPY } from "./project-shell-copy";

export type CopyProjectStructureOutcome =
	| { status: "committed" }
	| { status: "replayed" }
	| { status: "conflict" }
	| { currentValueLabel: string; status: "stale" }
	| { reason: string; status: "rejected" };

export function copyProjectStructureError(
	outcome: CopyProjectStructureOutcome
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
	if (outcome.reason === "missing-project-name") {
		return PROJECT_SHELL_COPY.projectName;
	}
	if (
		outcome.reason === "short-code-taken" ||
		outcome.reason === "short-code-invalid"
	) {
		return PROJECT_SHELL_COPY.shortCode;
	}
	return PROJECT_SHELL_COPY.unavailable;
}
