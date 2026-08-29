import { MUTATION_COPY } from "../../../lib/mutation";

import { PRIORITY_COPY } from "./priority-copy";

export type PriorityCriterionOutcome =
	| { status: "committed" }
	| { status: "replayed" }
	| { status: "conflict" }
	| { reason: string; status: "rejected" };

export function createPriorityCriterionError(
	outcome: PriorityCriterionOutcome
): string | null {
	if (outcome.status === "committed" || outcome.status === "replayed") {
		return null;
	}
	if (outcome.status === "conflict") {
		return MUTATION_COPY.conflict;
	}
	if (outcome.reason === "missing-name") {
		return PRIORITY_COPY.nameRequired;
	}
	if (outcome.reason === "unknown-rank") {
		return PRIORITY_COPY.unknownRank;
	}
	return PRIORITY_COPY.nameRequired;
}
