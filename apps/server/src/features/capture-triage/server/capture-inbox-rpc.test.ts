import type {
  CaptureInboxAccess,
  CaptureInboxSnapshot,
  CaptureInboxTriageAccess,
} from "@cantiara/api/capture-triage";
import type { Context } from "@cantiara/api/context";
import { appRouter } from "@cantiara/api/routers/index";
import { createRouterClient } from "@orpc/server";
import { describe, expect, test, vi } from "vitest";

const emptyInbox: CaptureInboxSnapshot = { groups: [], items: [] };

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

  test("hands direct Create Bug to Work creation without adding an Inbox route", async () => {
    const createBug = vi.fn().mockResolvedValue({ workId: "work-1" });
    const captureInbox: CaptureInboxAccess = {
      create: vi.fn(),
      createBug,
      list: vi.fn().mockResolvedValue(emptyInbox),
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
      itemId: "capture-1",
      previewId: "preview-1",
    });
  });
});
