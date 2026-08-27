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
	boundRecordTypes: "Bound record types",
	boundRecordTypesRequired: "Bound record types are required.",
	customField: "Custom field",
	date: "Date",
	multiSelect: "Multi select",
	name: "Name",
	nameRequired: "Name is required.",
	number: "Number",
	options: "Options",
	selectOptionsRequired: "Options are required.",
	singleSelect: "Single select",
	text: "Text",
	type: "Type",
	unknownFieldType: "Unknown field type.",
	unsupportedRecordType: "This record type cannot carry a Custom field.",
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

export const CUSTOM_FIELD_REJECTION_REASONS = [
	"missing-bound-record-types",
	"missing-idempotency-key",
	"missing-name",
	"missing-select-options",
	"target-not-found",
	"unknown-field-type",
	"unsupported-record-type",
] as const;

export type CustomFieldRejectionReason =
	(typeof CUSTOM_FIELD_REJECTION_REASONS)[number];

export type CustomFieldOutcome =
	| { definition: CustomFieldDefinitionView; status: "committed" }
	| { definition: CustomFieldDefinitionView; status: "replayed" }
	| { conflict: string; status: "conflict" }
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
