import type {
  FileAttachmentFinalizeInput,
  FileAttachmentFinalizeReceipt,
} from "@cantiara/api/file-attachments";
import { describe, expect, test, vi } from "vitest";

import { uploadFileAttachment } from "./file-attachment-upload";

const projectScope = {
  kind: "project" as const,
  projectId: "project-1",
};

const receipt = {} as FileAttachmentFinalizeReceipt;

describe("File Attachment upload", () => {
  test("stages a selected file before finalizing it in the Project scope", async () => {
    const request = vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
      const form = init?.body as FormData;

      expect(form.get("file")).toBeInstanceOf(File);
      expect(form.get("fileName")).toBe("notes.md");
      expect(form.get("declaredMimeType")).toBe("text/markdown");
      expect(form.get("mode")).toBe("new");
      expect(form.get("clientIdempotencyKey")).toBe("idempotency-1");
      expect(form.get("scope")).toBe(JSON.stringify(projectScope));

      return Promise.resolve(
        new Response(
          JSON.stringify({
            fileName: "notes.md",
            mode: "new",
            status: "Uploading",
            uploadId: "upload-1",
          }),
          { headers: { "content-type": "application/json" }, status: 200 },
        ),
      );
    });
    const finalize = vi.fn(
      async (_input: FileAttachmentFinalizeInput) => receipt,
    );

    const result = await uploadFileAttachment(
      new File(["hello"], "notes.md", { type: "text/markdown" }),
      projectScope,
      {
        createIdempotencyKey: () => "idempotency-1",
        finalize,
        request,
        serverURL: "http://localhost:3000",
      },
    );

    expect(result).toBe(receipt);
    expect(request).toHaveBeenCalledOnce();
    expect(finalize).toHaveBeenCalledWith({
      clientIdempotencyKey: "idempotency-1",
      declaredMimeType: "text/markdown",
      fileName: "notes.md",
      mode: "new",
      scope: projectScope,
      uploadId: "upload-1",
    });
  });

  test("does not finalize when staging rejects the file", async () => {
    const request = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            code: "FILE_ATTACHMENT_UNSUPPORTED_TYPE",
            message: "This file type is not supported.",
          }),
          { headers: { "content-type": "application/json" }, status: 400 },
        ),
    );
    const finalize = vi.fn(
      async (_input: FileAttachmentFinalizeInput) => receipt,
    );

    await expect(
      uploadFileAttachment(
        new File(["hello"], "notes.md", { type: "text/markdown" }),
        projectScope,
        {
          finalize,
          request,
          serverURL: "http://localhost:3000",
        },
      ),
    ).rejects.toThrow("This file type is not supported.");
    expect(finalize).not.toHaveBeenCalled();
  });
});
