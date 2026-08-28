import { z } from "zod";

export const TAGS_COPY = {
	allTags: "All tags",
	applyTag: "Apply tag",
	createTag: "Create tag",
	filterByTag: "Filter by tag",
	name: "Name",
	noMatchingTags: "No matching tags.",
	noTags: "No tags yet.",
	removeTag: "Remove tag",
	suggestedInThisProject: "Suggested in this Project",
	tags: "Tags",
} as const;

export const tagViewSchema = z.object({
	id: z.string().min(1),
	name: z.string().min(1),
	revision: z.number().int().positive(),
	workspaceId: z.string().min(1),
});

export type TagView = z.infer<typeof tagViewSchema>;

export const taggedRecordViewSchema = z.object({
	id: z.string().min(1),
	key: z.string().min(1),
	projectId: z.string().min(1),
	revision: z.number().int().positive(),
	tagIds: z.array(z.string().min(1)),
	title: z.string().min(1),
});

export type TaggedRecordView = z.infer<typeof taggedRecordViewSchema>;

export const createTagCommandSchema = z.object({
	actorId: z.string().min(1),
	idempotencyKey: z.string().min(1),
	name: z.string(),
	origin: z.literal("human"),
	workspaceId: z.string().min(1),
});

export type CreateTagCommand = z.infer<typeof createTagCommandSchema>;

export const applyTagCommandSchema = z.object({
	actorId: z.string().min(1),
	baseRevision: z.number().int().nonnegative(),
	idempotencyKey: z.string().min(1),
	origin: z.literal("human"),
	tagId: z.string().min(1),
	workId: z.string().min(1),
});

export type ApplyTagCommand = z.infer<typeof applyTagCommandSchema>;

export const removeTagCommandSchema = applyTagCommandSchema;

export type RemoveTagCommand = z.infer<typeof removeTagCommandSchema>;

export type TagWriteOutcome =
	| { status: "committed"; tag: TagView }
	| { status: "replayed"; tag: TagView }
	| { conflict: string; status: "conflict" }
	| { reason: string; status: "rejected" };

export type TagApplyOutcome =
	| {
			record: TaggedRecordView;
			status: "committed";
			tag: TagView;
	  }
	| {
			record: TaggedRecordView;
			status: "replayed";
			tag: TagView;
	  }
	| { conflict: string; status: "conflict" }
	| { reason: string; status: "rejected" }
	| {
			currentValueLabel: string;
			status: "stale";
	  };
