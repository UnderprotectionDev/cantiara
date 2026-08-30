export const BULK_EDITING_COPY = {
	apply: "Apply",
	bulkEdit: "Bulk Edit",
	cancel: "Cancel",
	closeStepRequired: "Close result is required.",
	closureResult: "Closure check",
	conflict: "Conflict",
	currentValue: "Current value",
	failed: "Failed",
	fieldChanges: "Field changes",
	finalizing: "Finalizing",
	noSelection: "Select Work to bulk edit.",
	progress: "Progress",
	schemaOrImportRefused:
		"Bulk Edit cannot create fields, migrate schema, or import records.",
	selectedWork: "Selected Work",
	status: "Status",
	succeeded: "Succeeded",
	supportReference: "Support reference",
	targetNotFound: "Work is unavailable.",
	title: "Title",
	undo: "Undo",
} as const;

export function bulkFieldLabel(
	id: "status" | "title" | "closureResult"
): string {
	if (id === "status") {
		return BULK_EDITING_COPY.status;
	}
	if (id === "title") {
		return BULK_EDITING_COPY.title;
	}
	return BULK_EDITING_COPY.closureResult;
}
