import { describe, expect, test } from "vitest";

import { createFileAttachmentObjectStore } from "./file-attachments-object-store";

describe("File Attachment object-store selection", () => {
  test("uses a development store when R2 is not configured", async () => {
    const store = createFileAttachmentObjectStore({
      nodeEnv: "development",
    });

    expect(store).toBeDefined();

    const temporary = await store?.putTemporary({
      accountId: "account-1",
      bytes: new Uint8Array([1, 2, 3]),
      contentType: "application/octet-stream",
      uploadId: "upload-1",
    });

    expect(temporary).toEqual({
      key: "file-attachments-temporary/account-1/upload-1",
    });
    await store?.promote({
      permanentKey: "file-attachments/account-1/attachment-1/version-1",
      temporaryKey: temporary?.key ?? "",
    });
    await expect(
      store?.read("file-attachments/account-1/attachment-1/version-1"),
    ).resolves.toEqual(new Uint8Array([1, 2, 3]));
  });

  test("does not silently replace production R2 with the development store", () => {
    expect(
      createFileAttachmentObjectStore({ nodeEnv: "production" }),
    ).toBeUndefined();
  });
});
