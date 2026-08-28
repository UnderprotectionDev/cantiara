import { MUTATION_COPY } from "../../../lib/mutation";

import { CUSTOM_FIELD_COPY } from "./custom-fields-copy";

export type CreateCustomFieldOutcome =
	| { status: "committed" }
	| { status: "replayed" }
	| { status: "conflict" }
	| { reason: string; status: "rejected" };

export function createCustomFieldError(
	outcome: CreateCustomFieldOutcome
): string | null {
	if (outcome.status === "committed" || outcome.status === "replayed") {
		return null;
	}
	if (outcome.status === "conflict") {
		return MUTATION_COPY.conflict;
	}
	if (outcome.reason === "missing-name") {
		return CUSTOM_FIELD_COPY.nameRequired;
	}
	if (outcome.reason === "missing-bound-record-types") {
		return CUSTOM_FIELD_COPY.boundRecordTypesRequired;
	}
	if (outcome.reason === "missing-select-options") {
		return CUSTOM_FIELD_COPY.selectOptionsRequired;
	}
	if (outcome.reason === "unknown-field-type") {
		return CUSTOM_FIELD_COPY.unknownFieldType;
	}
	if (outcome.reason === "unsupported-record-type") {
		return CUSTOM_FIELD_COPY.unsupportedRecordType;
	}
	return CUSTOM_FIELD_COPY.unknownFieldType;
}
