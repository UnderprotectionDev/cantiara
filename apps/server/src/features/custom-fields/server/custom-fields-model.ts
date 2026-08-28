import { z } from "zod";

export const CUSTOM_FIELD_TYPES = [
	"Text",
	"Number",
	"Boolean",
	"Date",
	"Single select",
	"Multi select",
] as const;

export type CustomFieldType = (typeof CUSTOM_FIELD_TYPES)[number];

export const BINDABLE_RECORD_TYPES = [
	"Work",
	"Feedback",
	"User Research Session",
	"Risk",
	"Assumption",
	"Decision",
	"Test Handoff",
	"Test Session",
	"Planned Test Scenario",
	"Test Gap",
	"Production Incident",
	"Milestone",
	"Project Release",
] as const;

export type BindableRecordType = (typeof BINDABLE_RECORD_TYPES)[number];

export const CUSTOM_FIELD_COPY = {
	addCustomField: "Add custom field",
	addOption: "Add option",
	boolean: "Boolean",
	booleanFalse: "False",
	booleanTrue: "True",
	boundRecordTypes: "Bound record types",
	boundRecordTypesRequired: "Bound record types are required.",
	customField: "Custom field",
	date: "Date",
	filter: "Filter",
	multiSelect: "Multi select",
	name: "Name",
	nameRequired: "Name is required.",
	notEvaluated: "Not evaluated",
	number: "Number",
	options: "Options",
	save: "Save",
	search: "Search",
	selectOptionsRequired: "Options are required.",
	singleSelect: "Single select",
	text: "Text",
	type: "Type",
	unknownFieldType: "Unknown field type.",
	unsupportedRecordType: "This record type cannot carry a Custom field.",
	valueTypeMismatch: "This value does not match the Custom field type.",
} as const;

export const createCustomFieldPayloadSchema = z.object({
	boundRecordTypes: z.array(z.string()).optional(),
	name: z.string().optional(),
	options: z.array(z.string()).optional(),
	projectId: z.string().min(1),
	type: z.string().optional(),
});

export type CreateCustomFieldPayload = z.infer<
	typeof createCustomFieldPayloadSchema
>;

export const createCustomFieldCommandSchema = z.object({
	actorId: z.string().min(1),
	idempotencyKey: z.string().min(1),
	origin: z.literal("human"),
	payload: createCustomFieldPayloadSchema,
});

export type CreateCustomFieldCommand = z.infer<
	typeof createCustomFieldCommandSchema
>;

export const customFieldDefinitionSchema = z.object({
	boundRecordTypes: z.array(z.string()),
	id: z.string().min(1),
	name: z.string().min(1),
	options: z.array(z.string()),
	projectId: z.string().min(1),
	revision: z.number().int().positive(),
	type: z.string().min(1),
});

export type CustomFieldDefinitionView = z.infer<
	typeof customFieldDefinitionSchema
>;

export const CALENDAR_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export const customFieldStoredValueSchema = z.discriminatedUnion("kind", [
	z.object({ kind: z.literal("unset") }),
	z.object({ kind: z.literal("text"), text: z.string() }),
	z.object({ kind: z.literal("number"), number: z.number() }),
	z.object({ boolean: z.boolean(), kind: z.literal("boolean") }),
	z.object({
		date: z.string().regex(CALENDAR_DATE_PATTERN),
		kind: z.literal("date"),
	}),
	z.object({ kind: z.literal("single-select"), option: z.string() }),
	z.object({
		kind: z.literal("multi-select"),
		options: z.array(z.string()),
	}),
]);

export type CustomFieldStoredValue = z.infer<
	typeof customFieldStoredValueSchema
>;

export const UNSET_CUSTOM_FIELD_VALUE = {
	kind: "unset",
} as const satisfies CustomFieldStoredValue;

export const customFieldValueViewSchema = z.object({
	definitionId: z.string().min(1),
	name: z.string().min(1),
	notEvaluated: z.boolean(),
	options: z.array(z.string()),
	recordId: z.string().min(1),
	recordType: z.string().min(1),
	revision: z.number().int().nonnegative(),
	type: z.string().min(1),
	value: customFieldStoredValueSchema,
});

export type CustomFieldValueView = z.infer<typeof customFieldValueViewSchema>;

export const setCustomFieldValuePayloadSchema = z.object({
	definitionId: z.string().min(1),
	recordId: z.string().min(1),
	recordType: z.string().min(1),
	value: customFieldStoredValueSchema,
});

export type SetCustomFieldValuePayload = z.infer<
	typeof setCustomFieldValuePayloadSchema
>;

export const setCustomFieldValueCommandSchema = z.object({
	actorId: z.string().min(1),
	baseRevision: z.number().int().nonnegative(),
	idempotencyKey: z.string().min(1),
	origin: z.literal("human"),
	payload: setCustomFieldValuePayloadSchema,
});

export type SetCustomFieldValueCommand = z.infer<
	typeof setCustomFieldValueCommandSchema
>;

export const customFieldFilterPayloadSchema = z.object({
	definitionId: z.string().min(1),
	projectId: z.string().min(1),
	recordType: z.string().min(1),
	value: customFieldStoredValueSchema,
});

export type CustomFieldFilterPayload = z.infer<
	typeof customFieldFilterPayloadSchema
>;

export const CUSTOM_FIELD_REJECTION_REASONS = [
	"missing-bound-record-types",
	"missing-idempotency-key",
	"missing-name",
	"missing-select-options",
	"target-not-found",
	"unbound-record-type",
	"unknown-field-type",
	"unknown-select-option",
	"unsupported-record-type",
	"value-type-mismatch",
] as const;

export type CustomFieldRejectionReason =
	(typeof CUSTOM_FIELD_REJECTION_REASONS)[number];

export type CustomFieldOutcome =
	| { definition: CustomFieldDefinitionView; status: "committed" }
	| { definition: CustomFieldDefinitionView; status: "replayed" }
	| { conflict: string; status: "conflict" }
	| { reason: CustomFieldRejectionReason; status: "rejected" };

export type CustomFieldValueOutcome =
	| { status: "committed"; value: CustomFieldValueView }
	| { status: "replayed"; value: CustomFieldValueView }
	| { conflict: string; status: "conflict" }
	| {
			current: CustomFieldValueView;
			currentValueLabel: string;
			status: "stale";
	  }
	| { reason: CustomFieldRejectionReason; status: "rejected" };

export function isCustomFieldType(value: string): value is CustomFieldType {
	return (CUSTOM_FIELD_TYPES as readonly string[]).includes(value);
}

export function isBindableRecordType(
	value: string
): value is BindableRecordType {
	return (BINDABLE_RECORD_TYPES as readonly string[]).includes(value);
}

export function isSelectFieldType(value: string): boolean {
	return value === "Single select" || value === "Multi select";
}

export function customFieldCatalog() {
	return {
		bindableRecordTypes: BINDABLE_RECORD_TYPES,
		copy: CUSTOM_FIELD_COPY,
		types: CUSTOM_FIELD_TYPES,
	} as const;
}

export function fieldsOnSurface(
	definitions: readonly CustomFieldDefinitionView[],
	recordType: string
): CustomFieldDefinitionView[] {
	if (!isBindableRecordType(recordType)) {
		return [];
	}
	return definitions.filter((definition) =>
		definition.boundRecordTypes.includes(recordType)
	);
}

export function isNotEvaluated(value: CustomFieldStoredValue): boolean {
	return value.kind === "unset";
}

export function normalizeStoredValue(
	type: string,
	value: CustomFieldStoredValue
): CustomFieldStoredValue {
	if (type === "Text" && value.kind === "text" && value.text.trim() === "") {
		return UNSET_CUSTOM_FIELD_VALUE;
	}
	if (
		type === "Multi select" &&
		value.kind === "multi-select" &&
		value.options.length === 0
	) {
		return UNSET_CUSTOM_FIELD_VALUE;
	}
	return value;
}
