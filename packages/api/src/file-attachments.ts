import { z } from "zod";

export const FILE_ATTACHMENT_UI_LABELS = {
  arrow: "Arrow",
  bindAsOrigin: "Bind as origin",
  cancel: "Cancel",
  confirm: "Confirm",
  chooseFile: "Choose file",
  captions: "Captions",
  copy: "Copy",
  description: "Description",
  download: "Download",
  fileAttachment: "File Attachment",
  existingWork: "Existing Work",
  finalizing: "Finalizing",
  fullscreen: "Fullscreen",
  highlighter: "Highlighter",
  loop: "Loop",
  markingLayer: "Marking layer",
  markedSourceLocation: "Marked source location",
  move: "Move",
  locationBindFailed: "Bind as origin could not be completed.",
  locationPreviewUnavailable: "Location preview is unavailable.",
  locationSelectionInstruction:
    "Click a Point or drag a Region on the preview, then click Preview.",
  markingSaveFailed: "Marking could not be saved. Try again.",
  markingUndoFailed: "Marking could not be undone. Try again.",
  newWork: "New Work",
  newWorkProjectRequired: "A Project is required for a new Work.",
  noFileSelected: "No file selected",
  page: "Page",
  pen: "Pen",
  playbackSpeed: "Playback speed",
  point: "Point",
  projectId: "Project ID",
  preview: "Preview",
  rectangle: "Rectangle",
  region: "Region",
  retryPreview: "Retry preview",
  selectFileAttachment: "Select a File Attachment",
  reviewLocationBind:
    "Review the selected Point or Region, then confirm the Work bind.",
  title: "Title",
  undo: "Undo",
  unavailable: "Unavailable",
  upload: "Upload",
  uploading: "Uploading",
  uploadNewVersion: "Upload new version",
  versions: "Versions",
  workId: "Work ID",
  xCoordinate: "X (0–1)",
  yCoordinate: "Y (0–1)",
  width: "Width (0–1)",
  height: "Height (0–1)",
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

// Largest accepted original bytes plus multipart form overhead for the stage route.
export const FILE_ATTACHMENT_UPLOAD_BODY_LIMIT =
  Math.max(
    ...Object.values(FILE_ATTACHMENT_TYPE_RULES).map((rule) => rule.maxBytes),
  ) +
  1024 * 1024;

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

export const FILE_ATTACHMENT_PREVIEW_VARIANTS = [
  "original",
  "small",
  "medium",
] as const;

export type FileAttachmentPreviewVariant =
  (typeof FILE_ATTACHMENT_PREVIEW_VARIANTS)[number];

export const FILE_ATTACHMENT_MARKING_TOOLS = [
  "pen",
  "highlighter",
  "arrow",
  "rectangle",
] as const;

export type FileAttachmentMarkingTool =
  (typeof FILE_ATTACHMENT_MARKING_TOOLS)[number];

export const FILE_ATTACHMENT_MARKING_GEOMETRY = {
  arrow: "arrow",
  highlighter: "path",
  pen: "path",
  rectangle: "rectangle",
} as const satisfies Record<
  FileAttachmentMarkingTool,
  "arrow" | "path" | "rectangle"
>;

const normalizedCoordinateSchema = z.number().min(0).max(1);
const pageNumberSchema = z.number().int().positive().safe();

export const fileAttachmentPointSchema = z
  .object({
    x: normalizedCoordinateSchema,
    y: normalizedCoordinateSchema,
  })
  .strict();

export type FileAttachmentPoint = z.infer<typeof fileAttachmentPointSchema>;

export const fileAttachmentRegionSchema = z
  .object({
    height: z.number().gt(0).max(1),
    width: z.number().gt(0).max(1),
    x: normalizedCoordinateSchema,
    y: normalizedCoordinateSchema,
  })
  .strict()
  .superRefine((region, context) => {
    if (region.x + region.width > 1) {
      context.addIssue({
        code: "custom",
        message: "Region must stay inside the source surface.",
        path: ["width"],
      });
    }
    if (region.y + region.height > 1) {
      context.addIssue({
        code: "custom",
        message: "Region must stay inside the source surface.",
        path: ["height"],
      });
    }
  });

export type FileAttachmentRegion = z.infer<typeof fileAttachmentRegionSchema>;

export const fileAttachmentLocationSchema = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("point"),
      page: pageNumberSchema.optional(),
      x: normalizedCoordinateSchema,
      y: normalizedCoordinateSchema,
    })
    .strict(),
  z
    .object({
      kind: z.literal("region"),
      page: pageNumberSchema.optional(),
      region: fileAttachmentRegionSchema,
    })
    .strict(),
]);

export type FileAttachmentLocation = z.infer<
  typeof fileAttachmentLocationSchema
>;

export const fileAttachmentMarkingGeometrySchema = z.discriminatedUnion(
  "kind",
  [
    z
      .object({
        kind: z.literal("path"),
        page: pageNumberSchema.optional(),
        points: z.array(fileAttachmentPointSchema).min(2).max(10_000),
      })
      .strict(),
    z
      .object({
        end: fileAttachmentPointSchema,
        kind: z.literal("arrow"),
        page: pageNumberSchema.optional(),
        start: fileAttachmentPointSchema,
      })
      .strict(),
    z
      .object({
        kind: z.literal("rectangle"),
        page: pageNumberSchema.optional(),
        region: fileAttachmentRegionSchema,
      })
      .strict(),
  ],
);

export type FileAttachmentMarkingGeometry = z.infer<
  typeof fileAttachmentMarkingGeometrySchema
>;

export const fileAttachmentMarkingInputSchema = z
  .object({
    attachmentId: identifierSchema,
    clientIdempotencyKey: identifierSchema,
    geometry: fileAttachmentMarkingGeometrySchema,
    tool: z.enum(FILE_ATTACHMENT_MARKING_TOOLS),
    versionId: identifierSchema,
  })
  .strict();

export type FileAttachmentMarkingInput = z.infer<
  typeof fileAttachmentMarkingInputSchema
>;

export const fileAttachmentMarkingSchema = z
  .object({
    attachmentId: identifierSchema,
    createdAt: z.string().datetime({ offset: true }),
    geometry: fileAttachmentMarkingGeometrySchema,
    id: identifierSchema,
    tool: z.enum(FILE_ATTACHMENT_MARKING_TOOLS),
    versionId: identifierSchema,
  })
  .strict();

export type FileAttachmentMarking = z.infer<typeof fileAttachmentMarkingSchema>;

export const fileAttachmentMarkingsInputSchema = z
  .object({
    attachmentId: identifierSchema,
    versionId: identifierSchema,
  })
  .strict();

export type FileAttachmentMarkingsInput = z.infer<
  typeof fileAttachmentMarkingsInputSchema
>;

export const fileAttachmentUndoMarkingInputSchema = z
  .object({
    attachmentId: identifierSchema,
    markingId: identifierSchema,
    versionId: identifierSchema,
  })
  .strict();

export type FileAttachmentUndoMarkingInput = z.infer<
  typeof fileAttachmentUndoMarkingInputSchema
>;

const fileAttachmentWorkTypeSchema = z.enum([
  "Feature",
  "Bug",
  "Task",
  "Research",
  "Improvement",
]);

export const fileAttachmentLocationBindPreviewInputSchema =
  z.discriminatedUnion("mode", [
    z
      .object({
        attachmentId: identifierSchema,
        description: z.string().trim().max(100_000).nullable().optional(),
        location: fileAttachmentLocationSchema,
        mode: z.literal("new"),
        projectId: identifierSchema,
        title: fileNameSchema,
        type: fileAttachmentWorkTypeSchema.default("Task"),
        versionId: identifierSchema,
      })
      .strict(),
    z
      .object({
        attachmentId: identifierSchema,
        location: fileAttachmentLocationSchema,
        mode: z.literal("existing"),
        versionId: identifierSchema,
        workId: identifierSchema,
      })
      .strict(),
  ]);

export type FileAttachmentLocationBindPreviewInput = z.infer<
  typeof fileAttachmentLocationBindPreviewInputSchema
>;

export const fileAttachmentLocationBindInputSchema = z.discriminatedUnion(
  "mode",
  [
    z
      .object({
        attachmentId: identifierSchema,
        clientIdempotencyKey: identifierSchema,
        description: z.string().trim().max(100_000).nullable().optional(),
        location: fileAttachmentLocationSchema,
        mode: z.literal("new"),
        previewId: identifierSchema,
        projectId: identifierSchema,
        title: fileNameSchema,
        type: fileAttachmentWorkTypeSchema.default("Task"),
        versionId: identifierSchema,
      })
      .strict(),
    z
      .object({
        attachmentId: identifierSchema,
        baseRevision: revisionSchema,
        clientIdempotencyKey: identifierSchema,
        location: fileAttachmentLocationSchema,
        mode: z.literal("existing"),
        previewId: identifierSchema,
        versionId: identifierSchema,
        workId: identifierSchema,
      })
      .strict(),
  ],
);

export type FileAttachmentLocationBindInput = z.infer<
  typeof fileAttachmentLocationBindInputSchema
>;

export const fileAttachmentWorkTargetSchema = z
  .object({
    id: identifierSchema,
    key: identifierSchema,
    projectId: identifierSchema,
    revision: revisionSchema,
    title: fileNameSchema,
  })
  .strict();

export type FileAttachmentWorkTarget = z.infer<
  typeof fileAttachmentWorkTargetSchema
>;

export const fileAttachmentLocationBindPreviewSchema = z
  .object({
    attachmentId: identifierSchema,
    location: fileAttachmentLocationSchema,
    previewId: identifierSchema,
    target: z.discriminatedUnion("mode", [
      z
        .object({
          mode: z.literal("new"),
          projectId: identifierSchema,
          title: fileNameSchema,
          type: fileAttachmentWorkTypeSchema,
        })
        .strict(),
      z
        .object({
          mode: z.literal("existing"),
          work: fileAttachmentWorkTargetSchema,
        })
        .strict(),
    ]),
    versionId: identifierSchema,
  })
  .strict();

export type FileAttachmentLocationBindPreview = z.infer<
  typeof fileAttachmentLocationBindPreviewSchema
>;

export const fileAttachmentLocationBindReceiptSchema = z
  .object({
    attachmentId: identifierSchema,
    location: fileAttachmentLocationSchema,
    status: z.literal("committed"),
    versionId: identifierSchema,
    work: fileAttachmentWorkTargetSchema,
  })
  .strict();

export type FileAttachmentLocationBindReceipt = z.infer<
  typeof fileAttachmentLocationBindReceiptSchema
>;

export const fileAttachmentPreviewInputSchema = z
  .object({
    attachmentId: identifierSchema,
    versionId: identifierSchema,
  })
  .strict();

export type FileAttachmentPreviewInput = z.infer<
  typeof fileAttachmentPreviewInputSchema
>;

export const fileAttachmentAssetInputSchema = z
  .object({
    attachmentId: identifierSchema,
    variant: z.enum(FILE_ATTACHMENT_PREVIEW_VARIANTS),
    versionId: identifierSchema,
  })
  .strict();

export type FileAttachmentAssetInput = z.infer<
  typeof fileAttachmentAssetInputSchema
>;

export const fileAttachmentPreviewSchema = z
  .object({
    attachmentId: identifierSchema,
    csv: z
      .object({
        headers: z.array(z.string()),
        rows: z.array(z.array(z.string())),
        truncated: z.boolean(),
      })
      .strict()
      .optional(),
    downloadPath: z.string().startsWith("/api/file-attachments/"),
    failure: z
      .object({
        attempts: z.number().int().positive().safe(),
        code: z.enum([
          "decode-limit",
          "dimension-limit",
          "frame-limit",
          "cpu-limit",
          "processing-failed",
        ]),
        message: z.string().min(1),
        retryable: z.boolean(),
      })
      .strict()
      .optional(),
    fallback: z.literal("Unavailable").optional(),
    gallery: z
      .object({
        mediumPath: z.string().startsWith("/api/file-attachments/"),
        smallPath: z.string().startsWith("/api/file-attachments/"),
      })
      .strict()
      .optional(),
    kind: z.enum(["image", "pdf", "csv", "text", "audio", "video", "download"]),
    pageCount: z.number().int().positive().optional(),
    playback: z
      .object({
        autoplay: z.literal(false),
        fullscreen: z.literal(true),
        loop: z.literal("optional"),
        speeds: z.array(z.number().positive()).min(1),
        userInitiated: z.literal(true),
      })
      .strict()
      .optional(),
    previewPath: z.string().startsWith("/api/file-attachments/").optional(),
    status: z.enum(["available", "download-only", "processing", "unavailable"]),
    text: z
      .object({
        content: z.string(),
        truncated: z.boolean(),
      })
      .strict()
      .optional(),
    versionId: identifierSchema,
  })
  .strict();

export type FileAttachmentPreview = z.infer<typeof fileAttachmentPreviewSchema>;

export interface FileAttachmentAsset {
  bytes: Uint8Array;
  contentType: string;
  disposition: "attachment" | "inline";
  fileName: string;
  versionId: string;
}

export interface FileAttachmentExternalSurfaceSelection {
  allowed: boolean;
  reason: "unscanned-zip" | null;
}

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
  bindLocation: (
    accountId: string,
    input: FileAttachmentLocationBindInput,
  ) => Promise<FileAttachmentLocationBindReceipt>;
  canSelectIntoExternalSurface: (
    accountId: string,
    input: FileAttachmentPreviewInput,
  ) => Promise<FileAttachmentExternalSurfaceSelection>;
  cleanupVersionDerivatives: (
    accountId: string,
    input: FileAttachmentPreviewInput,
  ) => Promise<void>;
  createMarking: (
    accountId: string,
    input: FileAttachmentMarkingInput,
  ) => Promise<FileAttachmentMarking>;
  finalize: (
    accountId: string,
    input: FileAttachmentFinalizeInput,
  ) => Promise<FileAttachmentFinalizeReceipt>;
  getQuota: (accountId: string) => Promise<FileAttachmentQuota>;
  list: (
    accountId: string,
    scope?: FileAttachmentScope,
  ) => Promise<FileAttachment[]>;
  listMarkings: (
    accountId: string,
    input: FileAttachmentMarkingsInput,
  ) => Promise<FileAttachmentMarking[]>;
  preview: (
    accountId: string,
    input: FileAttachmentPreviewInput,
  ) => Promise<FileAttachmentPreview>;
  previewLocationBind: (
    accountId: string,
    input: FileAttachmentLocationBindPreviewInput,
  ) => Promise<FileAttachmentLocationBindPreview>;
  readAsset: (
    accountId: string,
    input: FileAttachmentAssetInput,
  ) => Promise<FileAttachmentAsset>;
  stage: (
    accountId: string,
    input: FileAttachmentStageInput,
    bytes: Uint8Array,
  ) => Promise<FileAttachmentUploadSession>;
  undoMarking: (
    accountId: string,
    input: FileAttachmentUndoMarkingInput,
  ) => Promise<void>;
}
