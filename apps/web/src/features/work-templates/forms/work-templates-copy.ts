export const WORK_TEMPLATE_TYPES = [
	"Feature",
	"Bug",
	"Task",
	"Research",
	"Improvement",
] as const;

export type WorkTemplateType = (typeof WORK_TEMPLATE_TYPES)[number];

export const WORK_TEMPLATE_COPY = {
	addChecklistItem: "Add checklist item",
	addWorkTemplate: "Add Work Template",
	checklist: "Checklist",
	createDay: "Create day",
	createFromTemplate: "Create from template",
	daysFromCreate: "Days from create",
	description: "Description",
	documentPlaceholderRefused:
		"Work Template cannot carry Document placeholder syntax.",
	forbiddenPayload:
		"A Work Template cannot carry history, relations, close outcome, current status, or absolute dates.",
	moveToTrash: "Move to Trash",
	name: "Name",
	nameRequired: "Name is required.",
	plannedStart: "Planned start",
	previewDates: "Preview dates",
	relativeDateUnresolved: "Relative dates could not be resolved.",
	save: "Save",
	targetDate: "Target date",
	trashedNotEffective: "A trashed Work Template is not effective.",
	type: "Type",
	unknownWorkType: "Unknown Work type.",
	workTemplate: "Work Template",
} as const;
