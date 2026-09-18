import type {
  CaptureInboxAccess,
  CaptureInboxSnapshot,
  CaptureInboxTriageAccess,
} from "@cantiara/api/capture-triage";
import type { Context } from "@cantiara/api/context";
import { appRouter } from "@cantiara/api/routers/index";
import { createRouterClient } from "@orpc/server";
import { describe, expect, test, vi } from "vitest";

const emptyInbox: CaptureInboxSnapshot = {
  bulkSenseMaking: { clusters: [], placements: [], revision: 0 },
  groups: [],
  items: [],
  triageAvailable: false,
};

function createContext(captureInbox: CaptureInboxAccess): Context {
  return {
    accountAccess: {
      listSessions: async () => [],
      revokeOtherSessions: async () => undefined,
      revokeSession: async () => undefined,
    },
    accountPreferences: {
      get: async () => ({
        appearance: "Dark",
        dateFormat: "locale",
        firstDayOfWeek: "Monday",
        isSaved: false,
        locale: "en-GB",
        revision: 0,
        savedAt: null,
        timeZone: "Europe/Istanbul",
      }),
    },
    auth: null,
    captureInbox,
    db: {} as Context["db"],
    githubAvailability: { getStatus: () => "available" },
    session: {
      session: { id: "session-1" },
      user: { id: "account-1" },
    } as Context["session"],
  };
}

describe("Capture Inbox RPC", () => {
  test("reads and saves through the authenticated Capture Inbox interface", async () => {
    const create = vi.fn().mockResolvedValue({
      content: "Save this thought",
      createdAt: "2026-09-16T09:00:00.000Z",
      fields: {},
      id: "capture-1",
      projectId: null,
      template: null,
    });
    const captureInbox: CaptureInboxAccess = {
      create,
      createBug: vi.fn(),
      list: vi.fn().mockResolvedValue(emptyInbox),
      updateBulkSenseMaking: vi.fn(),
    };
    const client = createRouterClient(appRouter, {
      context: createContext(captureInbox),
    });

    await expect(client.captureInbox()).resolves.toEqual(emptyInbox);
    await expect(
      client.createCapture({
        clientIdempotencyKey: "capture-key-1",
        content: "Save this thought",
      }),
    ).resolves.toMatchObject({ id: "capture-1" });

    expect(create).toHaveBeenCalledWith("account-1", {
      clientIdempotencyKey: "capture-key-1",
      content: "Save this thought",
      fields: {},
      projectId: null,
      template: null,
    });
  });

  test("updates Bulk sense-making through the authenticated Capture Inbox interface", async () => {
    const updateBulkSenseMaking = vi.fn().mockResolvedValue({
      clusters: [{ id: "cluster-ideas", name: "Ideas", position: 0 }],
      placements: [
        { clusterId: "cluster-ideas", itemId: "capture-1", position: 0 },
      ],
      revision: 1,
    });
    const captureInbox: CaptureInboxAccess = {
      create: vi.fn(),
      createBug: vi.fn(),
      list: vi.fn().mockResolvedValue(emptyInbox),
      updateBulkSenseMaking,
    };
    const client = createRouterClient(appRouter, {
      context: createContext(captureInbox),
    });
    const input = {
      baseRevision: 0,
      clientIdempotencyKey: "bulk-layout-1",
      clusters: [{ id: "cluster-ideas", name: "Ideas", position: 0 }],
      placements: [
        { clusterId: "cluster-ideas", itemId: "capture-1", position: 0 },
      ],
    };

    await expect(client.updateCaptureBulkSenseMaking(input)).resolves.toEqual({
      clusters: [{ id: "cluster-ideas", name: "Ideas", position: 0 }],
      placements: [
        { clusterId: "cluster-ideas", itemId: "capture-1", position: 0 },
      ],
      revision: 1,
    });
    expect(updateBulkSenseMaking).toHaveBeenCalledWith("account-1", input);
  });

  test("hands direct Create Bug to Work creation without adding an Inbox route", async () => {
    const createBug = vi.fn().mockResolvedValue({ workId: "work-1" });
    const captureInbox: CaptureInboxAccess = {
      create: vi.fn(),
      createBug,
      list: vi.fn().mockResolvedValue(emptyInbox),
      updateBulkSenseMaking: vi.fn(),
    };
    const client = createRouterClient(appRouter, {
      context: createContext(captureInbox),
    });

    await expect(
      client.createBug({
        content: "Blank preview",
        projectId: "project-1",
        template: "Bug Capture",
      }),
    ).resolves.toEqual({ workId: "work-1" });
    expect(createBug).toHaveBeenCalledWith("account-1", {
      content: "Blank preview",
      fields: {},
      projectId: "project-1",
      template: "Bug Capture",
    });
  });

  test("keeps an unavailable Project error actionable instead of classifying it as an API failure", async () => {
    const createBug = vi.fn().mockRejectedValue(
      Object.assign(new Error("Project is unavailable."), {
        code: "WORK_PROJECT_NOT_FOUND",
      }),
    );
    const captureInbox: CaptureInboxAccess = {
      create: vi.fn(),
      createBug,
      list: vi.fn().mockResolvedValue(emptyInbox),
      updateBulkSenseMaking: vi.fn(),
    };
    const client = createRouterClient(appRouter, {
      context: createContext(captureInbox),
    });

    await expect(
      client.createBug({
        content: "Blank preview",
        projectId: "missing-project",
        template: "Bug Capture",
      }),
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
      data: { code: "WORK_PROJECT_NOT_FOUND" },
      message: "Choose an available Project.",
      status: 400,
    });
  });

  test("returns an explicit unavailable error when Work creation is not wired", async () => {
    const createBug = vi.fn().mockRejectedValue(
      Object.assign(new Error("Work creation is not available yet."), {
        code: "CAPTURE_WORK_CREATE_UNAVAILABLE",
      }),
    );
    const captureInbox: CaptureInboxAccess = {
      create: vi.fn(),
      createBug,
      list: vi.fn().mockResolvedValue(emptyInbox),
      updateBulkSenseMaking: vi.fn(),
    };
    const client = createRouterClient(appRouter, {
      context: createContext(captureInbox),
    });

    await expect(
      client.createBug({
        content: "Blank preview",
        projectId: "project-1",
        template: "Bug Capture",
      }),
    ).rejects.toMatchObject({
      code: "NOT_IMPLEMENTED",
      data: { code: "CAPTURE_WORK_CREATE_UNAVAILABLE" },
      message: "Work creation is not available yet.",
      status: 501,
    });
  });

  test("returns an explicit conflict for a concurrent idempotency collision", async () => {
    const create = vi.fn().mockRejectedValue(
      Object.assign(new Error("Conflict"), {
        code: "CONFLICT",
        targetId: "capture-inbox:account-1:capture-key-1",
      }),
    );
    const captureInbox: CaptureInboxAccess = {
      create,
      createBug: vi.fn(),
      list: vi.fn().mockResolvedValue(emptyInbox),
      updateBulkSenseMaking: vi.fn(),
    };
    const client = createRouterClient(appRouter, {
      context: createContext(captureInbox),
    });

    await expect(
      client.createCapture({
        clientIdempotencyKey: "capture-key-1",
        content: "Different payload",
      }),
    ).rejects.toMatchObject({
      code: "CONFLICT",
      data: {
        code: "CONFLICT",
        label: "Conflict",
        targetId: "capture-inbox:account-1:capture-key-1",
      },
      message: "Conflict",
      status: 409,
    });
  });

  test("keeps triage exits behind preview and confirmation RPCs", async () => {
    const preview = {
      fieldMappings: [],
      itemId: "capture-1",
      previewId: "preview-1",
      proposedRelations: [{ relation: "Origin", target: "Proposed record" }],
      proposedRecord: {
        fields: {},
        projectId: null,
        recordType: "Work" as const,
        title: "A capture",
      },
      source: {
        content: "A capture",
        createdAt: "2026-09-16T09:00:00.000Z",
        fields: {},
        id: "capture-1",
        projectId: null,
        template: null,
      },
      targetScope: {
        kind: "workspace" as const,
        label: "Workspace" as const,
        projectId: null,
      },
    };
    const captureInbox: CaptureInboxTriageAccess = {
      attachToExisting: vi.fn(),
      convert: vi.fn().mockResolvedValue({
        consumed: true,
        exit: "convert",
        itemId: "capture-1",
        recordId: "work-1",
        recordType: "Work",
      }),
      create: vi.fn(),
      createBug: vi.fn(),
      delete: vi.fn(),
      list: vi.fn().mockResolvedValue(emptyInbox),
      previewAttachToExisting: vi.fn(),
      previewConvert: vi.fn().mockResolvedValue(preview),
      previewUndoMerge: vi.fn(),
      suggestions: vi.fn(),
      undoMerge: vi.fn(),
      updateBulkSenseMaking: vi.fn(),
    };
    const client = createRouterClient(appRouter, {
      context: createContext(captureInbox),
    });

    await expect(
      client.previewCaptureConversion({
        itemId: "capture-1",
        recordType: "Work",
      }),
    ).resolves.toEqual(preview);
    await expect(
      client.convertCapture({
        clientIdempotencyKey: "convert-key-1",
        itemId: "capture-1",
        previewId: "preview-1",
      }),
    ).resolves.toMatchObject({
      consumed: true,
      exit: "convert",
      recordId: "work-1",
    });

    expect(captureInbox.previewConvert).toHaveBeenCalledWith("account-1", {
      itemId: "capture-1",
      recordType: "Work",
    });
    expect(captureInbox.convert).toHaveBeenCalledWith("account-1", {
      clientIdempotencyKey: "convert-key-1",
      itemId: "capture-1",
      previewId: "preview-1",
    });
  });
});
