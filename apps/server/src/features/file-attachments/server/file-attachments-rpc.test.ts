import type { Context } from "@cantiara/api/context";
import type {
  FileAttachmentAccess,
  FileAttachmentPreview,
} from "@cantiara/api/file-attachments";
import { appRouter } from "@cantiara/api/routers/index";
import { createRouterClient } from "@orpc/server";
import { describe, expect, test, vi } from "vitest";

const preview: FileAttachmentPreview = {
  attachmentId: "attachment-1",
  downloadPath:
    "/api/file-attachments/attachment-1/versions/version-1/asset?variant=original",
  kind: "image",
  previewPath:
    "/api/file-attachments/attachment-1/versions/version-1/asset?variant=original",
  status: "available",
  versionId: "version-1",
};

function createContext(fileAttachments: FileAttachmentAccess): Context {
  return {
    accountAccess: {
      listSessions: async () => [],
      revokeOtherSessions: async () => undefined,
      revokeSession: async () => undefined,
    },
    accountPreferences: {
      get: () => Promise.reject(new Error("Not part of this test.")),
    },
    auth: null,
    db: {} as Context["db"],
    fileAttachments,
    githubAvailability: { getStatus: () => "available" },
    session: {
      session: { id: "session-1" },
      user: { id: "account-1" },
    } as Context["session"],
  };
}

describe("File Attachments RPC", () => {
  test("keeps preview and External Surface selection behind the File Attachments seam", async () => {
    const fileAttachments: FileAttachmentAccess = {
      canSelectIntoExternalSurface: vi
        .fn()
        .mockResolvedValue({ allowed: true, reason: null }),
      cleanupVersionDerivatives: vi.fn(),
      finalize: vi.fn(),
      getQuota: vi.fn(),
      list: vi.fn(),
      preview: vi.fn().mockResolvedValue(preview),
      readAsset: vi.fn(),
      stage: vi.fn(),
    };
    const client = createRouterClient(appRouter, {
      context: createContext(fileAttachments),
    });
    const input = { attachmentId: "attachment-1", versionId: "version-1" };

    await expect(client.previewFileAttachment(input)).resolves.toEqual(preview);
    await expect(
      client.fileAttachmentExternalSurfaceSelection(input),
    ).resolves.toEqual({ allowed: true, reason: null });
    expect(fileAttachments.preview).toHaveBeenCalledWith("account-1", input);
    expect(fileAttachments.canSelectIntoExternalSurface).toHaveBeenCalledWith(
      "account-1",
      input,
    );
  });
});
