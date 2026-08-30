import { z } from "zod";

import { MUTATION_COPY } from "../../mutation-core/server/mutation-shared";
import {
	CLOSURE_RESULTS,
	WORK_STATUSES,
} from "../../work-lifecycle/server/work-lifecycle-model";

export const BULK_EDITING_COPY = {
	apply: "Apply",
	bulkEdit: "Bulk Edit",
	closeStepRequired: "Close result is required.",
	closureResult: "Closure check",
	failed: "Failed",
	fieldChanges: "Field changes",
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
	...MUTATION_COPY,
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

export const bulkEditRecordCommandSchema = z
	.object({
		baseRevision: z.number().int().nonnegative(),
		idempotencyKey: z.string().min(1),
		workId: z.string().min(1),
	})
	.strict();

export const startBulkEditInputSchema = z
	.object({
		actorId: z.string().min(1),
		changes: previewBulkFieldChangeSchema,
		idempotencyKey: z.string().min(1),
		records: z.array(bulkEditRecordCommandSchema).min(1),
		selectedWorkIds: z.array(z.string().min(1)),
	})
	.strict();

export type StartBulkEditInput = z.infer<typeof startBulkEditInputSchema>;

export const undoBulkEditInputSchema = z
	.object({
		actorId: z.string().min(1),
		baseRevision: z.number().int().nonnegative(),
		historyEntryId: z.string().min(1),
		idempotencyKey: z.string().min(1),
		jobId: z.string().min(1),
		workId: z.string().min(1),
	})
	.strict();

export type UndoBulkEditInput = z.infer<typeof undoBulkEditInputSchema>;
