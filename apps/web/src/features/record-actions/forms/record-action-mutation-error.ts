import { MUTATION_COPY } from "../../../lib/mutation";

import { RECORD_ACTION_COPY } from "./record-actions-copy";

export type RecordActionMutationOutcome =
	| { status: "committed" }
	| { status: "replayed" }
	| { status: "conflict" }
	| { reason: string; status: "rejected" };

export function recordActionMutationError(
	outcome: RecordActionMutationOutcome
): string | null {
	if (outcome.status === "committed" || outcome.status === "replayed") {
		return null;
	}
	if (outcome.status === "conflict") {
		return MUTATION_COPY.conflict;
	}
	if (outcome.reason === "missing-name") {
		return RECORD_ACTION_COPY.nameRequired;
	}
	if (outcome.reason === "forbidden-step") {
		return RECORD_ACTION_COPY.forbiddenStep;
	}
	if (outcome.reason === "multi-target") {
		return RECORD_ACTION_COPY.multiTarget;
	}
	if (outcome.reason === "bulk-edit-not-allowed") {
		return RECORD_ACTION_COPY.bulkEditNotAllowed;
	}
	if (outcome.reason === "trashed-not-effective") {
		return RECORD_ACTION_COPY.trashedNotEffective;
	}
	if (outcome.reason === "unknown-step") {
		return RECORD_ACTION_COPY.unknownStep;
	}
	return RECORD_ACTION_COPY.unknownStep;
}
