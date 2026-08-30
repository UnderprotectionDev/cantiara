import { z } from "zod";

import {
	CLOSURE_RESULTS,
	WORK_STATUSES,
} from "../../work-lifecycle/server/work-lifecycle-model";

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

export const previewBulkFieldChangeSchema = z
	.object({
		closureResult: z.enum(CLOSURE_RESULTS).optional(),
		status: z.enum(WORK_STATUSES).optional(),
		title: z.string().min(1).optional(),
	})
	.strict();

export const previewBulkEditInputSchema = z
	.object({
		changes: previewBulkFieldChangeSchema,
		filterWorkIds: z.array(z.string().min(1)).optional(),
		selectedWorkIds: z.array(z.string().min(1)),
	})
	.strict();

export type PreviewBulkEditInput = z.infer<typeof previewBulkEditInputSchema>;
