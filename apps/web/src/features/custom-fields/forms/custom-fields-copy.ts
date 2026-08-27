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

export function isSelectFieldType(value: string): boolean {
	return value === "Single select" || value === "Multi select";
}
