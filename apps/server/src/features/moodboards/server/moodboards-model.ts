import { z } from "zod";

export const MOODBOARDS_COPY = {
	addVisual: "Add visual",
	caption: "Caption",
	createMoodboard: "Create Moodboard",
	externalLink: "External link",
	fileAttachment: "File Attachment",
	moodboard: "Moodboard",
	noMoodboards: "No Moodboards yet.",
	title: "Title",
} as const;

export const MOODBOARD_KIND = MOODBOARDS_COPY.moodboard;

export const VISUAL_ORIGIN_KIND = {
	externalLink: MOODBOARDS_COPY.externalLink,
	fileAttachment: MOODBOARDS_COPY.fileAttachment,
} as const;

export const MOODBOARD_COUNTERPARTS = {
	autoCreateProjectWallCard: false,
	captionIsCommentThread: false,
	captionIsFileDescription: false,
	captionIsMention: false,
	captionIsReaction: false,
	captionIsTask: false,
	designSystem: false,
	productionAsset: false,
	screen: false,
	userFlow: false,
	wireframe: false,
} as const;

export const MOODBOARD_FOREIGN_IDENTITIES = [
	"Screen",
	"production asset",
	"User Flow",
	"Wireframe",
] as const;

const captionSchema = z.string().max(280);

const fileAttachmentOriginSchema = z
	.object({
		fileAttachmentVersionId: z.string().min(1),
		kind: z.literal(VISUAL_ORIGIN_KIND.fileAttachment),
	})
	.strict();

const externalLinkOriginSchema = z
	.object({
		kind: z.literal(VISUAL_ORIGIN_KIND.externalLink),
		url: z
			.string()
			.url()
			.refine(
				(value) => value.startsWith("http://") || value.startsWith("https://"),
				{ message: "url" }
			),
	})
	.strict();

export const visualOriginInputSchema = z.discriminatedUnion("kind", [
	fileAttachmentOriginSchema,
	externalLinkOriginSchema,
]);

export const visualOriginViewSchema = z.discriminatedUnion("kind", [
	z.object({
		fileAttachmentId: z.string().min(1),
		fileAttachmentVersionId: z.string().min(1),
		kind: z.literal(VISUAL_ORIGIN_KIND.fileAttachment),
		title: z.string(),
	}),
	z.object({
		kind: z.literal(VISUAL_ORIGIN_KIND.externalLink),
		url: z.string().min(1),
	}),
]);

export const moodboardVisualViewSchema = z.object({
	caption: z.string(),
	id: z.string().min(1),
	origin: visualOriginViewSchema,
});

export type MoodboardVisualView = z.infer<typeof moodboardVisualViewSchema>;

export const moodboardViewSchema = z.object({
	id: z.string().min(1),
	projectId: z.string().min(1),
	recordKind: z.literal(MOODBOARD_KIND),
	revision: z.number().int().positive(),
	title: z.string(),
	visuals: z.array(moodboardVisualViewSchema),
});

export type MoodboardView = z.infer<typeof moodboardViewSchema>;

export const createMoodboardPayloadSchema = z
	.object({
		projectId: z.string().min(1),
		title: z.string().min(1),
	})
	.strict();

export const createMoodboardCommandSchema = z.object({
	actorId: z.string().min(1),
	idempotencyKey: z.string().min(1),
	origin: z.literal("human"),
	payload: createMoodboardPayloadSchema,
});

export type CreateMoodboardCommand = z.infer<
	typeof createMoodboardCommandSchema
>;

export const addMoodboardVisualPayloadSchema = z
	.object({
		caption: captionSchema.optional(),
		moodboardId: z.string().min(1),
		origin: visualOriginInputSchema,
	})
	.strict();

export const addMoodboardVisualCommandSchema = z.object({
	actorId: z.string().min(1),
	idempotencyKey: z.string().min(1),
	origin: z.literal("human"),
	payload: addMoodboardVisualPayloadSchema,
});

export type AddMoodboardVisualCommand = z.infer<
	typeof addMoodboardVisualCommandSchema
>;

export const setMoodboardCaptionPayloadSchema = z
	.object({
		caption: captionSchema,
		visualId: z.string().min(1),
	})
	.strict();

export const setMoodboardCaptionCommandSchema = z.object({
	actorId: z.string().min(1),
	baseRevision: z.number().int().nonnegative(),
	idempotencyKey: z.string().min(1),
	origin: z.literal("human"),
	payload: setMoodboardCaptionPayloadSchema,
});

export type SetMoodboardCaptionCommand = z.infer<
	typeof setMoodboardCaptionCommandSchema
>;

export const moodboardWriteOutcomeSchema = z.discriminatedUnion("status", [
	z.object({
		moodboard: moodboardViewSchema,
		status: z.literal("committed"),
	}),
	z.object({
		moodboard: moodboardViewSchema,
		status: z.literal("replayed"),
	}),
	z.object({
		conflict: z.literal("Conflict"),
		status: z.literal("conflict"),
	}),
	z.object({
		reason: z.enum([
			"invalid-command",
			"moodboard-not-found",
			"file-attachment-not-found",
			"visual-not-found",
		]),
		status: z.literal("rejected"),
	}),
]);

export type MoodboardWriteOutcome = z.infer<typeof moodboardWriteOutcomeSchema>;

export function moodboardsCatalog() {
	return {
		copy: MOODBOARDS_COPY,
		counterparts: MOODBOARD_COUNTERPARTS,
		foreignIdentities: MOODBOARD_FOREIGN_IDENTITIES,
		kind: MOODBOARD_KIND,
		originKinds: [
			VISUAL_ORIGIN_KIND.fileAttachment,
			VISUAL_ORIGIN_KIND.externalLink,
		],
	};
}
