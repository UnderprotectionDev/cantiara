import type {
  FileAttachment,
  FileAttachmentVersion,
} from "@cantiara/api/file-attachments";
import sharp from "sharp";
import { describe, expect, test } from "vitest";
import { createSharpPreviewProcessor } from "./file-attachment-preview";
import {
  createFileAttachments,
  type FileAttachmentObjectStore,
  type FileAttachmentRepository,
} from "./file-attachments";

type FileAttachmentPreviewConfiguration = NonNullable<
  Parameters<typeof createFileAttachments>[0]["preview"]
>;
type FileAttachmentPreviewProcessor = NonNullable<
  FileAttachmentPreviewConfiguration["processor"]
>;
type FileAttachmentPreviewSchedule = NonNullable<
  Parameters<typeof createFileAttachments>[0]["schedulePreview"]
>;

const baseVersion: FileAttachmentVersion = {
  byteSize: 4,
  contentHash: "a".repeat(64),
  createdAt: "2026-09-21T10:00:00.000Z",
  detectedMimeType: "application/zip",
  extension: ".zip",
  fileName: "archive.zip",
  id: "version-1",
  mimeType: "application/zip",
  number: 1,
  preview: "download",
};

const defaultProcessor: FileAttachmentPreviewProcessor = {
  createImageDerivatives: () =>
    Promise.resolve({
      medium: new Uint8Array([2]),
      small: new Uint8Array([1]),
    }),
};

function createPdf(pageCount: number) {
  const pageIds = Array.from(
    { length: pageCount },
    (_, index) => `${index + 3} 0 R`,
  ).join(" ");
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    `<< /Type /Pages /Kids [${pageIds}] /Count ${pageCount} >>`,
    ...Array.from(
      { length: pageCount },
      () => "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 10 10] >>",
    ),
  ];
  let body = "%PDF-1.4\n";
  const offsets = [0];
  for (const [index, object] of objects.entries()) {
    offsets.push(new TextEncoder().encode(body).byteLength);
    body += `${index + 1} 0 obj\n${object}\nendobj\n`;
  }
  const xrefOffset = new TextEncoder().encode(body).byteLength;
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets.slice(1)) {
    body += `${offset.toString().padStart(10, "0")} 00000 n \n`;
  }
  body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return new TextEncoder().encode(body);
}

function createPreview(
  overrides: Partial<FileAttachmentVersion> = {},
  options: {
    bytes?: Uint8Array;
    limits?: FileAttachmentPreviewConfiguration["limits"];
    observe?: FileAttachmentPreviewConfiguration["observe"];
    pdfReader?: FileAttachmentPreviewConfiguration["pdfReader"];
    processor?: FileAttachmentPreviewProcessor | null;
    schedulePreview?: FileAttachmentPreviewSchedule;
    hasOtherVersionWithContentHash?: FileAttachmentRepository["hasOtherVersionWithContentHash"];
  } = {},
) {
  const version = { ...baseVersion, ...overrides };
  const attachment: FileAttachment = {
    createdAt: version.createdAt,
    currentVersion: version,
    id: "attachment-1",
    lifecycleStatus: "Active",
    name: version.fileName,
    revision: 0,
    scope: { kind: "project", projectId: "project-1" },
    updatedAt: version.createdAt,
  };
  const sourceKey = "file-attachments/workspace-1/attachment-1/version-1";
  const objects = new Map<string, Uint8Array>([
    [sourceKey, options.bytes ?? new Uint8Array([1, 2, 3, 4])],
  ]);
  let processorCalls = 0;
  const objectStore: FileAttachmentObjectStore = {
    delete: (key) => {
      objects.delete(key);
      return Promise.resolve();
    },
    has: (key) => Promise.resolve(objects.has(key)),
    putImmutable: ({ bytes, key }) => {
      if (objects.has(key)) {
        return Promise.resolve("existing" as const);
      }
      objects.set(key, new Uint8Array(bytes));
      return Promise.resolve("created" as const);
    },
    read: (key) => {
      const bytes = objects.get(key);
      if (!bytes) {
        return Promise.reject(new Error("object missing"));
      }
      return Promise.resolve(new Uint8Array(bytes));
    },
    promote: () => Promise.resolve(),
    putTemporary: () => Promise.resolve({ key: sourceKey }),
  };
  let processor: FileAttachmentPreviewProcessor | undefined;
  if (options.processor !== null) {
    const sourceProcessor = options.processor ?? defaultProcessor;
    processor = {
      createImageDerivatives: (
        bytes: Uint8Array,
        limits: Parameters<
          NonNullable<FileAttachmentPreviewProcessor["createImageDerivatives"]>
        >[1],
        signal?: AbortSignal,
      ) => {
        processorCalls += 1;
        return sourceProcessor.createImageDerivatives(bytes, limits, signal);
      },
    };
  }
  const repository: FileAttachmentRepository = {
    clearTemporaryObject: () => Promise.resolve(),
    commitUpload: () =>
      Promise.reject(new Error("Not part of this preview test.")),
    findExpiredUploads: () => Promise.resolve([]),
    findUpload: () => Promise.resolve(null),
    findVersion: () =>
      Promise.resolve({
        attachment,
        objectKey: sourceKey,
        version,
      }),
    findMarking: () => Promise.resolve(null),
    findMarkingByIdempotencyKey: () => Promise.resolve(null),
    hasOtherVersionWithContentHash:
      options.hasOtherVersionWithContentHash ?? (() => Promise.resolve(false)),
    findWorkspaceId: () => Promise.resolve("workspace-1"),
    getQuota: () => Promise.reject(new Error("Not part of this preview test.")),
    insertUpload: () => Promise.resolve(),
    insertMarking: () => Promise.resolve(),
    list: () => Promise.resolve([]),
    listMarkings: () => Promise.resolve([]),
    markUploadRejected: () => Promise.resolve(),
    markUploadSwept: () => Promise.resolve(),
    rollbackCapturePromotion: () => Promise.resolve(),
    undoMarking: () => Promise.resolve(),
  };
  const previewConfiguration: FileAttachmentPreviewConfiguration = {
    limits: options.limits,
    observe: options.observe,
    ...(options.pdfReader ? { pdfReader: options.pdfReader } : {}),
    ...(processor ? { processor } : {}),
  };
  const service = createFileAttachments({
    objectStore,
    preview: previewConfiguration,
    repository,
    schedulePreview: options.schedulePreview,
  });
  return {
    preview: service.access,
    processorCalls: () => processorCalls,
    service,
  };
}

describe("File Attachments — Dosya sınırları preview seam", () => {
  test("keeps ZIP download-only and blocks unscanned External Surface selection", async () => {
    const { preview } = createPreview();

    await expect(
      preview.preview("account-1", {
        attachmentId: "attachment-1",
        versionId: "version-1",
      }),
    ).resolves.toMatchObject({
      attachmentId: "attachment-1",
      downloadPath:
        "/api/file-attachments/attachment-1/versions/version-1/asset?variant=original",
      kind: "download",
      status: "download-only",
      versionId: "version-1",
    });

    await expect(
      preview.canSelectIntoExternalSurface("account-1", {
        attachmentId: "attachment-1",
        versionId: "version-1",
      }),
    ).resolves.toEqual({ allowed: false, reason: "unscanned-zip" });
  });

  test("exposes user-started playback controls for audio and video", async () => {
    const { preview: audioPreview } = createPreview({
      detectedMimeType: "audio/mpeg",
      extension: ".mp3",
      fileName: "voice.mp3",
      mimeType: "audio/mpeg",
      preview: "audio",
    });
    const { preview: videoPreview } = createPreview({
      detectedMimeType: "video/mp4",
      extension: ".mp4",
      fileName: "demo.mp4",
      mimeType: "video/mp4",
      preview: "video",
    });

    await expect(
      audioPreview.preview("account-1", {
        attachmentId: "attachment-1",
        versionId: "version-1",
      }),
    ).resolves.toMatchObject({
      kind: "audio",
      playback: {
        autoplay: false,
        fullscreen: true,
        loop: "optional",
        userInitiated: true,
      },
      status: "available",
    });
    await expect(
      videoPreview.preview("account-1", {
        attachmentId: "attachment-1",
        versionId: "version-1",
      }),
    ).resolves.toMatchObject({ kind: "video", status: "available" });
  });

  test("returns bounded CSV rows, safe plain text, and paged PDF metadata", async () => {
    const csv = createPreview(
      {
        detectedMimeType: "text/csv",
        extension: ".csv",
        fileName: "rows.csv",
        mimeType: "text/csv",
        preview: "csv",
      },
      { bytes: new TextEncoder().encode("name,value\nalpha,1\nbeta,2") },
    );
    const text = createPreview(
      {
        detectedMimeType: "text/plain",
        extension: ".txt",
        fileName: "notes.txt",
        mimeType: "text/plain",
        preview: "text",
      },
      { bytes: new TextEncoder().encode("<script>not markup</script>") },
    );
    const pdf = createPreview(
      {
        detectedMimeType: "application/pdf",
        extension: ".pdf",
        fileName: "brief.pdf",
        mimeType: "application/pdf",
        preview: "pdf",
      },
      {
        bytes: createPdf(2),
      },
    );

    await expect(
      csv.preview.preview("account-1", {
        attachmentId: "attachment-1",
        versionId: "version-1",
      }),
    ).resolves.toMatchObject({
      csv: {
        headers: ["name", "value"],
        rows: [
          ["alpha", "1"],
          ["beta", "2"],
        ],
        truncated: false,
      },
      kind: "csv",
      status: "available",
    });
    await expect(
      text.preview.preview("account-1", {
        attachmentId: "attachment-1",
        versionId: "version-1",
      }),
    ).resolves.toMatchObject({
      kind: "text",
      status: "available",
      text: { content: "<script>not markup</script>", truncated: false },
    });
    await expect(
      pdf.preview.preview("account-1", {
        attachmentId: "attachment-1",
        versionId: "version-1",
      }),
    ).resolves.toMatchObject({
      kind: "pdf",
      pageCount: 2,
      status: "available",
    });
  });

  test("creates immutable small and medium Gallery derivatives idempotently", async () => {
    const original = new Uint8Array([9, 8, 7, 6]);
    const memory = createPreview(
      {
        contentHash: "b".repeat(64),
        detectedMimeType: "image/jpeg",
        extension: ".jpg",
        fileName: "screen.jpg",
        mimeType: "image/jpeg",
        preview: "image",
      },
      { bytes: original },
    );

    const first = await memory.preview.preview("account-1", {
      attachmentId: "attachment-1",
      versionId: "version-1",
    });
    const second = await memory.preview.preview("account-1", {
      attachmentId: "attachment-1",
      versionId: "version-1",
    });

    expect(first).toMatchObject({
      gallery: {
        mediumPath:
          "/api/file-attachments/attachment-1/versions/version-1/asset?variant=medium",
        smallPath:
          "/api/file-attachments/attachment-1/versions/version-1/asset?variant=small",
      },
      kind: "image",
      status: "available",
    });
    expect(second).toEqual(first);
    expect(memory.processorCalls()).toBe(1);
    await expect(
      memory.preview.readAsset("account-1", {
        attachmentId: "attachment-1",
        variant: "original",
        versionId: "version-1",
      }),
    ).resolves.toMatchObject({ bytes: original });
    await expect(
      memory.preview.readAsset("account-1", {
        attachmentId: "attachment-1",
        variant: "small",
        versionId: "version-1",
      }),
    ).resolves.toMatchObject({ bytes: new Uint8Array([1]) });
  });

  test("queues Gallery work and keeps the original path available while processing", async () => {
    const scheduled: unknown[] = [];
    const memory = createPreview(
      {
        contentHash: "q".repeat(64),
        detectedMimeType: "image/jpeg",
        extension: ".jpg",
        fileName: "queued.jpg",
        mimeType: "image/jpeg",
        preview: "image",
      },
      {
        schedulePreview: (job) => {
          scheduled.push(job);
          return Promise.resolve();
        },
      },
    );

    await expect(
      memory.preview.preview("account-1", {
        attachmentId: "attachment-1",
        versionId: "version-1",
      }),
    ).resolves.toMatchObject({
      downloadPath:
        "/api/file-attachments/attachment-1/versions/version-1/asset?variant=original",
      kind: "image",
      status: "processing",
    });
    expect(scheduled).toEqual([
      {
        accountId: "account-1",
        attachmentId: "attachment-1",
        versionId: "version-1",
      },
    ]);
    expect(memory.processorCalls()).toBe(0);
  });

  test("persists a terminal worker failure as Unavailable", async () => {
    const memory = createPreview(
      {
        contentHash: "r".repeat(64),
        detectedMimeType: "image/jpeg",
        extension: ".jpg",
        fileName: "failed.jpg",
        mimeType: "image/jpeg",
        preview: "image",
      },
      {
        processor: {
          createImageDerivatives: () =>
            Promise.reject(new Error("decoder busy")),
        },
        schedulePreview: () => Promise.resolve(),
      },
    );

    await expect(
      memory.service.processPreview(
        {
          accountId: "account-1",
          attachmentId: "attachment-1",
          versionId: "version-1",
        },
        { finalAttempt: true },
      ),
    ).rejects.toMatchObject({ message: "The preview could not be generated." });
    await expect(
      memory.preview.preview("account-1", {
        attachmentId: "attachment-1",
        versionId: "version-1",
      }),
    ).resolves.toMatchObject({
      failure: { attempts: 1, code: "processing-failed", retryable: false },
      fallback: "Unavailable",
      status: "unavailable",
    });
  });

  test("keeps retryable worker failures available for the next queue attempt", async () => {
    let attempts = 0;
    const memory = createPreview(
      {
        contentHash: "w".repeat(64),
        detectedMimeType: "image/jpeg",
        extension: ".jpg",
        fileName: "retry.jpg",
        mimeType: "image/jpeg",
        preview: "image",
      },
      {
        processor: {
          createImageDerivatives: () => {
            attempts += 1;
            return Promise.reject(new Error("decoder busy"));
          },
        },
        schedulePreview: () => Promise.resolve(),
      },
    );

    await expect(
      memory.service.processPreview({
        accountId: "account-1",
        attachmentId: "attachment-1",
        versionId: "version-1",
      }),
    ).rejects.toMatchObject({ retryable: true });
    await expect(
      memory.service.processPreview(
        {
          accountId: "account-1",
          attachmentId: "attachment-1",
          versionId: "version-1",
        },
        { finalAttempt: true },
      ),
    ).rejects.toMatchObject({ retryable: true });
    expect(attempts).toBe(2);
  });

  test("serves immutable derivatives through the File Attachments seam", async () => {
    const source = new Uint8Array([8, 7, 6, 5]);
    const memory = createPreview(
      {
        contentHash: "f".repeat(64),
        detectedMimeType: "image/jpeg",
        extension: ".jpg",
        fileName: "photo.jpg",
        mimeType: "image/jpeg",
        preview: "image",
      },
      {
        bytes: source,
        processor: {
          createImageDerivatives: () =>
            Promise.resolve({
              medium: new Uint8Array([22]),
              small: new Uint8Array([11]),
            }),
        },
      },
    );

    await memory.preview.preview("account-1", {
      attachmentId: "attachment-1",
      versionId: "version-1",
    });
    await expect(
      memory.preview.readAsset("account-1", {
        attachmentId: "attachment-1",
        variant: "small",
        versionId: "version-1",
      }),
    ).resolves.toMatchObject({ bytes: new Uint8Array([11]) });
    await expect(
      memory.preview.readAsset("account-1", {
        attachmentId: "attachment-1",
        variant: "original",
        versionId: "version-1",
      }),
    ).resolves.toMatchObject({ bytes: source });
  });

  test("shows Unavailable after a decode limit without damaging the original", async () => {
    const observed: unknown[] = [];
    const original = new Uint8Array([9, 8, 7, 6]);
    const memory = createPreview(
      {
        contentHash: "c".repeat(64),
        detectedMimeType: "image/jpeg",
        extension: ".jpg",
        fileName: "large.jpg",
        mimeType: "image/jpeg",
        preview: "image",
      },
      {
        bytes: original,
        limits: { maxDecodeBytes: 2 },
        observe: (event) => {
          observed.push(event);
        },
      },
    );

    await expect(
      memory.preview.preview("account-1", {
        attachmentId: "attachment-1",
        versionId: "version-1",
      }),
    ).resolves.toMatchObject({
      downloadPath:
        "/api/file-attachments/attachment-1/versions/version-1/asset?variant=original",
      failure: { attempts: 1, code: "decode-limit", retryable: false },
      fallback: "Unavailable",
      status: "unavailable",
    });
    expect(memory.processorCalls()).toBe(0);
    await expect(
      memory.preview.readAsset("account-1", {
        attachmentId: "attachment-1",
        variant: "original",
        versionId: "version-1",
      }),
    ).resolves.toMatchObject({ bytes: original });
    expect(observed).toHaveLength(1);
  });

  test("rejects an image when decoded memory exceeds the preview limit", async () => {
    const source = await sharp({
      create: {
        background: { b: 0, g: 0, r: 0 },
        channels: 4,
        height: 256,
        width: 256,
      },
    })
      .png()
      .toBuffer();
    expect(source.byteLength).toBeLessThan(100_000);

    const memory = createPreview(
      {
        contentHash: "m".repeat(64),
        detectedMimeType: "image/png",
        extension: ".png",
        fileName: "compressed.png",
        mimeType: "image/png",
        preview: "image",
      },
      {
        bytes: new Uint8Array(source),
        limits: { maxDecodeBytes: 100_000 },
        processor: createSharpPreviewProcessor(),
      },
    );

    await expect(
      memory.preview.preview("account-1", {
        attachmentId: "attachment-1",
        versionId: "version-1",
      }),
    ).resolves.toMatchObject({
      failure: { attempts: 1, code: "decode-limit", retryable: false },
      fallback: "Unavailable",
      status: "unavailable",
    });
    await expect(
      memory.preview.readAsset("account-1", {
        attachmentId: "attachment-1",
        variant: "original",
        versionId: "version-1",
      }),
    ).resolves.toMatchObject({ bytes: new Uint8Array(source) });
  });

  test("aborts image processing when the CPU budget expires", async () => {
    let aborted = false;
    let signalReceived = false;
    const memory = createPreview(
      {
        contentHash: "t".repeat(64),
        detectedMimeType: "image/jpeg",
        extension: ".jpg",
        fileName: "slow.jpg",
        mimeType: "image/jpeg",
        preview: "image",
      },
      {
        limits: { maxCpuMs: 5 },
        processor: {
          createImageDerivatives: (_bytes, _limits, signal) =>
            new Promise((_resolve, reject) => {
              signalReceived = Boolean(signal);
              signal?.addEventListener(
                "abort",
                () => {
                  aborted = true;
                  reject(new Error("processing aborted"));
                },
                { once: true },
              );
            }),
        },
      },
    );

    await expect(
      memory.preview.preview("account-1", {
        attachmentId: "attachment-1",
        versionId: "version-1",
      }),
    ).resolves.toMatchObject({
      failure: { attempts: 1, code: "cpu-limit", retryable: false },
      fallback: "Unavailable",
      status: "unavailable",
    });
    expect(signalReceived).toBe(true);
    expect(aborted).toBe(true);
  });

  test("aborts PDF parsing when the CPU budget expires", async () => {
    let aborted = false;
    const memory = createPreview(
      {
        detectedMimeType: "application/pdf",
        extension: ".pdf",
        fileName: "slow.pdf",
        mimeType: "application/pdf",
        preview: "pdf",
      },
      {
        limits: { maxCpuMs: 5 },
        pdfReader: {
          readPageCount: (_bytes, _limits, signal) =>
            new Promise((_resolve, reject) => {
              signal?.addEventListener(
                "abort",
                () => {
                  aborted = true;
                  reject(new Error("PDF parsing aborted"));
                },
                { once: true },
              );
            }),
        },
      },
    );

    await expect(
      memory.preview.preview("account-1", {
        attachmentId: "attachment-1",
        versionId: "version-1",
      }),
    ).resolves.toMatchObject({
      failure: { attempts: 1, code: "cpu-limit", retryable: false },
      fallback: "Unavailable",
      status: "unavailable",
    });
    expect(aborted).toBe(true);
  });

  test("retries processing failures a bounded number of times and keeps the original downloadable", async () => {
    const observed: unknown[] = [];
    let attempts = 0;
    const memory = createPreview(
      {
        contentHash: "d".repeat(64),
        detectedMimeType: "image/jpeg",
        extension: ".jpg",
        fileName: "retry.jpg",
        mimeType: "image/jpeg",
        preview: "image",
      },
      {
        observe: (event) => {
          observed.push(event);
        },
        processor: {
          createImageDerivatives: () => {
            attempts += 1;
            return Promise.reject(new Error("decoder busy"));
          },
        },
      },
    );

    await expect(
      memory.preview.preview("account-1", {
        attachmentId: "attachment-1",
        versionId: "version-1",
      }),
    ).resolves.toMatchObject({
      failure: { attempts: 3, code: "processing-failed", retryable: false },
      fallback: "Unavailable",
      status: "unavailable",
    });
    await expect(
      memory.preview.readAsset("account-1", {
        attachmentId: "attachment-1",
        variant: "original",
        versionId: "version-1",
      }),
    ).resolves.toMatchObject({ bytes: new Uint8Array([1, 2, 3, 4]) });
    expect(attempts).toBe(3);
    expect(observed).toHaveLength(1);
  });

  test("removes image derivatives with their source version", async () => {
    const memory = createPreview(
      {
        contentHash: "e".repeat(64),
        detectedMimeType: "image/jpeg",
        extension: ".jpg",
        fileName: "cleanup.jpg",
        mimeType: "image/jpeg",
        preview: "image",
      },
      { schedulePreview: () => Promise.resolve() },
    );
    await memory.service.processPreview({
      accountId: "account-1",
      attachmentId: "attachment-1",
      versionId: "version-1",
    });

    await memory.preview.cleanupVersionDerivatives("account-1", {
      attachmentId: "attachment-1",
      versionId: "version-1",
    });

    await expect(
      memory.preview.readAsset("account-1", {
        attachmentId: "attachment-1",
        variant: "small",
        versionId: "version-1",
      }),
    ).rejects.toMatchObject({ code: "FILE_ATTACHMENT_PREVIEW_UNAVAILABLE" });
    await expect(
      memory.preview.readAsset("account-1", {
        attachmentId: "attachment-1",
        variant: "original",
        versionId: "version-1",
      }),
    ).resolves.toMatchObject({ bytes: new Uint8Array([1, 2, 3, 4]) });
  });

  test("keeps shared fingerprint derivatives for another version", async () => {
    const memory = createPreview(
      {
        contentHash: "s".repeat(64),
        detectedMimeType: "image/jpeg",
        extension: ".jpg",
        fileName: "shared.jpg",
        mimeType: "image/jpeg",
        preview: "image",
      },
      {
        hasOtherVersionWithContentHash: () => Promise.resolve(true),
        schedulePreview: () => Promise.resolve(),
      },
    );
    await memory.service.processPreview({
      accountId: "account-1",
      attachmentId: "attachment-1",
      versionId: "version-1",
    });

    await memory.preview.cleanupVersionDerivatives("account-1", {
      attachmentId: "attachment-1",
      versionId: "version-1",
    });

    await expect(
      memory.preview.readAsset("account-1", {
        attachmentId: "attachment-1",
        variant: "small",
        versionId: "version-1",
      }),
    ).resolves.toMatchObject({ bytes: new Uint8Array([1]) });
  });
});
