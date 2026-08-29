import { MUTATION_COPY } from "../../../lib/mutation";

import { WORK_TEMPLATE_COPY } from "./work-templates-copy";

export type WorkTemplateMutationOutcome =
	| { status: "committed" }
	| { status: "replayed" }
	| { status: "conflict" }
	| { reason: string; status: "rejected" };

export function workTemplateMutationError(
	outcome: WorkTemplateMutationOutcome
): string | null {
	if (outcome.status === "committed" || outcome.status === "replayed") {
		return null;
	}
	if (outcome.status === "conflict") {
		return MUTATION_COPY.conflict;
	}
	if (outcome.reason === "missing-name") {
		return WORK_TEMPLATE_COPY.nameRequired;
	}
	if (outcome.reason === "unknown-work-type") {
		return WORK_TEMPLATE_COPY.unknownWorkType;
	}
	if (outcome.reason === "document-placeholder") {
		return WORK_TEMPLATE_COPY.documentPlaceholderRefused;
	}
	if (outcome.reason === "relative-date-unresolved") {
		return WORK_TEMPLATE_COPY.relativeDateUnresolved;
	}
	if (outcome.reason === "preview-required") {
		return WORK_TEMPLATE_COPY.previewRequired;
	}
	if (outcome.reason === "trashed-not-effective") {
		return WORK_TEMPLATE_COPY.trashedNotEffective;
	}
	if (
		outcome.reason === "forbidden-payload" ||
		outcome.reason === "absolute-date" ||
		outcome.reason === "date-field-default"
	) {
		return WORK_TEMPLATE_COPY.forbiddenPayload;
	}
	return WORK_TEMPLATE_COPY.unknownWorkType;
}
