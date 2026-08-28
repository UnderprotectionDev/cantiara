import { z } from "zod";

export const FILE_ATTACHMENT_COPY = {
	conflict: "Conflict",
	download: "Download",
	fileAttachment: "File Attachment",
	finalizing: "Finalizing",
	incomingFile: "Incoming file",
	mimeMismatch: "MIME and extension do not match. The file was not repaired.",
	personalWiki: "Personal Wiki",
	quotaExceeded: "Workspace file quota is exceeded.",
	quotaWarning: "Workspace file storage is at 80% of quota.",
	restartFromByteZero: "The transfer restarts from byte zero.",
	targetAttachment: "Target File Attachment",
	tooLarge: "This file exceeds the size limit for its type.",
	typeRejected: "This file type is not accepted.",
	unavailable: "Unavailable",
	upload: "Upload",
	uploadNewVersion: "Upload new version",
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

export const STAGING_TTL_MS = 24 * 60 * 60 * 1000;

export const contentPathFor = (
	fileAttachmentId: string,
	versionId: string
): string => `/api/file-attachments/${fileAttachmentId}/versions/${versionId}`;

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
