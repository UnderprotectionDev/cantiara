import { z } from "zod";

import { HUMAN_ORIGIN } from "../../mutation-core/server/mutation-shared";
import { lightChecklistItemSchema } from "../../work-lifecycle/server/work-lifecycle-model";

export const WORK_CHECKLISTS_COPY = {
	addItem: "Add item",
	checklist: "Checklist",
	confirmConvert: "Confirm convert",
	convertToIndependentWork: "Convert to independent Work",
	item: "Item",
	moveDown: "Move down",
	moveUp: "Move up",
	project: "Project",
	remove: "Remove",
	save: "Save",
	startStatus: "Start status",
	title: "Title",
} as const;

export const checklistItemSchema = lightChecklistItemSchema;
export type ChecklistItemView = z.infer<typeof checklistItemSchema>;

export const checklistWorkSchema = z.object({
	closureResult: z.string().nullable(),
	id: z.string().min(1),
	key: z.string().min(1),
	revision: z.number().int().positive(),
	status: z.string().min(1),
});

export type ChecklistWorkView = z.infer<typeof checklistWorkSchema>;

export const workChecklistViewSchema = z.object({
	items: z.array(checklistItemSchema),
	work: checklistWorkSchema,
});

export type WorkChecklistView = z.infer<typeof workChecklistViewSchema>;

const humanCommand = {
	actorId: z.string().min(1),
	baseRevision: z.number().int().nonnegative(),
	idempotencyKey: z.string().min(1),
	origin: z.literal(HUMAN_ORIGIN),
	workId: z.string().min(1),
};

export const addChecklistItemCommandSchema = z.object({
	...humanCommand,
	title: z.string(),
});

export const updateChecklistItemCommandSchema = z.object({
	...humanCommand,
	itemId: z.string().min(1),
	title: z.string(),
});

export const setChecklistItemCompletedCommandSchema = z.object({
	...humanCommand,
	completed: z.boolean(),
	itemId: z.string().min(1),
});

export const reorderChecklistItemsCommandSchema = z.object({
	...humanCommand,
	orderedItemIds: z.array(z.string().min(1)),
});

export const removeChecklistItemCommandSchema = z.object({
	...humanCommand,
	itemId: z.string().min(1),
});

export const previewConvertChecklistItemInputSchema = z.object({
	itemId: z.string().min(1),
	workId: z.string().min(1),
});

export const convertChecklistItemCommandSchema = z.object({
	...humanCommand,
	itemId: z.string().min(1),
	previewAcknowledged: z.boolean().optional(),
});

export const convertedWorkViewSchema = z.object({
	id: z.string().min(1),
	key: z.string().min(1),
	projectId: z.string().min(1),
	status: z.string().min(1),
	title: z.string().min(1),
});

export const convertChecklistPreviewSchema = z.object({
	origin: z.object({
		id: z.string().min(1),
		key: z.string().min(1),
	}),
	originLocation: z.object({
		componentId: z.string().min(1),
		ownerId: z.string().min(1),
		ownerKind: z.literal("Work"),
		sourceVersion: z.string().min(1),
	}),
	projectId: z.string().min(1),
	projectName: z.string().min(1),
	startStatus: z.literal("Not Started"),
	title: z.string().min(1),
});

export const convertChecklistResultSchema = z.object({
	checklist: workChecklistViewSchema,
	convertedWork: convertedWorkViewSchema,
});

export type AddChecklistItemCommand = z.infer<
	typeof addChecklistItemCommandSchema
>;
export type UpdateChecklistItemCommand = z.infer<
	typeof updateChecklistItemCommandSchema
>;
export type SetChecklistItemCompletedCommand = z.infer<
	typeof setChecklistItemCompletedCommandSchema
>;
export type ReorderChecklistItemsCommand = z.infer<
	typeof reorderChecklistItemsCommandSchema
>;
export type RemoveChecklistItemCommand = z.infer<
	typeof removeChecklistItemCommandSchema
>;
export type PreviewConvertChecklistItemInput = z.infer<
	typeof previewConvertChecklistItemInputSchema
>;
export type ConvertChecklistItemCommand = z.infer<
	typeof convertChecklistItemCommandSchema
>;
export type ConvertedWorkView = z.infer<typeof convertedWorkViewSchema>;
export type ConvertChecklistPreview = z.infer<
	typeof convertChecklistPreviewSchema
>;
export type ConvertChecklistResult = z.infer<
	typeof convertChecklistResultSchema
>;

export type WorkChecklistRejectionReason =
	| "already-converted"
	| "invalid-command"
	| "invalid-order"
	| "item-not-found"
	| "missing-title"
	| "preview-required"
	| "target-not-found";

export type WorkChecklistOutcome =
	| { checklist: WorkChecklistView; status: "committed" }
	| { checklist: WorkChecklistView; status: "replayed" }
	| { conflict: "Conflict"; status: "conflict" }
	| {
			checklist: WorkChecklistView;
			currentValueLabel: "Current value";
			status: "stale";
	  }
	| { reason: WorkChecklistRejectionReason; status: "rejected" };

export type ConvertChecklistPreviewOutcome =
	| { preview: ConvertChecklistPreview; status: "ok" }
	| { reason: WorkChecklistRejectionReason; status: "rejected" };

export type ConvertChecklistOutcome =
	| {
			checklist: WorkChecklistView;
			convertedWork: ConvertedWorkView;
			status: "committed";
	  }
	| {
			checklist: WorkChecklistView;
			convertedWork: ConvertedWorkView;
			status: "replayed";
	  }
	| { conflict: "Conflict"; status: "conflict" }
	| {
			checklist: WorkChecklistView;
			currentValueLabel: "Current value";
			status: "stale";
	  }
	| { reason: WorkChecklistRejectionReason; status: "rejected" };
