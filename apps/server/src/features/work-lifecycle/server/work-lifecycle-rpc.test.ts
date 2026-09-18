import type { Context } from "@cantiara/api/context";
import { appRouter } from "@cantiara/api/routers/index";
import type {
  WorkLifecycleAccess,
  WorkProfile,
} from "@cantiara/api/work-lifecycle";
import { createRouterClient } from "@orpc/server";
import { describe, expect, test, vi } from "vitest";

import {
  WorkClosureResultRequiredError,
  WorkProjectNotFoundError,
  WorkTypeImpactPreviewRequiredError,
} from "./work-lifecycle";

const work: WorkProfile = {
  archivedAt: null,
  captureProvenance: null,
  closureReason: null,
  closureResult: null,
  createdAt: "2026-09-18T09:00:00.000Z",
  id: "work-1",
  key: "CANT-1",
  number: 1,
  projectId: "project-1",
  revision: 1,
  status: "Not Started",
  title: "Create the first Work",
  type: "Task",
  updatedAt: "2026-09-18T09:00:00.000Z",
};

function createWorkLifecycleStub(
  overrides: Partial<WorkLifecycleAccess> = {},
): WorkLifecycleAccess {
  return {
    archive: vi.fn(),
    close: vi.fn(),
    create: vi.fn(),
    find: vi.fn(),
    list: vi.fn(),
    previewClose: vi.fn(),
    previewTypeChange: vi.fn(),
    reopen: vi.fn(),
    updateStatus: vi.fn(),
    updateType: vi.fn(),
    unarchive: vi.fn(),
    ...overrides,
  };
}

function createContext(workLifecycle: WorkLifecycleAccess): Context {
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
    db: {} as Context["db"],
    githubAvailability: { getStatus: () => "available" },
    session: {
      session: { id: "session-1" },
      user: { id: "account-1" },
    } as Context["session"],
    workLifecycle,
  };
}

describe("Work Lifecycle RPC", () => {
  test("creates, lists, and reads Work through the authenticated interface", async () => {
    const close = vi.fn().mockResolvedValue({
      ...work,
      closureResult: "Completed",
      status: "Closed",
    });
    const create = vi.fn().mockResolvedValue(work);
    const archive = vi
      .fn()
      .mockResolvedValue({ ...work, archivedAt: "2026-09-18T10:00:00.000Z" });
    const unarchive = vi.fn().mockResolvedValue(work);
    const list = vi.fn().mockResolvedValue([work]);
    const reopen = vi.fn().mockResolvedValue({
      ...work,
      status: "In Progress",
    });
    const updateStatus = vi.fn().mockResolvedValue({
      ...work,
      status: "In Progress",
    });
    const workLifecycle = createWorkLifecycleStub({
      archive,
      close,
      create,
      find: vi.fn().mockResolvedValue(work),
      list,
      previewClose: vi.fn().mockResolvedValue({
        closureCheck: {
          activeBlockers: [],
          incompleteChecklistItems: [],
        },
        lastingContext: null,
        workId: work.id,
      }),
      previewTypeChange: vi.fn().mockResolvedValue({
        currentType: "Task",
        nextType: "Bug",
        previewId: "work-type-impact-work-1-1-Task-Bug",
        requiresImpactPreview: false,
        workId: work.id,
      }),
      reopen,
      updateStatus,
      updateType: vi.fn().mockResolvedValue({ ...work, type: "Bug" }),
      unarchive,
    });
    const client = createRouterClient(appRouter, {
      context: createContext(workLifecycle),
    });

    await expect(
      client.createWork({
        baseRevision: 0,
        clientIdempotencyKey: "work-create-1",
        projectId: "project-1",
        title: "Create the first Work",
      }),
    ).resolves.toEqual(work);
    await expect(
      client.projectWorks({ projectId: "project-1" }),
    ).resolves.toEqual([work]);
    await client.projectWorks({ archived: true, projectId: "project-1" });
    expect(list).toHaveBeenLastCalledWith("account-1", "project-1", {
      archived: true,
    });
    await expect(client.work({ workId: "work-1" })).resolves.toEqual(work);
    expect(create).toHaveBeenCalledWith("account-1", {
      baseRevision: 0,
      clientIdempotencyKey: "work-create-1",
      projectId: "project-1",
      title: "Create the first Work",
      type: "Task",
    });
    await expect(
      client.workTypeChangePreview({ type: "Bug", workId: work.id }),
    ).resolves.toMatchObject({ requiresImpactPreview: false });
    await expect(
      client.updateWorkType({
        baseRevision: work.revision,
        clientIdempotencyKey: "work-update-1",
        type: "Bug",
        workId: work.id,
      }),
    ).resolves.toMatchObject({ type: "Bug" });
    await expect(
      client.updateWorkStatus({
        baseRevision: work.revision,
        clientIdempotencyKey: "work-status-1",
        status: "In Progress",
        workId: work.id,
      }),
    ).resolves.toMatchObject({ status: "In Progress" });
    await expect(
      client.workClosePreview({ workId: work.id }),
    ).resolves.toMatchObject({ workId: work.id });
    await expect(
      client.closeWork({
        baseRevision: work.revision,
        clientIdempotencyKey: "work-close-1",
        closureResult: "Completed",
        workId: work.id,
      }),
    ).resolves.toMatchObject({
      closureResult: "Completed",
      status: "Closed",
    });
    await expect(
      client.reopenWork({
        baseRevision: work.revision + 1,
        clientIdempotencyKey: "work-reopen-1",
        confirmed: true,
        status: "In Progress",
        workId: work.id,
      }),
    ).resolves.toMatchObject({ status: "In Progress" });
    expect(updateStatus).toHaveBeenCalledWith(
      "account-1",
      expect.objectContaining({ status: "In Progress", workId: work.id }),
      { kind: "Visible user" },
    );
    expect(close).toHaveBeenCalledWith(
      "account-1",
      expect.objectContaining({
        closureResult: "Completed",
        workId: work.id,
      }),
      { kind: "Visible user" },
    );
    expect(reopen).toHaveBeenCalledWith(
      "account-1",
      expect.objectContaining({ status: "In Progress", workId: work.id }),
      { kind: "Visible user" },
    );

    await expect(
      client.archiveWork({
        baseRevision: work.revision,
        clientIdempotencyKey: "work-archive-1",
        workId: work.id,
      }),
    ).resolves.toMatchObject({ archivedAt: "2026-09-18T10:00:00.000Z" });
    await expect(
      client.unarchiveWork({
        baseRevision: work.revision + 1,
        clientIdempotencyKey: "work-unarchive-1",
        workId: work.id,
      }),
    ).resolves.toEqual(work);
  });

  test("maps a missing Project to a user-facing not-found response", async () => {
    const workLifecycle = createWorkLifecycleStub({
      create: vi
        .fn()
        .mockRejectedValue(new WorkProjectNotFoundError("missing")),
    });
    const client = createRouterClient(appRouter, {
      context: createContext(workLifecycle),
    });

    await expect(
      client.createWork({
        baseRevision: 0,
        clientIdempotencyKey: "work-create-missing",
        projectId: "missing",
        title: "Should not be created",
      }),
    ).rejects.toMatchObject({
      code: "NOT_FOUND",
      message: "Project is unavailable.",
      status: 404,
    });
  });

  test("maps a missing Feature impact preview to a precondition response", async () => {
    const workLifecycle = createWorkLifecycleStub({
      updateType: vi
        .fn()
        .mockRejectedValue(
          new WorkTypeImpactPreviewRequiredError(
            "work-type-impact-work-1-1-Task-Feature",
          ),
        ),
    });
    const client = createRouterClient(appRouter, {
      context: createContext(workLifecycle),
    });

    await expect(
      client.updateWorkType({
        baseRevision: 1,
        clientIdempotencyKey: "work-update-feature",
        type: "Feature",
        workId: work.id,
      }),
    ).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
      data: {
        code: "WORK_TYPE_IMPACT_PREVIEW_REQUIRED",
        previewId: "work-type-impact-work-1-1-Task-Feature",
      },
      status: 412,
    });
  });

  test("maps a result-less Closed write to the close-step precondition", async () => {
    const workLifecycle = createWorkLifecycleStub({
      updateStatus: vi
        .fn()
        .mockRejectedValue(new WorkClosureResultRequiredError()),
    });
    const client = createRouterClient(appRouter, {
      context: createContext(workLifecycle),
    });

    await expect(
      client.updateWorkStatus({
        baseRevision: 1,
        clientIdempotencyKey: "planning-close",
        status: "Closed",
        workId: work.id,
      }),
    ).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
      data: { code: "WORK_CLOSURE_RESULT_REQUIRED" },
      status: 412,
    });
  });
});
