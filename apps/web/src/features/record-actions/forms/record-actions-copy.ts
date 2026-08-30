export const RECORD_ACTION_STEP_KINDS = [
	"setWorkStatus",
	"dailyFocusMembership",
	"setExistingField",
] as const;

export type RecordActionStepKind = (typeof RECORD_ACTION_STEP_KINDS)[number];

export const RECORD_ACTION_INPUT_KINDS = [
	"Date",
	"Number",
	"Select",
	"Relation",
] as const;

export type RecordActionInputKind = (typeof RECORD_ACTION_INPUT_KINDS)[number];

export const RECORD_ACTION_COPY = {
	addRecordAction: "Add Record Action",
	apply: "Apply",
	bulkEditNotAllowed:
		"Bulk field editing is not a named Record Action. Multi-record field updates stay Bulk Editing.",
	closeStepRequired:
		"Closed status needs the close step. Data was not written.",
	dailyFocusAdd: "Add to Daily Focus",
	dailyFocusMember: "In Daily Focus",
	dailyFocusNotMember: "Not in Daily Focus",
	dailyFocusRemove: "Remove from Daily Focus",
	date: "Date",
	explicitStartRequired: "Start the Record Action before it can apply.",
	forbiddenInput:
		"A Record Action cannot use a formula, free-text macro, script, or new record as a runtime input.",
	forbiddenStep:
		"A Record Action cannot run JavaScript, HTTP, new record creation, or GitHub mutation.",
	laterWrite: "Undo stopped because a later write changed an attributed field.",
	missingRuntimeInput:
		"A Record Action cannot write until every runtime input has a value.",
	moveToTrash: "Move to Trash",
	multiTarget:
		"A Record Action targets exactly one record. Multi-record combined buttons are not available.",
	name: "Name",
	nameRequired: "Name is required.",
	number: "Number",
	preview: "Preview",
	previewMismatch: "The previewed diff no longer matches the record.",
	recordAction: "Record Action",
	relatedRecordRequired: "Relation must point to an existing main record.",
	relation: "Relation",
	runtimeInputs: "Runtime inputs",
	save: "Save",
	select: "Select",
	setExistingField: "Set existing field",
	setWorkStatus: "Set Work status",
	start: "Start",
	startWork: "Start Work",
	steps: "Steps",
	trashedNotEffective: "A trashed Record Action is not effective.",
	undoNotSafe: "This Record Action cannot be undone without a partial rewind.",
	unknownInput: "That runtime input is not in the closed catalog.",
	unknownStep: "That step is not in the closed catalog.",
	useStartWork: "Use Start Work",
} as const;

export type RecordActionStep =
	| { kind: "setWorkStatus"; status: "In Progress" }
	| { kind: "dailyFocusMembership"; operation: "add" | "remove" }
	| {
			fieldKey: "title" | "type" | "description";
			kind: "setExistingField";
			value: string;
	  };

export type RecordActionInput =
	| {
			fieldId: string;
			key: string;
			kind: "Date" | "Number" | "Select";
			label: string;
	  }
	| {
			key: string;
			kind: "Relation";
			label: string;
			relatedKind: "Work";
	  };

export const START_WORK_STEPS: readonly RecordActionStep[] = [
	{ kind: "setWorkStatus", status: "In Progress" },
	{ kind: "dailyFocusMembership", operation: "add" },
];

export function stepLabel(step: RecordActionStep): string {
	if (step.kind === "setWorkStatus") {
		return `${RECORD_ACTION_COPY.setWorkStatus}: ${step.status}`;
	}
	if (step.kind === "dailyFocusMembership") {
		return step.operation === "add"
			? RECORD_ACTION_COPY.dailyFocusAdd
			: RECORD_ACTION_COPY.dailyFocusRemove;
	}
	return `${RECORD_ACTION_COPY.setExistingField}: ${step.fieldKey}`;
}

export function inputLabel(input: RecordActionInput): string {
	return input.label;
}
