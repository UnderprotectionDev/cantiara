import { MUTATION_COPY } from "../../../lib/mutation";

import { RECORD_ACTION_COPY } from "./record-actions-copy";

export type RecordActionMutationOutcome =
	| { status: "committed" }
	| { status: "replayed" }
	| { status: "conflict" }
	| { status: "stale" }
	| { explanation?: string; reason: string; status: "rejected" };

export function recordActionMutationError(
	outcome: RecordActionMutationOutcome
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
	if (outcome.explanation) {
		return outcome.explanation;
	}
	if (outcome.reason === "missing-name") {
		return RECORD_ACTION_COPY.nameRequired;
	}
	if (outcome.reason === "forbidden-step") {
		return RECORD_ACTION_COPY.forbiddenStep;
	}
	if (outcome.reason === "forbidden-input") {
		return RECORD_ACTION_COPY.forbiddenInput;
	}
	if (outcome.reason === "missing-runtime-input") {
		return RECORD_ACTION_COPY.missingRuntimeInput;
	}
	if (outcome.reason === "related-record-required") {
		return RECORD_ACTION_COPY.relatedRecordRequired;
	}
	if (outcome.reason === "unknown-input") {
		return RECORD_ACTION_COPY.unknownInput;
	}
	if (outcome.reason === "multi-target") {
		return RECORD_ACTION_COPY.multiTarget;
	}
	if (outcome.reason === "bulk-edit-not-allowed") {
		return RECORD_ACTION_COPY.bulkEditNotAllowed;
	}
	if (outcome.reason === "explicit-start-required") {
		return RECORD_ACTION_COPY.explicitStartRequired;
	}
	if (outcome.reason === "preview-mismatch") {
		return RECORD_ACTION_COPY.previewMismatch;
	}
	if (outcome.reason === "close-step-required") {
		return RECORD_ACTION_COPY.closeStepRequired;
	}
	if (outcome.reason === "later-write") {
		return RECORD_ACTION_COPY.laterWrite;
	}
	if (outcome.reason === "undo-not-safe") {
		return RECORD_ACTION_COPY.undoNotSafe;
	}
	if (outcome.reason === "trashed-not-effective") {
		return RECORD_ACTION_COPY.trashedNotEffective;
	}
	if (outcome.reason === "unknown-step") {
		return RECORD_ACTION_COPY.unknownStep;
	}
	return RECORD_ACTION_COPY.unknownStep;
}
