import { z } from "zod";

import { HUMAN_ORIGIN } from "../../mutation-core/server/mutation-shared";
import { lightChecklistItemSchema } from "../../work-lifecycle/server/work-lifecycle-model";

export const WORK_CHECKLISTS_COPY = {
	addItem: "Add item",
	checklist: "Checklist",
	item: "Item",
	moveDown: "Move down",
	moveUp: "Move up",
	remove: "Remove",
	save: "Save",
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

export type WorkChecklistRejectionReason =
	| "invalid-command"
	| "invalid-order"
	| "item-not-found"
	| "missing-title"
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
