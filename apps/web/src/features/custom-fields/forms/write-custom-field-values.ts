import type { OnlineWorkKind } from "@/features/web-macos-client/views/client-shell";
import { newIdempotencyKey } from "@/lib/mutation";

import {
	type CustomFieldStoredValue,
	type CustomFieldValueView,
	UNSET_CUSTOM_FIELD_VALUE,
} from "./custom-fields-copy";
import {
	type SetCustomFieldValueOutcome,
	setCustomFieldValueError,
} from "./set-custom-field-value-error";

type AttemptOnlineWork = <T>(
	kind: OnlineWorkKind,
	work: () => T
) => { status: "refused" } | { status: "applied"; value: T };

export async function writeCustomFieldValues(input: {
	attempt: AttemptOnlineWork;
	fields: readonly CustomFieldValueView[];
	recordId: string;
	recordType: string;
	setValue: (command: {
		baseRevision: number;
		idempotencyKey: string;
		payload: {
			definitionId: string;
			recordId: string;
			recordType: string;
			value: CustomFieldStoredValue;
		};
	}) => Promise<SetCustomFieldValueOutcome>;
	values: Readonly<Record<string, CustomFieldStoredValue>>;
}): Promise<string | null> {
	const outcomes = await Promise.all(
		input.fields.map(async (field) => {
			const result = input.attempt("record-create", () =>
				input.setValue({
					baseRevision: field.revision,
					idempotencyKey: newIdempotencyKey(),
					payload: {
						definitionId: field.definitionId,
						recordId: input.recordId,
						recordType: input.recordType,
						value: input.values[field.definitionId] ?? UNSET_CUSTOM_FIELD_VALUE,
					},
				})
			);
			if (result.status === "refused") {
				return { reason: "offline", status: "rejected" as const };
			}
			return await result.value;
		})
	);
	for (const outcome of outcomes) {
		const message = setCustomFieldValueError(outcome);
		if (message) {
			return message;
		}
	}
	return null;
}
