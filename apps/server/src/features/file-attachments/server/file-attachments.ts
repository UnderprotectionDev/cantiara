import { createHash } from "node:crypto";

import {
  FILE_ATTACHMENT_MARKING_GEOMETRY,
  FILE_ATTACHMENT_QUOTA,
  FILE_ATTACHMENT_TYPE_RULES,
  type FileAttachment,
  type FileAttachmentAccess,
  type FileAttachmentFinalizeInput,
  type FileAttachmentFinalizeReceipt,
  type FileAttachmentLocation,
  type FileAttachmentLocationBindInput,
  type FileAttachmentLocationBindPreview,
  type FileAttachmentLocationBindPreviewInput,
  type FileAttachmentMarking,
  type FileAttachmentMarkingInput,
  type FileAttachmentMarkingsInput,
  type FileAttachmentQuota,
  type FileAttachmentScope,
  type FileAttachmentStageInput,
  type FileAttachmentType,
  type FileAttachmentTypeRule,
  type FileAttachmentUndoMarkingInput,
  type FileAttachmentVersion,
  type FileAttachmentWorkTarget,
  fileAttachmentFinalizeInputSchema,
  fileAttachmentFinalizeReceiptSchema,
  fileAttachmentLocationBindInputSchema,
  fileAttachmentLocationBindPreviewInputSchema,
  fileAttachmentLocationBindPreviewSchema,
  fileAttachmentLocationBindReceiptSchema,
  fileAttachmentMarkingInputSchema,
  fileAttachmentMarkingSchema,
  fileAttachmentMarkingsInputSchema,
  fileAttachmentQuotaSchema,
  fileAttachmentSchema,
  fileAttachmentStageInputSchema,
  fileAttachmentUndoMarkingInputSchema,
  fileAttachmentUploadSessionSchema,
} from "@cantiara/api/file-attachments";
import type { WorkOriginPosition } from "@cantiara/api/work-lifecycle";
import { fileTypeFromBuffer } from "file-type";

import {
  createFileAttachmentPreview,
  type FileAttachmentPreviewConfiguration,
  type FileAttachmentPreviewJob,
  type FileAttachmentPreviewProcessOptions,
  type FileAttachmentPreviewSchedule,
} from "./file-attachment-preview";

const MIME_PARAMETER_PATTERN = /;.*$/u;
const CONTROL_CHARACTER_PATTERN = /\p{Cc}/u;

const FORBIDDEN_EXTENSIONS = new Set([
  ".app",
  ".bat",
  ".cmd",
  ".com",
  ".dll",
  ".dmg",
  ".docm",
  ".exe",
  ".htm",
  ".html",
  ".jar",
  ".js",
  ".jsx",
  ".mjs",
  ".msi",
  ".php",
  ".pl",
  ".ps1",
  ".py",
  ".rb",
  ".scr",
  ".sh",
  ".svg",
  ".ts",
  ".tsx",
  ".vbs",
  ".xlsm",
  ".xltm",
  ".pptm",
  ".potm",
  ".ppsm",
]);

const FORBIDDEN_MIME_TYPES = new Set([
  "application/ecmascript",
  "application/javascript",
  "application/x-7z-compressed",
  "application/x-dosexec",
  "application/x-executable",
  "application/x-httpd-php",
  "application/x-msdownload",
  "application/x-sh",
  "application/x-shockwave-flash",
  "image/svg+xml",
  "text/html",
  "text/javascript",
]);

const EXTENSION_MIME_TYPES: Record<string, readonly string[]> = {
  ".csv": ["text/csv"],
  ".gif": ["image/gif"],
  ".jpeg": ["image/jpeg"],
  ".jpg": ["image/jpeg"],
  ".json": ["application/json"],
  ".log": ["text/plain"],
  ".m4a": ["audio/mp4", "audio/x-m4a"],
  ".markdown": ["text/markdown"],
  ".md": ["text/markdown"],
  ".mp3": ["audio/mpeg"],
  ".mp4": ["video/mp4"],
  ".pdf": ["application/pdf"],
  ".png": ["image/png"],
  ".txt": ["text/plain"],
  ".wav": ["audio/wav", "audio/x-wav"],
  ".webm": ["video/webm"],
  ".webp": ["image/webp"],
  ".zip": ["application/zip", "application/x-zip-compressed"],
};

const MIME_TYPE_ALIASES: Record<string, string> = {
  "audio/x-m4a": "audio/mp4",
  "audio/x-wav": "audio/wav",
  "application/x-zip-compressed": "application/zip",
};

export type FileAttachmentValidationErrorCode =
  | "FILE_ATTACHMENT_CONTENT_MISMATCH"
  | "FILE_ATTACHMENT_FILE_TOO_LARGE"
  | "FILE_ATTACHMENT_INVALID_NAME"
  | "FILE_ATTACHMENT_MIME_MISMATCH"
  | "FILE_ATTACHMENT_UNSUPPORTED_TYPE";

export class FileAttachmentValidationError extends Error {
  readonly code: FileAttachmentValidationErrorCode;

  constructor(code: FileAttachmentValidationErrorCode, message: string) {
    super(message);
    this.name = "FileAttachmentValidationError";
    this.code = code;
  }
}

export interface ValidateFileAttachmentUploadInput {
  bytes: Uint8Array;
  declaredMimeType: string;
  fileName: string;
}

export interface ValidatedFileAttachmentUpload {
  byteSize: number;
  contentHash: string;
  detectedMimeType: string;
  extension: string;
  fileName: string;
  mimeType: string;
  preview: FileAttachmentTypeRule["preview"];
  type: FileAttachmentType;
}

function normalizeMimeType(value: string) {
  const normalized = value
    .trim()
    .toLocaleLowerCase("en-US")
    .replace(MIME_PARAMETER_PATTERN, "");
  return MIME_TYPE_ALIASES[normalized] ?? normalized;
}

function extensionFor(fileName: string) {
  const lastDot = fileName.lastIndexOf(".");
  if (lastDot <= 0 || lastDot === fileName.length - 1) {
    return "";
  }
  return fileName.slice(lastDot).toLocaleLowerCase("en-US");
}

function ruleForExtension(extension: string) {
  for (const [type, rule] of Object.entries(FILE_ATTACHMENT_TYPE_RULES) as [
    FileAttachmentType,
    FileAttachmentTypeRule,
  ][]) {
    if (rule.extensions.includes(extension)) {
      return { rule, type };
    }
  }
  return null;
}

function ruleForMimeType(mimeType: string) {
  for (const [type, rule] of Object.entries(FILE_ATTACHMENT_TYPE_RULES) as [
    FileAttachmentType,
    FileAttachmentTypeRule,
  ][]) {
    if (rule.mimeTypes.includes(mimeType)) {
      return { rule, type };
    }
  }
  return null;
}

function isUtf8Text(bytes: Uint8Array) {
  if (bytes.includes(0)) {
    return false;
  }
  try {
    new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    return true;
  } catch {
    return false;
  }
}

function hashBytes(bytes: Uint8Array) {
  return createHash("sha256").update(bytes).digest("hex");
}

function reject(
  code: FileAttachmentValidationErrorCode,
  message: string,
): never {
  throw new FileAttachmentValidationError(code, message);
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Validation keeps the type matrix, content detector, and fail-closed checks together at one acceptance seam.
export async function validateFileAttachmentUpload(
  input: ValidateFileAttachmentUploadInput,
): Promise<ValidatedFileAttachmentUpload> {
  const fileName = input.fileName.trim();
  const declaredMimeType = normalizeMimeType(input.declaredMimeType);
  const extension = extensionFor(fileName);

  if (
    fileName.length === 0 ||
    fileName.length > 255 ||
    fileName.includes("/") ||
    fileName.includes("\\") ||
    CONTROL_CHARACTER_PATTERN.test(fileName)
  ) {
    reject(
      "FILE_ATTACHMENT_INVALID_NAME",
      "File names must not contain path separators or control characters.",
    );
  }

  if (
    FORBIDDEN_EXTENSIONS.has(extension) ||
    FORBIDDEN_MIME_TYPES.has(declaredMimeType)
  ) {
    reject(
      "FILE_ATTACHMENT_UNSUPPORTED_TYPE",
      "This file type is not allowed for File Attachments.",
    );
  }

  const extensionRule = ruleForExtension(extension);
  const mimeRule = ruleForMimeType(declaredMimeType);
  if (!(extensionRule && mimeRule) || extensionRule.type !== mimeRule.type) {
    reject(
      "FILE_ATTACHMENT_MIME_MISMATCH",
      "The MIME type and file extension do not match.",
    );
  }

  const extensionMimes = EXTENSION_MIME_TYPES[extension] ?? [];
  if (!extensionMimes.includes(declaredMimeType)) {
    reject(
      "FILE_ATTACHMENT_MIME_MISMATCH",
      "The MIME type and file extension do not match.",
    );
  }

  const { rule, type } = extensionRule;
  const byteSize = input.bytes.byteLength;
  if (byteSize === 0 || byteSize > rule.maxBytes) {
    reject(
      "FILE_ATTACHMENT_FILE_TOO_LARGE",
      `This ${type} file exceeds its original-byte limit.`,
    );
  }

  const isTextType = type === "text" || type === "csv";
  const detected = await fileTypeFromBuffer(input.bytes);
  let detectedMimeType = "";
  if (detected) {
    detectedMimeType = normalizeMimeType(detected.mime);
  } else if (isTextType) {
    detectedMimeType = declaredMimeType;
  }
  const detectedRule = detectedMimeType
    ? ruleForMimeType(detectedMimeType)
    : null;

  const normalizedExtensionMimes = extensionMimes.map(normalizeMimeType);
  if (
    detectedRule &&
    (detectedRule.type !== type ||
      !normalizedExtensionMimes.includes(detectedMimeType))
  ) {
    reject(
      "FILE_ATTACHMENT_MIME_MISMATCH",
      "The file content does not match its MIME type and extension.",
    );
  }

  if (isTextType && !isUtf8Text(input.bytes)) {
    reject(
      "FILE_ATTACHMENT_CONTENT_MISMATCH",
      "The file is not valid safe UTF-8 text.",
    );
  }

  if (!(isTextType || detectedRule)) {
    reject(
      "FILE_ATTACHMENT_CONTENT_MISMATCH",
      "The file content could not be verified for this type.",
    );
  }

  return {
    byteSize,
    contentHash: hashBytes(input.bytes),
    detectedMimeType,
    extension,
    fileName,
    mimeType: declaredMimeType,
    preview: rule.preview,
    type,
  };
}

export interface FileAttachmentObjectStore {
  delete: (key: string) => Promise<void>;
  has: (key: string) => Promise<boolean>;
  promote: (input: {
    permanentKey: string;
    temporaryKey: string;
  }) => Promise<void>;
  putImmutable: (input: {
    bytes: Uint8Array;
    contentType: string;
    key: string;
  }) => Promise<"created" | "existing">;
  putTemporary: (input: {
    accountId: string;
    bytes: Uint8Array;
    contentType: string;
    uploadId: string;
  }) => Promise<{ key: string }>;
  read: (key: string) => Promise<Uint8Array>;
}

export type FileAttachmentStoredUploadStatus =
  | "committed"
  | "rejected"
  | "staged"
  | "swept";

export interface FileAttachmentStoredUpload {
  accountId: string;
  attachmentId: string | null;
  baseRevision: number | null;
  clientIdempotencyKey: string;
  declaredMimeType: string;
  error: {
    code: string;
    message: string;
  } | null;
  expiresAt: Date;
  fileName: string;
  id: string;
  mode: "new" | "new-version";
  payloadFingerprint: string;
  result: FileAttachmentFinalizeReceipt | null;
  scope: FileAttachmentScope | null;
  status: FileAttachmentStoredUploadStatus;
  temporaryObjectKey: string | null;
  workspaceId: string;
}

export interface FileAttachmentStoredVersion {
  attachment: FileAttachment;
  objectKey: string;
  version: FileAttachmentVersion;
}

export type FileAttachmentWorkOriginPosition = WorkOriginPosition & {
  location: FileAttachmentLocation;
};

export interface FileAttachmentLocationWorkAccess {
  bind: (
    accountId: string,
    input: {
      baseRevision: number;
      clientIdempotencyKey: string;
      originPosition: FileAttachmentWorkOriginPosition;
      workId: string;
    },
  ) => Promise<FileAttachmentWorkTarget>;
  create: (
    accountId: string,
    input: {
      clientIdempotencyKey: string;
      description: string | null;
      originPosition: FileAttachmentWorkOriginPosition;
      projectId: string;
      title: string;
      type: "Feature" | "Bug" | "Task" | "Research" | "Improvement";
    },
  ) => Promise<FileAttachmentWorkTarget>;
  find: (
    accountId: string,
    workId: string,
  ) => Promise<FileAttachmentWorkTarget | null>;
  findProject: (accountId: string, projectId: string) => Promise<boolean>;
  replayBind: (
    accountId: string,
    input: {
      baseRevision: number;
      clientIdempotencyKey: string;
      originPosition: FileAttachmentWorkOriginPosition;
      workId: string;
    },
  ) => Promise<FileAttachmentWorkTarget | null>;
}

export interface FileAttachmentStoredMarking {
  accountId: string;
  clientIdempotencyKey: string;
  marking: FileAttachmentMarking;
  payloadFingerprint: string;
}

export interface FileAttachmentCommitInput {
  accountId: string;
  attachmentId: string;
  baseRevision: number | null;
  fileName: string;
  mode: "new" | "new-version";
  now: Date;
  permanentObjectKey: string;
  scope: FileAttachmentScope | null;
  uploadId: string;
  validated: ValidatedFileAttachmentUpload;
  versionId: string;
  workspaceId: string;
}

export interface FileAttachmentCommitResult {
  attachment: FileAttachment;
  version: FileAttachmentVersion;
}

export interface FileAttachmentRepository {
  clearTemporaryObject: (uploadId: string) => Promise<void>;
  commitUpload: (
    input: FileAttachmentCommitInput,
  ) => Promise<FileAttachmentCommitResult>;
  findExpiredUploads: (now: Date) => Promise<FileAttachmentStoredUpload[]>;
  findMarking: (
    accountId: string,
    attachmentId: string,
    versionId: string,
    markingId: string,
  ) => Promise<FileAttachmentMarking | null>;
  findMarkingByIdempotencyKey: (
    accountId: string,
    clientIdempotencyKey: string,
  ) => Promise<FileAttachmentStoredMarking | null>;
  findUpload: (
    accountId: string,
    clientIdempotencyKey: string,
  ) => Promise<FileAttachmentStoredUpload | null>;
  findVersion: (
    accountId: string,
    attachmentId: string,
    versionId: string,
  ) => Promise<FileAttachmentStoredVersion | null>;
  findWorkspaceId: (accountId: string) => Promise<string | null>;
  getQuota: (accountId: string) => Promise<FileAttachmentQuota>;
  hasOtherVersionWithContentHash: (
    contentHash: string,
    versionId: string,
  ) => Promise<boolean>;
  insertMarking: (input: FileAttachmentStoredMarking) => Promise<void>;
  insertUpload: (input: FileAttachmentStoredUpload) => Promise<void>;
  list: (
    accountId: string,
    scope?: FileAttachmentScope,
  ) => Promise<FileAttachment[]>;
  listMarkings: (
    accountId: string,
    attachmentId: string,
    versionId: string,
  ) => Promise<FileAttachmentMarking[]>;
  markUploadRejected: (
    uploadId: string,
    error: { code: string; message: string },
    at: Date,
  ) => Promise<void>;
  markUploadSwept: (uploadId: string, at: Date) => Promise<void>;
  rollbackCapturePromotion: (input: {
    accountId: string;
    attachmentId: string;
    uploadId: string;
    versionId: string;
  }) => Promise<void>;
  undoMarking: (
    accountId: string,
    attachmentId: string,
    versionId: string,
    markingId: string,
  ) => Promise<void>;
}

export type FileAttachmentErrorCode =
  | "FILE_ATTACHMENT_ACCOUNT_NOT_FOUND"
  | "FILE_ATTACHMENT_IDEMPOTENCY_CONFLICT"
  | "FILE_ATTACHMENT_LOCATION_UNSUPPORTED"
  | "FILE_ATTACHMENT_MARKING_UNSUPPORTED"
  | "FILE_ATTACHMENT_QUOTA_EXCEEDED"
  | "FILE_ATTACHMENT_REVISION_CONFLICT"
  | "FILE_ATTACHMENT_PREVIEW_UNAVAILABLE"
  | "FILE_ATTACHMENT_TARGET_NOT_FOUND"
  | "FILE_ATTACHMENT_UPLOAD_NOT_FOUND"
  | "FILE_ATTACHMENT_UPLOAD_REJECTED"
  | "FILE_ATTACHMENT_UPLOAD_UNAVAILABLE";

export class FileAttachmentError extends Error {
  readonly code: FileAttachmentErrorCode;

  constructor(
    code: FileAttachmentErrorCode,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "FileAttachmentError";
    this.code = code;
  }
}

function scopeFingerprint(scope: FileAttachmentScope | undefined) {
  if (!scope) {
    return "none";
  }
  return scope.kind === "project"
    ? `project:${scope.projectId}`
    : `personalWiki:${scope.personalWikiId}`;
}

function uploadFingerprint(
  input: FileAttachmentStageInput | FileAttachmentFinalizeInput,
  contentHash: string,
  byteSize: number,
) {
  const attachmentId = "attachmentId" in input ? input.attachmentId : "none";
  return createHash("sha256")
    .update(
      JSON.stringify({
        attachmentId: attachmentId ?? "none",
        baseRevision: input.baseRevision ?? null,
        byteSize,
        clientIdempotencyKey: input.clientIdempotencyKey,
        contentHash,
        declaredMimeType: normalizeMimeType(input.declaredMimeType),
        fileName: input.fileName.trim(),
        mode: input.mode,
        scope: scopeFingerprint(input.scope),
      }),
    )
    .digest("hex");
}

function sameScope(
  left: FileAttachmentScope | null,
  right: FileAttachmentScope | undefined,
) {
  if (!(left && right)) {
    return left === null && right === undefined;
  }
  if (left.kind === "project" && right.kind === "project") {
    return left.projectId === right.projectId;
  }
  if (left.kind === "personalWiki" && right.kind === "personalWiki") {
    return left.personalWikiId === right.personalWikiId;
  }
  return false;
}

function uploadMetadataMatches(
  upload: FileAttachmentStoredUpload,
  input: FileAttachmentFinalizeInput,
) {
  return (
    upload.fileName === input.fileName.trim() &&
    upload.declaredMimeType === normalizeMimeType(input.declaredMimeType) &&
    upload.mode === input.mode &&
    upload.attachmentId ===
      ("attachmentId" in input ? input.attachmentId : null) &&
    upload.baseRevision === (input.baseRevision ?? null) &&
    sameScope(upload.scope, input.scope)
  );
}

function permanentObjectKey(
  workspaceId: string,
  attachmentId: string,
  versionId: string,
) {
  return `file-attachments/${workspaceId}/${attachmentId}/${versionId}`;
}

function captureUploadIdempotencyKey(clientIdempotencyKey: string) {
  return `capture-attachment:${hashBytes(new TextEncoder().encode(clientIdempotencyKey))}`;
}

function ensureUploadQuota(quota: FileAttachmentQuota, byteSize: number) {
  if (
    quota.isOverLimit ||
    quota.bytesUsed + byteSize > FILE_ATTACHMENT_QUOTA.maxBytes ||
    quota.versionsUsed + 1 > FILE_ATTACHMENT_QUOTA.maxVersions
  ) {
    throw new FileAttachmentError(
      "FILE_ATTACHMENT_QUOTA_EXCEEDED",
      "Workspace File Attachment quota has been exceeded.",
    );
  }
}

function metadataFingerprint(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function requireMarkableSource(source: FileAttachmentStoredVersion) {
  if (source.version.preview !== "image" && source.version.preview !== "pdf") {
    throw new FileAttachmentError(
      "FILE_ATTACHMENT_MARKING_UNSUPPORTED",
      "Only image and PDF previews support a Marking layer.",
    );
  }
  return source;
}

function validateMarkingGeometry(
  source: FileAttachmentStoredVersion,
  input: FileAttachmentMarkingInput,
) {
  requireMarkableSource(source);
  const { page } = input.geometry;
  if (source.version.preview === "pdf" && page === undefined) {
    throw new FileAttachmentError(
      "FILE_ATTACHMENT_MARKING_UNSUPPORTED",
      "PDF markings must identify a page.",
    );
  }
  if (source.version.preview === "image" && page !== undefined) {
    throw new FileAttachmentError(
      "FILE_ATTACHMENT_MARKING_UNSUPPORTED",
      "Image markings cannot identify a PDF page.",
    );
  }

  const expectedGeometry = FILE_ATTACHMENT_MARKING_GEOMETRY[input.tool];
  if (input.geometry.kind !== expectedGeometry) {
    throw new FileAttachmentError(
      "FILE_ATTACHMENT_MARKING_UNSUPPORTED",
      "The selected Marking tool does not match its geometry.",
    );
  }
}

function validateLocation(
  source: FileAttachmentStoredVersion,
  location: FileAttachmentLocation,
) {
  if (source.version.preview !== "image" && source.version.preview !== "pdf") {
    throw new FileAttachmentError(
      "FILE_ATTACHMENT_LOCATION_UNSUPPORTED",
      "Only image and PDF previews support Bind as origin.",
    );
  }
  if (source.version.preview === "pdf" && location.page === undefined) {
    throw new FileAttachmentError(
      "FILE_ATTACHMENT_LOCATION_UNSUPPORTED",
      "A PDF Bind as origin location must identify a page.",
    );
  }
  if (source.version.preview === "image" && location.page !== undefined) {
    throw new FileAttachmentError(
      "FILE_ATTACHMENT_LOCATION_UNSUPPORTED",
      "An image Bind as origin location cannot identify a PDF page.",
    );
  }
}

function originPosition(
  source: FileAttachmentStoredVersion,
  location: FileAttachmentLocation,
): FileAttachmentWorkOriginPosition {
  return {
    componentId: `file-location:${metadataFingerprint({
      attachmentId: source.attachment.id,
      location,
      versionId: source.version.id,
    })}`,
    location,
    ownerRecordId: source.attachment.id,
    sourceVersion: source.version.id,
  };
}

function locationPreviewId(
  source: FileAttachmentStoredVersion,
  input: FileAttachmentLocationBindPreviewInput,
  target: FileAttachmentWorkTarget | null,
) {
  return `file-attachment-origin:${metadataFingerprint({
    attachmentId: source.attachment.id,
    location: input.location,
    target:
      input.mode === "new"
        ? {
            description: input.description ?? null,
            mode: input.mode,
            projectId: input.projectId,
            title: input.title,
            type: input.type,
          }
        : {
            mode: input.mode,
            revision: target?.revision ?? null,
            workId: input.workId,
          },
    versionId: source.version.id,
  })}`;
}

export interface FileAttachmentService {
  access: FileAttachmentAccess;
  processPreview: (
    job: FileAttachmentPreviewJob,
    options?: FileAttachmentPreviewProcessOptions,
  ) => Promise<void>;
  promoteCaptureAttachment: <TReceipt>(
    input: FileAttachmentCapturePromotionInput<TReceipt>,
  ) => Promise<TReceipt>;
  sweepExpiredUploads: (now?: Date) => Promise<number>;
}

export interface FileAttachmentCapturePromotionInput<TReceipt> {
  accountId: string;
  bytes?: Uint8Array;
  clientIdempotencyKey: string;
  declaredMimeType: string;
  fileName: string;
  finalize: () => Promise<TReceipt>;
  readBytes?: () => Promise<Uint8Array>;
  scope: FileAttachmentScope;
}

export function createFileAttachments({
  idGenerator = () => crypto.randomUUID(),
  now = () => new Date(),
  objectStore,
  preview: previewConfiguration,
  repository,
  schedulePreview,
  locationWork,
}: {
  idGenerator?: () => string;
  now?: () => Date;
  objectStore: FileAttachmentObjectStore;
  repository: FileAttachmentRepository;
  schedulePreview?: FileAttachmentPreviewSchedule;
  preview?: FileAttachmentPreviewConfiguration;
  locationWork?: FileAttachmentLocationWorkAccess;
}): FileAttachmentService {
  const fileAttachmentPreview = createFileAttachmentPreview({
    ...previewConfiguration,
    objectStore,
    repository,
    schedulePreview,
  });

  async function exactSource(
    accountId: string,
    attachmentId: string,
    versionId: string,
  ) {
    const source = await repository.findVersion(
      accountId,
      attachmentId,
      versionId,
    );
    if (!source) {
      throw new FileAttachmentError(
        "FILE_ATTACHMENT_TARGET_NOT_FOUND",
        "File Attachment is unavailable.",
      );
    }
    return source;
  }

  // PDF page counts never change for a committed File Attachment version, so
  // one resolved count serves every later marking or Bind as origin call in
  // this process instead of re-reading and re-parsing the object each time.
  const pdfPageCounts = new Map<string, number>();

  async function pdfPageCount(
    accountId: string,
    source: FileAttachmentStoredVersion,
  ): Promise<number> {
    const cached = pdfPageCounts.get(source.version.id);
    if (cached !== undefined) {
      return cached;
    }
    const rendered = await fileAttachmentPreview.preview(accountId, {
      attachmentId: source.attachment.id,
      versionId: source.version.id,
    });
    if (
      rendered.status !== "available" ||
      rendered.kind !== "pdf" ||
      rendered.pageCount === undefined
    ) {
      throw new FileAttachmentError(
        "FILE_ATTACHMENT_PREVIEW_UNAVAILABLE",
        "The PDF page count is unavailable.",
      );
    }
    pdfPageCounts.set(source.version.id, rendered.pageCount);
    return rendered.pageCount;
  }

  async function validatePdfPage(
    accountId: string,
    source: FileAttachmentStoredVersion,
    page: number | undefined,
    errorCode:
      | "FILE_ATTACHMENT_LOCATION_UNSUPPORTED"
      | "FILE_ATTACHMENT_MARKING_UNSUPPORTED",
  ) {
    if (source.version.preview !== "pdf" || page === undefined) {
      return;
    }
    if (page > (await pdfPageCount(accountId, source))) {
      throw new FileAttachmentError(
        errorCode,
        "The selected PDF page is outside the available document pages.",
      );
    }
  }

  async function createMarking(
    accountId: string,
    rawInput: FileAttachmentMarkingInput,
  ) {
    const input = fileAttachmentMarkingInputSchema.parse(rawInput);
    const source = await exactSource(
      accountId,
      input.attachmentId,
      input.versionId,
    );
    validateMarkingGeometry(source, input);
    await validatePdfPage(
      accountId,
      source,
      input.geometry.page,
      "FILE_ATTACHMENT_MARKING_UNSUPPORTED",
    );
    const payloadFingerprint = metadataFingerprint(input);
    const existing = await repository.findMarkingByIdempotencyKey(
      accountId,
      input.clientIdempotencyKey,
    );
    if (existing) {
      if (existing.payloadFingerprint !== payloadFingerprint) {
        throw new FileAttachmentError(
          "FILE_ATTACHMENT_IDEMPOTENCY_CONFLICT",
          "The Marking key was already used for different metadata.",
        );
      }
      return fileAttachmentMarkingSchema.parse(existing.marking);
    }

    const marking = fileAttachmentMarkingSchema.parse({
      attachmentId: input.attachmentId,
      createdAt: now().toISOString(),
      geometry: input.geometry,
      id: idGenerator(),
      tool: input.tool,
      versionId: input.versionId,
    });
    const stored: FileAttachmentStoredMarking = {
      accountId,
      clientIdempotencyKey: input.clientIdempotencyKey,
      marking,
      payloadFingerprint,
    };
    try {
      await repository.insertMarking(stored);
    } catch (error) {
      const concurrent = await repository.findMarkingByIdempotencyKey(
        accountId,
        input.clientIdempotencyKey,
      );
      if (concurrent) {
        if (concurrent.payloadFingerprint !== payloadFingerprint) {
          // biome-ignore lint/style/useErrorCause: FileAttachmentError forwards this cause through its Error constructor.
          throw new FileAttachmentError(
            "FILE_ATTACHMENT_IDEMPOTENCY_CONFLICT",
            "The Marking key was already used for different metadata.",
            { cause: error },
          );
        }
        return fileAttachmentMarkingSchema.parse(concurrent.marking);
      }
      throw error;
    }
    return marking;
  }

  async function listMarkings(
    accountId: string,
    rawInput: FileAttachmentMarkingsInput,
  ) {
    const input = fileAttachmentMarkingsInputSchema.parse(rawInput);
    const source = await exactSource(
      accountId,
      input.attachmentId,
      input.versionId,
    );
    requireMarkableSource(source);
    return fileAttachmentMarkingSchema
      .array()
      .parse(
        await repository.listMarkings(
          accountId,
          input.attachmentId,
          input.versionId,
        ),
      );
  }

  async function undoMarking(
    accountId: string,
    rawInput: FileAttachmentUndoMarkingInput,
  ) {
    const input = fileAttachmentUndoMarkingInputSchema.parse(rawInput);
    const source = await exactSource(
      accountId,
      input.attachmentId,
      input.versionId,
    );
    requireMarkableSource(source);
    const marking = await repository.findMarking(
      accountId,
      input.attachmentId,
      input.versionId,
      input.markingId,
    );
    if (marking) {
      await repository.undoMarking(
        accountId,
        input.attachmentId,
        input.versionId,
        input.markingId,
      );
    }
  }

  async function resolveLocationPreview(
    accountId: string,
    rawInput: FileAttachmentLocationBindPreviewInput,
  ): Promise<{
    preview: FileAttachmentLocationBindPreview;
    source: FileAttachmentStoredVersion;
  }> {
    const input = fileAttachmentLocationBindPreviewInputSchema.parse(rawInput);
    const source = await exactSource(
      accountId,
      input.attachmentId,
      input.versionId,
    );
    validateLocation(source, input.location);
    await validatePdfPage(
      accountId,
      source,
      input.location.page,
      "FILE_ATTACHMENT_LOCATION_UNSUPPORTED",
    );
    if (!locationWork) {
      throw new FileAttachmentError(
        "FILE_ATTACHMENT_LOCATION_UNSUPPORTED",
        "Work is unavailable for Bind as origin.",
      );
    }
    const target =
      input.mode === "existing"
        ? await locationWork.find(accountId, input.workId)
        : null;
    if (input.mode === "existing" && !target) {
      throw new FileAttachmentError(
        "FILE_ATTACHMENT_TARGET_NOT_FOUND",
        "The selected Work is unavailable.",
      );
    }
    if (
      input.mode === "new" &&
      !(await locationWork.findProject(accountId, input.projectId))
    ) {
      throw new FileAttachmentError(
        "FILE_ATTACHMENT_TARGET_NOT_FOUND",
        "The selected Project is unavailable.",
      );
    }
    const preview = fileAttachmentLocationBindPreviewSchema.parse({
      attachmentId: input.attachmentId,
      location: input.location,
      previewId: locationPreviewId(source, input, target),
      target:
        input.mode === "new"
          ? {
              mode: "new" as const,
              projectId: input.projectId,
              title: input.title,
              type: input.type,
            }
          : { mode: "existing" as const, work: target },
      versionId: input.versionId,
    });
    return { preview, source };
  }

  async function previewLocationBind(
    accountId: string,
    rawInput: FileAttachmentLocationBindPreviewInput,
  ): Promise<FileAttachmentLocationBindPreview> {
    const { preview } = await resolveLocationPreview(accountId, rawInput);
    return preview;
  }

  async function bindLocation(
    accountId: string,
    rawInput: FileAttachmentLocationBindInput,
  ) {
    const input = fileAttachmentLocationBindInputSchema.parse(rawInput);
    const previewInput =
      input.mode === "new"
        ? {
            attachmentId: input.attachmentId,
            description: input.description,
            location: input.location,
            mode: input.mode,
            projectId: input.projectId,
            title: input.title,
            type: input.type,
            versionId: input.versionId,
          }
        : {
            attachmentId: input.attachmentId,
            location: input.location,
            mode: input.mode,
            versionId: input.versionId,
            workId: input.workId,
          };
    const { preview, source } = await resolveLocationPreview(
      accountId,
      previewInput,
    );
    const position = originPosition(source, input.location);
    if (preview.previewId !== input.previewId) {
      const replayed =
        input.mode === "existing"
          ? await locationWork?.replayBind(accountId, {
              baseRevision: input.baseRevision,
              clientIdempotencyKey: input.clientIdempotencyKey,
              originPosition: position,
              workId: input.workId,
            })
          : null;
      if (replayed) {
        return fileAttachmentLocationBindReceiptSchema.parse({
          attachmentId: input.attachmentId,
          location: input.location,
          status: "committed",
          versionId: input.versionId,
          work: replayed,
        });
      }
      throw new FileAttachmentError(
        "FILE_ATTACHMENT_REVISION_CONFLICT",
        "The Bind as origin preview is stale. Review it again before confirming.",
      );
    }
    const work =
      input.mode === "new"
        ? await locationWork?.create(accountId, {
            clientIdempotencyKey: input.clientIdempotencyKey,
            description: input.description ?? null,
            originPosition: position,
            projectId: input.projectId,
            title: input.title,
            type: input.type,
          })
        : await locationWork?.bind(accountId, {
            baseRevision: input.baseRevision,
            clientIdempotencyKey: input.clientIdempotencyKey,
            originPosition: position,
            workId: input.workId,
          });
    if (!work) {
      throw new FileAttachmentError(
        "FILE_ATTACHMENT_LOCATION_UNSUPPORTED",
        "Work is unavailable for Bind as origin.",
      );
    }
    return fileAttachmentLocationBindReceiptSchema.parse({
      attachmentId: input.attachmentId,
      location: input.location,
      status: "committed",
      versionId: input.versionId,
      work,
    });
  }

  async function stage(
    accountId: string,
    rawInput: FileAttachmentStageInput,
    bytes: Uint8Array,
  ) {
    const input = fileAttachmentStageInputSchema.parse(rawInput);
    const workspaceId = await repository.findWorkspaceId(accountId);
    if (!workspaceId) {
      throw new FileAttachmentError(
        "FILE_ATTACHMENT_ACCOUNT_NOT_FOUND",
        "Workspace is unavailable.",
      );
    }

    const contentHash = hashBytes(bytes);
    const payloadFingerprint = uploadFingerprint(
      input,
      contentHash,
      bytes.byteLength,
    );
    const existing = await repository.findUpload(
      accountId,
      input.clientIdempotencyKey,
    );
    if (existing) {
      if (existing.payloadFingerprint !== payloadFingerprint) {
        throw new FileAttachmentError(
          "FILE_ATTACHMENT_IDEMPOTENCY_CONFLICT",
          "The upload key was already used for different file content.",
        );
      }
      return fileAttachmentUploadSessionSchema.parse({
        fileName: existing.fileName,
        mode: existing.mode,
        status: "Uploading",
        uploadId: existing.id,
      });
    }

    const validated = await validateFileAttachmentUpload({
      bytes,
      declaredMimeType: input.declaredMimeType,
      fileName: input.fileName,
    });
    ensureUploadQuota(await repository.getQuota(accountId), validated.byteSize);

    const uploadId = idGenerator();
    const temporaryObject = await objectStore.putTemporary({
      accountId,
      bytes,
      contentType: validated.mimeType,
      uploadId,
    });
    const expiresAt = new Date(now().getTime() + 24 * 60 * 60 * 1000);
    const upload: FileAttachmentStoredUpload = {
      accountId,
      attachmentId: "attachmentId" in input ? input.attachmentId : null,
      baseRevision: input.baseRevision ?? null,
      clientIdempotencyKey: input.clientIdempotencyKey,
      declaredMimeType: normalizeMimeType(input.declaredMimeType),
      error: null,
      expiresAt,
      fileName: input.fileName.trim(),
      id: uploadId,
      mode: input.mode,
      payloadFingerprint,
      result: null,
      scope: input.scope ?? null,
      status: "staged",
      temporaryObjectKey: temporaryObject.key,
      workspaceId,
    };

    try {
      await repository.insertUpload(upload);
    } catch (error) {
      await objectStore.delete(temporaryObject.key).catch(() => undefined);
      const concurrent = await repository.findUpload(
        accountId,
        input.clientIdempotencyKey,
      );
      if (concurrent?.payloadFingerprint === payloadFingerprint) {
        return fileAttachmentUploadSessionSchema.parse({
          fileName: concurrent.fileName,
          mode: concurrent.mode,
          status: "Uploading",
          uploadId: concurrent.id,
        });
      }
      if (concurrent) {
        // biome-ignore lint/style/useErrorCause: FileAttachmentError forwards this cause through its Error constructor.
        throw new FileAttachmentError(
          "FILE_ATTACHMENT_IDEMPOTENCY_CONFLICT",
          "The upload key was already used for different file content.",
          { cause: error },
        );
      }
      throw error;
    }

    return fileAttachmentUploadSessionSchema.parse({
      fileName: upload.fileName,
      mode: upload.mode,
      status: "Uploading",
      uploadId,
    });
  }

  // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Finalize coordinates read validation, promotion, transactional commit, retry recovery, and cleanup.
  async function finalize(
    accountId: string,
    rawInput: FileAttachmentFinalizeInput,
  ): Promise<FileAttachmentFinalizeReceipt> {
    const input = fileAttachmentFinalizeInputSchema.parse(rawInput);
    const upload = await repository.findUpload(
      accountId,
      input.clientIdempotencyKey,
    );
    if (!upload || upload.id !== input.uploadId) {
      throw new FileAttachmentError(
        "FILE_ATTACHMENT_UPLOAD_NOT_FOUND",
        "The upload is unavailable.",
      );
    }
    if (!uploadMetadataMatches(upload, input)) {
      throw new FileAttachmentError(
        "FILE_ATTACHMENT_IDEMPOTENCY_CONFLICT",
        "The upload metadata changed before finalization.",
      );
    }
    if (upload.status === "committed" && upload.result) {
      return fileAttachmentFinalizeReceiptSchema.parse({
        ...upload.result,
        idempotent: true,
      });
    }
    if (upload.status === "rejected" && upload.error) {
      throw new FileAttachmentError(
        "FILE_ATTACHMENT_UPLOAD_REJECTED",
        upload.error.message,
      );
    }
    if (!upload.temporaryObjectKey) {
      throw new FileAttachmentError(
        "FILE_ATTACHMENT_UPLOAD_UNAVAILABLE",
        "The upload object is unavailable. Start the upload again.",
      );
    }

    let bytes: Uint8Array;
    try {
      bytes = await objectStore.read(upload.temporaryObjectKey);
    } catch (error) {
      const failure = {
        code: "FILE_ATTACHMENT_UPLOAD_UNAVAILABLE",
        message: "The upload object is unavailable. Start the upload again.",
      } as const;
      await repository.markUploadRejected(upload.id, failure, now());
      // biome-ignore lint/style/useErrorCause: FileAttachmentError forwards this cause through its Error constructor.
      throw new FileAttachmentError(failure.code, failure.message, {
        cause: error,
      });
    }

    let validated: ValidatedFileAttachmentUpload;
    try {
      validated = await validateFileAttachmentUpload({
        bytes,
        declaredMimeType: input.declaredMimeType,
        fileName: input.fileName,
      });
    } catch (error) {
      const failure =
        error instanceof FileAttachmentValidationError
          ? { code: error.code, message: error.message }
          : {
              code: "FILE_ATTACHMENT_CONTENT_MISMATCH",
              message: "The file could not be verified.",
            };
      await repository.markUploadRejected(upload.id, failure, now());
      throw error;
    }

    const expectedFingerprint = uploadFingerprint(
      input,
      validated.contentHash,
      validated.byteSize,
    );
    if (expectedFingerprint !== upload.payloadFingerprint) {
      const failure = {
        code: "FILE_ATTACHMENT_IDEMPOTENCY_CONFLICT",
        message: "The upload content changed before finalization.",
      } as const;
      await repository.markUploadRejected(upload.id, failure, now());
      throw new FileAttachmentError(failure.code, failure.message);
    }

    const attachmentId =
      input.mode === "new" ? idGenerator() : input.attachmentId;
    const versionId = idGenerator();
    const permanentKey = permanentObjectKey(
      upload.workspaceId,
      attachmentId,
      versionId,
    );

    try {
      await objectStore.promote({
        permanentKey,
        temporaryKey: upload.temporaryObjectKey,
      });
      const committed = await repository.commitUpload({
        accountId,
        attachmentId,
        baseRevision: input.baseRevision ?? null,
        fileName: validated.fileName,
        mode: input.mode,
        now: now(),
        permanentObjectKey: permanentKey,
        scope: input.mode === "new" ? input.scope : upload.scope,
        uploadId: upload.id,
        validated,
        versionId,
        workspaceId: upload.workspaceId,
      });
      const receipt = fileAttachmentFinalizeReceiptSchema.parse({
        attachment: committed.attachment,
        idempotent: false,
        status: "committed",
        version: committed.version,
      });
      await objectStore
        .delete(upload.temporaryObjectKey)
        .catch(() => undefined);
      await repository.clearTemporaryObject(upload.id).catch(() => undefined);
      fileAttachmentPreview
        .schedule(accountId, {
          attachmentId: committed.attachment.id,
          versionId: committed.version.id,
        })
        .catch(() => undefined);
      return receipt;
    } catch (error) {
      const committed = await repository.findUpload(
        accountId,
        input.clientIdempotencyKey,
      );
      if (committed?.status === "committed" && committed.result) {
        await objectStore.delete(permanentKey).catch(() => undefined);
        await objectStore
          .delete(upload.temporaryObjectKey)
          .catch(() => undefined);
        return fileAttachmentFinalizeReceiptSchema.parse({
          ...committed.result,
          idempotent: true,
        });
      }
      await objectStore.delete(permanentKey).catch(() => undefined);
      if (error instanceof FileAttachmentError) {
        await repository
          .markUploadRejected(
            upload.id,
            {
              code: error.code,
              message: error.message,
            },
            now(),
          )
          .catch(() => undefined);
        throw error;
      }
      throw error;
    }
  }

  async function getQuota(accountId: string) {
    return fileAttachmentQuotaSchema.parse(
      await repository.getQuota(accountId),
    );
  }

  async function list(accountId: string, scope?: FileAttachmentScope) {
    return (await repository.list(accountId, scope)).map((attachment) =>
      fileAttachmentSchema.parse(attachment),
    );
  }

  async function promoteCaptureAttachment<TReceipt>({
    accountId,
    bytes,
    clientIdempotencyKey,
    declaredMimeType,
    fileName,
    finalize: finalizeTarget,
    readBytes,
    scope,
  }: FileAttachmentCapturePromotionInput<TReceipt>): Promise<TReceipt> {
    const uploadInput: FileAttachmentStageInput = {
      clientIdempotencyKey: captureUploadIdempotencyKey(clientIdempotencyKey),
      declaredMimeType,
      fileName,
      mode: "new",
      scope,
    };
    const existing = await repository.findUpload(
      accountId,
      uploadInput.clientIdempotencyKey,
    );
    if (existing?.status === "committed" && existing.result) {
      return await finalizeTarget();
    }

    const promotionBytes =
      bytes ??
      (readBytes
        ? await readBytes()
        : (() => {
            throw new Error(
              "Capture attachment bytes are unavailable for File Attachment promotion.",
            );
          })());
    const session = await stage(accountId, uploadInput, promotionBytes);
    const attachmentReceipt = await finalize(accountId, {
      ...uploadInput,
      uploadId: session.uploadId,
    });
    const committed = await repository.findUpload(
      accountId,
      uploadInput.clientIdempotencyKey,
    );
    if (!committed) {
      throw new FileAttachmentError(
        "FILE_ATTACHMENT_UPLOAD_UNAVAILABLE",
        "The Capture File Attachment promotion could not be recovered.",
      );
    }

    try {
      return await finalizeTarget();
    } catch (error) {
      await repository.rollbackCapturePromotion({
        accountId,
        attachmentId: attachmentReceipt.attachment.id,
        uploadId: session.uploadId,
        versionId: attachmentReceipt.version.id,
      });
      await objectStore.delete(
        permanentObjectKey(
          committed.workspaceId,
          attachmentReceipt.attachment.id,
          attachmentReceipt.version.id,
        ),
      );
      throw error;
    }
  }

  async function sweepExpiredUploads(at = now()) {
    const expired = await repository.findExpiredUploads(at);
    await Promise.all(
      expired.map(async (upload) => {
        if (upload.temporaryObjectKey) {
          await objectStore.delete(upload.temporaryObjectKey);
        }
        // A committed upload must keep its receipt so an idempotent finalize
        // retry still returns the prior result (ADR-0004); only its leftover
        // temporary object is cleared.
        if (upload.status === "committed") {
          await repository.clearTemporaryObject(upload.id);
        } else {
          await repository.markUploadSwept(upload.id, at);
        }
      }),
    );
    return expired.length;
  }

  return {
    access: {
      bindLocation,
      createMarking,
      finalize,
      getQuota,
      list,
      listMarkings,
      previewLocationBind,
      stage,
      undoMarking,
      ...fileAttachmentPreview,
    },
    processPreview: (job, options) =>
      fileAttachmentPreview.process(
        job.accountId,
        {
          attachmentId: job.attachmentId,
          versionId: job.versionId,
        },
        options,
      ),
    promoteCaptureAttachment,
    sweepExpiredUploads,
  } satisfies FileAttachmentService;
}
