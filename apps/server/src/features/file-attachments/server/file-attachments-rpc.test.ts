import type { Context } from "@cantiara/api/context";
import type {
  FileAttachmentAccess,
  FileAttachmentLocationBindPreview,
  FileAttachmentMarking,
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

const marking: FileAttachmentMarking = {
  attachmentId: "attachment-1",
  createdAt: "2026-09-21T10:00:00.000Z",
  geometry: {
    kind: "path",
    points: [
      { x: 0.1, y: 0.2 },
      { x: 0.3, y: 0.4 },
    ],
  },
  id: "marking-1",
  tool: "pen",
  versionId: "version-1",
};

const locationPreview: FileAttachmentLocationBindPreview = {
  attachmentId: "attachment-1",
  location: { kind: "point", x: 0.5, y: 0.5 },
  previewId: "origin-preview-1",
  target: {
    mode: "existing",
    work: {
      id: "work-1",
      key: "CANT-1",
      projectId: "project-1",
      revision: 2,
      title: "Work",
    },
  },
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
      createMarking: vi.fn(),
      finalize: vi.fn(),
      getQuota: vi.fn(),
      list: vi.fn(),
      listMarkings: vi.fn(),
      previewLocationBind: vi.fn(),
      preview: vi.fn().mockResolvedValue(preview),
      readAsset: vi.fn(),
      stage: vi.fn(),
      undoMarking: vi.fn(),
      bindLocation: vi.fn(),
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

  test("keeps Marking and Köken konumu writes behind the authenticated RPC seam", async () => {
    const fileAttachments: FileAttachmentAccess = {
      canSelectIntoExternalSurface: vi.fn(),
      cleanupVersionDerivatives: vi.fn(),
      createMarking: vi.fn().mockResolvedValue(marking),
      finalize: vi.fn(),
      getQuota: vi.fn(),
      list: vi.fn(),
      listMarkings: vi.fn().mockResolvedValue([marking]),
      previewLocationBind: vi.fn().mockResolvedValue(locationPreview),
      preview: vi.fn(),
      readAsset: vi.fn(),
      stage: vi.fn(),
      undoMarking: vi.fn().mockResolvedValue(undefined),
      bindLocation: vi.fn().mockResolvedValue({
        attachmentId: "attachment-1",
        location: locationPreview.location,
        status: "committed",
        versionId: "version-1",
        work: {
          id: "work-1",
          key: "CANT-1",
          projectId: "project-1",
          revision: 2,
          title: "Work",
        },
      }),
    };
    const client = createRouterClient(appRouter, {
      context: createContext(fileAttachments),
    });
    const markingInput = {
      attachmentId: "attachment-1",
      clientIdempotencyKey: "marking-key",
      geometry: marking.geometry,
      tool: marking.tool,
      versionId: "version-1",
    } as const;
    const locationInput = {
      attachmentId: "attachment-1",
      location: locationPreview.location,
      mode: "existing" as const,
      versionId: "version-1",
      workId: "work-1",
    };

    await expect(
      client.fileAttachmentMarkings({
        attachmentId: "attachment-1",
        versionId: "version-1",
      }),
    ).resolves.toEqual([marking]);
    await expect(
      client.createFileAttachmentMarking(markingInput),
    ).resolves.toEqual(marking);
    await expect(
      client.undoFileAttachmentMarking({
        attachmentId: "attachment-1",
        markingId: marking.id,
        versionId: "version-1",
      }),
    ).resolves.toEqual({ status: "undone" });
    await expect(
      client.previewFileAttachmentLocationBind(locationInput),
    ).resolves.toEqual(locationPreview);
    await expect(
      client.bindFileAttachmentLocation({
        ...locationInput,
        baseRevision:
          locationPreview.target.mode === "existing"
            ? locationPreview.target.work.revision
            : 0,
        clientIdempotencyKey: "origin-key",
        previewId: locationPreview.previewId,
      }),
    ).resolves.toMatchObject({ status: "committed" });
    expect(fileAttachments.createMarking).toHaveBeenCalledWith(
      "account-1",
      markingInput,
    );
    expect(fileAttachments.bindLocation).toHaveBeenCalledWith(
      "account-1",
      expect.objectContaining({ previewId: locationPreview.previewId }),
    );
  });

  test("maps Work lifecycle conflicts raised through the Bind as origin seam", async () => {
    const staleRevisionError = Object.assign(
      new Error("Work has changed. Reload and try again."),
      { code: "STALE_BASE_REVISION", currentRevision: 4 },
    );
    const fileAttachments: FileAttachmentAccess = {
      canSelectIntoExternalSurface: vi.fn(),
      cleanupVersionDerivatives: vi.fn(),
      createMarking: vi.fn(),
      finalize: vi.fn(),
      getQuota: vi.fn(),
      list: vi.fn(),
      listMarkings: vi.fn(),
      previewLocationBind: vi.fn(),
      preview: vi.fn(),
      readAsset: vi.fn(),
      stage: vi.fn(),
      undoMarking: vi.fn(),
      bindLocation: vi.fn().mockRejectedValue(staleRevisionError),
    };
    const client = createRouterClient(appRouter, {
      context: createContext(fileAttachments),
    });

    await expect(
      client.bindFileAttachmentLocation({
        attachmentId: "attachment-1",
        baseRevision: 2,
        clientIdempotencyKey: "origin-key-2",
        location: locationPreview.location,
        mode: "existing",
        previewId: locationPreview.previewId,
        versionId: "version-1",
        workId: "work-1",
      }),
    ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    await expect(
      client.bindFileAttachmentLocation({
        attachmentId: "attachment-1",
        baseRevision: 2,
        clientIdempotencyKey: "origin-key-2",
        location: locationPreview.location,
        mode: "existing",
        previewId: locationPreview.previewId,
        versionId: "version-1",
        workId: "work-1",
      }),
    ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    expect(fileAttachments.bindLocation).toHaveBeenCalledTimes(2);
  });
});
