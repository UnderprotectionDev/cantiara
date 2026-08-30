export const BULK_EDITING_COPY = {
	bulkEdit: "Bulk Edit",
	closeStepRequired: "Close result is required.",
	closureResult: "Closure check",
	fieldChanges: "Field changes",
	noSelection: "Select Work to bulk edit.",
	schemaOrImportRefused:
		"Bulk Edit cannot create fields, migrate schema, or import records.",
	selectedWork: "Selected Work",
	status: "Status",
	targetNotFound: "Work is unavailable.",
	title: "Title",
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
