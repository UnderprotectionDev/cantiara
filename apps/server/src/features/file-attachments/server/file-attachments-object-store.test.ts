import { describe, expect, test } from "vitest";

import {
  createFileAttachments,
  type FileAttachmentRepository,
} from "./file-attachments";
import { createFileAttachmentObjectStore } from "./file-attachments-object-store";

const unsupportedRepositoryOperation = () => {
  throw new Error("Not part of the object-store selection test.");
};

function createListRepository(): FileAttachmentRepository {
  return {
    clearTemporaryObject: unsupportedRepositoryOperation,
    commitUpload: unsupportedRepositoryOperation,
    findExpiredUploads: unsupportedRepositoryOperation,
    findMarking: unsupportedRepositoryOperation,
    findMarkingByIdempotencyKey: unsupportedRepositoryOperation,
    findUpload: unsupportedRepositoryOperation,
    findVersion: unsupportedRepositoryOperation,
    findWorkspaceId: unsupportedRepositoryOperation,
    getQuota: unsupportedRepositoryOperation,
    hasOtherVersionWithContentHash: unsupportedRepositoryOperation,
    insertMarking: unsupportedRepositoryOperation,
    insertUpload: unsupportedRepositoryOperation,
    list: async () => [],
    listMarkings: unsupportedRepositoryOperation,
    markUploadRejected: unsupportedRepositoryOperation,
    markUploadSwept: unsupportedRepositoryOperation,
    rollbackCapturePromotion: unsupportedRepositoryOperation,
    undoMarking: unsupportedRepositoryOperation,
  };
}

describe("File Attachment object-store selection", () => {
  test("uses a development store when R2 is not configured", async () => {
    const store = createFileAttachmentObjectStore({
      nodeEnv: "development",
    });

    expect(store).toBeDefined();
    if (!store) {
      throw new Error("Development object store was not created.");
    }

    const temporary = await store.putTemporary({
      accountId: "account-1",
      bytes: new Uint8Array([1, 2, 3]),
      contentType: "application/octet-stream",
      uploadId: "upload-1",
    });

    expect(temporary).toEqual({
      key: "file-attachments-temporary/account-1/upload-1",
    });
    await store.promote({
      permanentKey: "file-attachments/account-1/attachment-1/version-1",
      temporaryKey: temporary.key,
    });
    await expect(
      store.read("file-attachments/account-1/attachment-1/version-1"),
    ).resolves.toEqual(new Uint8Array([1, 2, 3]));

    const service = createFileAttachments({
      objectStore: store,
      repository: createListRepository(),
    });
    await expect(
      service.access.list("account-1", {
        kind: "project",
        projectId: "project-1",
      }),
    ).resolves.toEqual([]);
  });

  test("does not silently replace production R2 with the development store", () => {
    expect(
      createFileAttachmentObjectStore({ nodeEnv: "production" }),
    ).toBeUndefined();
  });
});
