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

export type CustomFieldStoredValue =
	| { kind: "unset" }
	| { kind: "text"; text: string }
	| { kind: "number"; number: number }
	| { kind: "boolean"; boolean: boolean }
	| { kind: "date"; date: string }
	| { kind: "single-select"; option: string }
	| { kind: "multi-select"; options: string[] };

export const UNSET_CUSTOM_FIELD_VALUE = {
	kind: "unset",
} as const satisfies CustomFieldStoredValue;

export interface CustomFieldValueView {
	definitionId: string;
	name: string;
	notEvaluated: boolean;
	options: readonly string[];
	recordId: string;
	recordType: string;
	revision: number;
	type: string;
	value: CustomFieldStoredValue;
}

export function isSelectFieldType(value: string): boolean {
	return value === "Single select" || value === "Multi select";
}
