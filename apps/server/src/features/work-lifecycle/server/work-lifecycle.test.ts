import type {
  MutationApply,
  MutationCommand,
  MutationContract,
  MutationPayload,
  MutationReceipt,
} from "@cantiara/api/mutation-and-undo";
import { canonicalizeMutationPayload } from "@cantiara/api/mutation-and-undo";
import {
  type CreateWorkMutationInput,
  WORK_TYPE_OPTIONS,
  type WorkLifecycleMutationContracts,
  type WorkLifecycleMutationValue,
  type WorkProfile,
  type WorkRecreateField,
  type WorkRecreateRelation,
} from "@cantiara/api/work-lifecycle";
import { describe, expect, test } from "vitest";

import { MutationStaleBaseRevisionError } from "../../mutation-and-undo/server/mutation-contract";
import type { WorkRelations } from "../../relations/server/work-relations";
import {
  createWorkLifecycle,
  WorkClosureCheckRequiredError,
  type WorkClosureContext,
  WorkClosureResultRequiredError,
  WorkCreationConflictError,
  type WorkCreationReservation,
  WorkFeatureExitBlockedError,
  WorkInclusionConflictError,
  type WorkLifecycleStore,
  WorkPrimarySpecNotFoundError,
  WorkTypeImpactPreviewRequiredError,
  WorkVisibleUserInitiatorRequiredError,
} from "./work-lifecycle";

const PROJECT_ID = "project-1";
const VISIBLE_USER = { kind: "Visible user" } as const;

function createMemoryWorkLifecycle(
  options: {
    beforeUpdateApply?: (
      command: MutationCommand<MutationPayload>,
    ) => Promise<void>;
    closureContext?: WorkClosureContext;
    commitThenFailWithTitle?: string;
    enforceStaleRevision?: boolean;
    failNextCommit?: boolean;
    initialWorks?: WorkProfile[];
    projectDocuments?: ReadonlyArray<{ id: string; projectId: string }>;
    recreateRelations?: WorkRecreateRelation[];
    scopeTreeRelations?: ReadonlyArray<{
      id: string;
      kind: "Blocks" | "Contributes to Milestone";
      sourceProjectId: string;
      sourceWork: Pick<WorkProfile, "id" | "key" | "status" | "title" | "type">;
      targetLabel: string;
      targetRecordId: string;
    }>;
  } = {},
) {
  const works = new Map(
    options.initialWorks?.map((work) => [work.id, work] as const),
  );
  const reservations = new Map<string, WorkCreationReservation>();
  const updateReceipts = new Map<
    string,
    {
      payload: string;
      receipt: MutationReceipt<WorkLifecycleMutationValue>;
    }
  >();
  const {
    beforeUpdateApply,
    commitThenFailWithTitle: configuredCommitThenFailWithTitle,
    enforceStaleRevision = true,
    failNextCommit: configuredFailNextCommit,
    projectDocuments = [],
    recreateRelations = [],
    scopeTreeRelations = [],
  } = options;
  const projectDocumentIds = new Map(
    projectDocuments.map(({ id, projectId }) => [id, projectId]),
  );
  const nextNumberByProject = new Map<string, number>();
  let commitThenFailWithTitle = configuredCommitThenFailWithTitle;
  let failNextCommit = configuredFailNextCommit ?? false;

  const store: WorkLifecycleStore = {
    find: async (_accountId, workId) => works.get(workId) ?? null,
    findProject: (_accountId, projectId) => {
      const projects = new Map([
        [PROJECT_ID, "Cantiara"],
        ["project-2", "Second Project"],
      ]);
      const name = projects.get(projectId);
      return Promise.resolve(name ? { id: projectId, name } : null);
    },
    findByClientIdempotencyKey: (_accountId, projectId, key) => {
      const reservation = reservations.get(`${projectId}:${key}`);
      return Promise.resolve(
        reservation && works.has(reservation.workId)
          ? {
              payloadFingerprint: reservation.payloadFingerprint,
              work: works.get(reservation.workId) as WorkProfile,
            }
          : null,
      );
    },
    list: async (_accountId, projectId, listOptions) =>
      [...works.values()]
        .filter(
          (work) =>
            work.projectId === projectId &&
            (work.archivedAt !== null) === (listOptions?.archived ?? false),
        )
        .sort((left, right) => left.number - right.number),
    listIncluded: async (_accountId, featureId) =>
      [...works.values()]
        .filter((work) => work.primaryFeatureId === featureId)
        .sort((left, right) => left.number - right.number),
    hasProjectDocument: async (_accountId, projectId, documentId) =>
      projectDocumentIds.get(documentId) === projectId,
    reserveCreate: (_accountId, projectId, key, payloadFingerprint) => {
      const reservationKey = `${projectId}:${key}`;
      const existing = reservations.get(reservationKey);
      if (existing) {
        if (existing.payloadFingerprint !== payloadFingerprint) {
          return Promise.reject(new WorkCreationConflictError());
        }
        return Promise.resolve(existing);
      }

      const number = nextNumberByProject.get(projectId) ?? 1;
      nextNumberByProject.set(projectId, number + 1);
      const shortCode = projectId === "project-2" ? "SECOND" : "CANT";
      const reservation: WorkCreationReservation = {
        id: `${projectId}-work-${number}`,
        key: `${shortCode}-${number}`,
        number,
        payloadFingerprint,
        projectId,
        shortCode,
        workId: `${projectId}-work-${number}`,
      };
      reservations.set(reservationKey, reservation);
      return Promise.resolve(reservation);
    },
  };

  const relations: WorkRelations = {
    listRecreateRelations: async () => recreateRelations,
    listScopeTreeRelations: async () => scopeTreeRelations,
  };

  const mutationContracts: WorkLifecycleMutationContracts = {
    create: () =>
      ({
        replay: async () => null,
        mutate: async <TPayload extends MutationPayload>(
          command: MutationCommand<TPayload>,
          apply: MutationApply<WorkLifecycleMutationValue, TPayload>,
        ) => {
          if (command.kind !== "human") {
            throw new Error("Expected a human Work command.");
          }
          if (failNextCommit) {
            failNextCommit = false;
            throw new Error("simulated commit failure");
          }
          const nextValue = await apply({
            currentRevision: 0,
            currentValue: { work: null },
            payload: command.payload,
          });
          if (!nextValue.work) {
            throw new Error("A Work create must return a Work.");
          }
          works.set(nextValue.work.id, nextValue.work);
          if (commitThenFailWithTitle) {
            works.set(nextValue.work.id, {
              ...nextValue.work,
              title: commitThenFailWithTitle,
            });
            commitThenFailWithTitle = undefined;
            throw new Error("simulated commit failure after durable write");
          }
          return {
            actor: command.actor,
            committedAt: nextValue.work.createdAt,
            id: `receipt-${nextValue.work.id}`,
            nextValue,
            origin: {
              clientIdempotencyKey: command.clientIdempotencyKey,
              kind: "human" as const,
            },
            payloadFingerprint: "0".repeat(64),
            previousValue: { work: null },
            revision: 1,
            targetId: command.targetId,
          } satisfies MutationReceipt<WorkLifecycleMutationValue>;
        },
      }) as MutationContract<WorkLifecycleMutationValue>,
    update: () =>
      ({
        replay: <TPayload extends MutationPayload>(
          command: MutationCommand<TPayload>,
        ) => {
          if (command.kind !== "human") {
            throw new Error("Expected a human Work command.");
          }
          return Promise.resolve(
            updateReceipts.get(
              `${command.actor.actorId}:${command.targetId}:${command.clientIdempotencyKey}`,
            )?.receipt ?? null,
          );
        },
        mutate: async <TPayload extends MutationPayload>(
          command: MutationCommand<TPayload>,
          apply: MutationApply<WorkLifecycleMutationValue, TPayload>,
        ) => {
          if (command.kind !== "human") {
            throw new Error("Expected a human Work command.");
          }
          const receiptKey = `${command.actor.actorId}:${command.targetId}:${command.clientIdempotencyKey}`;
          const payload = canonicalizeMutationPayload(command.payload);
          const existing = updateReceipts.get(receiptKey);
          if (existing) {
            if (existing.payload !== payload) {
              throw new WorkInclusionConflictError(
                "The Work mutation payload does not match its existing receipt.",
              );
            }
            return Promise.resolve(existing.receipt);
          }
          await beforeUpdateApply?.(command);
          const currentWork = works.get(command.targetId) ?? null;
          const previousValue = { work: currentWork };
          if (
            enforceStaleRevision &&
            currentWork &&
            command.baseRevision !== currentWork.revision
          ) {
            throw new MutationStaleBaseRevisionError({
              id: command.targetId,
              revision: currentWork.revision,
              value: previousValue,
            });
          }
          const nextValue = await apply({
            currentRevision: currentWork?.revision ?? 0,
            currentValue: previousValue,
            payload: command.payload,
          });
          if (!nextValue.work) {
            throw new Error("A Work update must return a Work.");
          }
          works.set(nextValue.work.id, nextValue.work);
          const receipt = {
            actor: command.actor,
            committedAt: nextValue.work.updatedAt,
            id: `receipt-${nextValue.work.id}-${nextValue.work.revision}`,
            nextValue,
            origin: {
              clientIdempotencyKey: command.clientIdempotencyKey,
              kind: "human" as const,
            },
            payloadFingerprint: "0".repeat(64),
            previousValue,
            revision: nextValue.work.revision,
            targetId: command.targetId,
          } satisfies MutationReceipt<WorkLifecycleMutationValue>;
          updateReceipts.set(receiptKey, { payload, receipt });
          return receipt;
        },
      }) as MutationContract<WorkLifecycleMutationValue>,
  };

  return createWorkLifecycle({
    closureContext: options.closureContext
      ? { get: async () => options.closureContext as WorkClosureContext }
      : undefined,
    mutationContracts,
    relations,
    store,
  });
}

function createInput(
  clientIdempotencyKey: string,
  values: Partial<CreateWorkMutationInput> = {},
): CreateWorkMutationInput {
  return {
    baseRevision: 0,
    clientIdempotencyKey,
    projectId: PROJECT_ID,
    title: "Ship the first Work",
    ...values,
  };
}

describe("Work Lifecycle seam", () => {
  test("allows only one primary Feature to include a Work", async () => {
    const workLifecycle = createMemoryWorkLifecycle();
    const firstFeature = await workLifecycle.create(
      "account-1",
      createInput("first-feature", { title: "First Feature", type: "Feature" }),
    );
    const secondFeature = await workLifecycle.create(
      "account-1",
      createInput("second-feature", {
        title: "Second Feature",
        type: "Feature",
      }),
    );
    const includedWork = await workLifecycle.create(
      "account-1",
      createInput("included-work", { title: "Included Work" }),
    );

    await expect(
      workLifecycle.includeWork("account-1", {
        baseRevision: includedWork.revision,
        clientIdempotencyKey: "include-in-first-feature",
        featureId: firstFeature.id,
        workId: includedWork.id,
      }),
    ).resolves.toMatchObject({ primaryFeatureId: firstFeature.id });

    await expect(
      workLifecycle.includeWork("account-1", {
        baseRevision: includedWork.revision + 1,
        clientIdempotencyKey: "include-in-second-feature",
        featureId: secondFeature.id,
        workId: includedWork.id,
      }),
    ).rejects.toBeInstanceOf(WorkInclusionConflictError);
  });

  test("refuses nested Feature inclusion", async () => {
    const workLifecycle = createMemoryWorkLifecycle();
    const parentFeature = await workLifecycle.create(
      "account-1",
      createInput("parent-feature", {
        title: "Parent Feature",
        type: "Feature",
      }),
    );
    const childFeature = await workLifecycle.create(
      "account-1",
      createInput("child-feature", {
        title: "Child Feature",
        type: "Feature",
      }),
    );

    await expect(
      workLifecycle.includeWork("account-1", {
        baseRevision: childFeature.revision,
        clientIdempotencyKey: "nested-feature",
        featureId: parentFeature.id,
        workId: childFeature.id,
      }),
    ).rejects.toBeInstanceOf(WorkInclusionConflictError);

    const includedTask = await workLifecycle.create(
      "account-1",
      createInput("included-task-before-type-change", {
        title: "Included Task",
      }),
    );
    const included = await workLifecycle.includeWork("account-1", {
      baseRevision: includedTask.revision,
      clientIdempotencyKey: "include-task-before-type-change",
      featureId: parentFeature.id,
      workId: includedTask.id,
    });
    const preview = await workLifecycle.previewTypeChange("account-1", {
      type: "Feature",
      workId: included.id,
    });
    if (!preview) {
      throw new Error("Expected a Feature type-change preview.");
    }

    await expect(
      workLifecycle.updateType("account-1", {
        baseRevision: included.revision,
        clientIdempotencyKey: "nested-feature-type-change",
        impactPreviewId: preview.previewId,
        type: "Feature",
        workId: included.id,
      }),
    ).rejects.toBeInstanceOf(WorkInclusionConflictError);
  });

  test("keeps included Work independent and derives progress without changing Feature status", async () => {
    const workLifecycle = createMemoryWorkLifecycle();
    const feature = await workLifecycle.create(
      "account-1",
      createInput("progress-feature", {
        title: "Progress Feature",
        type: "Feature",
      }),
    );
    const includedWork = await workLifecycle.create(
      "account-1",
      createInput("progress-work", {
        title: "Independent Bug",
        type: "Bug",
      }),
    );

    const included = await workLifecycle.includeWork("account-1", {
      baseRevision: includedWork.revision,
      clientIdempotencyKey: "include-progress-work",
      featureId: feature.id,
      workId: includedWork.id,
    });
    expect(included).toMatchObject({
      closureResult: includedWork.closureResult,
      id: includedWork.id,
      key: includedWork.key,
      primaryFeatureId: feature.id,
      projectId: includedWork.projectId,
      status: includedWork.status,
      title: includedWork.title,
      type: includedWork.type,
    });

    await expect(
      workLifecycle.featureProgress("account-1", feature.id),
    ).resolves.toEqual({
      includedWorkCount: 1,
      statusCounts: {
        Blocked: 0,
        Closed: 0,
        "In Progress": 0,
        "Not Started": 1,
      },
    });
    await expect(
      workLifecycle.find("account-1", feature.id),
    ).resolves.toMatchObject({ status: "Not Started" });
  });

  test("derives a read-only Scope Tree from primary inclusion and source relations", async () => {
    const scopeTreeRelations: Array<{
      id: string;
      kind: "Blocks" | "Contributes to Milestone";
      sourceProjectId: string;
      sourceWork: Pick<WorkProfile, "id" | "key" | "status" | "title" | "type">;
      targetLabel: string;
      targetRecordId: string;
    }> = [];
    const workLifecycle = createMemoryWorkLifecycle({ scopeTreeRelations });
    const feature = await workLifecycle.create(
      "account-1",
      createInput("scope-tree-feature", {
        title: "Checkout Feature",
        type: "Feature",
      }),
    );
    const includedWork = await workLifecycle.create(
      "account-1",
      createInput("scope-tree-included", {
        title: "Verify provider callback",
        type: "Task",
      }),
    );
    const blocker = await workLifecycle.create(
      "account-1",
      createInput("scope-tree-blocker", {
        projectId: "project-2",
        title: "Wait for provider access",
        type: "Research",
      }),
    );
    const blockedBlocker = await workLifecycle.updateStatus(
      "account-1",
      {
        baseRevision: blocker.revision,
        clientIdempotencyKey: "scope-tree-blocker-status",
        status: "Blocked",
        workId: blocker.id,
      },
      VISIBLE_USER,
    );
    const unrelatedWork = await workLifecycle.create(
      "account-1",
      createInput("scope-tree-unrelated", {
        title: "Unscoped Work",
        type: "Task",
      }),
    );

    await workLifecycle.includeWork("account-1", {
      baseRevision: includedWork.revision,
      clientIdempotencyKey: "scope-tree-include",
      featureId: feature.id,
      workId: includedWork.id,
    });
    scopeTreeRelations.push(
      {
        id: "scope-tree-blocks",
        kind: "Blocks",
        sourceProjectId: "project-2",
        sourceWork: {
          id: blockedBlocker.id,
          key: blockedBlocker.key,
          status: blockedBlocker.status,
          title: blockedBlocker.title,
          type: blockedBlocker.type,
        },
        targetLabel: includedWork.key,
        targetRecordId: includedWork.id,
      },
      {
        id: "scope-tree-milestone",
        kind: "Contributes to Milestone",
        sourceProjectId: PROJECT_ID,
        sourceWork: {
          id: includedWork.id,
          key: includedWork.key,
          status: includedWork.status,
          title: includedWork.title,
          type: includedWork.type,
        },
        targetLabel: "Private beta",
        targetRecordId: "milestone-1",
      },
    );

    await expect(
      workLifecycle.scopeTree("account-1", PROJECT_ID),
    ).resolves.toEqual({
      features: [
        {
          blockers: [],
          includedWork: [
            {
              blockers: [
                {
                  id: blocker.id,
                  key: blocker.key,
                  label: blocker.title,
                  projectId: "project-2",
                },
              ],
              milestones: [
                { id: "milestone-1", key: null, label: "Private beta" },
              ],
              work: {
                id: includedWork.id,
                key: includedWork.key,
                status: includedWork.status,
                title: includedWork.title,
                type: includedWork.type,
              },
            },
          ],
          milestones: [],
          progress: {
            includedWorkCount: 1,
            statusCounts: {
              Blocked: 0,
              Closed: 0,
              "In Progress": 0,
              "Not Started": 1,
            },
          },
          work: {
            id: feature.id,
            key: feature.key,
            status: feature.status,
            title: feature.title,
            type: feature.type,
          },
        },
      ],
      project: { id: PROJECT_ID, name: "Cantiara" },
    });

    const tree = await workLifecycle.scopeTree("account-1", PROJECT_ID);
    expect(tree.features[0]?.includedWork[0]?.work.id).toBe(includedWork.id);
    expect(tree.features.flatMap((node) => node.includedWork)).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          work: expect.objectContaining({ id: unrelatedWork.id }),
        }),
      ]),
    );
  });

  test("records Feature health only on the Feature without changing status or progress", async () => {
    const workLifecycle = createMemoryWorkLifecycle();
    const feature = await workLifecycle.create(
      "account-1",
      createInput("health-feature", {
        title: "Healthy Feature",
        type: "Feature",
      }),
    );

    const updated = await workLifecycle.recordFeatureHealth("account-1", {
      baseRevision: feature.revision,
      clientIdempotencyKey: "record-feature-health",
      featureId: feature.id,
      health: "At Risk",
      reason: "The external dependency is uncertain.",
    });

    expect(updated).toMatchObject({ status: "Not Started" });
    expect(updated.featureHealthHistory).toEqual([
      expect.objectContaining({
        health: "At Risk",
        reason: "The external dependency is uncertain.",
        recordedByAccountId: "account-1",
      }),
    ]);
    await expect(
      workLifecycle.featureProgress("account-1", feature.id),
    ).resolves.toEqual({
      includedWorkCount: 0,
      statusCounts: {
        Blocked: 0,
        Closed: 0,
        "In Progress": 0,
        "Not Started": 0,
      },
    });
  });

  test("records concurrent Feature health updates in chronological order", async () => {
    let releaseFirst!: () => void;
    let signalFirstStarted!: () => void;
    const firstStarted = new Promise<void>((resolve) => {
      signalFirstStarted = resolve;
    });
    const firstRelease = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    const workLifecycle = createMemoryWorkLifecycle({
      beforeUpdateApply: async (command) => {
        if (
          command.kind === "human" &&
          command.clientIdempotencyKey === "health-first"
        ) {
          signalFirstStarted();
          await firstRelease;
        }
      },
      enforceStaleRevision: false,
    });
    const feature = await workLifecycle.create(
      "account-1",
      createInput("chronological-health-feature", {
        title: "Chronological health Feature",
        type: "Feature",
      }),
    );

    const firstUpdate = workLifecycle.recordFeatureHealth("account-1", {
      baseRevision: feature.revision,
      clientIdempotencyKey: "health-first",
      featureId: feature.id,
      health: "At Risk",
      reason: "The first update is still being applied.",
    });
    await firstStarted;
    await new Promise((resolve) => setTimeout(resolve, 5));
    const secondUpdate = await workLifecycle.recordFeatureHealth("account-1", {
      baseRevision: feature.revision,
      clientIdempotencyKey: "health-second",
      featureId: feature.id,
      health: "On Track",
      reason: "The second update commits first.",
    });
    releaseFirst();
    const firstResult = await firstUpdate;

    expect(firstResult.featureHealthHistory).toHaveLength(2);
    const [firstHistoryEntry, secondHistoryEntry] =
      firstResult.featureHealthHistory;
    if (!(firstHistoryEntry && secondHistoryEntry)) {
      throw new Error("Expected two Feature health updates.");
    }
    expect(
      new Date(secondHistoryEntry.recordedAt).getTime(),
    ).toBeGreaterThanOrEqual(new Date(firstHistoryEntry.recordedAt).getTime());
    expect(secondUpdate.featureHealthHistory).toMatchObject([
      { health: "On Track" },
    ]);
  });

  test("blocks leaving Feature until included Work is explicitly detached", async () => {
    const workLifecycle = createMemoryWorkLifecycle();
    const feature = await workLifecycle.create(
      "account-1",
      createInput("exit-feature", { title: "Exit Feature", type: "Feature" }),
    );
    const includedWork = await workLifecycle.create(
      "account-1",
      createInput("exit-included-work", { title: "Included Work" }),
    );
    await workLifecycle.includeWork("account-1", {
      baseRevision: includedWork.revision,
      clientIdempotencyKey: "include-before-exit",
      featureId: feature.id,
      workId: includedWork.id,
    });

    const blockedPreview = await workLifecycle.previewTypeChange("account-1", {
      type: "Task",
      workId: feature.id,
    });
    expect(blockedPreview).toMatchObject({
      featureExitBlockers: {
        featureHealthUpdateCount: 0,
        hasPrimarySpec: false,
        includedWorkCount: 1,
      },
    });
    if (!blockedPreview) {
      throw new Error("Expected a Feature exit preview.");
    }
    await expect(
      workLifecycle.updateType("account-1", {
        baseRevision: feature.revision,
        clientIdempotencyKey: "blocked-feature-exit",
        impactPreviewId: blockedPreview.previewId,
        type: "Task",
        workId: feature.id,
      }),
    ).rejects.toBeInstanceOf(WorkFeatureExitBlockedError);

    await workLifecycle.detachIncludedWork("account-1", {
      baseRevision: includedWork.revision + 1,
      clientIdempotencyKey: "detach-before-exit",
      featureId: feature.id,
      workId: includedWork.id,
    });
    const clearPreview = await workLifecycle.previewTypeChange("account-1", {
      type: "Task",
      workId: feature.id,
    });
    expect(clearPreview).toMatchObject({
      featureExitBlockers: {
        featureHealthUpdateCount: 0,
        hasPrimarySpec: false,
        includedWorkCount: 0,
      },
    });
    if (!clearPreview) {
      throw new Error("Expected a clear Feature exit preview.");
    }
    await expect(
      workLifecycle.updateType("account-1", {
        baseRevision: feature.revision,
        clientIdempotencyKey: "allowed-feature-exit",
        impactPreviewId: clearPreview.previewId,
        type: "Task",
        workId: feature.id,
      }),
    ).resolves.toMatchObject({ type: "Task" });
  });

  test("blocks leaving Feature until health history and Primary spec are detached", async () => {
    const workLifecycle = createMemoryWorkLifecycle({
      projectDocuments: [{ id: "document-1", projectId: PROJECT_ID }],
    });
    const feature = await workLifecycle.create(
      "account-1",
      createInput("feature-data-exit", {
        title: "Feature with context",
        type: "Feature",
      }),
    );
    const withHealth = await workLifecycle.recordFeatureHealth("account-1", {
      baseRevision: feature.revision,
      clientIdempotencyKey: "health-before-exit",
      featureId: feature.id,
      health: "Off Track",
      reason: "The required evidence is missing.",
    });
    const withPrimarySpec = await workLifecycle.updateFeaturePrimarySpec(
      "account-1",
      {
        baseRevision: withHealth.revision,
        clientIdempotencyKey: "primary-spec-before-exit",
        featureId: feature.id,
        primarySpecId: "document-1",
      },
    );

    const blockedPreview = await workLifecycle.previewTypeChange("account-1", {
      type: "Improvement",
      workId: feature.id,
    });
    expect(blockedPreview).toMatchObject({
      featureExitBlockers: {
        featureHealthUpdateCount: 1,
        hasPrimarySpec: true,
        includedWorkCount: 0,
      },
    });
    if (!blockedPreview) {
      throw new Error("Expected a blocked Feature exit preview.");
    }
    await expect(
      workLifecycle.updateType("account-1", {
        baseRevision: withPrimarySpec.revision,
        clientIdempotencyKey: "blocked-context-exit",
        impactPreviewId: blockedPreview.previewId,
        type: "Improvement",
        workId: feature.id,
      }),
    ).rejects.toBeInstanceOf(WorkFeatureExitBlockedError);

    const withoutHealth = await workLifecycle.detachFeatureHealthHistory(
      "account-1",
      {
        baseRevision: withPrimarySpec.revision,
        clientIdempotencyKey: "detach-health-before-exit",
        featureId: feature.id,
      },
    );
    const withoutPrimarySpec = await workLifecycle.updateFeaturePrimarySpec(
      "account-1",
      {
        baseRevision: withoutHealth.revision,
        clientIdempotencyKey: "detach-primary-spec-before-exit",
        featureId: feature.id,
        primarySpecId: null,
      },
    );
    const clearPreview = await workLifecycle.previewTypeChange("account-1", {
      type: "Improvement",
      workId: feature.id,
    });
    expect(clearPreview?.featureExitBlockers).toEqual({
      featureHealthUpdateCount: 0,
      hasPrimarySpec: false,
      includedWorkCount: 0,
    });
    if (!clearPreview) {
      throw new Error("Expected a clear Feature exit preview.");
    }
    await expect(
      workLifecycle.updateType("account-1", {
        baseRevision: withoutPrimarySpec.revision,
        clientIdempotencyKey: "allowed-context-exit",
        impactPreviewId: clearPreview.previewId,
        type: "Improvement",
        workId: feature.id,
      }),
    ).resolves.toMatchObject({ type: "Improvement" });
  });

  test("rejects a Primary spec from another Project", async () => {
    const workLifecycle = createMemoryWorkLifecycle({
      projectDocuments: [{ id: "document-1", projectId: "project-2" }],
    });
    const feature = await workLifecycle.create(
      "account-1",
      createInput("cross-project-primary-spec", {
        title: "Feature with an invalid Primary spec",
        type: "Feature",
      }),
    );

    await expect(
      workLifecycle.updateFeaturePrimarySpec("account-1", {
        baseRevision: feature.revision,
        clientIdempotencyKey: "cross-project-primary-spec",
        featureId: feature.id,
        primarySpecId: "document-1",
      }),
    ).rejects.toBeInstanceOf(WorkPrimarySpecNotFoundError);
  });

  test("replays an inclusion after the Feature changes", async () => {
    const workLifecycle = createMemoryWorkLifecycle();
    const feature = await workLifecycle.create(
      "account-1",
      createInput("replay-feature", {
        title: "Replay Feature",
        type: "Feature",
      }),
    );
    const includedWork = await workLifecycle.create(
      "account-1",
      createInput("replay-included-work", { title: "Replay Work" }),
    );

    const included = await workLifecycle.includeWork("account-1", {
      baseRevision: includedWork.revision,
      clientIdempotencyKey: "replay-inclusion",
      featureId: feature.id,
      workId: includedWork.id,
    });
    await workLifecycle.detachIncludedWork("account-1", {
      baseRevision: included.revision,
      clientIdempotencyKey: "detach-replayed-inclusion",
      featureId: feature.id,
      workId: includedWork.id,
    });
    const preview = await workLifecycle.previewTypeChange("account-1", {
      type: "Task",
      workId: feature.id,
    });
    if (!preview) {
      throw new Error("Expected a Feature exit preview.");
    }
    await workLifecycle.updateType("account-1", {
      baseRevision: feature.revision,
      clientIdempotencyKey: "change-replayed-feature",
      impactPreviewId: preview.previewId,
      type: "Task",
      workId: feature.id,
    });

    await expect(
      workLifecycle.includeWork("account-1", {
        baseRevision: includedWork.revision,
        clientIdempotencyKey: "replay-inclusion",
        featureId: feature.id,
        workId: includedWork.id,
      }),
    ).resolves.toEqual(included);
  });

  test("creates a title-only Work with a stable key and protected defaults", async () => {
    const workLifecycle = createMemoryWorkLifecycle();

    await expect(
      workLifecycle.create("account-1", createInput("create-1")),
    ).resolves.toMatchObject({
      archivedAt: null,
      closureResult: null,
      key: "CANT-1",
      number: 1,
      projectId: PROJECT_ID,
      status: "Not Started",
      title: "Ship the first Work",
      type: "Task",
    });
  });

  test("archives and unarchives Work without changing identity or closure", async () => {
    const workLifecycle = createMemoryWorkLifecycle();
    const created = await workLifecycle.create(
      "account-1",
      createInput("archive-create"),
    );

    const archived = await workLifecycle.archive("account-1", {
      baseRevision: created.revision,
      clientIdempotencyKey: "archive-work",
      workId: created.id,
    });

    expect(archived).toMatchObject({
      closureResult: null,
      id: created.id,
      key: created.key,
      status: "Not Started",
    });
    expect(archived.archivedAt).not.toBeNull();
    await expect(workLifecycle.list("account-1", PROJECT_ID)).resolves.toEqual(
      [],
    );
    await expect(
      workLifecycle.list("account-1", PROJECT_ID, { archived: true }),
    ).resolves.toEqual([archived]);

    const unarchived = await workLifecycle.unarchive("account-1", {
      baseRevision: archived.revision,
      clientIdempotencyKey: "unarchive-work",
      workId: created.id,
    });

    expect(unarchived).toMatchObject({
      archivedAt: null,
      closureResult: null,
      id: created.id,
      key: created.key,
      status: "Not Started",
    });
    await expect(workLifecycle.list("account-1", PROJECT_ID)).resolves.toEqual([
      unarchived,
    ]);
  });

  test("keeps closed Work in the default list until it is explicitly archived", async () => {
    const closedWork: WorkProfile = {
      archivedAt: null,
      captureProvenance: null,
      checklist: [],
      closureReason: null,
      closureResult: "Completed",
      createdAt: "2026-09-18T09:00:00.000Z",
      description: null,
      featureHealthHistory: [],
      id: "closed-work",
      key: "CANT-7",
      number: 7,
      primaryFeatureId: null,
      primarySpecId: null,
      projectId: PROJECT_ID,
      recreatedFrom: null,
      revision: 3,
      status: "Closed",
      title: "Already completed Work",
      type: "Task",
      updatedAt: "2026-09-18T10:00:00.000Z",
    };
    const workLifecycle = createMemoryWorkLifecycle({
      initialWorks: [closedWork],
    });

    await expect(workLifecycle.list("account-1", PROJECT_ID)).resolves.toEqual([
      closedWork,
    ]);
    await expect(
      workLifecycle.list("account-1", PROJECT_ID, { archived: true }),
    ).resolves.toEqual([]);

    const archived = await workLifecycle.archive("account-1", {
      baseRevision: closedWork.revision,
      clientIdempotencyKey: "archive-closed-work",
      workId: closedWork.id,
    });
    expect(archived).toMatchObject({
      closureResult: "Completed",
      id: closedWork.id,
      key: closedWork.key,
      status: "Closed",
    });

    await expect(
      workLifecycle.unarchive("account-1", {
        baseRevision: archived.revision,
        clientIdempotencyKey: "unarchive-closed-work",
        workId: closedWork.id,
      }),
    ).resolves.toMatchObject({
      archivedAt: null,
      closureResult: "Completed",
      id: closedWork.id,
      key: closedWork.key,
      status: "Closed",
    });
  });

  test("rejects a stale archive command when Work is already archived", async () => {
    const workLifecycle = createMemoryWorkLifecycle();
    const created = await workLifecycle.create(
      "account-1",
      createInput("stale-archive-create"),
    );
    const archived = await workLifecycle.archive("account-1", {
      baseRevision: created.revision,
      clientIdempotencyKey: "stale-archive-first",
      workId: created.id,
    });

    await expect(
      workLifecycle.archive("account-1", {
        baseRevision: created.revision,
        clientIdempotencyKey: "stale-archive-retry",
        workId: created.id,
      }),
    ).rejects.toMatchObject({
      code: "STALE_BASE_REVISION",
      currentRevision: archived.revision,
    });
  });

  test("persists Capture provenance on the Work created by conversion", async () => {
    const workLifecycle = createMemoryWorkLifecycle();
    const captureProvenance = {
      attachment: { id: "staging-1", name: "screenshot.png" },
      captureId: "capture-1",
      capturedAt: "2026-09-16T09:00:00.000Z",
      content: "The preview is blank",
      fields: { "Observed Behavior": "Blank" },
      link: "https://example.com/issue",
      origin: { kind: "Web Capture", url: "https://example.com/issue" },
      template: "Bug Capture" as const,
    };

    await expect(
      workLifecycle.create(
        "account-1",
        createInput("create-from-capture", { captureProvenance }),
      ),
    ).resolves.toMatchObject({ captureProvenance });
  });

  test("accepts ordinary spaces in the title and stores the normalized value", async () => {
    const workLifecycle = createMemoryWorkLifecycle();

    await expect(
      workLifecycle.create(
        "account-1",
        createInput("create-spaces", { title: "  Work with spaces  " }),
      ),
    ).resolves.toMatchObject({ title: "Work with spaces" });
  });

  test.each(WORK_TYPE_OPTIONS)("accepts the %s Work type", async (type) => {
    const workLifecycle = createMemoryWorkLifecycle();

    await expect(
      workLifecycle.create(
        "account-1",
        createInput(`create-${type}`, { type }),
      ),
    ).resolves.toMatchObject({ type });
  });

  test("does not reuse an allocated number after a failed create", async () => {
    const workLifecycle = createMemoryWorkLifecycle({ failNextCommit: true });

    await expect(
      workLifecycle.create("account-1", createInput("failed-create")),
    ).rejects.toThrow("simulated commit failure");

    await expect(
      workLifecycle.create("account-1", createInput("successful-create")),
    ).resolves.toMatchObject({ key: "CANT-2", number: 2 });
  });

  test("rejects a different payload when retrying a failed allocation", async () => {
    const workLifecycle = createMemoryWorkLifecycle({ failNextCommit: true });
    const failedInput = createInput("failed-retry");

    await expect(
      workLifecycle.create("account-1", failedInput),
    ).rejects.toThrow("simulated commit failure");
    await expect(
      workLifecycle.create("account-1", {
        ...failedInput,
        title: "A different retry payload",
      }),
    ).rejects.toBeInstanceOf(WorkCreationConflictError);
  });

  test("replays the same Work for the same client idempotency key", async () => {
    const workLifecycle = createMemoryWorkLifecycle();
    const input = createInput("replay-create");

    const first = await workLifecycle.create("account-1", input);
    const replay = await workLifecycle.create("account-1", input);

    expect(replay).toEqual(first);
  });

  test("rejects a different payload for an existing client idempotency key", async () => {
    const workLifecycle = createMemoryWorkLifecycle();
    const input = createInput("conflicting-create");

    await workLifecycle.create("account-1", input);

    await expect(
      workLifecycle.create("account-1", {
        ...input,
        title: "A different Work title",
      }),
    ).rejects.toBeInstanceOf(WorkCreationConflictError);
  });

  test("rejects a different payload found after a failed mutation", async () => {
    const workLifecycle = createMemoryWorkLifecycle({
      commitThenFailWithTitle: "The committed title",
    });

    await expect(
      workLifecycle.create(
        "account-1",
        createInput("failed-replay", { title: "The requested title" }),
      ),
    ).rejects.toBeInstanceOf(WorkCreationConflictError);
  });

  test("updates non-Feature types freely and previews Feature boundaries", async () => {
    const workLifecycle = createMemoryWorkLifecycle();
    const work = await workLifecycle.create(
      "account-1",
      createInput("type-change-create"),
    );

    await expect(
      workLifecycle.previewTypeChange("account-1", {
        type: "Bug",
        workId: work.id,
      }),
    ).resolves.toMatchObject({
      currentType: "Task",
      nextType: "Bug",
      requiresImpactPreview: false,
    });
    await expect(
      workLifecycle.updateType("account-1", {
        baseRevision: work.revision,
        clientIdempotencyKey: "type-change-bug",
        type: "Bug",
        workId: work.id,
      }),
    ).resolves.toMatchObject({ type: "Bug" });

    const featurePreview = await workLifecycle.previewTypeChange("account-1", {
      type: "Feature",
      workId: work.id,
    });
    expect(featurePreview).toMatchObject({
      currentType: "Bug",
      nextType: "Feature",
      requiresImpactPreview: true,
    });
    if (!featurePreview) {
      throw new Error("Expected a Feature type-change preview.");
    }

    await expect(
      workLifecycle.updateType("account-1", {
        baseRevision: 2,
        clientIdempotencyKey: "type-change-feature-without-preview",
        type: "Feature",
        workId: work.id,
      }),
    ).rejects.toBeInstanceOf(WorkTypeImpactPreviewRequiredError);

    const feature = await workLifecycle.updateType("account-1", {
      baseRevision: 2,
      clientIdempotencyKey: "type-change-feature",
      impactPreviewId: featurePreview.previewId,
      type: "Feature",
      workId: work.id,
    });
    expect(feature).toMatchObject({ revision: 3, type: "Feature" });

    /* The Feature boundary also protects the exit path. */
    await expect(
      workLifecycle.previewTypeChange("account-1", {
        type: "Task",
        workId: work.id,
      }),
    ).resolves.toMatchObject({
      currentType: "Feature",
      nextType: "Task",
      requiresImpactPreview: true,
    });

    expect(feature.type).toBe("Feature");
  });

  test.each([
    ["Not Started", "In Progress"],
    ["Not Started", "Blocked"],
    ["In Progress", "Not Started"],
    ["In Progress", "Blocked"],
    ["Blocked", "Not Started"],
    ["Blocked", "In Progress"],
  ] as const)(
    "moves freely from %s to %s without a closure result",
    async (_currentStatus, nextStatus) => {
      const workLifecycle = createMemoryWorkLifecycle();
      let work = await workLifecycle.create(
        "account-1",
        createInput(`status-${nextStatus}-create`),
      );

      if (_currentStatus !== "Not Started") {
        work = await workLifecycle.updateStatus(
          "account-1",
          {
            baseRevision: work.revision,
            clientIdempotencyKey: `status-${_currentStatus}`,
            status: _currentStatus,
            workId: work.id,
          },
          VISIBLE_USER,
        );
      }

      await expect(
        workLifecycle.updateStatus(
          "account-1",
          {
            baseRevision: work.revision,
            clientIdempotencyKey: `status-${nextStatus}`,
            status: nextStatus,
            workId: work.id,
          },
          VISIBLE_USER,
        ),
      ).resolves.toMatchObject({
        closureReason: null,
        closureResult: null,
        status: nextStatus,
      });
    },
  );

  test("rejects Closed when a planning-style status write skips the close step", async () => {
    const workLifecycle = createMemoryWorkLifecycle();
    const work = await workLifecycle.create(
      "account-1",
      createInput("planning-close-create"),
    );

    await expect(
      workLifecycle.updateStatus(
        "account-1",
        {
          baseRevision: work.revision,
          clientIdempotencyKey: "planning-close",
          status: "Closed",
          workId: work.id,
        },
        VISIBLE_USER,
      ),
    ).rejects.toBeInstanceOf(WorkClosureResultRequiredError);
    await expect(
      workLifecycle.find("account-1", work.id),
    ).resolves.toMatchObject({
      closureResult: null,
      status: "Not Started",
    });
  });

  test("does not let planning membership write a non-terminal status", async () => {
    const workLifecycle = createMemoryWorkLifecycle();
    const work = await workLifecycle.create(
      "account-1",
      createInput("planning-membership-create"),
    );

    await expect(
      workLifecycle.updateStatus(
        "account-1",
        {
          baseRevision: work.revision,
          clientIdempotencyKey: "planning-membership-status",
          status: "In Progress",
          workId: work.id,
        },
        { kind: "Planning membership" } as never,
      ),
    ).rejects.toBeInstanceOf(WorkVisibleUserInitiatorRequiredError);
    await expect(
      workLifecycle.find("account-1", work.id),
    ).resolves.toMatchObject({ status: "Not Started" });
  });

  test.each(["GitHub", "System automation"])(
    "does not let %s silently write a closure result",
    async (kind) => {
      const workLifecycle = createMemoryWorkLifecycle();
      const work = await workLifecycle.create(
        "account-1",
        createInput(`silent-close-${kind}`),
      );

      await expect(
        workLifecycle.close(
          "account-1",
          {
            baseRevision: work.revision,
            clientIdempotencyKey: `silent-close-${kind}`,
            closureResult: "Completed",
            workId: work.id,
          },
          { kind } as never,
        ),
      ).rejects.toBeInstanceOf(WorkVisibleUserInitiatorRequiredError);
      await expect(
        workLifecycle.find("account-1", work.id),
      ).resolves.toMatchObject({
        closureResult: null,
        status: "Not Started",
      });
    },
  );

  test.each(["Completed", "Abandoned"] as const)(
    "closes Work explicitly with the %s result and an optional reason",
    async (closureResult) => {
      const workLifecycle = createMemoryWorkLifecycle();
      const work = await workLifecycle.create(
        "account-1",
        createInput(`close-${closureResult}-create`),
      );

      await expect(
        workLifecycle.close(
          "account-1",
          {
            baseRevision: work.revision,
            clientIdempotencyKey: `close-${closureResult}`,
            closureResult,
            reason: "The founder made an explicit closure decision.",
            workId: work.id,
          },
          VISIBLE_USER,
        ),
      ).resolves.toMatchObject({
        closureReason: "The founder made an explicit closure decision.",
        closureResult,
        status: "Closed",
      });
    },
  );

  test("replays a close for the same client idempotency key", async () => {
    const workLifecycle = createMemoryWorkLifecycle();
    const work = await workLifecycle.create(
      "account-1",
      createInput("close-replay-create"),
    );
    const input = {
      baseRevision: work.revision,
      clientIdempotencyKey: "close-replay",
      closureResult: "Completed" as const,
      workId: work.id,
    };

    const first = await workLifecycle.close("account-1", input, VISIBLE_USER);

    await expect(
      workLifecycle.close("account-1", input, VISIBLE_USER),
    ).resolves.toEqual(first);
  });

  test("requires a closure result for every explicit close", async () => {
    const workLifecycle = createMemoryWorkLifecycle();
    const work = await workLifecycle.create(
      "account-1",
      createInput("close-without-result-create"),
    );

    await expect(
      workLifecycle.close(
        "account-1",
        {
          baseRevision: work.revision,
          clientIdempotencyKey: "close-without-result",
          workId: work.id,
        } as never,
        VISIBLE_USER,
      ),
    ).rejects.toThrow();
  });

  test("previews close without changing status and reopen requires a non-terminal target", async () => {
    const workLifecycle = createMemoryWorkLifecycle();
    const work = await workLifecycle.create(
      "account-1",
      createInput("close-cancel-create"),
    );

    await expect(
      workLifecycle.previewClose("account-1", { workId: work.id }),
    ).resolves.toMatchObject({ workId: work.id });
    await expect(
      workLifecycle.find("account-1", work.id),
    ).resolves.toMatchObject({ status: "Not Started" });

    const closed = await workLifecycle.close(
      "account-1",
      {
        baseRevision: work.revision,
        clientIdempotencyKey: "close-before-reopen",
        closureResult: "Completed",
        reason: "Released",
        workId: work.id,
      },
      VISIBLE_USER,
    );
    await expect(
      workLifecycle.reopen(
        "account-1",
        {
          baseRevision: closed.revision,
          clientIdempotencyKey: "reopen-to-blocked",
          confirmed: true,
          status: "Blocked",
          workId: work.id,
        },
        VISIBLE_USER,
      ),
    ).resolves.toMatchObject({
      closureReason: null,
      closureResult: null,
      status: "Blocked",
    });
  });

  test.each(["Not Started", "In Progress", "Blocked"] as const)(
    "reopens Closed Work explicitly as %s",
    async (status) => {
      const workLifecycle = createMemoryWorkLifecycle();
      const work = await workLifecycle.create(
        "account-1",
        createInput(`reopen-${status}-create`),
      );
      const closed = await workLifecycle.close(
        "account-1",
        {
          baseRevision: work.revision,
          clientIdempotencyKey: `reopen-${status}-close`,
          closureResult: "Completed",
          workId: work.id,
        },
        VISIBLE_USER,
      );

      await expect(
        workLifecycle.reopen(
          "account-1",
          {
            baseRevision: closed.revision,
            clientIdempotencyKey: `reopen-${status}`,
            confirmed: true,
            status,
            workId: work.id,
          },
          VISIBLE_USER,
        ),
      ).resolves.toMatchObject({
        closureReason: null,
        closureResult: null,
        status,
      });
    },
  );

  test("replays a reopen for the same client idempotency key", async () => {
    const workLifecycle = createMemoryWorkLifecycle();
    const work = await workLifecycle.create(
      "account-1",
      createInput("reopen-replay-create"),
    );
    const closed = await workLifecycle.close(
      "account-1",
      {
        baseRevision: work.revision,
        clientIdempotencyKey: "reopen-replay-close",
        closureResult: "Completed",
        workId: work.id,
      },
      VISIBLE_USER,
    );
    const input = {
      baseRevision: closed.revision,
      clientIdempotencyKey: "reopen-replay",
      confirmed: true as const,
      status: "In Progress" as const,
      workId: work.id,
    };

    const first = await workLifecycle.reopen("account-1", input, VISIBLE_USER);

    await expect(
      workLifecycle.reopen("account-1", input, VISIBLE_USER),
    ).resolves.toEqual(first);
  });

  test("shows a non-blocking Closure check and closes through Close anyway", async () => {
    const workLifecycle = createMemoryWorkLifecycle({
      closureContext: {
        activeBlockers: [{ id: "blocker-1", label: "PAY-9 blocks this Work" }],
        incompleteChecklistItems: [
          { id: "check-1", label: "Verify the migration" },
        ],
        lastingContextSources: [],
      },
    });
    const work = await workLifecycle.create(
      "account-1",
      createInput("closure-check-create"),
    );

    await expect(
      workLifecycle.previewClose("account-1", { workId: work.id }),
    ).resolves.toMatchObject({
      closureCheck: {
        activeBlockers: [{ id: "blocker-1" }],
        incompleteChecklistItems: [{ id: "check-1" }],
      },
    });
    await expect(
      workLifecycle.close(
        "account-1",
        {
          baseRevision: work.revision,
          clientIdempotencyKey: "closure-check-without-choice",
          closureResult: "Abandoned",
          workId: work.id,
        },
        VISIBLE_USER,
      ),
    ).rejects.toBeInstanceOf(WorkClosureCheckRequiredError);
    await expect(
      workLifecycle.close(
        "account-1",
        {
          baseRevision: work.revision,
          clientIdempotencyKey: "closure-check-close-anyway",
          closureCheck: "Close anyway",
          closureResult: "Abandoned",
          workId: work.id,
        },
        VISIBLE_USER,
      ),
    ).resolves.toMatchObject({
      closureResult: "Abandoned",
      status: "Closed",
    });
  });

  test("recreates selected portable content with a new identity and target key", async () => {
    const relation: WorkRecreateRelation = {
      id: "relation-1",
      kind: "Related",
      label: "Related",
      portable: true,
      targetLabel: "CANT-9",
      targetProjectName: "Cantiara",
      targetRecordId: "work-9",
    };
    const workLifecycle = createMemoryWorkLifecycle({
      recreateRelations: [relation],
    });
    const source = await workLifecycle.create(
      "account-1",
      createInput("recreate-source", {
        checklist: [
          { completed: true, id: "item-1", text: "Confirm the problem" },
        ],
        description: "Keep this context",
        type: "Bug",
      }),
    );
    const preview = await workLifecycle.previewRecreate("account-1", {
      sourceWorkId: source.id,
      targetProjectId: "project-2",
    });

    expect(preview).toMatchObject({
      sourceWork: { id: source.id, key: source.key },
      targetProject: { id: "project-2", name: "Second Project" },
    });
    const recreated = await workLifecycle.recreate("account-1", {
      baseRevision: 0,
      clientIdempotencyKey: "recreate-confirm",
      previewId: preview?.previewId ?? "missing-preview",
      selectedFields: ["title", "description", "checklist"],
      selectedRelationIds: [relation.id],
      sourceWorkId: source.id,
      targetProjectId: "project-2",
    });

    expect(recreated).toMatchObject({
      checklist: source.checklist,
      description: source.description,
      key: "SECOND-1",
      projectId: "project-2",
      recreatedFrom: { id: source.id, key: source.key },
      title: source.title,
      type: "Task",
    });
    expect(recreated.id).not.toBe(source.id);
    await expect(workLifecycle.find("account-1", source.id)).resolves.toEqual(
      source,
    );
  });

  test("includes selected relations in recreate idempotency", async () => {
    const relation: WorkRecreateRelation = {
      id: "relation-2",
      kind: "Related",
      label: "Related",
      portable: true,
      targetLabel: "CANT-10",
      targetProjectName: "Cantiara",
      targetRecordId: "work-10",
    };
    const workLifecycle = createMemoryWorkLifecycle({
      recreateRelations: [relation],
    });
    const source = await workLifecycle.create(
      "account-1",
      createInput("recreate-idempotency-source"),
    );
    const preview = await workLifecycle.previewRecreate("account-1", {
      sourceWorkId: source.id,
      targetProjectId: "project-2",
    });
    if (!preview) {
      throw new Error("Expected a recreate preview.");
    }
    const input = {
      baseRevision: 0 as const,
      clientIdempotencyKey: "recreate-idempotency",
      previewId: preview.previewId,
      selectedFields: ["title"] as WorkRecreateField[],
      selectedRelationIds: [] as string[],
      sourceWorkId: source.id,
      targetProjectId: "project-2",
    };
    await workLifecycle.recreate("account-1", input);

    await expect(
      workLifecycle.recreate("account-1", {
        ...input,
        selectedRelationIds: [relation.id],
      }),
    ).rejects.toBeInstanceOf(WorkCreationConflictError);
  });

  test("previews lasting context destinations without generating text or blocking close", async () => {
    const workLifecycle = createMemoryWorkLifecycle({
      closureContext: {
        activeBlockers: [],
        incompleteChecklistItems: [],
        lastingContextSources: [
          { id: "note-1", label: "Payment retry learning" },
        ],
      },
    });
    const work = await workLifecycle.create(
      "account-1",
      createInput("lasting-context-create"),
    );

    await expect(
      workLifecycle.previewClose("account-1", { workId: work.id }),
    ).resolves.toMatchObject({
      lastingContext: {
        commands: [
          { generatedText: null, target: "Decision" },
          { generatedText: null, target: "Personal Wiki" },
        ],
        sources: [{ id: "note-1" }],
      },
    });
    await expect(
      workLifecycle.close(
        "account-1",
        {
          baseRevision: work.revision,
          clientIdempotencyKey: "lasting-context-close",
          closureResult: "Completed",
          workId: work.id,
        },
        VISIBLE_USER,
      ),
    ).resolves.toMatchObject({ status: "Closed" });
  });
});
