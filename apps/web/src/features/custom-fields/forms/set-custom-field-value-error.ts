import { MUTATION_COPY } from "../../../lib/mutation";

import { CUSTOM_FIELD_COPY } from "./custom-fields-copy";

export type SetCustomFieldValueOutcome =
	| { status: "committed" }
	| { status: "replayed" }
	| { status: "conflict" }
	| { status: "stale"; currentValueLabel?: string }
	| { reason: string; status: "rejected" };

export function setCustomFieldValueError(
	outcome: SetCustomFieldValueOutcome
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
	if (outcome.reason === "value-type-mismatch") {
		return CUSTOM_FIELD_COPY.valueTypeMismatch;
	}
	if (outcome.reason === "unsupported-record-type") {
		return CUSTOM_FIELD_COPY.unsupportedRecordType;
	}
	if (outcome.reason === "unknown-select-option") {
		return CUSTOM_FIELD_COPY.selectOptionsRequired;
	}
	return CUSTOM_FIELD_COPY.unknownFieldType;
}
