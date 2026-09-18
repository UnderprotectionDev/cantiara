import type { Context } from "@cantiara/api/context";
import { appRouter } from "@cantiara/api/routers/index";
import type {
  WorkLifecycleAccess,
  WorkProfile,
} from "@cantiara/api/work-lifecycle";
import { createRouterClient } from "@orpc/server";
import { describe, expect, test, vi } from "vitest";

import {
  WorkFeatureExitBlockedError,
  WorkProjectNotFoundError,
  WorkTypeImpactPreviewRequiredError,
} from "./work-lifecycle";

const work: WorkProfile = {
  captureProvenance: null,
  closureResult: null,
  createdAt: "2026-09-18T09:00:00.000Z",
  featureHealthHistory: [],
  id: "work-1",
  key: "CANT-1",
  number: 1,
  primaryFeatureId: null,
  primarySpecId: null,
  projectId: "project-1",
  revision: 1,
  status: "Not Started",
  title: "Create the first Work",
  type: "Task",
  updatedAt: "2026-09-18T09:00:00.000Z",
};

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
    const create = vi.fn().mockResolvedValue(work);
    const workLifecycle: WorkLifecycleAccess = {
      create,
      detachFeatureHealthHistory: vi.fn().mockResolvedValue(work),
      detachIncludedWork: vi.fn().mockResolvedValue(work),
      featureProgress: vi.fn().mockResolvedValue({
        includedWorkCount: 0,
        statusCounts: {
          Blocked: 0,
          Closed: 0,
          "In Progress": 0,
          "Not Started": 0,
        },
      }),
      find: vi.fn().mockResolvedValue(work),
      includeWork: vi.fn().mockResolvedValue(work),
      list: vi.fn().mockResolvedValue([work]),
      previewTypeChange: vi.fn().mockResolvedValue({
        currentType: "Task",
        featureExitBlockers: null,
        nextType: "Bug",
        previewId: "work-type-impact-work-1-1-Task-Bug",
        requiresImpactPreview: false,
        workId: work.id,
      }),
      recordFeatureHealth: vi.fn().mockResolvedValue(work),
      updateFeaturePrimarySpec: vi.fn().mockResolvedValue(work),
      updateType: vi.fn().mockResolvedValue({ ...work, type: "Bug" }),
    };
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
      client.featureProgress({ featureId: work.id }),
    ).resolves.toMatchObject({ includedWorkCount: 0 });
    await expect(
      client.includeWork({
        baseRevision: work.revision,
        clientIdempotencyKey: "include-work-1",
        featureId: "feature-1",
        workId: work.id,
      }),
    ).resolves.toEqual(work);
    await expect(
      client.detachIncludedWork({
        baseRevision: work.revision,
        clientIdempotencyKey: "detach-work-1",
        featureId: "feature-1",
        workId: work.id,
      }),
    ).resolves.toEqual(work);
    await expect(
      client.recordFeatureHealth({
        baseRevision: work.revision,
        clientIdempotencyKey: "health-1",
        featureId: "feature-1",
        health: "On Track",
        reason: "The acceptance path is clear.",
      }),
    ).resolves.toEqual(work);
    await expect(
      client.updateFeaturePrimarySpec({
        baseRevision: work.revision,
        clientIdempotencyKey: "primary-spec-1",
        featureId: "feature-1",
        primarySpecId: "document-1",
      }),
    ).resolves.toEqual(work);
    await expect(
      client.detachFeatureHealthHistory({
        baseRevision: work.revision,
        clientIdempotencyKey: "detach-health-1",
        featureId: "feature-1",
      }),
    ).resolves.toEqual(work);
  });

  test("maps a missing Project to a user-facing not-found response", async () => {
    const workLifecycle: WorkLifecycleAccess = {
      create: vi
        .fn()
        .mockRejectedValue(new WorkProjectNotFoundError("missing")),
      detachFeatureHealthHistory: vi.fn(),
      detachIncludedWork: vi.fn(),
      featureProgress: vi.fn(),
      find: vi.fn(),
      includeWork: vi.fn(),
      list: vi.fn(),
      previewTypeChange: vi.fn(),
      recordFeatureHealth: vi.fn(),
      updateFeaturePrimarySpec: vi.fn(),
      updateType: vi.fn(),
    };
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
    const workLifecycle: WorkLifecycleAccess = {
      create: vi.fn(),
      detachFeatureHealthHistory: vi.fn(),
      detachIncludedWork: vi.fn(),
      featureProgress: vi.fn(),
      find: vi.fn(),
      includeWork: vi.fn(),
      list: vi.fn(),
      previewTypeChange: vi.fn(),
      recordFeatureHealth: vi.fn(),
      updateFeaturePrimarySpec: vi.fn(),
      updateType: vi
        .fn()
        .mockRejectedValue(
          new WorkTypeImpactPreviewRequiredError(
            "work-type-impact-work-1-1-Task-Feature",
          ),
        ),
    };
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

  test("maps blocked Feature exit details to a precondition response", async () => {
    const blockers = {
      featureHealthUpdateCount: 1,
      hasPrimarySpec: true,
      includedWorkCount: 2,
    };
    const workLifecycle: WorkLifecycleAccess = {
      create: vi.fn(),
      detachFeatureHealthHistory: vi.fn(),
      detachIncludedWork: vi.fn(),
      featureProgress: vi.fn(),
      find: vi.fn(),
      includeWork: vi.fn(),
      list: vi.fn(),
      previewTypeChange: vi.fn(),
      recordFeatureHealth: vi.fn(),
      updateFeaturePrimarySpec: vi.fn(),
      updateType: vi
        .fn()
        .mockRejectedValue(new WorkFeatureExitBlockedError(blockers)),
    };
    const client = createRouterClient(appRouter, {
      context: createContext(workLifecycle),
    });

    await expect(
      client.updateWorkType({
        baseRevision: 1,
        clientIdempotencyKey: "blocked-feature-exit",
        impactPreviewId: "work-type-impact:work-1:1:Feature:Task:2:1:1",
        type: "Task",
        workId: work.id,
      }),
    ).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
      data: { blockers, code: "WORK_FEATURE_EXIT_BLOCKED" },
      message:
        "Detach included Work, Feature health history, and Primary spec before leaving Feature.",
      status: 412,
    });
  });
});
