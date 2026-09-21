import {
  type FileAttachmentAsset,
  type FileAttachmentAssetInput,
  type FileAttachmentExternalSurfaceSelection,
  type FileAttachmentPreview,
  type FileAttachmentPreviewInput,
  type FileAttachmentPreviewVariant,
  fileAttachmentAssetInputSchema,
  fileAttachmentPreviewInputSchema,
  fileAttachmentPreviewSchema,
} from "@cantiara/api/file-attachments";
import { log } from "evlog";
import Papa from "papaparse";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import sharp, { type Metadata } from "sharp";

const TIMEOUT_ERROR_PATTERN = /timeout/iu;

import {
  FileAttachmentError,
  type FileAttachmentObjectStore,
  type FileAttachmentRepository,
  type FileAttachmentStoredVersion,
} from "./file-attachments";

export const FILE_ATTACHMENT_PREVIEW_LIMITS = {
  maxAttempts: 3,
  maxCsvCellBytes: 64 * 1024,
  maxCsvRows: 100,
  maxCpuMs: 5000,
  maxDecodeBytes: 128 * 1024 * 1024,
  maxFrames: 120,
  maxPixels: 40_000_000,
  maxTextBytes: 256 * 1024,
} as const;

export type FileAttachmentPreviewFailureCode =
  | "decode-limit"
  | "dimension-limit"
  | "frame-limit"
  | "cpu-limit"
  | "processing-failed";

const FILE_ATTACHMENT_PREVIEW_FAILURE_CODES =
  new Set<FileAttachmentPreviewFailureCode>([
    "decode-limit",
    "dimension-limit",
    "frame-limit",
    "cpu-limit",
    "processing-failed",
  ]);

export class FileAttachmentPreviewError extends Error {
  readonly code: FileAttachmentPreviewFailureCode;
  readonly retryable: boolean;

  constructor(
    code: FileAttachmentPreviewFailureCode,
    message: string,
    retryable = false,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "FileAttachmentPreviewError";
    this.code = code;
    this.retryable = retryable;
  }
}

export interface FileAttachmentPreviewObjectStore
  extends Pick<FileAttachmentObjectStore, "delete" | "has" | "read"> {
  putImmutable: (input: {
    bytes: Uint8Array;
    contentType: string;
    key: string;
  }) => Promise<"created" | "existing">;
}

export interface FileAttachmentPreviewProcessor {
  createImageDerivatives: (
    bytes: Uint8Array,
    limits: FileAttachmentPreviewLimits,
    signal?: AbortSignal,
  ) => Promise<{
    medium: Uint8Array;
    small: Uint8Array;
  }>;
}

export interface FileAttachmentPreviewPdfReader {
  readPageCount: (
    bytes: Uint8Array,
    limits: FileAttachmentPreviewLimits,
    signal?: AbortSignal,
  ) => Promise<number>;
}

export type FileAttachmentPreviewLimits = {
  [Key in keyof typeof FILE_ATTACHMENT_PREVIEW_LIMITS]: number;
};

export interface FileAttachmentPreviewObservation {
  attachmentId: string;
  attempts: number;
  code: FileAttachmentPreviewFailureCode;
  contentHash: string;
  versionId: string;
}

export interface FileAttachmentPreviewJob {
  accountId: string;
  attachmentId: string;
  versionId: string;
}

export interface FileAttachmentPreviewProcessOptions {
  finalAttempt?: boolean;
}

export interface FileAttachmentPreviewConfiguration {
  limits?: Partial<FileAttachmentPreviewLimits>;
  observe?: (event: FileAttachmentPreviewObservation) => void | Promise<void>;
  pdfReader?: FileAttachmentPreviewPdfReader;
  processor?: FileAttachmentPreviewProcessor;
}

export type FileAttachmentPreviewSchedule = (
  job: FileAttachmentPreviewJob,
) => Promise<void>;

function encodedPathSegment(value: string) {
  return encodeURIComponent(value);
}

export function fileAttachmentAssetPath(
  attachmentId: string,
  versionId: string,
  variant: FileAttachmentPreviewVariant,
) {
  return `/api/file-attachments/${encodedPathSegment(attachmentId)}/versions/${encodedPathSegment(versionId)}/asset?variant=${variant}`;
}

export function fileAttachmentDerivativeObjectKey(
  contentHash: string,
  variant: Exclude<FileAttachmentPreviewVariant, "original">,
) {
  return `file-attachment-derivatives/${contentHash}/${variant}.webp`;
}

function fileAttachmentPreviewFailureObjectKey(contentHash: string) {
  return `file-attachment-preview-failures/${contentHash}.json`;
}

function isZip(version: FileAttachmentStoredVersion["version"]) {
  return version.extension === ".zip" || version.mimeType === "application/zip";
}

function playback() {
  return {
    autoplay: false as const,
    fullscreen: true as const,
    loop: "optional" as const,
    speeds: [0.75, 1, 1.25, 1.5, 2],
    userInitiated: true as const,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isFileAttachmentPreviewFailureCode(
  value: unknown,
): value is FileAttachmentPreviewFailureCode {
  return (
    typeof value === "string" &&
    FILE_ATTACHMENT_PREVIEW_FAILURE_CODES.has(
      value as FileAttachmentPreviewFailureCode,
    )
  );
}

function toPreviewError(error: unknown) {
  if (error instanceof FileAttachmentPreviewError) {
    return error;
  }
  if (error instanceof Error && TIMEOUT_ERROR_PATTERN.test(error.message)) {
    return new FileAttachmentPreviewError(
      "cpu-limit",
      "The preview exceeded its processing time limit.",
      false,
      { cause: error },
    );
  }
  return new FileAttachmentPreviewError(
    "processing-failed",
    "The preview could not be generated.",
    true,
    isRecord(error) && error instanceof Error ? { cause: error } : undefined,
  );
}

function withProcessingTimeLimit<T>(
  taskFactory: (signal: AbortSignal) => Promise<T>,
  limitMs: number,
) {
  const controller = new AbortController();
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_resolve, reject) => {
    timeoutId = setTimeout(() => {
      controller.abort();
      reject(
        new FileAttachmentPreviewError(
          "cpu-limit",
          "The preview exceeded its processing time limit.",
        ),
      );
    }, limitMs);
  });
  const task = Promise.resolve().then(() => taskFactory(controller.signal));
  return Promise.race([task, timeout]).finally(() => {
    if (timeoutId !== undefined) {
      clearTimeout(timeoutId);
    }
  });
}

function sampleBytesForDepth(depth: Metadata["depth"] | undefined) {
  switch (depth) {
    case "dpcomplex":
      return 16;
    case "complex":
      return 8;
    case "double":
      return 8;
    case "float":
    case "int":
    case "uint":
      return 4;
    case "short":
    case "ushort":
      return 2;
    case "char":
    case "uchar":
      return 1;
    default:
      return 8;
  }
}

export function createSharpPreviewProcessor(): FileAttachmentPreviewProcessor {
  return {
    // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Sharp processing keeps decode, metadata, derivative, and limit handling in one preview adapter seam.
    async createImageDerivatives(bytes, limits, signal) {
      if (bytes.byteLength > limits.maxDecodeBytes) {
        throw new FileAttachmentPreviewError(
          "decode-limit",
          "The image exceeds the preview decode limit.",
        );
      }
      if (signal?.aborted) {
        throw new FileAttachmentPreviewError(
          "cpu-limit",
          "The preview exceeded its processing time limit.",
        );
      }

      let metadata: Metadata;
      try {
        metadata = await sharp(bytes, {
          failOn: "error",
          limitInputPixels: limits.maxPixels,
        })
          .timeout({ seconds: Math.max(limits.maxCpuMs / 1000, 0.001) })
          .metadata();
      } catch (error) {
        if (
          error instanceof Error &&
          TIMEOUT_ERROR_PATTERN.test(error.message)
        ) {
          // biome-ignore lint/style/useErrorCause: FileAttachmentPreviewError forwards ErrorOptions to Error.
          throw new FileAttachmentPreviewError(
            "cpu-limit",
            "The preview exceeded its processing time limit.",
            false,
            { cause: error },
          );
        }
        // biome-ignore lint/style/useErrorCause: FileAttachmentPreviewError forwards ErrorOptions to Error.
        throw new FileAttachmentPreviewError(
          "processing-failed",
          "The image could not be decoded for preview.",
          true,
          { cause: error },
        );
      }

      const pixels = (metadata.width ?? 0) * (metadata.height ?? 0);
      if (pixels <= 0) {
        throw new FileAttachmentPreviewError(
          "processing-failed",
          "The image has no previewable dimensions.",
        );
      }
      if (pixels > limits.maxPixels) {
        throw new FileAttachmentPreviewError(
          "dimension-limit",
          "The image exceeds the preview dimension limit.",
        );
      }
      if ((metadata.pages ?? 1) > limits.maxFrames) {
        throw new FileAttachmentPreviewError(
          "frame-limit",
          "The image exceeds the preview frame limit.",
        );
      }
      const decodedBytes =
        pixels *
        Math.max(metadata.channels ?? 4, 1) *
        Math.max(metadata.pages ?? 1, 1) *
        Math.max(
          sampleBytesForDepth(metadata.depth),
          Math.ceil((metadata.bitsPerSample ?? 8) / 8),
        );
      if (decodedBytes > limits.maxDecodeBytes) {
        throw new FileAttachmentPreviewError(
          "decode-limit",
          "The image exceeds the preview decode limit.",
        );
      }
      if (signal?.aborted) {
        throw new FileAttachmentPreviewError(
          "cpu-limit",
          "The preview exceeded its processing time limit.",
        );
      }

      const render = (size: number) =>
        sharp(bytes, {
          failOn: "error",
          limitInputPixels: limits.maxPixels,
          pages: 1,
        })
          .rotate()
          .resize({
            fit: "inside",
            height: size,
            withoutEnlargement: true,
            width: size,
          })
          .webp({ quality: 82 })
          .timeout({ seconds: Math.max(limits.maxCpuMs / 1000, 0.001) })
          .toBuffer();

      const [small, medium] = await Promise.all([render(320), render(1280)]);
      return {
        medium: new Uint8Array(medium),
        small: new Uint8Array(small),
      };
    },
  };
}

function decodeText(bytes: Uint8Array) {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch (error) {
    // biome-ignore lint/style/useErrorCause: FileAttachmentPreviewError forwards ErrorOptions to Error.
    throw new FileAttachmentPreviewError(
      "processing-failed",
      "The text preview is not valid UTF-8.",
      false,
      { cause: error },
    );
  }
}

function textPreview(bytes: Uint8Array, limits: FileAttachmentPreviewLimits) {
  const content = decodeText(bytes);
  const encoded = new TextEncoder().encode(content);
  if (encoded.byteLength <= limits.maxTextBytes) {
    return { content, truncated: false };
  }
  return {
    content: new TextDecoder().decode(encoded.slice(0, limits.maxTextBytes)),
    truncated: true,
  };
}

function cappedCell(value: string, maxBytes: number) {
  const encoded = new TextEncoder().encode(value);
  if (encoded.byteLength <= maxBytes) {
    return { value, truncated: false };
  }
  return {
    truncated: true,
    value: new TextDecoder().decode(encoded.slice(0, maxBytes)),
  };
}

function csvPreview(bytes: Uint8Array, limits: FileAttachmentPreviewLimits) {
  const content = decodeText(bytes);
  const result = Papa.parse<string[]>(content, {
    dynamicTyping: false,
    preview: limits.maxCsvRows + 2,
    skipEmptyLines: true,
  });
  const rows = result.data;
  const [header = [], ...dataRows] = rows;
  let truncated = dataRows.length > limits.maxCsvRows;
  const mappedRows = dataRows.slice(0, limits.maxCsvRows).map((row) =>
    row.map((cell) => {
      const capped = cappedCell(String(cell), limits.maxCsvCellBytes);
      truncated ||= capped.truncated;
      return capped.value;
    }),
  );
  const headers = header.map((cell) => {
    const capped = cappedCell(String(cell), limits.maxCsvCellBytes);
    truncated ||= capped.truncated;
    return capped.value;
  });
  return { headers, rows: mappedRows, truncated };
}

function createPdfPreviewReader(): FileAttachmentPreviewPdfReader {
  return {
    async readPageCount(bytes, _limits, signal) {
      const loadingTask = getDocument({
        data: bytes,
        disableAutoFetch: true,
        disableStream: true,
        useWorkerFetch: false,
      });
      let document: Awaited<typeof loadingTask.promise> | undefined;
      const abortLoading = () => {
        loadingTask.destroy().catch(() => undefined);
      };
      signal?.addEventListener("abort", abortLoading, { once: true });
      try {
        document = await loadingTask.promise;
        if (signal?.aborted) {
          throw new FileAttachmentPreviewError(
            "cpu-limit",
            "The preview exceeded its processing time limit.",
          );
        }
        return document.numPages;
      } catch (error) {
        if (error instanceof FileAttachmentPreviewError) {
          throw error;
        }
        // biome-ignore lint/style/useErrorCause: FileAttachmentPreviewError forwards ErrorOptions to Error.
        throw new FileAttachmentPreviewError(
          "processing-failed",
          "The PDF could not be decoded for preview.",
          false,
          { cause: error },
        );
      } finally {
        signal?.removeEventListener("abort", abortLoading);
        document?.cleanup();
        await loadingTask.destroy().catch(() => undefined);
      }
    },
  };
}

function sourcePreviewPath(source: FileAttachmentStoredVersion) {
  return fileAttachmentAssetPath(
    source.attachment.id,
    source.version.id,
    "original",
  );
}

function basePreview(source: FileAttachmentStoredVersion) {
  const downloadPath = sourcePreviewPath(source);
  return {
    attachmentId: source.attachment.id,
    downloadPath,
    versionId: source.version.id,
  };
}

function galleryPaths(source: FileAttachmentStoredVersion) {
  return {
    mediumPath: fileAttachmentAssetPath(
      source.attachment.id,
      source.version.id,
      "medium",
    ),
    smallPath: fileAttachmentAssetPath(
      source.attachment.id,
      source.version.id,
      "small",
    ),
  };
}

function processingPreview(source: FileAttachmentStoredVersion) {
  return fileAttachmentPreviewSchema.parse({
    ...basePreview(source),
    gallery: galleryPaths(source),
    kind: "image",
    status: "processing",
  });
}

function unavailablePreview(
  source: FileAttachmentStoredVersion,
  failure: {
    attempts: number;
    error: FileAttachmentPreviewError;
  },
) {
  return fileAttachmentPreviewSchema.parse({
    ...basePreview(source),
    failure: {
      attempts: failure.attempts,
      code: failure.error.code,
      message: failure.error.message,
      retryable: failure.error.retryable,
    },
    fallback: "Unavailable",
    kind: source.version.preview,
    status: "unavailable",
  });
}

export function createFileAttachmentPreview({
  limits: configuredLimits,
  observe,
  objectStore,
  pdfReader = createPdfPreviewReader(),
  processor = createSharpPreviewProcessor(),
  repository,
  schedulePreview,
}: FileAttachmentPreviewConfiguration & {
  objectStore: FileAttachmentPreviewObjectStore;
  repository: Pick<
    FileAttachmentRepository,
    "findVersion" | "hasOtherVersionWithContentHash"
  >;
  schedulePreview?: FileAttachmentPreviewSchedule;
}) {
  const limits: FileAttachmentPreviewLimits = {
    ...FILE_ATTACHMENT_PREVIEW_LIMITS,
    ...configuredLimits,
  };
  const observePreview =
    observe ??
    ((event: FileAttachmentPreviewObservation) => {
      log.warn({ action: "file-attachment.preview-failure", ...event });
    });

  async function sourceFor(
    accountId: string,
    input: FileAttachmentPreviewInput,
  ) {
    const source = await repository.findVersion(
      accountId,
      input.attachmentId,
      input.versionId,
    );
    if (!source) {
      throw new FileAttachmentError(
        "FILE_ATTACHMENT_TARGET_NOT_FOUND",
        "File Attachment is unavailable.",
      );
    }
    return source;
  }

  // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Preview derivative orchestration keeps cache lookup, queue scheduling, bounded processing, and failure persistence at one File Attachments seam.
  async function imageDerivatives(
    accountId: string,
    source: FileAttachmentStoredVersion,
    options: {
      checkOnly?: boolean;
      throwRetryable?: boolean;
      oneAttempt?: boolean;
      schedule?: boolean;
      finalAttempt?: boolean;
    } = {},
  ) {
    const keys = {
      medium: fileAttachmentDerivativeObjectKey(
        source.version.contentHash,
        "medium",
      ),
      small: fileAttachmentDerivativeObjectKey(
        source.version.contentHash,
        "small",
      ),
    } as const;
    const missing = (
      await Promise.all(
        (Object.keys(keys) as (keyof typeof keys)[]).map(async (variant) =>
          (await objectStore.has(keys[variant])) ? null : variant,
        ),
      )
    ).filter((variant): variant is keyof typeof keys => variant !== null);

    if (missing.length === 0) {
      return { failure: null, keys, queued: false };
    }

    const failureMarkerKey = fileAttachmentPreviewFailureObjectKey(
      source.version.contentHash,
    );
    if (await objectStore.has(failureMarkerKey)) {
      try {
        const marker = JSON.parse(
          new TextDecoder().decode(await objectStore.read(failureMarkerKey)),
        ) as {
          attempts?: number;
          code?: FileAttachmentPreviewFailureCode;
          message?: string;
          retryable?: boolean;
        };
        if (
          typeof marker.attempts === "number" &&
          Number.isSafeInteger(marker.attempts) &&
          marker.attempts > 0 &&
          isFileAttachmentPreviewFailureCode(marker.code) &&
          typeof marker.message === "string" &&
          typeof marker.retryable === "boolean"
        ) {
          return {
            failure: {
              attempts: marker.attempts,
              error: new FileAttachmentPreviewError(
                marker.code,
                marker.message,
                marker.retryable,
              ),
            },
            keys,
            queued: false,
          };
        }
      } catch {
        // A malformed marker must not hide the still-downloadable original.
      }
    }

    if (options.schedule && schedulePreview) {
      await schedulePreview({
        accountId,
        attachmentId: source.attachment.id,
        versionId: source.version.id,
      });
      return { failure: null, keys, queued: true };
    }

    if (options.checkOnly) {
      return {
        failure: {
          attempts: 1,
          error: new FileAttachmentPreviewError(
            "processing-failed",
            "The preview is still processing.",
            true,
          ),
        },
        keys,
        queued: false,
      };
    }

    let sourceBytes: Uint8Array;
    try {
      sourceBytes = await objectStore.read(source.objectKey);
      if (sourceBytes.byteLength > limits.maxDecodeBytes) {
        throw new FileAttachmentPreviewError(
          "decode-limit",
          "The image exceeds the preview decode limit.",
        );
      }
    } catch (error) {
      const failure = toPreviewError(error);
      const terminal = options.finalAttempt || !failure.retryable;
      const storedFailure = terminal
        ? new FileAttachmentPreviewError(failure.code, failure.message, false)
        : failure;
      if (terminal) {
        await objectStore
          .putImmutable({
            bytes: new TextEncoder().encode(
              JSON.stringify({
                attempts: 1,
                code: storedFailure.code,
                message: storedFailure.message,
                retryable: storedFailure.retryable,
              }),
            ),
            contentType: "application/json",
            key: failureMarkerKey,
          })
          .catch(() => undefined);
      }
      await Promise.resolve(
        observePreview({
          attachmentId: source.attachment.id,
          attempts: 1,
          code: storedFailure.code,
          contentHash: source.version.contentHash,
          versionId: source.version.id,
        }),
      ).catch(() => undefined);
      if (options.throwRetryable && failure.retryable) {
        throw failure;
      }
      return {
        failure: { attempts: 1, error: storedFailure },
        keys,
        queued: false,
      };
    }

    let lastError = new FileAttachmentPreviewError(
      "processing-failed",
      "The preview could not be generated.",
      true,
    );
    let attempts = 0;
    const maxAttempts = options.oneAttempt ? 1 : limits.maxAttempts;
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      attempts = attempt;
      try {
        // biome-ignore lint/performance/noAwaitInLoops: Preview retries must remain sequential and bounded so one version cannot consume parallel processor attempts.
        const generated = await withProcessingTimeLimit(
          (signal) =>
            processor.createImageDerivatives(sourceBytes, limits, signal),
          limits.maxCpuMs,
        );
        const generatedByVariant = {
          medium: generated.medium,
          small: generated.small,
        } as const;
        await Promise.all(
          missing.map((variant) =>
            objectStore.putImmutable({
              bytes: generatedByVariant[variant],
              contentType: "image/webp",
              key: keys[variant],
            }),
          ),
        );
        await objectStore.delete(failureMarkerKey).catch(() => undefined);
        return { failure: null, keys, queued: false };
      } catch (error) {
        lastError = toPreviewError(error);
        if (!lastError.retryable) {
          break;
        }
      }
    }

    const terminal =
      options.finalAttempt || attempts >= maxAttempts || !lastError.retryable;
    const storedFailure = terminal
      ? new FileAttachmentPreviewError(lastError.code, lastError.message, false)
      : lastError;
    if (terminal) {
      await objectStore
        .putImmutable({
          bytes: new TextEncoder().encode(
            JSON.stringify({
              attempts,
              code: storedFailure.code,
              message: storedFailure.message,
              retryable: storedFailure.retryable,
            }),
          ),
          contentType: "application/json",
          key: failureMarkerKey,
        })
        .catch(() => undefined);
    }
    await Promise.resolve(
      observePreview({
        attachmentId: source.attachment.id,
        attempts,
        code: storedFailure.code,
        contentHash: source.version.contentHash,
        versionId: source.version.id,
      }),
    ).catch(() => undefined);
    if (options.throwRetryable && lastError.retryable) {
      throw lastError;
    }
    return {
      failure: {
        attempts,
        error: storedFailure,
      },
      keys,
      queued: false,
    };
  }

  // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Preview dispatch keeps the supported File Attachment type matrix and fail-closed fallback together.
  async function preview(
    accountId: string,
    rawInput: FileAttachmentPreviewInput,
  ): Promise<FileAttachmentPreview> {
    const input = fileAttachmentPreviewInputSchema.parse(rawInput);
    const source = await sourceFor(accountId, input);
    const base = basePreview(source);

    if (isZip(source.version)) {
      return fileAttachmentPreviewSchema.parse({
        ...base,
        kind: "download",
        status: "download-only",
      });
    }

    if (source.version.preview === "image") {
      const derivatives = await imageDerivatives(accountId, source, {
        schedule: Boolean(schedulePreview),
      });
      if (derivatives.queued) {
        return processingPreview(source);
      }
      if (derivatives.failure) {
        return unavailablePreview(source, derivatives.failure);
      }
      return fileAttachmentPreviewSchema.parse({
        ...base,
        gallery: galleryPaths(source),
        kind: "image",
        previewPath: sourcePreviewPath(source),
        status: "available",
      });
    }

    if (
      source.version.preview === "audio" ||
      source.version.preview === "video"
    ) {
      return fileAttachmentPreviewSchema.parse({
        ...base,
        kind: source.version.preview,
        playback: playback(),
        previewPath: sourcePreviewPath(source),
        status: "available",
      });
    }

    try {
      const bytes = await objectStore.read(source.objectKey);
      if (source.version.preview === "csv") {
        return fileAttachmentPreviewSchema.parse({
          ...base,
          csv: csvPreview(bytes, limits),
          kind: "csv",
          previewPath: sourcePreviewPath(source),
          status: "available",
        });
      }
      if (source.version.preview === "text") {
        return fileAttachmentPreviewSchema.parse({
          ...base,
          kind: "text",
          previewPath: sourcePreviewPath(source),
          status: "available",
          text: textPreview(bytes, limits),
        });
      }
      if (source.version.preview === "pdf") {
        const pageCount = await withProcessingTimeLimit(
          (signal) => pdfReader.readPageCount(bytes, limits, signal),
          limits.maxCpuMs,
        );
        if (pageCount > limits.maxFrames) {
          throw new FileAttachmentPreviewError(
            "frame-limit",
            "The PDF exceeds the preview page limit.",
          );
        }
        return fileAttachmentPreviewSchema.parse({
          ...base,
          kind: "pdf",
          pageCount,
          previewPath: sourcePreviewPath(source),
          status: "available",
        });
      }
    } catch (error) {
      const previewError = toPreviewError(error);
      await Promise.resolve(
        observePreview({
          attachmentId: source.attachment.id,
          attempts: 1,
          code: previewError.code,
          contentHash: source.version.contentHash,
          versionId: source.version.id,
        }),
      ).catch(() => undefined);
      return unavailablePreview(source, { attempts: 1, error: previewError });
    }

    return unavailablePreview(source, {
      attempts: 1,
      error: new FileAttachmentPreviewError(
        "processing-failed",
        "The preview type is unavailable.",
      ),
    });
  }

  async function readAsset(
    accountId: string,
    rawInput: FileAttachmentAssetInput,
  ): Promise<FileAttachmentAsset> {
    const input = fileAttachmentAssetInputSchema.parse(rawInput);
    const source = await sourceFor(accountId, input);
    let bytes: Uint8Array;
    let contentType = source.version.mimeType;
    if (input.variant === "original") {
      bytes = await objectStore.read(source.objectKey);
    } else {
      if (source.version.preview !== "image") {
        throw new FileAttachmentError(
          "FILE_ATTACHMENT_PREVIEW_UNAVAILABLE",
          "This File Attachment has no gallery derivative.",
        );
      }
      const generated = await imageDerivatives(accountId, source, {
        checkOnly: Boolean(schedulePreview),
      });
      if (generated.failure) {
        throw new FileAttachmentError(
          "FILE_ATTACHMENT_PREVIEW_UNAVAILABLE",
          "The preview is Unavailable. The original remains downloadable.",
        );
      }
      const key = generated.keys[input.variant];
      bytes = await objectStore.read(key);
      contentType = "image/webp";
    }
    return {
      bytes,
      contentType,
      disposition: isZip(source.version) ? "attachment" : "inline",
      fileName: source.version.fileName,
      versionId: source.version.id,
    };
  }

  async function cleanupVersionDerivatives(
    accountId: string,
    rawInput: FileAttachmentPreviewInput,
  ) {
    const input = fileAttachmentPreviewInputSchema.parse(rawInput);
    const source = await sourceFor(accountId, input);
    if (source.version.preview !== "image") {
      return;
    }
    if (
      await repository.hasOtherVersionWithContentHash(
        source.version.contentHash,
        source.version.id,
      )
    ) {
      return;
    }
    await Promise.all(
      (["small", "medium"] as const).map((variant) =>
        objectStore.delete(
          fileAttachmentDerivativeObjectKey(
            source.version.contentHash,
            variant,
          ),
        ),
      ),
    );
    await objectStore.delete(
      fileAttachmentPreviewFailureObjectKey(source.version.contentHash),
    );
  }

  async function schedule(
    accountId: string,
    rawInput: FileAttachmentPreviewInput,
  ) {
    if (!schedulePreview) {
      return;
    }
    const input = fileAttachmentPreviewInputSchema.parse(rawInput);
    const source = await sourceFor(accountId, input);
    if (source.version.preview !== "image") {
      return;
    }
    await schedulePreview({
      accountId,
      attachmentId: source.attachment.id,
      versionId: source.version.id,
    });
  }

  async function process(
    accountId: string,
    rawInput: FileAttachmentPreviewInput,
    options: FileAttachmentPreviewProcessOptions = {},
  ) {
    const input = fileAttachmentPreviewInputSchema.parse(rawInput);
    const source = await sourceFor(accountId, input);
    if (source.version.preview !== "image") {
      return;
    }
    await imageDerivatives(accountId, source, {
      finalAttempt: options.finalAttempt,
      oneAttempt: true,
      throwRetryable: true,
    });
  }

  async function canSelectIntoExternalSurface(
    accountId: string,
    rawInput: FileAttachmentPreviewInput,
  ): Promise<FileAttachmentExternalSurfaceSelection> {
    const input = fileAttachmentPreviewInputSchema.parse(rawInput);
    const source = await sourceFor(accountId, input);
    return isZip(source.version)
      ? { allowed: false, reason: "unscanned-zip" }
      : { allowed: true, reason: null };
  }

  return {
    canSelectIntoExternalSurface,
    cleanupVersionDerivatives,
    process,
    preview,
    readAsset,
    schedule,
  };
}
