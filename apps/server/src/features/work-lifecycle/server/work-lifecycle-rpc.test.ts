import type { Context } from "@cantiara/api/context";
import { appRouter } from "@cantiara/api/routers/index";
import type {
  WorkLifecycleAccess,
  WorkProfile,
} from "@cantiara/api/work-lifecycle";
import { createRouterClient } from "@orpc/server";
import { describe, expect, test, vi } from "vitest";

import {
  WorkChecklistConvertPreviewRequiredError,
  WorkChecklistItemTitleTooLongError,
  WorkClosureResultRequiredError,
  WorkFeatureExitBlockedError,
  WorkInclusionConflictError,
  WorkProjectNotFoundError,
  WorkTypeImpactPreviewRequiredError,
} from "./work-lifecycle";

const work: WorkProfile = {
  archivedAt: null,
  captureProvenance: null,
  checklist: [],
  closureReason: null,
  closureResult: null,
  createdAt: "2026-09-18T09:00:00.000Z",
  description: null,
  effort: null,
  featureHealthHistory: [],
  id: "work-1",
  key: "CANT-1",
  number: 1,
  primaryFeatureId: null,
  primarySpecId: null,
  projectId: "project-1",
  recreatedFrom: null,
  revision: 1,
  status: "Not Started",
  targetDate: null,
  title: "Create the first Work",
  type: "Task",
  updatedAt: "2026-09-18T09:00:00.000Z",
};

function createWorkLifecycleStub(
  overrides: Partial<WorkLifecycleAccess> = {},
): WorkLifecycleAccess {
  return {
    archive: vi.fn(),
    bindOriginPosition: vi.fn(),
    close: vi.fn(),
    convertChecklistItem: vi.fn(),
    create: vi.fn(),
    detachFeatureHealthHistory: vi.fn(),
    detachIncludedWork: vi.fn(),
    featureProgress: vi.fn(),
    find: vi.fn(),
    includeWork: vi.fn(),
    list: vi.fn(),
    scopeTree: vi.fn(),
    merge: vi.fn(),
    previewClose: vi.fn(),
    previewChecklistConversion: vi.fn(),
    previewMerge: vi.fn(),
    previewRecreate: vi.fn(),
    previewTypeChange: vi.fn(),
    recordFeatureHealth: vi.fn(),
    replayBindOriginPosition: vi.fn(),
    reopen: vi.fn(),
    updateFeaturePrimarySpec: vi.fn(),
    updateChecklist: vi.fn(),
    updateStatus: vi.fn(),
    updateType: vi.fn(),
    unarchive: vi.fn(),
    recreate: vi.fn(),
    resolve: vi.fn(),
    undoMerge: vi.fn(),
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
    const scopeTree = vi.fn().mockResolvedValue({
      features: [],
      project: { id: "project-1", name: "Payment App" },
    });
    const reopen = vi.fn().mockResolvedValue({
      ...work,
      status: "In Progress",
    });
    const updateStatus = vi.fn().mockResolvedValue({
      ...work,
      status: "In Progress",
    });
    const previewRecreate = vi.fn().mockResolvedValue({
      fields: [],
      previewId: "work-recreate:preview-1",
      relations: [],
      sourceWork: {
        id: work.id,
        key: work.key,
        revision: work.revision,
        title: work.title,
      },
      targetProject: { id: "project-2", name: "Second Project" },
    });
    const recreate = vi.fn().mockResolvedValue({
      ...work,
      id: "work-2",
      key: "SECOND-1",
      projectId: "project-2",
      recreatedFrom: { id: work.id, key: work.key },
    });
    const previewMerge = vi.fn().mockResolvedValue({
      duplicateWork: {
        id: "work-duplicate",
        key: "CANT-2",
        revision: 1,
        title: "Duplicate Work",
      },
      fields: [],
      previewId: "work-merge:preview-1",
      relations: [],
      survivingWork: {
        id: work.id,
        key: work.key,
        revision: work.revision,
        title: work.title,
      },
    });
    const merge = vi.fn().mockResolvedValue({
      mergeId: "merge-1",
      receiptId: "receipt-1",
      retiredIdentity: {
        id: "work-duplicate",
        key: "CANT-2",
        kind: "Retired identity",
        origin: { id: "work-duplicate", key: "CANT-2" },
        projectId: work.projectId,
        retiredAt: work.updatedAt,
        survivingWork: {
          id: work.id,
          key: work.key,
          title: work.title,
        },
      },
      work,
    });
    const resolve = vi.fn().mockResolvedValue({ kind: "Active", work });
    const undoMerge = vi.fn().mockResolvedValue(work);
    const updateChecklist = vi.fn().mockResolvedValue({
      ...work,
      checklist: [
        { completed: false, id: "checklist-item-1", text: "Draft copy" },
      ],
    });
    const checklistConversionPreview = {
      item: { id: "checklist-item-1", text: "Draft copy" },
      newWork: {
        projectId: work.projectId,
        status: "Not Started" as const,
        title: "Draft copy",
        type: "Task" as const,
      },
      originPosition: {
        componentId: "checklist-item-1",
        ownerRecordId: work.id,
        sourceVersion: String(work.revision),
      },
      previewId: "work-checklist-convert:preview-1",
      sourceWork: {
        id: work.id,
        key: work.key,
        revision: work.revision,
        title: work.title,
      },
      targetProject: { id: work.projectId, name: "Payment App" },
    };
    const convertChecklistItem = vi.fn().mockResolvedValue({
      sourceWork: {
        ...work,
        checklist: [
          {
            completed: true,
            convertedWork: {
              id: "work-2",
              key: "CANT-2",
              title: "Draft copy",
            },
            id: "checklist-item-1",
            text: "Draft copy",
          },
        ],
      },
      work: {
        ...work,
        id: "work-2",
        key: "CANT-2",
        originPosition: checklistConversionPreview.originPosition,
        title: "Draft copy",
      },
    });
    const workLifecycle = createWorkLifecycleStub({
      archive,
      close,
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
      list,
      scopeTree,
      merge,
      previewClose: vi.fn().mockResolvedValue({
        closureCheck: {
          activeBlockers: [],
          incompleteChecklistItems: [],
        },
        lastingContext: null,
        workId: work.id,
      }),
      previewChecklistConversion: vi
        .fn()
        .mockResolvedValue(checklistConversionPreview),
      previewRecreate,
      previewMerge,
      previewTypeChange: vi.fn().mockResolvedValue({
        currentType: "Task",
        featureExitBlockers: null,
        nextType: "Bug",
        previewId: "work-type-impact-work-1-1-Task-Bug",
        requiresImpactPreview: false,
        workId: work.id,
      }),
      recordFeatureHealth: vi.fn().mockResolvedValue(work),
      recreate,
      resolve,
      updateFeaturePrimarySpec: vi.fn().mockResolvedValue(work),
      updateChecklist,
      convertChecklistItem,
      reopen,
      updateStatus,
      updateType: vi.fn().mockResolvedValue({ ...work, type: "Bug" }),
      unarchive,
      undoMerge,
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
    await expect(client.scopeTree({ projectId: "project-1" })).resolves.toEqual(
      {
        features: [],
        project: { id: "project-1", name: "Payment App" },
      },
    );
    await client.projectWorks({ archived: "all", projectId: "project-1" });
    expect(list).toHaveBeenLastCalledWith("account-1", "project-1", {
      archived: "all",
    });
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
    expect(scopeTree).toHaveBeenCalledWith("account-1", "project-1");
    await expect(
      client.workTypeChangePreview({ type: "Bug", workId: work.id }),
    ).resolves.toMatchObject({ requiresImpactPreview: false });
    await expect(
      client.workRecreatePreview({
        sourceWorkId: work.id,
        targetProjectId: "project-2",
      }),
    ).resolves.toMatchObject({ previewId: "work-recreate:preview-1" });
    await expect(
      client.recreateWork({
        baseRevision: 0,
        clientIdempotencyKey: "recreate-1",
        previewId: "work-recreate:preview-1",
        selectedFields: ["title", "type"],
        selectedRelationIds: [],
        sourceWorkId: work.id,
        targetProjectId: "project-2",
      }),
    ).resolves.toMatchObject({ key: "SECOND-1" });
    expect(previewRecreate).toHaveBeenCalledWith("account-1", {
      sourceWorkId: work.id,
      targetProjectId: "project-2",
    });
    expect(recreate).toHaveBeenCalledWith("account-1", {
      baseRevision: 0,
      clientIdempotencyKey: "recreate-1",
      previewId: "work-recreate:preview-1",
      selectedFields: ["title", "type"],
      selectedRelationIds: [],
      sourceWorkId: work.id,
      targetProjectId: "project-2",
    });
    await expect(
      client.workMergePreview({
        duplicateWorkId: "work-duplicate",
        survivingWorkId: work.id,
      }),
    ).resolves.toMatchObject({ previewId: "work-merge:preview-1" });
    await expect(
      client.mergeWork({
        baseRevision: work.revision,
        clientIdempotencyKey: "merge-1",
        duplicateRevision: 1,
        duplicateWorkId: "work-duplicate",
        fieldResolutions: {},
        previewId: "work-merge:preview-1",
        survivingWorkId: work.id,
      }),
    ).resolves.toMatchObject({ mergeId: "merge-1" });
    await expect(
      client.resolveWorkIdentity({ workId: "work-duplicate" }),
    ).resolves.toMatchObject({ kind: "Active" });
    await expect(
      client.undoWorkMerge({
        baseRevision: work.revision,
        clientIdempotencyKey: "undo-merge-1",
        mergeId: "merge-1",
        survivingWorkId: work.id,
      }),
    ).resolves.toEqual(work);
    expect(previewMerge).toHaveBeenCalledWith("account-1", {
      duplicateWorkId: "work-duplicate",
      survivingWorkId: work.id,
    });
    expect(merge).toHaveBeenCalledWith("account-1", {
      baseRevision: work.revision,
      clientIdempotencyKey: "merge-1",
      duplicateRevision: 1,
      duplicateWorkId: "work-duplicate",
      fieldResolutions: {},
      previewId: "work-merge:preview-1",
      survivingWorkId: work.id,
    });
    expect(resolve).toHaveBeenCalledWith("account-1", {
      workId: "work-duplicate",
    });
    expect(undoMerge).toHaveBeenCalledWith("account-1", {
      baseRevision: work.revision,
      clientIdempotencyKey: "undo-merge-1",
      mergeId: "merge-1",
      survivingWorkId: work.id,
    });
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
    await expect(
      client.updateWorkStatus({
        baseRevision: work.revision,
        clientIdempotencyKey: "work-status-1",
        status: "In Progress",
        workId: work.id,
      }),
    ).resolves.toMatchObject({ status: "In Progress" });
    await expect(
      client.updateWorkChecklist({
        baseRevision: work.revision,
        checklist: [
          { completed: false, id: "checklist-item-1", text: "Draft copy" },
        ],
        clientIdempotencyKey: "work-checklist-1",
        workId: work.id,
      }),
    ).resolves.toMatchObject({
      checklist: [
        { completed: false, id: "checklist-item-1", text: "Draft copy" },
      ],
    });
    await expect(
      client.workChecklistConversionPreview({
        itemId: "checklist-item-1",
        workId: work.id,
      }),
    ).resolves.toMatchObject({
      newWork: { status: "Not Started", title: "Draft copy" },
      previewId: "work-checklist-convert:preview-1",
    });
    await expect(
      client.convertWorkChecklistItem({
        baseRevision: work.revision,
        clientIdempotencyKey: "work-checklist-convert-1",
        itemId: "checklist-item-1",
        previewId: "work-checklist-convert:preview-1",
        workId: work.id,
      }),
    ).resolves.toMatchObject({
      sourceWork: {
        checklist: [
          {
            convertedWork: { id: "work-2", key: "CANT-2" },
            id: "checklist-item-1",
          },
        ],
      },
      work: { id: "work-2", key: "CANT-2" },
    });
    expect(workLifecycle.previewChecklistConversion).toHaveBeenCalledWith(
      "account-1",
      {
        itemId: "checklist-item-1",
        workId: work.id,
      },
    );
    expect(convertChecklistItem).toHaveBeenCalledWith("account-1", {
      baseRevision: work.revision,
      clientIdempotencyKey: "work-checklist-convert-1",
      itemId: "checklist-item-1",
      previewId: "work-checklist-convert:preview-1",
      workId: work.id,
    });
    expect(updateChecklist).toHaveBeenCalledWith("account-1", {
      baseRevision: work.revision,
      checklist: [
        { completed: false, id: "checklist-item-1", text: "Draft copy" },
      ],
      clientIdempotencyKey: "work-checklist-1",
      workId: work.id,
    });
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

  test("maps a stale checklist conversion preview to a precondition response", async () => {
    const workLifecycle = createWorkLifecycleStub({
      convertChecklistItem: vi
        .fn()
        .mockRejectedValue(new WorkChecklistConvertPreviewRequiredError()),
    });
    const client = createRouterClient(appRouter, {
      context: createContext(workLifecycle),
    });

    await expect(
      client.convertWorkChecklistItem({
        baseRevision: 1,
        clientIdempotencyKey: "stale-checklist-convert",
        itemId: "checklist-item-1",
        previewId: "work-checklist-convert:stale",
        workId: work.id,
      }),
    ).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
      data: { code: "WORK_CHECKLIST_CONVERT_PREVIEW_REQUIRED" },
      status: 412,
    });
  });

  test("maps an over-long checklist item title to a bad-request response", async () => {
    const workLifecycle = createWorkLifecycleStub({
      previewChecklistConversion: vi
        .fn()
        .mockRejectedValue(new WorkChecklistItemTitleTooLongError()),
    });
    const client = createRouterClient(appRouter, {
      context: createContext(workLifecycle),
    });

    await expect(
      client.workChecklistConversionPreview({
        itemId: "checklist-item-1",
        workId: work.id,
      }),
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
      data: { code: "WORK_CHECKLIST_ITEM_TITLE_TOO_LONG" },
      status: 400,
    });
  });

  test("maps blocked Feature exit details to a precondition response", async () => {
    const blockers = {
      featureHealthUpdateCount: 1,
      hasPrimarySpec: true,
      includedWorkCount: 2,
    };
    const workLifecycle = createWorkLifecycleStub({
      updateType: vi
        .fn()
        .mockRejectedValue(new WorkFeatureExitBlockedError(blockers)),
    });
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

  test("preserves typed Work errors wrapped by the database apply boundary", async () => {
    const workLifecycle = createWorkLifecycleStub({
      includeWork: vi.fn().mockRejectedValue({
        cause: new WorkInclusionConflictError(
          "Only a Feature can include Work.",
        ),
        code: "APPLY_FAILED",
      }),
    });
    const client = createRouterClient(appRouter, {
      context: createContext(workLifecycle),
    });

    await expect(
      client.includeWork({
        baseRevision: 1,
        clientIdempotencyKey: "wrapped-inclusion-conflict",
        featureId: "feature-1",
        workId: work.id,
      }),
    ).rejects.toMatchObject({
      code: "CONFLICT",
      data: { code: "WORK_INCLUSION_CONFLICT" },
      status: 409,
    });

    const blockedWorkLifecycle = createWorkLifecycleStub({
      updateType: vi.fn().mockRejectedValue({
        cause: new WorkFeatureExitBlockedError({
          featureHealthUpdateCount: 0,
          hasPrimarySpec: false,
          includedWorkCount: 1,
        }),
        code: "APPLY_FAILED",
      }),
    });
    const blockedClient = createRouterClient(appRouter, {
      context: createContext(blockedWorkLifecycle),
    });

    await expect(
      blockedClient.updateWorkType({
        baseRevision: 1,
        clientIdempotencyKey: "wrapped-feature-exit-block",
        impactPreviewId: "preview-1",
        type: "Task",
        workId: work.id,
      }),
    ).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
      data: {
        blockers: {
          featureHealthUpdateCount: 0,
          hasPrimarySpec: false,
          includedWorkCount: 1,
        },
        code: "WORK_FEATURE_EXIT_BLOCKED",
      },
      status: 412,
    });
  });
});
