import { describe, expect, test } from "vitest";

import { createFileAttachmentObjectStore } from "./file-attachments-object-store";

describe("File Attachment object-store selection", () => {
  test("uses a development store when R2 is not configured", () => {
    const store = createFileAttachmentObjectStore({
      nodeEnv: "development",
    });

    expect(store).toBeDefined();
  });

  test("does not silently replace production R2 with the development store", () => {
    expect(
      createFileAttachmentObjectStore({ nodeEnv: "production" }),
    ).toBeUndefined();
  });
});
