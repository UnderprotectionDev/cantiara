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
	renameTag: "Rename Tag",
	suggestedInThisProject: "Suggested in this Project",
	tags: "Tags",
	undo: "Undo",
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

export const tagIdentityFilterSchema = z
	.object({
		tagId: z.string().min(1),
	})
	.strict();

export type TagIdentityFilter = z.infer<typeof tagIdentityFilterSchema>;

export const taggedDocumentViewSchema = z.object({
	documentId: z.string().min(1),
	tagId: z.string().min(1),
});

export type TaggedDocumentView = z.infer<typeof taggedDocumentViewSchema>;

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

export const renameTagCommandSchema = z.object({
	actorId: z.string().min(1),
	baseRevision: z.number().int().nonnegative(),
	idempotencyKey: z.string().min(1),
	name: z.string(),
	origin: z.literal("human"),
	tagId: z.string().min(1),
});

export type RenameTagCommand = z.infer<typeof renameTagCommandSchema>;

export const undoTagRenameCommandSchema = z.object({
	actorId: z.string().min(1),
	baseRevision: z.number().int().nonnegative(),
	historyEntryId: z.string().min(1),
	idempotencyKey: z.string().min(1),
	origin: z.literal("human"),
	tagId: z.string().min(1),
});

export type UndoTagRenameCommand = z.infer<typeof undoTagRenameCommandSchema>;

export const recordResolvedInlineUseCommandSchema = z.object({
	body: z.string(),
	documentId: z.string().min(1),
	tagId: z.string().min(1),
});

export type RecordResolvedInlineUseCommand = z.infer<
	typeof recordResolvedInlineUseCommandSchema
>;

export const tagDocumentChangeViewSchema = z.object({
	documentId: z.string().min(1),
	nextBody: z.string(),
	previousBody: z.string(),
	revision: z.number().int().positive(),
	undo: z.literal("Undo"),
});

export type TagDocumentChangeView = z.infer<typeof tagDocumentChangeViewSchema>;

export const tagMarkdownExportSchema = z.object({
	inlineByDocumentId: z.record(z.string(), z.string()),
	manifest: z.object({
		identities: z.array(
			z.object({
				id: z.string().min(1),
				name: z.string().min(1),
			})
		),
	}),
});

export type TagMarkdownExport = z.infer<typeof tagMarkdownExportSchema>;

export const tagImportExistingMappingSchema = z.object({
	name: z.string().min(1),
	status: z.literal("existing"),
	tagId: z.string().min(1),
	token: z.string().min(1),
});

export const tagImportCandidateMappingSchema = z.object({
	name: z.string().min(1),
	status: z.literal("new-flat-candidate"),
	token: z.string().min(1),
});

export const tagImportPreviewSchema = z.object({
	mappings: z.array(
		z.discriminatedUnion("status", [
			tagImportExistingMappingSchema,
			tagImportCandidateMappingSchema,
		])
	),
});

export type TagImportPreview = z.infer<typeof tagImportPreviewSchema>;

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

export type TagRenameOutcome =
	| {
			documentChanges: TagDocumentChangeView[];
			historyEntryId: string;
			status: "committed";
			tag: TagView;
			undo: "Undo";
	  }
	| {
			documentChanges: TagDocumentChangeView[];
			historyEntryId: string;
			status: "replayed";
			tag: TagView;
			undo: "Undo";
	  }
	| { conflict: string; status: "conflict" }
	| { reason: string; status: "rejected" }
	| {
			currentValueLabel: string;
			status: "stale";
	  };

export type TagInlineUseOutcome =
	| {
			body: string;
			documentId: string;
			revision: number;
			status: "committed";
			tagId: string;
	  }
	| { reason: string; status: "rejected" };
