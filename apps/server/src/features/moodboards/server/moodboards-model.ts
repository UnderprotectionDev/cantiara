import { z } from "zod";

export const MOODBOARDS_COPY = {
	addVisual: "Add visual",
	caption: "Caption",
	createMoodboard: "Create Moodboard",
	crop: "Crop",
	exitPresentationMode: "Exit Presentation Mode",
	externalLink: "External link",
	fileAttachment: "File Attachment",
	focusOrder: "Focus order",
	moodboard: "Moodboard",
	noLiveSourceLinks: "Output carries no live source links.",
	noMoodboards: "No Moodboards yet.",
	pdf: "PDF",
	png: "PNG",
	presentationMode: "Presentation Mode",
	preview: "Preview",
	rotate: "Rotate 90°",
	snapshot: "Snapshot",
	title: "Title",
} as const;

export const MOODBOARD_KIND = MOODBOARDS_COPY.moodboard;

export const VISUAL_ORIGIN_KIND = {
	externalLink: MOODBOARDS_COPY.externalLink,
	fileAttachment: MOODBOARDS_COPY.fileAttachment,
} as const;

export const MOODBOARD_SNAPSHOT_FORMAT = {
	pdf: MOODBOARDS_COPY.pdf,
	png: MOODBOARDS_COPY.png,
} as const;

export const MOODBOARD_ROTATIONS = [0, 90, 180, 270] as const;

export const MOODBOARD_COUNTERPARTS = {
	approvedSnapshotRevision: false,
	autoCreateProjectWallCard: false,
	brandGuide: false,
	buildInPublic: false,
	captionIsCommentThread: false,
	captionIsFileDescription: false,
	captionIsMention: false,
	captionIsReaction: false,
	captionIsTask: false,
	contentCopy: false,
	designSystem: false,
	externalSurface: false,
	liveSourceLinks: false,
	productionAsset: false,
	screen: false,
	shareLink: false,
	smashEntireBoard: false,
	userFlow: false,
	wireframe: false,
} as const;

export const MOODBOARD_FOREIGN_IDENTITIES = [
	"Screen",
	"production asset",
	"User Flow",
	"Wireframe",
] as const;

export const MOODBOARD_PRESENTATION_WRITES = {
	approvedSnapshotRevision: false,
	brandGuide: false,
	buildInPublic: false,
	contentCopy: false,
	externalSurface: false,
	shareLink: false,
} as const;

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

const unit = z.number().min(0).max(1);

export const cropBoxSchema = z
	.object({
		height: unit,
		left: unit,
		top: unit,
		width: unit,
	})
	.strict()
	.refine(
		(box) =>
			box.width > 0 &&
			box.height > 0 &&
			box.left + box.width <= 1 &&
			box.top + box.height <= 1,
		{ message: "crop" }
	);

export const visualPresentationViewSchema = z.object({
	crop: cropBoxSchema.nullable(),
	fileAttachmentVersionId: z.string().min(1).nullable(),
	originalDownloadable: z.boolean(),
	rotation: z.union([
		z.literal(0),
		z.literal(90),
		z.literal(180),
		z.literal(270),
	]),
});

export type VisualPresentationView = z.infer<
	typeof visualPresentationViewSchema
>;

export const moodboardVisualViewSchema = z.object({
	caption: z.string(),
	id: z.string().min(1),
	origin: visualOriginViewSchema,
	presentation: visualPresentationViewSchema,
});

export type MoodboardVisualView = z.infer<typeof moodboardVisualViewSchema>;

export const moodboardViewSchema = z.object({
	focusOrder: z.array(z.string().min(1)),
	id: z.string().min(1),
	projectId: z.string().min(1),
	recordKind: z.literal(MOODBOARD_KIND),
	revision: z.number().int().positive(),
	title: z.string(),
	visuals: z.array(moodboardVisualViewSchema),
});

export type MoodboardView = z.infer<typeof moodboardViewSchema>;

export const moodboardPresentationModeViewSchema = z.object({
	contentCopy: z.literal(false),
	editingHidden: z.literal(true),
	focusOrder: z.array(z.string().min(1)),
	mode: z.literal(MOODBOARDS_COPY.presentationMode),
	moodboardId: z.string().min(1),
	toolsHidden: z.literal(true),
	writes: z.object({
		approvedSnapshotRevision: z.literal(false),
		brandGuide: z.literal(false),
		buildInPublic: z.literal(false),
		contentCopy: z.literal(false),
		externalSurface: z.literal(false),
		shareLink: z.literal(false),
	}),
});

export type MoodboardPresentationModeView = z.infer<
	typeof moodboardPresentationModeViewSchema
>;

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

export const setMoodboardViewTransformPayloadSchema = z
	.object({
		crop: cropBoxSchema.nullable(),
		rotation: z.union([
			z.literal(0),
			z.literal(90),
			z.literal(180),
			z.literal(270),
		]),
		visualId: z.string().min(1),
	})
	.strict();

export const setMoodboardViewTransformCommandSchema = z.object({
	actorId: z.string().min(1),
	baseRevision: z.number().int().nonnegative(),
	idempotencyKey: z.string().min(1),
	origin: z.literal("human"),
	payload: setMoodboardViewTransformPayloadSchema,
});

export type SetMoodboardViewTransformCommand = z.infer<
	typeof setMoodboardViewTransformCommandSchema
>;

export const setMoodboardFocusOrderPayloadSchema = z
	.object({
		moodboardId: z.string().min(1),
		visualIds: z.array(z.string().min(1)),
	})
	.strict();

export const setMoodboardFocusOrderCommandSchema = z.object({
	actorId: z.string().min(1),
	baseRevision: z.number().int().nonnegative(),
	idempotencyKey: z.string().min(1),
	origin: z.literal("human"),
	payload: setMoodboardFocusOrderPayloadSchema,
});

export type SetMoodboardFocusOrderCommand = z.infer<
	typeof setMoodboardFocusOrderCommandSchema
>;

export const moodboardSnapshotScopeSchema = z
	.object({
		fitEntireBoardOnOnePage: z.literal(true).optional(),
		format: z.enum([
			MOODBOARD_SNAPSHOT_FORMAT.png,
			MOODBOARD_SNAPSHOT_FORMAT.pdf,
		]),
		moodboardId: z.string().min(1),
		visualIds: z.array(z.string().min(1)).min(1),
	})
	.strict();

export type MoodboardSnapshotScope = z.infer<
	typeof moodboardSnapshotScopeSchema
>;

export const moodboardSnapshotPreviewSchema = z.object({
	applied: z.array(
		z.object({
			crop: cropBoxSchema.nullable(),
			fileAttachmentVersionId: z.string().min(1).nullable(),
			rotation: z.union([
				z.literal(0),
				z.literal(90),
				z.literal(180),
				z.literal(270),
			]),
			visualId: z.string().min(1),
		})
	),
	format: z.enum([
		MOODBOARD_SNAPSHOT_FORMAT.png,
		MOODBOARD_SNAPSHOT_FORMAT.pdf,
	]),
	liveSourceLinks: z.literal(false),
	noLiveSourceLinks: z.literal(MOODBOARDS_COPY.noLiveSourceLinks),
	viewMoment: z.string().min(1),
});

export type MoodboardSnapshotPreview = z.infer<
	typeof moodboardSnapshotPreviewSchema
>;

export const moodboardSnapshotFileSchema = z.object({
	bytes: z.instanceof(Uint8Array),
	filename: z.string().min(1),
	mimeType: z.string().min(1),
	pageCount: z.number().int().positive(),
	visualId: z.string().min(1).nullable(),
});

export const moodboardSnapshotViewSchema = z.object({
	approvedSnapshotRevision: z.literal(false),
	brandGuide: z.literal(false),
	externalSurface: z.literal(false),
	files: z.array(moodboardSnapshotFileSchema),
	liveSourceLinks: z.literal(false),
	preview: moodboardSnapshotPreviewSchema,
	shareLink: z.literal(false),
	sourceMutation: z.literal(false),
});

export type MoodboardSnapshotView = z.infer<typeof moodboardSnapshotViewSchema>;

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
			"smash-entire-board",
			"focus-order-mismatch",
		]),
		status: z.literal("rejected"),
	}),
]);

export type MoodboardWriteOutcome = z.infer<typeof moodboardWriteOutcomeSchema>;

export const moodboardSnapshotOutcomeSchema = z.discriminatedUnion("status", [
	z.object({
		snapshot: moodboardSnapshotViewSchema,
		status: z.literal("ok"),
	}),
	z.object({
		reason: z.enum([
			"invalid-command",
			"moodboard-not-found",
			"visual-not-found",
			"smash-entire-board",
		]),
		status: z.literal("rejected"),
	}),
]);

export type MoodboardSnapshotOutcome = z.infer<
	typeof moodboardSnapshotOutcomeSchema
>;

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
		snapshotFormats: [
			MOODBOARD_SNAPSHOT_FORMAT.png,
			MOODBOARD_SNAPSHOT_FORMAT.pdf,
		],
	};
}

export function identityPresentation(input: {
	fileAttachmentVersionId: string | null;
	originalDownloadable: boolean;
}): VisualPresentationView {
	return {
		crop: null,
		fileAttachmentVersionId: input.fileAttachmentVersionId,
		originalDownloadable: input.originalDownloadable,
		rotation: 0,
	};
}

export function presentationModeView(input: {
	focusOrder: readonly string[];
	moodboardId: string;
}): MoodboardPresentationModeView {
	return {
		contentCopy: false,
		editingHidden: true,
		focusOrder: [...input.focusOrder],
		mode: MOODBOARDS_COPY.presentationMode,
		moodboardId: input.moodboardId,
		toolsHidden: true,
		writes: MOODBOARD_PRESENTATION_WRITES,
	};
}
