import type {
  MutationContract,
  MutationReceipt,
} from "@cantiara/api/mutation-and-undo";
import type {
  ProjectProfile,
  ProjectShellAccess,
} from "@cantiara/api/project-shell";
import type {
  WorkDraft,
  WorkDraftMutationValue,
  WorkDraftsAccess,
} from "@cantiara/api/work-drafts";
import type {
  WorkLifecycleAccess,
  WorkProfile,
} from "@cantiara/api/work-lifecycle";
import { describe, expect, test, vi } from "vitest";

import {
  createWorkDrafts,
  isFinalizationReservationStale,
  WORK_DRAFT_FINALIZATION_LEASE_MS,
  type WorkDraftFinalizationReservation,
  type WorkDraftRecord,
  type WorkDraftStore,
} from "./work-drafts";

const draft: WorkDraft = {
  checklist: [],
  customFieldValues: [],
  createdAt: "2026-09-19T09:00:00.000Z",
  description: null,
  id: "draft-1",
  projectId: "project-1",
  revision: 1,
  title: "Investigate payment failures",
  type: "Research",
  updatedAt: "2026-09-19T09:00:00.000Z",
};

const work: WorkProfile = {
  archivedAt: null,
  captureProvenance: null,
  checklist: [],
  closureReason: null,
  closureResult: null,
  createdAt: "2026-09-19T09:01:00.000Z",
  description: null,
  effort: null,
  featureHealthHistory: [],
  id: "work-1",
  key: "PAY-1",
  number: 1,
  primaryFeatureId: null,
  primarySpecId: null,
  projectId: "project-1",
  recreatedFrom: null,
  revision: 1,
  status: "Not Started",
  targetDate: null,
  title: draft.title,
  type: draft.type,
  updatedAt: "2026-09-19T09:01:00.000Z",
};

function createMemoryStore(
  initial: WorkDraft,
  { staleReservation = false }: { staleReservation?: boolean } = {},
): WorkDraftStore {
  const records = new Map<string, WorkDraftRecord>([
    [
      initial.id,
      {
        ...initial,
        consumedAt: null,
        finalizedWorkId: null,
        finalizingClientIdempotencyKey: null,
      },
    ],
  ]);

  const stampReservation = () =>
    staleReservation
      ? new Date(Date.now() - WORK_DRAFT_FINALIZATION_LEASE_MS * 2)
      : new Date();

  return {
    find: (_accountId, draftId) =>
      Promise.resolve(records.get(draftId) ?? null),
    list: (_accountId, projectId) =>
      Promise.resolve(
        [...records.values()].filter(
          (record) =>
            record.consumedAt === null &&
            (projectId === undefined || record.projectId === projectId),
        ),
      ),
    markConsumed: (_accountId, draftId, workId, consumedAt) => {
      const record = records.get(draftId);
      if (!record) {
        return Promise.resolve(null);
      }
      const consumed = {
        ...record,
        consumedAt,
        finalizedWorkId: workId,
      };
      records.set(draftId, consumed);
      return Promise.resolve(consumed);
    },
    releaseFinalization: (_accountId, draftId, clientIdempotencyKey) => {
      const record = records.get(draftId);
      if (record?.finalizingClientIdempotencyKey === clientIdempotencyKey) {
        records.set(draftId, {
          ...record,
          finalizingClientIdempotencyKey: null,
        });
      }
      return Promise.resolve();
    },
    reserveFinalization: (
      _accountId,
      draftId,
      clientIdempotencyKey,
    ): Promise<WorkDraftFinalizationReservation> => {
      const record = records.get(draftId);
      if (!record) {
        return Promise.resolve({ status: "not-found" });
      }
      if (record.consumedAt) {
        return Promise.resolve({ draft: record, status: "consumed" });
      }
      if (
        record.finalizingClientIdempotencyKey &&
        record.finalizingClientIdempotencyKey !== clientIdempotencyKey
      ) {
        if (isFinalizationReservationStale(record.updatedAt, new Date())) {
          const takenOver = {
            ...record,
            finalizingClientIdempotencyKey: clientIdempotencyKey,
            updatedAt: stampReservation().toISOString(),
          };
          records.set(draftId, takenOver);
          return Promise.resolve({ draft: takenOver, status: "reserved" });
        }
        return Promise.resolve({ draft: record, status: "finalizing" });
      }
      if (record.finalizingClientIdempotencyKey === clientIdempotencyKey) {
        return Promise.resolve({ draft: record, status: "reserved" });
      }
      const reserved = {
        ...record,
        finalizingClientIdempotencyKey: clientIdempotencyKey,
        updatedAt: stampReservation().toISOString(),
      };
      records.set(draftId, reserved);
      return Promise.resolve({ draft: reserved, status: "reserved" });
    },
  };
}

function createWorkLifecycleStub(): WorkLifecycleAccess {
  return {
    archive: vi.fn(),
    close: vi.fn(),
    create: vi.fn().mockResolvedValue(work),
    detachFeatureHealthHistory: vi.fn(),
    detachIncludedWork: vi.fn(),
    featureProgress: vi.fn(),
    find: vi.fn().mockResolvedValue(work),
    includeWork: vi.fn(),
    list: vi.fn(),
    merge: vi.fn(),
    previewClose: vi.fn(),
    previewMerge: vi.fn(),
    previewRecreate: vi.fn(),
    previewTypeChange: vi.fn(),
    recordFeatureHealth: vi.fn(),
    recreate: vi.fn(),
    reopen: vi.fn(),
    resolve: vi.fn(),
    scopeTree: vi.fn(),
    unarchive: vi.fn(),
    undoMerge: vi.fn(),
    updateFeaturePrimarySpec: vi.fn(),
    updateStatus: vi.fn(),
    updateType: vi.fn(),
  };
}

function createProjectShellStub(): Pick<ProjectShellAccess, "find"> {
  return {
    find: vi.fn().mockResolvedValue({ id: draft.projectId } as ProjectProfile),
  };
}

function expectNoWorkLifecycleCall(workLifecycle: WorkLifecycleAccess) {
  for (const [name, method] of Object.entries(workLifecycle)) {
    // biome-ignore lint/suspicious/noMisplacedAssertion: This helper is called only from test bodies.
    expect(method, name).not.toHaveBeenCalled();
  }
}

function createUnusedMutationContract(): MutationContract<{
  draft: WorkDraft | null;
}> {
  return {
    mutate: vi.fn(),
    replay: vi.fn().mockResolvedValue(null),
  } as unknown as MutationContract<{ draft: WorkDraft | null }>;
}

function createSavingMutationContract(): MutationContract<WorkDraftMutationValue> {
  return {
    mutate: vi.fn(async (command, apply) => {
      const nextValue = await apply({
        currentRevision: 0,
        currentValue: { draft: null },
        payload: command.payload,
      });
      return {
        actor: command.actor,
        committedAt: "2026-09-19T09:00:01.000Z",
        id: "receipt-1",
        nextValue,
        origin: {
          clientIdempotencyKey: command.clientIdempotencyKey,
          kind: "human",
        },
        payloadFingerprint: "0".repeat(64),
        previousValue: { draft: null },
        revision: 1,
        targetId: command.targetId,
      } satisfies MutationReceipt<WorkDraftMutationValue>;
    }),
    replay: vi.fn().mockResolvedValue(null),
  } as unknown as MutationContract<WorkDraftMutationValue>;
}

describe("Work Drafts", () => {
  test("does not save a Draft outside the account's Project scope", async () => {
    const store = createMemoryStore(draft);
    const workLifecycle = createWorkLifecycleStub();
    const workDrafts: WorkDraftsAccess = createWorkDrafts({
      mutationContract: createSavingMutationContract(),
      projects: {
        find: vi.fn().mockResolvedValue(null),
      },
      store,
      workLifecycle,
    });

    await expect(
      workDrafts.save("account-1", {
        baseRevision: 0,
        checklist: [],
        clientIdempotencyKey: "draft-save-outside-scope",
        description: null,
        draftId: "draft-new",
        projectId: "other-account-project",
        title: "A saved Draft",
        type: "Task",
      }),
    ).rejects.toMatchObject({ code: "WORK_DRAFT_PROJECT_NOT_FOUND" });
  });

  test("saves a Draft without creating a Work", async () => {
    const store = createMemoryStore(draft);
    const workLifecycle = createWorkLifecycleStub();
    const workDrafts: WorkDraftsAccess = createWorkDrafts({
      mutationContract: createSavingMutationContract(),
      projects: createProjectShellStub(),
      store,
      workLifecycle,
    });

    const saved = await workDrafts.save("account-1", {
      baseRevision: 0,
      checklist: [],
      clientIdempotencyKey: "draft-save-1",
      description: null,
      draftId: "draft-new",
      projectId: "project-1",
      title: "A saved Draft",
      type: "Task",
    });

    expect(saved.title).toBe("A saved Draft");
    expect(saved.revision).toBe(1);
    expectNoWorkLifecycleCall(workLifecycle);
  });

  test("deletes a Draft without creating or changing a Work", async () => {
    const store = createMemoryStore(draft);
    const workLifecycle = createWorkLifecycleStub();
    const workDrafts: WorkDraftsAccess = createWorkDrafts({
      mutationContract: createSavingMutationContract(),
      projects: createProjectShellStub(),
      store,
      workLifecycle,
    });

    await expect(
      workDrafts.delete("account-1", {
        baseRevision: draft.revision,
        clientIdempotencyKey: "draft-delete-1",
        draftId: draft.id,
      }),
    ).resolves.toEqual({ deleted: true });
    expectNoWorkLifecycleCall(workLifecycle);
  });

  test("finalizes one Work and consumes the Draft exactly once", async () => {
    const store = createMemoryStore(draft);
    const workLifecycle = createWorkLifecycleStub();
    const workDrafts: WorkDraftsAccess = createWorkDrafts({
      mutationContract: createUnusedMutationContract(),
      projects: createProjectShellStub(),
      store,
      workLifecycle,
    });
    const input = {
      baseRevision: draft.revision,
      clientIdempotencyKey: "draft-finalize-1",
      draftId: draft.id,
    } as const;

    await expect(workDrafts.finalize("account-1", input)).resolves.toEqual(
      work,
    );
    await expect(workDrafts.finalize("account-1", input)).resolves.toEqual(
      work,
    );
    await expect(workDrafts.find("account-1", draft.id)).resolves.toBeNull();
    await expect(
      workDrafts.finalize("account-1", {
        ...input,
        clientIdempotencyKey: "draft-finalize-2",
      }),
    ).rejects.toMatchObject({ code: "WORK_DRAFT_CONSUMED" });

    expect(workLifecycle.create).toHaveBeenCalledTimes(1);
  });

  test("writes Draft Custom field values after creating the Work", async () => {
    const draftWithCustomField: WorkDraft = {
      ...draft,
      customFieldValues: [
        {
          definitionId: "field-shipped",
          payload: { boolean: true, kind: "boolean" },
        },
      ],
    };
    const store = createMemoryStore(draftWithCustomField);
    const createWithCustomFieldValues = vi.fn().mockResolvedValue(work);
    const workLifecycle = {
      ...createWorkLifecycleStub(),
      createWithCustomFieldValues,
    };
    const workDrafts: WorkDraftsAccess = createWorkDrafts({
      mutationContract: createUnusedMutationContract(),
      projects: createProjectShellStub(),
      store,
      workLifecycle,
    });

    await expect(
      workDrafts.finalize("account-1", {
        baseRevision: draftWithCustomField.revision,
        clientIdempotencyKey: "draft-finalize-custom-field",
        draftId: draftWithCustomField.id,
      }),
    ).resolves.toEqual(work);

    expect(createWithCustomFieldValues).toHaveBeenCalledOnce();
    expect(createWithCustomFieldValues).toHaveBeenCalledWith(
      "account-1",
      {
        baseRevision: 0,
        checklist: [],
        clientIdempotencyKey: "work-draft:draft-1",
        description: null,
        projectId: "project-1",
        title: draft.title,
        type: draft.type,
      },
      draftWithCustomField.customFieldValues,
    );
  });

  test("takes over a stale finalization when Create is retried with a new key", async () => {
    const store = createMemoryStore(draft, { staleReservation: true });
    const workLifecycle = createWorkLifecycleStub();
    let createCalls = 0;
    // The first create hangs forever: the server died after the Work create
    // reservation but before the Draft could be consumed.
    workLifecycle.create = vi.fn(() => {
      const callNumber = createCalls;
      createCalls += 1;
      return callNumber === 0
        ? new Promise<WorkProfile>(() => undefined)
        : Promise.resolve(work);
    });
    const workDrafts: WorkDraftsAccess = createWorkDrafts({
      mutationContract: createUnusedMutationContract(),
      projects: createProjectShellStub(),
      store,
      workLifecycle,
    });
    const crashed = workDrafts.finalize("account-1", {
      baseRevision: draft.revision,
      clientIdempotencyKey: "draft-finalize-crash",
      draftId: draft.id,
    });
    crashed.catch(() => undefined);

    await expect(
      workDrafts.finalize("account-1", {
        baseRevision: draft.revision,
        clientIdempotencyKey: "draft-finalize-retry",
        draftId: draft.id,
      }),
    ).resolves.toEqual(work);
    await expect(workDrafts.find("account-1", draft.id)).resolves.toBeNull();
    // The production Work create replays through the draft-derived
    // idempotency key; this stub has no replay, so it is called twice.
    expect(workLifecycle.create).toHaveBeenCalledTimes(2);
  });

  test("keeps a live finalization exclusive against a different key", async () => {
    const store = createMemoryStore(draft);
    const workLifecycle = createWorkLifecycleStub();
    let releaseCreate: ((created: WorkProfile) => void) | undefined;
    workLifecycle.create = vi.fn(
      () =>
        new Promise<WorkProfile>((resolve) => {
          releaseCreate = resolve;
        }),
    );
    const workDrafts: WorkDraftsAccess = createWorkDrafts({
      mutationContract: createUnusedMutationContract(),
      projects: createProjectShellStub(),
      store,
      workLifecycle,
    });

    const inFlight = workDrafts.finalize("account-1", {
      baseRevision: draft.revision,
      clientIdempotencyKey: "draft-finalize-live",
      draftId: draft.id,
    });
    await vi.waitFor(() =>
      expect(workLifecycle.create).toHaveBeenCalledTimes(1),
    );

    await expect(
      workDrafts.finalize("account-1", {
        baseRevision: draft.revision,
        clientIdempotencyKey: "draft-finalize-other",
        draftId: draft.id,
      }),
    ).rejects.toMatchObject({ code: "WORK_DRAFT_FINALIZING" });

    releaseCreate?.(work);
    await expect(inFlight).resolves.toEqual(work);
  });

  test("deletes a Draft stuck in a stale finalization", async () => {
    const store = createMemoryStore(draft, { staleReservation: true });
    const workLifecycle = createWorkLifecycleStub();
    workLifecycle.create = vi.fn(
      () => new Promise<WorkProfile>(() => undefined),
    );
    const workDrafts: WorkDraftsAccess = createWorkDrafts({
      mutationContract: createSavingMutationContract(),
      projects: createProjectShellStub(),
      store,
      workLifecycle,
    });
    const crashed = workDrafts.finalize("account-1", {
      baseRevision: draft.revision,
      clientIdempotencyKey: "draft-finalize-crash",
      draftId: draft.id,
    });
    crashed.catch(() => undefined);

    await expect(
      workDrafts.delete("account-1", {
        baseRevision: draft.revision,
        clientIdempotencyKey: "draft-delete-retry",
        draftId: draft.id,
      }),
    ).resolves.toEqual({ deleted: true });
    // The stub contract does not touch the store; the heal itself must have
    // taken over and released the stale reservation.
    const healed = await store.find("account-1", draft.id);
    expect(healed?.finalizingClientIdempotencyKey).toBeNull();
  });

  test("resumes saving a Draft after a stale finalization is taken over", async () => {
    const store = createMemoryStore(draft, { staleReservation: true });
    const workLifecycle = createWorkLifecycleStub();
    workLifecycle.create = vi.fn(
      () => new Promise<WorkProfile>(() => undefined),
    );
    const workDrafts: WorkDraftsAccess = createWorkDrafts({
      mutationContract: createSavingMutationContract(),
      projects: createProjectShellStub(),
      store,
      workLifecycle,
    });
    const crashed = workDrafts.finalize("account-1", {
      baseRevision: draft.revision,
      clientIdempotencyKey: "draft-finalize-crash",
      draftId: draft.id,
    });
    crashed.catch(() => undefined);

    await expect(
      workDrafts.save("account-1", {
        baseRevision: draft.revision,
        checklist: [],
        clientIdempotencyKey: "draft-save-after-crash",
        description: null,
        draftId: draft.id,
        projectId: draft.projectId,
        title: draft.title,
        type: draft.type,
      }),
    ).resolves.toMatchObject({ id: draft.id, revision: 1 });
  });
});
