import {
  FILE_ATTACHMENT_QUOTA,
  type FileAttachment,
  type FileAttachmentFinalizeInput,
  type FileAttachmentQuota,
  type FileAttachmentVersion,
  fileAttachmentFinalizeReceiptSchema,
} from "@cantiara/api/file-attachments";
import { describe, expect, test, vi } from "vitest";

import {
  createFileAttachments,
  type FileAttachmentCommitInput,
  FileAttachmentError,
  type FileAttachmentLocationWorkAccess,
  type FileAttachmentObjectStore,
  type FileAttachmentRepository,
  type FileAttachmentStoredMarking,
  type FileAttachmentStoredUpload,
  FileAttachmentValidationError,
  type FileAttachmentWorkOriginPosition,
  validateFileAttachmentUpload,
} from "./file-attachments";
import { createFileAttachmentObjectStore } from "./file-attachments-object-store";

const jpegBytes = new Uint8Array([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
]);
const pdfBytes = new TextEncoder().encode("%PDF-1.7\n1 0 obj\n");
const CONTENT_HASH_PATTERN = /^[0-9a-f]{64}$/u;

const accountId = "account-1";
const workspaceId = "workspace-1";
const projectScope = { kind: "project", projectId: "project-1" } as const;
type NewFinalizeInput = Extract<FileAttachmentFinalizeInput, { mode: "new" }>;

function createIds() {
  let nextId = 1;
  return () => {
    const id = nextId;
    nextId += 1;
    return `${id}`;
  };
}

function createMemoryFileAttachments(
  options: {
    byteLimit?: number;
    commitByteLimit?: number;
    locationWork?: FileAttachmentLocationWorkAccess;
    readPageCount?: () => Promise<number>;
  } = {},
) {
  const objects = new Map<string, Uint8Array>();
  const uploads = new Map<string, FileAttachmentStoredUpload>();
  const attachments = new Map<
    string,
    { attachment: FileAttachment; versions: FileAttachmentVersion[] }
  >();
  const versionObjectKeys = new Map<string, string>();
  const markings = new Map<string, FileAttachmentStoredMarking>();
  const byteLimit = options.byteLimit ?? FILE_ATTACHMENT_QUOTA.maxBytes;
  const commitByteLimit = options.commitByteLimit ?? byteLimit;

  const quota = (): FileAttachmentQuota => {
    const versions = [...attachments.values()].flatMap(
      ({ versions: fileVersions }) => fileVersions,
    );
    const bytesUsed = versions.reduce(
      (sum, version) => sum + version.byteSize,
      0,
    );
    const versionsUsed = versions.length;
    return {
      byteLimit,
      bytesRemaining: Math.max(0, byteLimit - bytesUsed),
      bytesUsed,
      isOverLimit: bytesUsed > byteLimit,
      isWarning: bytesUsed >= byteLimit * FILE_ATTACHMENT_QUOTA.warningRatio,
      versionLimit: FILE_ATTACHMENT_QUOTA.maxVersions,
      versionsRemaining: Math.max(
        0,
        FILE_ATTACHMENT_QUOTA.maxVersions - versionsUsed,
      ),
      versionsUsed,
    };
  };

  const repository: FileAttachmentRepository = {
    clearTemporaryObject(uploadId) {
      const upload = [...uploads.values()].find(
        (candidate) => candidate.id === uploadId,
      );
      if (upload) {
        upload.temporaryObjectKey = null;
      }
      return Promise.resolve();
    },

    rollbackCapturePromotion({ attachmentId, uploadId }) {
      attachments.delete(attachmentId);
      uploads.delete(uploadId);
      return Promise.resolve();
    },

    commitUpload(input: FileAttachmentCommitInput) {
      const upload = [...uploads.values()].find(
        (candidate) => candidate.id === input.uploadId,
      );
      if (!upload || upload.accountId !== input.accountId) {
        throw new FileAttachmentError(
          "FILE_ATTACHMENT_UPLOAD_NOT_FOUND",
          "The upload is unavailable.",
        );
      }
      if (upload.status === "committed" && upload.result) {
        throw new FileAttachmentError(
          "FILE_ATTACHMENT_UPLOAD_REJECTED",
          "The upload was already finalized.",
        );
      }

      const currentQuota = quota();
      if (
        currentQuota.bytesUsed + input.validated.byteSize > commitByteLimit ||
        currentQuota.versionsUsed + 1 > FILE_ATTACHMENT_QUOTA.maxVersions
      ) {
        throw new FileAttachmentError(
          "FILE_ATTACHMENT_QUOTA_EXCEEDED",
          "Workspace File Attachment quota has been exceeded.",
        );
      }

      const existing = attachments.get(input.attachmentId);
      let versionNumber: number;
      if (input.mode === "new") {
        if (!input.scope) {
          throw new FileAttachmentError(
            "FILE_ATTACHMENT_TARGET_NOT_FOUND",
            "A new File Attachment requires a Project or Personal Wiki.",
          );
        }
        versionNumber = 1;
      } else {
        if (!existing) {
          throw new FileAttachmentError(
            "FILE_ATTACHMENT_TARGET_NOT_FOUND",
            "File Attachment is unavailable.",
          );
        }
        if (
          input.baseRevision !== null &&
          input.baseRevision !== existing.attachment.revision
        ) {
          throw new FileAttachmentError(
            "FILE_ATTACHMENT_REVISION_CONFLICT",
            "File Attachment changed. Reload and try again.",
          );
        }
        versionNumber = existing.versions.length + 1;
      }

      const version: FileAttachmentVersion = {
        byteSize: input.validated.byteSize,
        contentHash: input.validated.contentHash,
        createdAt: input.now.toISOString(),
        detectedMimeType: input.validated.detectedMimeType,
        extension: input.validated.extension,
        fileName: input.validated.fileName,
        id: input.versionId,
        mimeType: input.validated.mimeType,
        number: versionNumber,
        preview: input.validated.preview,
      };
      let attachment: FileAttachment;
      if (input.mode === "new") {
        if (!input.scope) {
          throw new FileAttachmentError(
            "FILE_ATTACHMENT_TARGET_NOT_FOUND",
            "A new File Attachment requires a Project or Personal Wiki.",
          );
        }
        attachment = {
          createdAt: input.now.toISOString(),
          currentVersion: version,
          id: input.attachmentId,
          lifecycleStatus: "Active",
          name: input.fileName,
          revision: 0,
          scope: input.scope,
          updatedAt: input.now.toISOString(),
        };
      } else {
        if (!existing) {
          throw new FileAttachmentError(
            "FILE_ATTACHMENT_TARGET_NOT_FOUND",
            "File Attachment is unavailable.",
          );
        }
        attachment = {
          ...existing.attachment,
          currentVersion: version,
          name: input.fileName,
          revision: existing.attachment.revision + 1,
          updatedAt: input.now.toISOString(),
        };
      }
      const record = existing ?? { attachment, versions: [] };
      record.attachment = attachment;
      record.versions.push(version);
      versionObjectKeys.set(input.versionId, input.permanentObjectKey);
      attachments.set(input.attachmentId, record);

      const receipt = fileAttachmentFinalizeReceiptSchema.parse({
        attachment,
        idempotent: false,
        status: "committed",
        version,
      });
      upload.result = receipt;
      upload.status = "committed";
      return Promise.resolve({ attachment, version });
    },

    findExpiredUploads(at) {
      return Promise.resolve(
        [...uploads.values()].filter(
          (upload) =>
            upload.expiresAt <= at &&
            (upload.status === "staged" ||
              upload.status === "rejected" ||
              upload.status === "committed"),
        ),
      );
    },

    findUpload(candidateAccountId, clientIdempotencyKey) {
      return Promise.resolve(
        [...uploads.values()].find(
          (upload) =>
            upload.accountId === candidateAccountId &&
            upload.clientIdempotencyKey === clientIdempotencyKey,
        ) ?? null,
      );
    },

    findVersion(candidateAccountId, attachmentId, versionId) {
      if (candidateAccountId !== accountId) {
        return Promise.resolve(null);
      }
      const record = attachments.get(attachmentId);
      const version = record?.versions.find(
        (candidate) => candidate.id === versionId,
      );
      const objectKey = versionObjectKeys.get(versionId);
      return Promise.resolve(
        record && version && objectKey
          ? { attachment: record.attachment, objectKey, version }
          : null,
      );
    },

    findMarking(candidateAccountId, attachmentId, versionId, markingId) {
      const stored = markings.get(markingId);
      return Promise.resolve(
        stored?.accountId === candidateAccountId &&
          stored.marking.attachmentId === attachmentId &&
          stored.marking.versionId === versionId
          ? stored.marking
          : null,
      );
    },

    findMarkingByIdempotencyKey(candidateAccountId, clientIdempotencyKey) {
      return Promise.resolve(
        [...markings.values()].find(
          ({ accountId: storedAccountId, clientIdempotencyKey: storedKey }) =>
            storedAccountId === candidateAccountId &&
            storedKey === clientIdempotencyKey,
        ) ?? null,
      );
    },

    insertMarking(marking) {
      markings.set(marking.marking.id, marking);
      return Promise.resolve();
    },

    listMarkings(candidateAccountId, attachmentId, versionId) {
      return Promise.resolve(
        [...markings.values()]
          .filter(
            ({ accountId: storedAccountId, marking }) =>
              storedAccountId === candidateAccountId &&
              marking.attachmentId === attachmentId &&
              marking.versionId === versionId,
          )
          .map(({ marking }) => marking),
      );
    },

    hasOtherVersionWithContentHash(contentHash, versionId) {
      return Promise.resolve(
        [...attachments.values()].some(({ versions }) =>
          versions.some(
            (candidate) =>
              candidate.id !== versionId &&
              candidate.contentHash === contentHash,
          ),
        ),
      );
    },

    findWorkspaceId(candidateAccountId) {
      return Promise.resolve(
        candidateAccountId === accountId ? workspaceId : null,
      );
    },

    getQuota(candidateAccountId) {
      if (candidateAccountId !== accountId) {
        throw new FileAttachmentError(
          "FILE_ATTACHMENT_ACCOUNT_NOT_FOUND",
          "Workspace is unavailable.",
        );
      }
      return Promise.resolve(quota());
    },

    insertUpload(upload) {
      const key = `${upload.accountId}:${upload.clientIdempotencyKey}`;
      if (
        [...uploads.values()].some(
          (candidate) =>
            `${candidate.accountId}:${candidate.clientIdempotencyKey}` === key,
        )
      ) {
        throw new Error("duplicate idempotency key");
      }
      uploads.set(upload.id, upload);
      return Promise.resolve();
    },

    list(candidateAccountId, scope) {
      if (candidateAccountId !== accountId) {
        return Promise.resolve([]);
      }
      return Promise.resolve(
        [...attachments.values()]
          .map(({ attachment }) => attachment)
          .filter((attachment) => {
            if (!scope) {
              return true;
            }
            if (scope.kind === "project") {
              return (
                attachment.scope.kind === "project" &&
                attachment.scope.projectId === scope.projectId
              );
            }
            return (
              attachment.scope.kind === "personalWiki" &&
              attachment.scope.personalWikiId === scope.personalWikiId
            );
          }),
      );
    },

    markUploadRejected(uploadId, error, _at) {
      const upload = uploads.get(uploadId);
      if (upload) {
        upload.error = error;
        upload.status = "rejected";
      }
      return Promise.resolve();
    },

    markUploadSwept(uploadId, _at) {
      uploads.delete(uploadId);
      return Promise.resolve();
    },

    undoMarking(candidateAccountId, _attachmentId, _versionId, markingId) {
      const stored = markings.get(markingId);
      if (stored?.accountId === candidateAccountId) {
        markings.delete(markingId);
      }
      return Promise.resolve();
    },
  };

  const objectStore: FileAttachmentObjectStore = {
    delete(key) {
      objects.delete(key);
      return Promise.resolve();
    },
    has(key) {
      return Promise.resolve(objects.has(key));
    },
    putImmutable({ bytes, key }) {
      if (objects.has(key)) {
        return Promise.resolve("existing");
      }
      objects.set(key, new Uint8Array(bytes));
      return Promise.resolve("created");
    },
    promote({ permanentKey, temporaryKey }) {
      const bytes = objects.get(temporaryKey);
      if (!bytes) {
        throw new Error("temporary object missing");
      }
      objects.set(permanentKey, new Uint8Array(bytes));
      return Promise.resolve();
    },
    putTemporary({ bytes, uploadId }) {
      const key = `temporary/${uploadId}`;
      objects.set(key, new Uint8Array(bytes));
      return Promise.resolve({ key });
    },
    read(key) {
      const bytes = objects.get(key);
      if (!bytes) {
        throw new Error("object missing");
      }
      return Promise.resolve(new Uint8Array(bytes));
    },
  };

  return {
    attachments,
    objects,
    objectStore,
    repository,
    service: createFileAttachments({
      idGenerator: createIds(),
      now: () => new Date("2026-09-21T10:00:00.000Z"),
      objectStore,
      preview: {
        pdfReader: {
          readPageCount: options.readPageCount ?? (async () => 1),
        },
      },
      repository,
      locationWork: options.locationWork,
    }),
    uploads,
    markings,
  };
}

function newInput(overrides: Partial<NewFinalizeInput> = {}): NewFinalizeInput {
  return {
    clientIdempotencyKey: "key-1",
    declaredMimeType: "image/jpeg",
    fileName: "screen.jpg",
    mode: "new" as const,
    scope: projectScope,
    uploadId: "upload-1",
    ...overrides,
  };
}

function stageInput(input: FileAttachmentFinalizeInput) {
  const { uploadId: _uploadId, ...value } = input;
  return value;
}

describe("File Attachments — Dosya sınırları", () => {
  test("accepts a detected JPEG when MIME and extension agree", async () => {
    await expect(
      validateFileAttachmentUpload({
        bytes: jpegBytes,
        declaredMimeType: "image/jpeg",
        fileName: "screen.jpg",
      }),
    ).resolves.toMatchObject({
      contentHash: expect.stringMatching(CONTENT_HASH_PATTERN),
      type: "image",
    });
  });

  test("rejects a renamed binary instead of repairing its MIME", async () => {
    await expect(
      validateFileAttachmentUpload({
        bytes: jpegBytes,
        declaredMimeType: "image/png",
        fileName: "screen.png",
      }),
    ).rejects.toMatchObject({
      code: "FILE_ATTACHMENT_MIME_MISMATCH",
    });
  });

  test("rejects SVG, HTML, scripts, and unknown pairs", async () => {
    const rejected = [
      {
        bytes: new TextEncoder().encode("<svg></svg>"),
        fileName: "icon.svg",
        mime: "image/svg+xml",
      },
      {
        bytes: new TextEncoder().encode("<html></html>"),
        fileName: "page.html",
        mime: "text/html",
      },
      {
        bytes: new TextEncoder().encode("echo unsafe"),
        fileName: "run.sh",
        mime: "text/plain",
      },
      {
        bytes: new Uint8Array([0, 1, 2, 3]),
        fileName: "payload.bin",
        mime: "application/octet-stream",
      },
    ];

    await Promise.all(
      rejected.map((input) =>
        expect(
          validateFileAttachmentUpload({
            bytes: input.bytes,
            declaredMimeType: input.mime,
            fileName: input.fileName,
          }),
        ).rejects.toBeInstanceOf(FileAttachmentValidationError),
      ),
    );

    await expect(
      validateFileAttachmentUpload({
        bytes: new Uint8Array([0, 1, 2, 3]),
        declaredMimeType: "image/jpeg",
        fileName: "renamed.jpg",
      }),
    ).rejects.toMatchObject({ code: "FILE_ATTACHMENT_CONTENT_MISMATCH" });
  });

  test("uses original bytes for the type-specific limit and content hash", async () => {
    const text = new TextEncoder().encode("hello\n");
    await expect(
      validateFileAttachmentUpload({
        bytes: text,
        declaredMimeType: "text/plain",
        fileName: "notes.txt",
      }),
    ).resolves.toMatchObject({
      byteSize: text.byteLength,
      contentHash:
        "5891b5b522d5df086d0ff0b110fbd9d21bb4fc7163af34d08286a2e846f6be03",
      type: "text",
    });
  });

  test("rejects forbidden content before writing a temporary object", async () => {
    const memory = createMemoryFileAttachments();
    const input = newInput({
      declaredMimeType: "image/svg+xml",
      fileName: "icon.svg",
    });

    await expect(
      memory.service.access.stage(
        accountId,
        stageInput(input),
        new TextEncoder().encode("<svg></svg>"),
      ),
    ).rejects.toMatchObject({ code: "FILE_ATTACHMENT_UNSUPPORTED_TYPE" });
    expect(memory.objects.size).toBe(0);
  });
});

describe("File Attachments — Dosya sınırları finalize seam", () => {
  test("uses development storage through the public File Attachments seam", async () => {
    const memory = createMemoryFileAttachments();
    const objectStore = createFileAttachmentObjectStore({
      nodeEnv: "development",
    });
    if (!objectStore) {
      throw new Error("Development object store was not created.");
    }
    const service = createFileAttachments({
      idGenerator: createIds(),
      now: () => new Date("2026-09-21T10:00:00.000Z"),
      objectStore,
      preview: {
        pdfReader: {
          readPageCount: async () => 1,
        },
      },
      repository: memory.repository,
    });
    const input = newInput({ clientIdempotencyKey: "development-store" });
    const session = await service.access.stage(
      accountId,
      stageInput(input),
      jpegBytes,
    );

    const receipt = await service.access.finalize(accountId, {
      ...input,
      uploadId: session.uploadId,
    });

    await expect(
      service.access.list(accountId, projectScope),
    ).resolves.toHaveLength(1);
    await expect(
      service.access.readAsset(accountId, {
        attachmentId: receipt.attachment.id,
        variant: "original",
        versionId: receipt.version.id,
      }),
    ).resolves.toMatchObject({
      bytes: jpegBytes,
      contentType: "image/jpeg",
    });
  });

  test("commits a new File Attachment atomically and hides object keys", async () => {
    const memory = createMemoryFileAttachments();
    const input = newInput();
    const session = await memory.service.access.stage(
      accountId,
      stageInput(input),
      jpegBytes,
    );

    const receipt = await memory.service.access.finalize(accountId, {
      ...input,
      uploadId: session.uploadId,
    });

    expect(receipt).toMatchObject({
      attachment: {
        id: "2",
        currentVersion: { id: "3", number: 1 },
      },
      idempotent: false,
      status: "committed",
    });
    expect(receipt).not.toHaveProperty("objectKey");
    expect(await memory.service.access.list(accountId)).toHaveLength(1);
    expect([...memory.objects.keys()]).toHaveLength(1);
    expect(
      [...memory.objects.keys()].every((key) => !key.startsWith("temporary/")),
    ).toBe(true);

    await expect(
      memory.service.access.finalize(accountId, {
        ...input,
        uploadId: session.uploadId,
      }),
    ).resolves.toMatchObject({ idempotent: true });
  });

  test("promotes a Capture staging payload through the File Attachment finalize barrier", async () => {
    const memory = createMemoryFileAttachments();
    let finalizeCalls = 0;

    await expect(
      memory.service.promoteCaptureAttachment({
        accountId,
        bytes: jpegBytes,
        clientIdempotencyKey: "capture-attachment-1",
        declaredMimeType: "image/jpeg",
        fileName: "capture.jpg",
        finalize: () => {
          finalizeCalls += 1;
          return Promise.resolve({ recordId: "record-1" });
        },
        scope: projectScope,
      }),
    ).resolves.toEqual({ recordId: "record-1" });

    expect(finalizeCalls).toBe(1);
    await expect(
      memory.service.access.list(accountId, projectScope),
    ).resolves.toMatchObject([
      {
        currentVersion: { fileName: "capture.jpg" },
        scope: projectScope,
      },
    ]);
    expect(
      [...memory.objects.keys()].some((key) =>
        key.startsWith("file-attachments/"),
      ),
    ).toBe(true);
  });

  test("does not create a visible File Attachment when Capture target finalization fails", async () => {
    const memory = createMemoryFileAttachments();

    await expect(
      memory.service.promoteCaptureAttachment({
        accountId,
        bytes: jpegBytes,
        clientIdempotencyKey: "capture-attachment-failure",
        declaredMimeType: "image/jpeg",
        fileName: "capture.jpg",
        finalize: () => Promise.reject(new Error("target finalization failed")),
        scope: projectScope,
      }),
    ).rejects.toThrow("target finalization failed");

    expect(await memory.service.access.list(accountId)).toHaveLength(0);
    expect(
      [...memory.objects.keys()].some((key) =>
        key.startsWith("file-attachments/"),
      ),
    ).toBe(false);
    expect([...memory.objects.keys()]).toHaveLength(0);
    expect(memory.uploads.size).toBe(0);
  });

  test("promotes a Capture staging payload into a Personal Wiki", async () => {
    const memory = createMemoryFileAttachments();

    await memory.service.promoteCaptureAttachment({
      accountId,
      bytes: jpegBytes,
      clientIdempotencyKey: "capture-personal-wiki",
      declaredMimeType: "image/jpeg",
      fileName: "capture.jpg",
      finalize: async () => ({ recordId: "wiki-record-1" }),
      scope: { kind: "personalWiki", personalWikiId: accountId },
    });

    await expect(
      memory.service.access.list(accountId, {
        kind: "personalWiki",
        personalWikiId: accountId,
      }),
    ).resolves.toMatchObject([
      {
        scope: { kind: "personalWiki", personalWikiId: accountId },
      },
    ]);
  });

  test("applies forbidden type rules before promoting a Capture staging payload", async () => {
    const memory = createMemoryFileAttachments();
    let finalizeCalls = 0;

    await expect(
      memory.service.promoteCaptureAttachment({
        accountId,
        bytes: new TextEncoder().encode("<svg></svg>"),
        clientIdempotencyKey: "capture-forbidden",
        declaredMimeType: "image/svg+xml",
        fileName: "capture.svg",
        finalize: () => {
          finalizeCalls += 1;
          return Promise.resolve({ recordId: "record-1" });
        },
        scope: projectScope,
      }),
    ).rejects.toMatchObject({ code: "FILE_ATTACHMENT_UNSUPPORTED_TYPE" });

    expect(finalizeCalls).toBe(0);
    expect(await memory.service.access.list(accountId)).toHaveLength(0);
    expect(memory.objects.size).toBe(0);
  });

  test("applies the atomic quota barrier to Capture promotion", async () => {
    const memory = createMemoryFileAttachments({
      byteLimit: jpegBytes.byteLength,
      commitByteLimit: jpegBytes.byteLength - 1,
    });
    let finalizeCalls = 0;

    await expect(
      memory.service.promoteCaptureAttachment({
        accountId,
        bytes: jpegBytes,
        clientIdempotencyKey: "capture-quota",
        declaredMimeType: "image/jpeg",
        fileName: "capture.jpg",
        finalize: () => {
          finalizeCalls += 1;
          return Promise.resolve({ recordId: "record-1" });
        },
        scope: projectScope,
      }),
    ).rejects.toMatchObject({ code: "FILE_ATTACHMENT_QUOTA_EXCEEDED" });

    expect(finalizeCalls).toBe(0);
    expect(await memory.service.access.list(accountId)).toHaveLength(0);
    expect(
      [...memory.objects.keys()].filter((key) =>
        key.startsWith("file-attachments/"),
      ),
    ).toHaveLength(0);
    expect(
      [...memory.objects.keys()].filter((key) => key.startsWith("temporary/")),
    ).toHaveLength(1);
  });

  test("replays a committed Capture promotion without rereading staging", async () => {
    const memory = createMemoryFileAttachments();
    let readCalls = 0;
    let finalizeCalls = 0;

    const input = {
      accountId,
      clientIdempotencyKey: "capture-retry-after-commit",
      declaredMimeType: "image/jpeg",
      fileName: "capture.jpg",
      finalize: () => {
        finalizeCalls += 1;
        return Promise.resolve({ recordId: "record-1" });
      },
      readBytes: () => {
        readCalls += 1;
        return Promise.resolve(jpegBytes);
      },
      scope: projectScope,
    };

    await expect(
      memory.service.promoteCaptureAttachment(input),
    ).resolves.toEqual({ recordId: "record-1" });
    await expect(
      memory.service.promoteCaptureAttachment({
        ...input,
        readBytes: () => {
          readCalls += 1;
          return Promise.reject(
            new Error("Capture staging was already deleted."),
          );
        },
      }),
    ).resolves.toEqual({ recordId: "record-1" });

    expect(readCalls).toBe(1);
    expect(finalizeCalls).toBe(2);
  });

  test("rejects content changed after staging without creating a visible attachment", async () => {
    const memory = createMemoryFileAttachments();
    const input = newInput();
    const session = await memory.service.access.stage(
      accountId,
      stageInput(input),
      jpegBytes,
    );
    const temporaryKey = [...memory.objects.keys()].find((key) =>
      key.startsWith("temporary/"),
    );
    expect(temporaryKey).toBeDefined();
    memory.objects.set(temporaryKey as string, new Uint8Array([0, 1, 2, 3]));

    await expect(
      memory.service.access.finalize(accountId, {
        ...input,
        uploadId: session.uploadId,
      }),
    ).rejects.toMatchObject({ code: "FILE_ATTACHMENT_CONTENT_MISMATCH" });
    expect(await memory.service.access.list(accountId)).toHaveLength(0);

    expect(
      await memory.service.sweepExpiredUploads(
        new Date("2026-09-23T10:00:00.000Z"),
      ),
    ).toBe(1);
    expect([...memory.objects.keys()]).toHaveLength(0);
  });

  test("cleans the promoted object when the atomic quota barrier rejects it", async () => {
    const memory = createMemoryFileAttachments({
      byteLimit: jpegBytes.byteLength,
      commitByteLimit: jpegBytes.byteLength - 1,
    });
    const input = newInput();
    const session = await memory.service.access.stage(
      accountId,
      stageInput(input),
      jpegBytes,
    );

    await expect(
      memory.service.access.finalize(accountId, {
        ...input,
        uploadId: session.uploadId,
      }),
    ).rejects.toMatchObject({ code: "FILE_ATTACHMENT_QUOTA_EXCEEDED" });
    expect(await memory.service.access.list(accountId)).toHaveLength(0);
    expect(
      [...memory.objects.keys()].filter((key) =>
        key.startsWith("file-attachments/"),
      ),
    ).toHaveLength(0);
    expect(
      [...memory.objects.keys()].filter((key) => key.startsWith("temporary/")),
    ).toHaveLength(1);
  });

  test("appends a new version without moving the attachment chain", async () => {
    const memory = createMemoryFileAttachments();
    const firstInput = newInput();
    const firstSession = await memory.service.access.stage(
      accountId,
      stageInput(firstInput),
      jpegBytes,
    );
    const firstReceipt = await memory.service.access.finalize(accountId, {
      ...firstInput,
      uploadId: firstSession.uploadId,
    });

    const secondInput = {
      attachmentId: firstReceipt.attachment.id,
      baseRevision: firstReceipt.attachment.revision,
      clientIdempotencyKey: "key-2",
      declaredMimeType: "image/jpeg",
      fileName: "screen-v2.jpg",
      mode: "new-version" as const,
    };
    const secondSession = await memory.service.access.stage(
      accountId,
      secondInput,
      jpegBytes,
    );
    const secondReceipt = await memory.service.access.finalize(accountId, {
      ...secondInput,
      uploadId: secondSession.uploadId,
    });

    expect(secondReceipt).toMatchObject({
      attachment: {
        id: firstReceipt.attachment.id,
        revision: 1,
        currentVersion: { number: 2, fileName: "screen-v2.jpg" },
      },
      version: { number: 2 },
    });
    expect(
      memory.attachments.get(firstReceipt.attachment.id)?.versions[0],
    ).toEqual(firstReceipt.version);
    await expect(
      memory.service.access.finalize(accountId, {
        ...secondInput,
        uploadId: secondSession.uploadId,
      }),
    ).resolves.toMatchObject({ idempotent: true });
  });

  test("rejects a changed payload under an existing idempotency key", async () => {
    const memory = createMemoryFileAttachments();
    const input = newInput();
    await memory.service.access.stage(accountId, stageInput(input), jpegBytes);

    await expect(
      memory.service.access.stage(
        accountId,
        stageInput(input),
        new Uint8Array([...jpegBytes, 0x01]),
      ),
    ).rejects.toMatchObject({ code: "FILE_ATTACHMENT_IDEMPOTENCY_CONFLICT" });
  });

  test("reports an idempotency conflict when a concurrent stage wins with different content", async () => {
    const memory = createMemoryFileAttachments();
    const input = newInput();
    const racingRepository: FileAttachmentRepository = {
      ...memory.repository,
      async insertUpload(upload) {
        await memory.repository.insertUpload({
          ...upload,
          id: `${upload.id}-concurrent`,
          payloadFingerprint: "0".repeat(64),
        });
        throw new Error("duplicate idempotency key");
      },
    };
    const service = createFileAttachments({
      idGenerator: createIds(),
      now: () => new Date("2026-09-21T10:00:00.000Z"),
      objectStore: memory.objectStore,
      repository: racingRepository,
    });

    await expect(
      service.access.stage(accountId, stageInput(input), jpegBytes),
    ).rejects.toMatchObject({ code: "FILE_ATTACHMENT_IDEMPOTENCY_CONFLICT" });
    expect([...memory.objects.keys()]).toHaveLength(0);
  });

  test("sweeping a committed upload keeps its idempotent finalize receipt", async () => {
    const memory = createMemoryFileAttachments();
    const input = newInput();
    const session = await memory.service.access.stage(
      accountId,
      stageInput(input),
      jpegBytes,
    );
    await memory.service.access.finalize(accountId, {
      ...input,
      uploadId: session.uploadId,
    });

    // Simulate a failed temporary-object cleanup after the commit barrier.
    const upload = memory.uploads.get(session.uploadId);
    expect(upload?.status).toBe("committed");
    if (!upload) {
      throw new Error("The committed upload is missing.");
    }
    upload.temporaryObjectKey = "temporary/orphan";

    expect(
      await memory.service.sweepExpiredUploads(
        new Date("2026-09-22T10:00:00.000Z"),
      ),
    ).toBe(1);
    expect(upload.status).toBe("committed");
    expect(upload.temporaryObjectKey).toBeNull();
    await expect(
      memory.service.access.finalize(accountId, {
        ...input,
        uploadId: session.uploadId,
      }),
    ).resolves.toMatchObject({ idempotent: true });
  });
});

describe("File Attachments — Görsel işaretleme ve Köken konumu seam", () => {
  test("stores marking as undoable metadata pinned to the exact version", async () => {
    const memory = createMemoryFileAttachments();
    const input = newInput();
    const session = await memory.service.access.stage(
      accountId,
      stageInput(input),
      jpegBytes,
    );
    const receipt = await memory.service.access.finalize(accountId, {
      ...input,
      uploadId: session.uploadId,
    });
    const beforeSource = await memory.service.access.readAsset(accountId, {
      attachmentId: receipt.attachment.id,
      variant: "original",
      versionId: receipt.version.id,
    });

    const marking = await memory.service.access.createMarking(accountId, {
      attachmentId: receipt.attachment.id,
      clientIdempotencyKey: "marking-1",
      geometry: {
        kind: "path",
        points: [
          { x: 0.1, y: 0.2 },
          { x: 0.3, y: 0.4 },
        ],
      },
      tool: "highlighter",
      versionId: receipt.version.id,
    });

    await expect(
      memory.service.access.listMarkings(accountId, {
        attachmentId: receipt.attachment.id,
        versionId: receipt.version.id,
      }),
    ).resolves.toEqual([marking]);
    const afterSource = await memory.service.access.readAsset(accountId, {
      attachmentId: receipt.attachment.id,
      variant: "original",
      versionId: receipt.version.id,
    });
    expect(afterSource.bytes).toEqual(beforeSource.bytes);

    const nextVersionInput = {
      attachmentId: receipt.attachment.id,
      baseRevision: receipt.attachment.revision,
      clientIdempotencyKey: "version-1",
      declaredMimeType: "image/jpeg",
      fileName: "screen-v2.jpg",
      mode: "new-version" as const,
    };
    const nextVersionSession = await memory.service.access.stage(
      accountId,
      nextVersionInput,
      jpegBytes,
    );
    const nextVersion = await memory.service.access.finalize(accountId, {
      ...nextVersionInput,
      uploadId: nextVersionSession.uploadId,
    });
    await expect(
      memory.service.access.listMarkings(accountId, {
        attachmentId: receipt.attachment.id,
        versionId: nextVersion.version.id,
      }),
    ).resolves.toEqual([]);

    await memory.service.access.undoMarking(accountId, {
      attachmentId: receipt.attachment.id,
      markingId: marking.id,
      versionId: receipt.version.id,
    });
    await expect(
      memory.service.access.undoMarking(accountId, {
        attachmentId: receipt.attachment.id,
        markingId: marking.id,
        versionId: receipt.version.id,
      }),
    ).resolves.toBeUndefined();
    await expect(
      memory.service.access.listMarkings(accountId, {
        attachmentId: receipt.attachment.id,
        versionId: receipt.version.id,
      }),
    ).resolves.toEqual([]);
  });

  test("pins a location bind to the selected version across a later version", async () => {
    const work = {
      id: "work-1",
      key: "CANT-1",
      projectId: "project-1",
      revision: 0,
      title: "Existing work",
    };
    const originPositions: FileAttachmentWorkOriginPosition[] = [];
    let workRevision = 0;
    const locationWork: FileAttachmentLocationWorkAccess = {
      bind: (_accountId, bindInput) => {
        originPositions.push(bindInput.originPosition);
        workRevision = 1;
        expect(bindInput.originPosition).toMatchObject({
          ownerRecordId: "2",
          sourceVersion: "3",
        });
        return Promise.resolve({ ...work, revision: 1 });
      },
      create: (_accountId, createInput) => {
        originPositions.push(createInput.originPosition);
        expect(createInput.originPosition).toMatchObject({
          ownerRecordId: "2",
          sourceVersion: "3",
        });
        return Promise.resolve({
          ...work,
          id: "work-2",
          key: "CANT-2",
          title: createInput.title,
        });
      },
      find: () => Promise.resolve({ ...work, revision: workRevision }),
      findProject: (_accountId, projectId) =>
        Promise.resolve(projectId === projectScope.projectId),
      replayBind: () => Promise.resolve({ ...work, revision: workRevision }),
    };
    const memory = createMemoryFileAttachments({ locationWork });
    const input = newInput();
    const session = await memory.service.access.stage(
      accountId,
      stageInput(input),
      jpegBytes,
    );
    const receipt = await memory.service.access.finalize(accountId, {
      ...input,
      uploadId: session.uploadId,
    });
    const originInput = {
      attachmentId: receipt.attachment.id,
      location: { kind: "point" as const, x: 0.25, y: 0.75 },
      mode: "existing" as const,
      versionId: receipt.version.id,
      workId: work.id,
    };
    const preview = await memory.service.access.previewLocationBind(
      accountId,
      originInput,
    );

    expect(preview).toMatchObject({
      attachmentId: receipt.attachment.id,
      target: { mode: "existing", work },
      versionId: receipt.version.id,
    });

    await expect(
      memory.service.access.bindLocation(accountId, {
        ...originInput,
        baseRevision: work.revision,
        clientIdempotencyKey: "origin-1",
        previewId: preview.previewId,
      }),
    ).resolves.toMatchObject({
      attachmentId: receipt.attachment.id,
      status: "committed",
      versionId: receipt.version.id,
      work: { id: work.id, revision: 1 },
    });

    await expect(
      memory.service.access.bindLocation(accountId, {
        ...originInput,
        baseRevision: work.revision,
        clientIdempotencyKey: "origin-1",
        previewId: preview.previewId,
      }),
    ).resolves.toMatchObject({
      status: "committed",
      versionId: receipt.version.id,
      work: { id: work.id, revision: 1 },
    });

    const newWorkInput = {
      attachmentId: receipt.attachment.id,
      description: "Create a Work from this source location.",
      location: {
        kind: "region" as const,
        region: { height: 0.2, width: 0.3, x: 0.1, y: 0.2 },
      },
      mode: "new" as const,
      projectId: projectScope.projectId,
      title: "New source Work",
      type: "Task" as const,
      versionId: receipt.version.id,
    };
    const newWorkPreview = await memory.service.access.previewLocationBind(
      accountId,
      newWorkInput,
    );

    expect(newWorkPreview).toMatchObject({
      target: {
        mode: "new",
        projectId: projectScope.projectId,
        title: newWorkInput.title,
        type: newWorkInput.type,
      },
      versionId: receipt.version.id,
    });

    await expect(
      memory.service.access.previewLocationBind(accountId, {
        ...newWorkInput,
        projectId: "project-missing",
      }),
    ).rejects.toMatchObject({
      code: "FILE_ATTACHMENT_TARGET_NOT_FOUND",
    });

    await expect(
      memory.service.access.bindLocation(accountId, {
        ...newWorkInput,
        clientIdempotencyKey: "origin-new-1",
        previewId: newWorkPreview.previewId,
      }),
    ).resolves.toMatchObject({
      status: "committed",
      versionId: receipt.version.id,
      work: { id: "work-2", key: "CANT-2", title: newWorkInput.title },
    });

    const nextVersionInput = {
      attachmentId: receipt.attachment.id,
      baseRevision: receipt.attachment.revision,
      clientIdempotencyKey: "version-after-origin-1",
      declaredMimeType: "image/jpeg",
      fileName: "screen-v2.jpg",
      mode: "new-version" as const,
    };
    const nextVersionSession = await memory.service.access.stage(
      accountId,
      nextVersionInput,
      jpegBytes,
    );
    const nextVersion = await memory.service.access.finalize(accountId, {
      ...nextVersionInput,
      uploadId: nextVersionSession.uploadId,
    });

    const latestOriginPosition = originPositions.at(-1);
    expect(latestOriginPosition).toMatchObject({
      ownerRecordId: receipt.attachment.id,
      sourceVersion: receipt.version.id,
    });
    expect(nextVersion.version.id).not.toBe(
      latestOriginPosition?.sourceVersion,
    );
  });

  test("requires a page for PDF marking and location metadata", async () => {
    const memory = createMemoryFileAttachments();
    const input = newInput({
      declaredMimeType: "application/pdf",
      fileName: "brief.pdf",
    });
    const session = await memory.service.access.stage(
      accountId,
      stageInput(input),
      pdfBytes,
    );
    const receipt = await memory.service.access.finalize(accountId, {
      ...input,
      uploadId: session.uploadId,
    });

    await expect(
      memory.service.access.createMarking(accountId, {
        attachmentId: receipt.attachment.id,
        clientIdempotencyKey: "pdf-marking-without-page",
        geometry: {
          kind: "path",
          points: [
            { x: 0.1, y: 0.2 },
            { x: 0.3, y: 0.4 },
          ],
        },
        tool: "pen",
        versionId: receipt.version.id,
      }),
    ).rejects.toMatchObject({ code: "FILE_ATTACHMENT_MARKING_UNSUPPORTED" });

    await expect(
      memory.service.access.createMarking(accountId, {
        attachmentId: receipt.attachment.id,
        clientIdempotencyKey: "pdf-marking-with-page",
        geometry: {
          kind: "path",
          page: 1,
          points: [
            { x: 0.1, y: 0.2 },
            { x: 0.3, y: 0.4 },
          ],
        },
        tool: "pen",
        versionId: receipt.version.id,
      }),
    ).resolves.toMatchObject({ versionId: receipt.version.id });

    await expect(
      memory.service.access.createMarking(accountId, {
        attachmentId: receipt.attachment.id,
        clientIdempotencyKey: "pdf-marking-out-of-range",
        geometry: {
          kind: "path",
          page: 2,
          points: [
            { x: 0.1, y: 0.2 },
            { x: 0.3, y: 0.4 },
          ],
        },
        tool: "pen",
        versionId: receipt.version.id,
      }),
    ).rejects.toMatchObject({ code: "FILE_ATTACHMENT_MARKING_UNSUPPORTED" });

    await expect(
      memory.service.access.previewLocationBind(accountId, {
        attachmentId: receipt.attachment.id,
        location: { kind: "point", x: 0.25, y: 0.75 },
        mode: "existing",
        versionId: receipt.version.id,
        workId: "work-1",
      }),
    ).rejects.toMatchObject({ code: "FILE_ATTACHMENT_LOCATION_UNSUPPORTED" });
  });

  test("resolves the PDF page count once per version for repeated markings", async () => {
    const readPageCount = vi.fn(async () => 1);
    const memory = createMemoryFileAttachments({ readPageCount });
    const input = newInput({
      declaredMimeType: "application/pdf",
      fileName: "brief.pdf",
    });
    const session = await memory.service.access.stage(
      accountId,
      stageInput(input),
      pdfBytes,
    );
    const receipt = await memory.service.access.finalize(accountId, {
      ...input,
      uploadId: session.uploadId,
    });
    const pageMarking = {
      attachmentId: receipt.attachment.id,
      geometry: {
        kind: "path" as const,
        page: 1,
        points: [
          { x: 0.1, y: 0.2 },
          { x: 0.3, y: 0.4 },
        ],
      },
      tool: "pen" as const,
      versionId: receipt.version.id,
    };

    await memory.service.access.createMarking(accountId, {
      ...pageMarking,
      clientIdempotencyKey: "pdf-page-count-1",
    });
    await memory.service.access.createMarking(accountId, {
      ...pageMarking,
      clientIdempotencyKey: "pdf-page-count-2",
    });
    await expect(
      memory.service.access.createMarking(accountId, {
        ...pageMarking,
        clientIdempotencyKey: "pdf-page-count-out-of-range",
        geometry: { ...pageMarking.geometry, page: 2 },
      }),
    ).rejects.toMatchObject({ code: "FILE_ATTACHMENT_MARKING_UNSUPPORTED" });

    expect(readPageCount).toHaveBeenCalledTimes(1);
  });
});
