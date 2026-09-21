import { z } from "zod";

export const FILE_ATTACHMENT_UI_LABELS = {
  chooseFile: "Choose file",
  copy: "Copy",
  download: "Download",
  fileAttachment: "File Attachment",
  finalizing: "Finalizing",
  move: "Move",
  noFileSelected: "No file selected",
  selectFileAttachment: "Select a File Attachment",
  unavailable: "Unavailable",
  upload: "Upload",
  uploadNewVersion: "Upload new version",
  versions: "Versions",
} as const;

export const FILE_ATTACHMENT_QUOTA = {
  maxBytes: 25 * 1024 * 1024 * 1024,
  maxVersions: 20_000,
  warningRatio: 0.8,
} as const;

export const FILE_ATTACHMENT_TYPES = [
  "image",
  "pdf",
  "csv",
  "text",
  "audio",
  "video",
  "zip",
] as const;

export type FileAttachmentType = (typeof FILE_ATTACHMENT_TYPES)[number];

export type FileAttachmentPreviewKind =
  | "image"
  | "pdf"
  | "csv"
  | "text"
  | "audio"
  | "video"
  | "download";

export interface FileAttachmentTypeRule {
  extensions: readonly string[];
  indexing: "name-and-metadata" | "safe-text" | "csv" | "none";
  maxBytes: number;
  mimeTypes: readonly string[];
  preview: FileAttachmentPreviewKind;
}

export const FILE_ATTACHMENT_TYPE_RULES: Record<
  FileAttachmentType,
  FileAttachmentTypeRule
> = {
  audio: {
    extensions: [".mp3", ".m4a", ".wav"],
    indexing: "none",
    maxBytes: 100 * 1024 * 1024,
    mimeTypes: [
      "audio/mpeg",
      "audio/mp4",
      "audio/wav",
      "audio/x-m4a",
      "audio/x-wav",
    ],
    preview: "audio",
  },
  csv: {
    extensions: [".csv"],
    indexing: "csv",
    maxBytes: 25 * 1024 * 1024,
    mimeTypes: ["text/csv"],
    preview: "csv",
  },
  image: {
    extensions: [".jpg", ".jpeg", ".png", ".webp", ".gif"],
    indexing: "name-and-metadata",
    maxBytes: 25 * 1024 * 1024,
    mimeTypes: ["image/jpeg", "image/png", "image/webp", "image/gif"],
    preview: "image",
  },
  pdf: {
    extensions: [".pdf"],
    indexing: "safe-text",
    maxBytes: 50 * 1024 * 1024,
    mimeTypes: ["application/pdf"],
    preview: "pdf",
  },
  text: {
    extensions: [".txt", ".md", ".markdown", ".json", ".log"],
    indexing: "safe-text",
    maxBytes: 10 * 1024 * 1024,
    mimeTypes: ["application/json", "text/markdown", "text/plain"],
    preview: "text",
  },
  video: {
    extensions: [".mp4", ".webm"],
    indexing: "none",
    maxBytes: 250 * 1024 * 1024,
    mimeTypes: ["video/mp4", "video/webm"],
    preview: "video",
  },
  zip: {
    extensions: [".zip"],
    indexing: "none",
    maxBytes: 100 * 1024 * 1024,
    mimeTypes: ["application/zip", "application/x-zip-compressed"],
    preview: "download",
  },
};

export const FILE_ATTACHMENT_LIFECYCLE_STATUSES = [
  "Active",
  "Archive",
  "Trash",
] as const;

export type FileAttachmentLifecycleStatus =
  (typeof FILE_ATTACHMENT_LIFECYCLE_STATUSES)[number];

const identifierSchema = z.string().trim().min(1).max(255);
const fileNameSchema = z
  .string()
  .trim()
  .min(1, "File name is required.")
  .max(255, "File name must be 255 characters or fewer.");
const mimeTypeSchema = z
  .string()
  .trim()
  .min(1, "MIME type is required.")
  .max(255);
const revisionSchema = z.number().int().nonnegative().safe();

export const fileAttachmentScopeSchema = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("project"),
      projectId: identifierSchema,
    })
    .strict(),
  z
    .object({
      kind: z.literal("personalWiki"),
      personalWikiId: identifierSchema,
    })
    .strict(),
]);

export type FileAttachmentScope = z.infer<typeof fileAttachmentScopeSchema>;

export const fileAttachmentUploadModeSchema = z.enum(["new", "new-version"]);

export type FileAttachmentUploadMode = z.infer<
  typeof fileAttachmentUploadModeSchema
>;

const fileAttachmentUploadFields = {
  baseRevision: revisionSchema.optional(),
  clientIdempotencyKey: identifierSchema,
  declaredMimeType: mimeTypeSchema,
  fileName: fileNameSchema,
  uploadId: identifierSchema,
} as const;

const fileAttachmentStageFields = {
  baseRevision: revisionSchema.optional(),
  clientIdempotencyKey: identifierSchema,
  declaredMimeType: mimeTypeSchema,
  fileName: fileNameSchema,
} as const;

export const fileAttachmentFinalizeInputSchema = z.discriminatedUnion("mode", [
  z
    .object({
      ...fileAttachmentUploadFields,
      mode: z.literal("new"),
      scope: fileAttachmentScopeSchema,
    })
    .strict(),
  z
    .object({
      ...fileAttachmentUploadFields,
      attachmentId: identifierSchema,
      mode: z.literal("new-version"),
      scope: fileAttachmentScopeSchema.optional(),
    })
    .strict(),
]);

export type FileAttachmentFinalizeInput = z.infer<
  typeof fileAttachmentFinalizeInputSchema
>;

export const fileAttachmentStageInputSchema = z.discriminatedUnion("mode", [
  z
    .object({
      ...fileAttachmentStageFields,
      mode: z.literal("new"),
      scope: fileAttachmentScopeSchema,
    })
    .strict(),
  z
    .object({
      ...fileAttachmentStageFields,
      attachmentId: identifierSchema,
      mode: z.literal("new-version"),
      scope: fileAttachmentScopeSchema.optional(),
    })
    .strict(),
]);

export type FileAttachmentStageInput = z.infer<
  typeof fileAttachmentStageInputSchema
>;

export const fileAttachmentVersionSchema = z
  .object({
    byteSize: z.number().int().positive().safe(),
    contentHash: z.string().regex(/^[0-9a-f]{64}$/u),
    createdAt: z.string().datetime({ offset: true }),
    detectedMimeType: mimeTypeSchema,
    extension: z.string().regex(/^\.[a-z0-9]+$/u),
    fileName: fileNameSchema,
    id: identifierSchema,
    mimeType: mimeTypeSchema,
    number: z.number().int().positive().safe(),
    preview: z.enum([
      "image",
      "pdf",
      "csv",
      "text",
      "audio",
      "video",
      "download",
    ]),
  })
  .strict();

export type FileAttachmentVersion = z.infer<typeof fileAttachmentVersionSchema>;

export const fileAttachmentSchema = z
  .object({
    createdAt: z.string().datetime({ offset: true }),
    currentVersion: fileAttachmentVersionSchema,
    id: identifierSchema,
    lifecycleStatus: z.enum(FILE_ATTACHMENT_LIFECYCLE_STATUSES),
    name: fileNameSchema,
    revision: revisionSchema,
    scope: fileAttachmentScopeSchema,
    updatedAt: z.string().datetime({ offset: true }),
  })
  .strict();

export type FileAttachment = z.infer<typeof fileAttachmentSchema>;

export const fileAttachmentQuotaSchema = z
  .object({
    byteLimit: z.number().int().positive().safe(),
    bytesRemaining: z.number().int().nonnegative().safe(),
    bytesUsed: z.number().int().nonnegative().safe(),
    isOverLimit: z.boolean(),
    isWarning: z.boolean(),
    versionLimit: z.number().int().positive().safe(),
    versionsRemaining: z.number().int().nonnegative().safe(),
    versionsUsed: z.number().int().nonnegative().safe(),
  })
  .strict();

export type FileAttachmentQuota = z.infer<typeof fileAttachmentQuotaSchema>;

export const fileAttachmentUploadSessionSchema = z
  .object({
    fileName: fileNameSchema,
    mode: fileAttachmentUploadModeSchema,
    status: z.literal("Uploading"),
    uploadId: identifierSchema,
  })
  .strict();

export type FileAttachmentUploadSession = z.infer<
  typeof fileAttachmentUploadSessionSchema
>;

export const fileAttachmentFinalizeReceiptSchema = z
  .object({
    attachment: fileAttachmentSchema,
    idempotent: z.boolean(),
    status: z.literal("committed"),
    version: fileAttachmentVersionSchema,
  })
  .strict();

export type FileAttachmentFinalizeReceipt = z.infer<
  typeof fileAttachmentFinalizeReceiptSchema
>;

export const fileAttachmentListInputSchema = z
  .object({ scope: fileAttachmentScopeSchema.optional() })
  .strict();

export interface FileAttachmentAccess {
  finalize: (
    accountId: string,
    input: FileAttachmentFinalizeInput,
  ) => Promise<FileAttachmentFinalizeReceipt>;
  getQuota: (accountId: string) => Promise<FileAttachmentQuota>;
  list: (
    accountId: string,
    scope?: FileAttachmentScope,
  ) => Promise<FileAttachment[]>;
  stage: (
    accountId: string,
    input: FileAttachmentStageInput,
    bytes: Uint8Array,
  ) => Promise<FileAttachmentUploadSession>;
}
