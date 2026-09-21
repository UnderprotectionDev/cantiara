import {
  FILE_ATTACHMENT_QUOTA,
  type FileAttachment,
  type FileAttachmentFinalizeInput,
  type FileAttachmentQuota,
  type FileAttachmentVersion,
  fileAttachmentFinalizeReceiptSchema,
} from "@cantiara/api/file-attachments";
import { describe, expect, test } from "vitest";

import {
  createFileAttachments,
  type FileAttachmentCommitInput,
  FileAttachmentError,
  type FileAttachmentObjectStore,
  type FileAttachmentRepository,
  type FileAttachmentStoredUpload,
  FileAttachmentValidationError,
  validateFileAttachmentUpload,
} from "./file-attachments";

const jpegBytes = new Uint8Array([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
]);
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
  options: { byteLimit?: number; commitByteLimit?: number } = {},
) {
  const objects = new Map<string, Uint8Array>();
  const uploads = new Map<string, FileAttachmentStoredUpload>();
  const attachments = new Map<
    string,
    { attachment: FileAttachment; versions: FileAttachmentVersion[] }
  >();
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
  };

  const objectStore: FileAttachmentObjectStore = {
    delete(key) {
      objects.delete(key);
      return Promise.resolve();
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
      repository,
    }),
    uploads,
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
