import { z } from "zod";

export const FILE_ATTACHMENT_COPY = {
	arrow: "Arrow",
	bindAsOrigin: "Bind as origin",
	confirm: "Confirm",
	conflict: "Conflict",
	download: "Download",
	existingWork: "Existing Work",
	fileAttachment: "File Attachment",
	finalizing: "Finalizing",
	highlighter: "Highlighter",
	incomingFile: "Incoming file",
	markingLayer: "Marking layer",
	mimeMismatch: "MIME and extension do not match. The file was not repaired.",
	newWork: "New Work",
	originLocation: "Origin Location",
	pen: "Pen",
	personalWiki: "Personal Wiki",
	point: "Point",
	preview: "Preview",
	previewRequired: "Preview the Origin Location bind before confirming.",
	quotaExceeded: "Workspace file quota is exceeded.",
	quotaWarning: "Workspace file storage is at 80% of quota.",
	rectangle: "Rectangle",
	region: "Region",
	restartFromByteZero: "The transfer restarts from byte zero.",
	sourceVisual: "Source visual",
	targetAttachment: "Target File Attachment",
	tooLarge: "This file exceeds the size limit for its type.",
	typeRejected: "This file type is not accepted.",
	unavailable: "Unavailable",
	undo: "Undo",
	unscannedZip:
		"Unscanned ZIP cannot enter a link-limited or public External Surface.",
	upload: "Upload",
	uploadNewVersion: "Upload new version",
	wireframeOriginNotThisFeature:
		"Wireframe-screen origin location is not a File Attachment action.",
	workRequiresProject: "Origin Location binds to Work in a Project.",
} as const;

export const CAPTURE_STAGING_SURFACES = {
	export: false,
	publish: false,
	search: false,
	share: false,
} as const;

export const FILE_ATTACHMENT_QUOTA = {
	maxOriginalBytes: 25 * 1024 * 1024 * 1024,
	maxVersions: 20_000,
	warnRatio: 0.8,
} as const;

export const FILE_TYPE_INTEGRITY_BUDGET_MS = {
	p95: 1500,
	p99: 3000,
} as const;

export const FILE_KIND = {
	audio: "audio",
	csv: "csv",
	image: "image",
	pdf: "pdf",
	text: "text",
	video: "video",
	zip: "zip",
} as const;

export type FileKind = (typeof FILE_KIND)[keyof typeof FILE_KIND];

export const FILE_KIND_LIMITS: Record<FileKind, number> = {
	audio: 100 * 1024 * 1024,
	csv: 25 * 1024 * 1024,
	image: 25 * 1024 * 1024,
	pdf: 50 * 1024 * 1024,
	text: 10 * 1024 * 1024,
	video: 250 * 1024 * 1024,
	zip: 100 * 1024 * 1024,
};

export const FILE_LIFECYCLE = {
	active: "active",
	archived: "archived",
	trash: "trash",
} as const;

export type FileLifecycle =
	(typeof FILE_LIFECYCLE)[keyof typeof FILE_LIFECYCLE];

export const FILE_SCOPE_KIND = {
	personalWiki: "personal-wiki",
	project: "project",
} as const;

export const FILE_PIN_KIND = {
	content: "content",
	location: "location",
	publish: "publish",
} as const;

export type FilePinKind = (typeof FILE_PIN_KIND)[keyof typeof FILE_PIN_KIND];

export const MARKING_TOOLS = {
	arrow: "arrow",
	highlighter: "highlighter",
	pen: "pen",
	rectangle: "rectangle",
} as const;

export type MarkingTool = (typeof MARKING_TOOLS)[keyof typeof MARKING_TOOLS];

export const MARKING_TOOL_LABELS: Record<MarkingTool, string> = {
	arrow: FILE_ATTACHMENT_COPY.arrow,
	highlighter: FILE_ATTACHMENT_COPY.highlighter,
	pen: FILE_ATTACHMENT_COPY.pen,
	rectangle: FILE_ATTACHMENT_COPY.rectangle,
};

export const FORBIDDEN_MARKING_TOOLS = [
	"comment",
	"mention",
	"review",
	"task",
] as const;

export const SHARE_PUBLISH_ITEM_KIND = {
	markingLayer: "marking-layer",
	sourceVisual: "source-visual",
} as const;

export type SharePublishItemKind =
	(typeof SHARE_PUBLISH_ITEM_KIND)[keyof typeof SHARE_PUBLISH_ITEM_KIND];

export const ORIGIN_LOCATION_KIND = {
	point: "point",
	region: "region",
} as const;

export type OriginLocationKind =
	(typeof ORIGIN_LOCATION_KIND)[keyof typeof ORIGIN_LOCATION_KIND];

export const LOCATION_SURFACE = {
	fileAttachment: "file-attachment",
	screen: "screen",
	wireframe: "wireframe",
} as const;

export const locationGeometrySchema = z.discriminatedUnion("kind", [
	z.object({
		kind: z.literal(ORIGIN_LOCATION_KIND.point),
		page: z.number().int().positive().optional(),
		x: z.number().min(0).max(1),
		y: z.number().min(0).max(1),
	}),
	z.object({
		height: z.number().gt(0).max(1),
		kind: z.literal(ORIGIN_LOCATION_KIND.region),
		page: z.number().int().positive().optional(),
		width: z.number().gt(0).max(1),
		x: z.number().min(0).max(1),
		y: z.number().min(0).max(1),
	}),
]);

export type LocationGeometry = z.infer<typeof locationGeometrySchema>;

export const fileMarkSchema = z.object({
	geometry: z.record(z.string(), z.unknown()),
	id: z.string().min(1),
	page: z.number().int().positive().optional(),
	tool: z.enum([
		MARKING_TOOLS.pen,
		MARKING_TOOLS.highlighter,
		MARKING_TOOLS.arrow,
		MARKING_TOOLS.rectangle,
	]),
});

export type FileMark = z.infer<typeof fileMarkSchema>;

export const fileMarksSchema = z.array(fileMarkSchema);

export const shareItemApprovalsSchema = z.object({
	[SHARE_PUBLISH_ITEM_KIND.markingLayer]: z.boolean().optional(),
	[SHARE_PUBLISH_ITEM_KIND.sourceVisual]: z.boolean().optional(),
});

export const STAGING_TTL_MS = 24 * 60 * 60 * 1000;

export const PREVIEW_MODE = {
	csvRows: "csv-rows",
	downloadOnly: "download-only",
	paged: "paged",
	plainText: "plain-text",
	playback: "playback",
	visual: "visual",
} as const;

export type PreviewMode = (typeof PREVIEW_MODE)[keyof typeof PREVIEW_MODE];

export const PREVIEW_STATUS = {
	pending: "pending",
	ready: "ready",
	unavailable: "unavailable",
} as const;

export type PreviewStatus =
	(typeof PREVIEW_STATUS)[keyof typeof PREVIEW_STATUS];

export const THUMBNAIL_SIZE = {
	medium: "medium",
	small: "small",
} as const;

export type ThumbnailSize =
	(typeof THUMBNAIL_SIZE)[keyof typeof THUMBNAIL_SIZE];

export const IMAGE_DERIVATIVE_LIMITS = {
	cpuMs: 5000,
	maxFrames: 300,
	maxHeight: 8192,
	maxPixels: 40_000_000,
	maxWidth: 8192,
	mediumPx: 960,
	retryLimit: 3,
	smallPx: 320,
} as const;

export const CSV_PREVIEW_MAX_ROWS = 50;
export const TEXT_PREVIEW_MAX_CHARS = 32_768;

export const EXTERNAL_SURFACE_AUDIENCE = {
	linkLimited: "link-limited",
	public: "public",
} as const;

export type ExternalSurfaceAudience =
	(typeof EXTERNAL_SURFACE_AUDIENCE)[keyof typeof EXTERNAL_SURFACE_AUDIENCE];

export const contentPathFor = (
	fileAttachmentId: string,
	versionId: string
): string => `/api/file-attachments/${fileAttachmentId}/versions/${versionId}`;

export const previewPathFor = (
	fileAttachmentId: string,
	versionId: string
): string => `${contentPathFor(fileAttachmentId, versionId)}/preview`;

export const thumbnailPathFor = (
	fileAttachmentId: string,
	versionId: string,
	size: ThumbnailSize
): string =>
	`${contentPathFor(fileAttachmentId, versionId)}/thumbnails/${size}`;

export const derivativeObjectKeyFor = (
	contentHash: string,
	size: ThumbnailSize
): string => `deriv/${contentHash}/${size}.webp`;

export const fileScopeSchema = z.discriminatedUnion("kind", [
	z.object({
		kind: z.literal(FILE_SCOPE_KIND.project),
		projectId: z.string().min(1),
	}),
	z.object({
		kind: z.literal(FILE_SCOPE_KIND.personalWiki),
	}),
]);

export type FileScope = z.infer<typeof fileScopeSchema>;

export const stageFileUploadPayloadSchema = z.object({
	byteOffset: z.number().int().nonnegative().optional(),
	declaredMime: z.string().min(1),
	filename: z.string().min(1),
	scope: fileScopeSchema,
	targetFileAttachmentId: z.string().min(1).optional(),
	title: z.string().min(1).optional(),
});

export const stageFileUploadCommandSchema = z.object({
	actorId: z.string().min(1),
	idempotencyKey: z.string().min(1),
	origin: z.literal("human"),
	payload: stageFileUploadPayloadSchema,
	workspaceId: z.string().min(1),
});

export type StageFileUploadCommand = z.infer<
	typeof stageFileUploadCommandSchema
>;

export const promoteCaptureAttachmentPayloadSchema = z.object({
	inboxItemId: z.string().min(1),
	scope: fileScopeSchema,
	title: z.string().min(1).optional(),
});

export const promoteCaptureAttachmentCommandSchema = z.object({
	actorId: z.string().min(1),
	idempotencyKey: z.string().min(1),
	origin: z.literal("human"),
	payload: promoteCaptureAttachmentPayloadSchema,
	workspaceId: z.string().min(1),
});

export type PromoteCaptureAttachmentCommand = z.infer<
	typeof promoteCaptureAttachmentCommandSchema
>;
