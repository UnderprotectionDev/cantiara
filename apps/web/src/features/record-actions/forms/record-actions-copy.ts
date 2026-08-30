export const RECORD_ACTION_STEP_KINDS = [
	"setWorkStatus",
	"dailyFocusMembership",
	"setExistingField",
] as const;

export type RecordActionStepKind = (typeof RECORD_ACTION_STEP_KINDS)[number];

export const RECORD_ACTION_COPY = {
	addRecordAction: "Add Record Action",
	bulkEditNotAllowed:
		"Bulk field editing is not a named Record Action. Multi-record field updates stay Bulk Editing.",
	dailyFocusAdd: "Add to Daily Focus",
	dailyFocusRemove: "Remove from Daily Focus",
	forbiddenStep:
		"A Record Action cannot run JavaScript, HTTP, new record creation, or GitHub mutation.",
	moveToTrash: "Move to Trash",
	multiTarget:
		"A Record Action targets exactly one record. Multi-record combined buttons are not available.",
	name: "Name",
	nameRequired: "Name is required.",
	recordAction: "Record Action",
	save: "Save",
	setExistingField: "Set existing field",
	setWorkStatus: "Set Work status",
	startWork: "Start Work",
	steps: "Steps",
	trashedNotEffective: "A trashed Record Action is not effective.",
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
