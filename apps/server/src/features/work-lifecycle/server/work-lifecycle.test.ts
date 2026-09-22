import type {
  MutationApply,
  MutationCommand,
  MutationContract,
  MutationPayload,
  MutationReceipt,
  MutationUndoApply,
} from "@cantiara/api/mutation-and-undo";
import { canonicalizeMutationPayload } from "@cantiara/api/mutation-and-undo";
import {
  type CreateWorkMutationInput,
  WORK_TYPE_OPTIONS,
  type WorkLifecycleMutationContracts,
  type WorkLifecycleMutationValue,
  type WorkMergeInclusionSnapshot,
  type WorkMergeRelationSnapshot,
  type WorkProfile,
  type WorkRecreateField,
  type WorkRecreateRelation,
  type WorkRetiredIdentity,
  workChecklistItemSchema,
} from "@cantiara/api/work-lifecycle";
import { describe, expect, test } from "vitest";

import { MutationStaleBaseRevisionError } from "../../mutation-and-undo/server/mutation-contract";
import type {
  WorkRelations,
  WorkRelationsMutationAdapter,
} from "../../relations/server/work-relations";
import {
  createWorkLifecycle,
  WorkChecklistConversionRequiredError,
  WorkChecklistConvertPreviewRequiredError,
  WorkClosureCheckRequiredError,
  type WorkClosureContext,
  WorkClosureResultRequiredError,
  WorkCreationConflictError,
  type WorkCreationReservation,
  WorkFeatureExitBlockedError,
  WorkInclusionConflictError,
  type WorkLifecycleStore,
  WorkMergePreviewRequiredError,
  WorkMergeResolutionRequiredError,
  WorkPrimarySpecNotFoundError,
  WorkTypeImpactPreviewRequiredError,
  WorkVisibleUserInitiatorRequiredError,
} from "./work-lifecycle";

const PROJECT_ID = "project-1";
const VISIBLE_USER = { kind: "Visible user" } as const;
const WORK_MERGE_PREVIEW_PATTERN = /^work-merge:/;
const WORK_CHECKLIST_CONVERT_PREVIEW_PATTERN = /^work-checklist-convert:/;

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
    mergeInclusions?: WorkMergeInclusionSnapshot[];
    mergeRelations?: WorkMergeRelationSnapshot[];
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
  const retiredIdentities = new Map<
    string,
    { id: string; key: string; projectId: string; survivingWorkId: string }
  >();
  const mergeInclusions = options.mergeInclusions ?? [];
  const mergeRelations = options.mergeRelations ?? [];
  const updateReceipts = new Map<
    string,
    {
      payload: string;
      receipt: MutationReceipt<WorkLifecycleMutationValue>;
    }
  >();
  const receiptsById = new Map<
    string,
    MutationReceipt<WorkLifecycleMutationValue>
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
    findByKey: async (_accountId, projectId, key) =>
      [...works.values()].find(
        (work) => work.projectId === projectId && work.key === key,
      ) ?? null,
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
    findRetiredIdentity: (_accountId, input) => {
      const resolve = (identity?: {
        id: string;
        key: string;
        projectId: string;
        survivingWorkId: string;
      }) => {
        // The surviving Work is read live so a renamed survivor never serves
        // a stale title through the permanent redirect.
        const survivor = identity ? works.get(identity.survivingWorkId) : null;
        if (!(identity && survivor)) {
          return null;
        }
        return {
          id: identity.id,
          key: identity.key,
          kind: "Retired identity",
          origin: { id: identity.id, key: identity.key },
          projectId: identity.projectId,
          retiredAt: new Date(0).toISOString(),
          survivingWork: {
            id: survivor.id,
            key: survivor.key,
            title: survivor.title,
          },
        } satisfies WorkRetiredIdentity;
      };
      if ("workId" in input) {
        return Promise.resolve(resolve(retiredIdentities.get(input.workId)));
      }
      return Promise.resolve(
        resolve(
          [...retiredIdentities.values()].find(
            (identity) =>
              identity.projectId === input.projectId &&
              identity.key === input.key,
          ),
        ),
      );
    },
    listRetiredIdentityIdsBySurvivor: (_accountId, survivingWorkId) =>
      Promise.resolve(
        [...retiredIdentities.values()]
          .filter((identity) => identity.survivingWorkId === survivingWorkId)
          .map((identity) => identity.id)
          .sort(),
      ),
    list: async (_accountId, projectId, listOptions) =>
      [...works.values()]
        .filter(
          (work) =>
            work.projectId === projectId &&
            (listOptions?.archived === "all" ||
              (work.archivedAt !== null) === (listOptions?.archived ?? false)),
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
    releaseCreate: (_accountId, projectId, key, workId) => {
      const reservationKey = `${projectId}:${key}`;
      const reservation = reservations.get(reservationKey);
      if (reservation?.workId === workId && !works.has(workId)) {
        reservations.delete(reservationKey);
      }
      return Promise.resolve();
    },
  };

  const relations = {
    listMergeInclusions: async () =>
      mergeInclusions.map((inclusion) => ({ ...inclusion })),
    listMergeRelations: async () =>
      mergeRelations.map((relation) => ({ ...relation })),
    listRecreateRelations: async () => recreateRelations,
    listScopeTreeRelations: async () => scopeTreeRelations,
    persistMergedRelations: (
      _executor,
      _committedAt,
      survivingWork,
      duplicateWorkId,
      relationsToMerge,
    ) => {
      for (const relation of relationsToMerge) {
        const sourceWorkId =
          relation.sourceWorkId === duplicateWorkId
            ? survivingWork.id
            : relation.sourceWorkId;
        const targetRecordId =
          relation.targetRecordId === duplicateWorkId
            ? survivingWork.id
            : relation.targetRecordId;
        if (
          sourceWorkId === survivingWork.id &&
          targetRecordId === survivingWork.id
        ) {
          const index = mergeRelations.findIndex(
            (candidate) => candidate.id === relation.id,
          );
          if (index >= 0) {
            mergeRelations.splice(index, 1);
          }
          continue;
        }
        const current = mergeRelations.find(
          (candidate) => candidate.id === relation.id,
        );
        if (current) {
          current.sourceWorkId = sourceWorkId;
          current.targetRecordId = targetRecordId;
          if (relation.targetRecordId === duplicateWorkId) {
            current.targetLabel = survivingWork.key;
          }
        }
      }
      return Promise.resolve();
    },
    persistMergedInclusions: (
      _executor,
      _committedAt,
      survivingWork,
      duplicateWorkId,
      inclusions,
    ) => {
      for (const inclusion of inclusions) {
        const child = works.get(inclusion.childWorkId);
        if (
          child?.primaryFeatureId !== duplicateWorkId ||
          child.revision !== inclusion.childWorkRevision
        ) {
          return Promise.resolve(false);
        }
        works.set(child.id, {
          ...child,
          primaryFeatureId: survivingWork.id,
          revision: child.revision + 1,
          updatedAt: new Date().toISOString(),
        });
      }
      return Promise.resolve(true);
    },
    restoreMergedRelations: (
      _executor,
      _committedAt,
      survivingWork,
      duplicateWorkId,
      relationsToRestore,
    ) => {
      for (const relation of relationsToRestore) {
        const mergedSourceWorkId =
          relation.sourceWorkId === duplicateWorkId
            ? survivingWork.id
            : relation.sourceWorkId;
        const mergedTargetRecordId =
          relation.targetRecordId === duplicateWorkId
            ? survivingWork.id
            : relation.targetRecordId;
        const currentIndex = mergeRelations.findIndex(
          (candidate) => candidate.id === relation.id,
        );
        const current =
          currentIndex >= 0 ? mergeRelations[currentIndex] : undefined;
        if (!current) {
          if (relation.removedByMerge) {
            mergeRelations.push({ ...relation });
          }
          continue;
        }
        if (
          current.sourceWorkId === mergedSourceWorkId &&
          current.targetRecordId === mergedTargetRecordId &&
          current.targetLabel ===
            (relation.targetRecordId === duplicateWorkId
              ? survivingWork.key
              : relation.targetLabel)
        ) {
          mergeRelations[currentIndex] = { ...relation };
        }
      }
      return Promise.resolve();
    },
    restoreMergedInclusions: (
      _executor,
      _committedAt,
      survivingWork,
      duplicateWorkId,
      inclusions,
    ) => {
      for (const inclusion of inclusions) {
        const child = works.get(inclusion.childWorkId);
        if (child?.primaryFeatureId !== survivingWork.id) {
          continue;
        }
        works.set(child.id, {
          ...child,
          primaryFeatureId: duplicateWorkId,
          revision: child.revision + 1,
          updatedAt: new Date().toISOString(),
        });
      }
      return Promise.resolve();
    },
  } as WorkRelations &
    Pick<
      WorkRelationsMutationAdapter,
      | "persistMergedInclusions"
      | "persistMergedRelations"
      | "restoreMergedInclusions"
      | "restoreMergedRelations"
    >;

  function undoMetadataFromOptions(mutationOptions: unknown) {
    if (!mutationOptions || typeof mutationOptions !== "object") {
      return;
    }
    let candidate: unknown;
    if ("kind" in mutationOptions) {
      candidate = mutationOptions;
    } else if ("undo" in mutationOptions) {
      candidate = mutationOptions.undo;
    }
    if (
      !candidate ||
      typeof candidate !== "object" ||
      !("kind" in candidate) ||
      candidate.kind !== "merge" ||
      !("merge" in candidate)
    ) {
      return;
    }
    return {
      after: {},
      afterPresent: true,
      before: {},
      beforePresent: true,
      kind: "merge" as const,
      merge: candidate.merge,
      scope: "$",
    } as MutationReceipt<WorkLifecycleMutationValue>["undo"];
  }

  async function applyMergedState(
    nextValue: WorkLifecycleMutationValue,
    committedAt: string,
  ) {
    if (nextValue.checklistConversion?.newWork) {
      works.set(
        nextValue.checklistConversion.newWork.id,
        nextValue.checklistConversion.newWork,
      );
    }
    if (!(nextValue.work && nextValue.merge)) {
      if (nextValue.work) {
        works.set(nextValue.work.id, nextValue.work);
      }
      return;
    }
    if (nextValue.merge.operation === "merge") {
      works.set(nextValue.work.id, nextValue.work);
      works.delete(nextValue.merge.duplicateWorkId);
      retiredIdentities.set(nextValue.merge.duplicateWorkId, {
        id: nextValue.merge.duplicateWork.id,
        key: nextValue.merge.duplicateWork.key,
        projectId: nextValue.merge.duplicateWork.projectId,
        survivingWorkId: nextValue.work.id,
      });
      // Redirects that already pointed at the retired Work follow the new
      // survivor so chained merges keep every redirect permanent.
      for (const redirectId of nextValue.merge.retiredRedirectIds) {
        const redirect = retiredIdentities.get(redirectId);
        if (redirect?.survivingWorkId === nextValue.merge.duplicateWorkId) {
          redirect.survivingWorkId = nextValue.work.id;
        }
      }
      await relations.persistMergedRelations?.(
        undefined as never,
        new Date(committedAt),
        {
          id: nextValue.work.id,
          key: nextValue.work.key,
          projectId: nextValue.work.projectId,
        },
        nextValue.merge.duplicateWorkId,
        nextValue.merge.relations,
      );
      await relations.persistMergedInclusions?.(
        undefined as never,
        new Date(committedAt),
        {
          id: nextValue.work.id,
          key: nextValue.work.key,
          projectId: nextValue.work.projectId,
        },
        nextValue.merge.duplicateWorkId,
        nextValue.merge.inclusions,
      );
      return;
    }

    // The restored combination must satisfy the Feature exit contract: Work
    // included after the merge stays with the survivor, so reverting its type
    // away from Feature is blocked exactly like an explicit type change.
    const restoredChildIds = new Set(
      nextValue.merge.inclusions.map((inclusion) => inclusion.childWorkId),
    );
    const remainingIncludedWork = [...works.values()].filter(
      (candidate) =>
        candidate.primaryFeatureId === nextValue.work?.id &&
        !restoredChildIds.has(candidate.id),
    );
    if (
      nextValue.work &&
      nextValue.work.type !== "Feature" &&
      (remainingIncludedWork.length > 0 ||
        nextValue.work.featureHealthHistory.length > 0 ||
        nextValue.work.primarySpecId !== null)
    ) {
      throw new WorkFeatureExitBlockedError({
        featureHealthUpdateCount: nextValue.work.featureHealthHistory.length,
        hasPrimarySpec: nextValue.work.primarySpecId !== null,
        includedWorkCount: remainingIncludedWork.length,
      });
    }

    works.set(nextValue.work.id, nextValue.work);
    works.set(nextValue.merge.duplicateWork.id, {
      ...nextValue.merge.duplicateWork,
      revision: nextValue.merge.duplicateWork.revision + 1,
      updatedAt: committedAt,
    });
    retiredIdentities.delete(nextValue.merge.duplicateWorkId);
    // Redirects that this merge re-pointed to the survivor follow the
    // restored duplicate back.
    for (const redirectId of nextValue.merge.retiredRedirectIds) {
      const redirect = retiredIdentities.get(redirectId);
      if (redirect?.survivingWorkId === nextValue.work.id) {
        redirect.survivingWorkId = nextValue.merge.duplicateWorkId;
      }
    }
    await relations.restoreMergedRelations?.(
      undefined as never,
      new Date(committedAt),
      {
        id: nextValue.work.id,
        key: nextValue.work.key,
        projectId: nextValue.work.projectId,
      },
      nextValue.merge.duplicateWorkId,
      nextValue.merge.relations,
    );
    await relations.restoreMergedInclusions?.(
      undefined as never,
      new Date(committedAt),
      {
        id: nextValue.work.id,
        key: nextValue.work.key,
        projectId: nextValue.work.projectId,
      },
      nextValue.merge.duplicateWorkId,
      nextValue.merge.inclusions,
    );
  }

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
          mutationOptions?: unknown,
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
            undo: undoMetadataFromOptions(mutationOptions),
          } satisfies MutationReceipt<WorkLifecycleMutationValue>;
          await applyMergedState(nextValue, nextValue.work.updatedAt);
          updateReceipts.set(receiptKey, { payload, receipt });
          receiptsById.set(receipt.id, receipt);
          return receipt;
        },
        findReceiptById: async (receiptId: string) =>
          receiptsById.get(receiptId) ?? null,
        undo: async (
          sourceReceipt: MutationReceipt<WorkLifecycleMutationValue>,
          command: MutationCommand<MutationPayload>,
          applyUndo: MutationUndoApply<WorkLifecycleMutationValue>,
        ) => {
          if (!applyUndo || command.kind !== "human") {
            throw new Error(
              "A Work merge Undo requires a human apply callback.",
            );
          }
          const currentWork = works.get(command.targetId) ?? null;
          const nextValue = await applyUndo({
            currentRevision: currentWork?.revision ?? 0,
            currentValue: { work: currentWork },
            nextValue: sourceReceipt.nextValue,
            previousValue: sourceReceipt.previousValue,
            undo: sourceReceipt.undo as NonNullable<typeof sourceReceipt.undo>,
          });
          if (!nextValue.work) {
            throw new Error("A Work Undo must return a Work.");
          }
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
            previousValue: { work: currentWork },
            revision: nextValue.work.revision,
            targetId: command.targetId,
            undoOf: sourceReceipt.id,
          } satisfies MutationReceipt<WorkLifecycleMutationValue>;
          await applyMergedState(nextValue, nextValue.work.updatedAt);
          receiptsById.set(receipt.id, receipt);
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
  test("previews and atomically converts a checklist item into independent Work with exact origin", async () => {
    const workLifecycle = createMemoryWorkLifecycle();
    const sourceWork = await workLifecycle.create(
      "account-1",
      createInput("checklist-convert-source", {
        title: "Prepare the release",
      }),
    );
    const withChecklist = await workLifecycle.updateChecklist("account-1", {
      baseRevision: sourceWork.revision,
      checklist: [
        { completed: false, id: "item-1", text: "Publish the release" },
      ],
      clientIdempotencyKey: "checklist-convert-item",
      workId: sourceWork.id,
    });

    const preview = await workLifecycle.previewChecklistConversion(
      "account-1",
      { itemId: "item-1", workId: sourceWork.id },
    );

    expect(preview).toMatchObject({
      item: { id: "item-1", text: "Publish the release" },
      newWork: {
        projectId: PROJECT_ID,
        status: "Not Started",
        title: "Publish the release",
        type: "Task",
      },
      originPosition: {
        componentId: "item-1",
        ownerRecordId: sourceWork.id,
        sourceVersion: String(withChecklist.revision),
      },
      sourceWork: {
        id: sourceWork.id,
        key: sourceWork.key,
        revision: withChecklist.revision,
      },
      targetProject: { id: PROJECT_ID, name: "Cantiara" },
    });
    expect(preview?.previewId).toMatch(WORK_CHECKLIST_CONVERT_PREVIEW_PATTERN);
    await expect(
      workLifecycle.list("account-1", PROJECT_ID),
    ).resolves.toHaveLength(1);
    await expect(
      workLifecycle.find("account-1", sourceWork.id),
    ).resolves.toMatchObject({
      checklist: [
        { completed: false, id: "item-1", text: "Publish the release" },
      ],
      revision: withChecklist.revision,
    });

    if (!preview) {
      throw new Error("Expected a checklist conversion preview.");
    }

    await expect(
      workLifecycle.updateChecklist("account-1", {
        baseRevision: withChecklist.revision,
        checklist: [
          {
            completed: true,
            convertedWork: {
              id: "fake-work",
              key: "CANT-99",
              title: "Fake Work",
            },
            id: "item-1",
            text: "Publish the release",
          },
        ],
        clientIdempotencyKey: "checklist-convert-spoof",
        workId: sourceWork.id,
      }),
    ).rejects.toBeInstanceOf(WorkChecklistConversionRequiredError);

    await expect(
      workLifecycle.convertChecklistItem("account-1", {
        baseRevision: withChecklist.revision,
        clientIdempotencyKey: "checklist-convert-confirm",
        itemId: "item-1",
        previewId: "work-checklist-convert:stale",
        workId: sourceWork.id,
      }),
    ).rejects.toBeInstanceOf(WorkChecklistConvertPreviewRequiredError);

    const converted = await workLifecycle.convertChecklistItem("account-1", {
      baseRevision: withChecklist.revision,
      clientIdempotencyKey: "checklist-convert-confirm",
      itemId: "item-1",
      previewId: preview.previewId,
      workId: sourceWork.id,
    });

    expect(converted.work).toMatchObject({
      originPosition: {
        componentId: "item-1",
        ownerRecordId: sourceWork.id,
        sourceVersion: String(withChecklist.revision),
      },
      primaryFeatureId: null,
      projectId: PROJECT_ID,
      status: "Not Started",
      title: "Publish the release",
      type: "Task",
    });
    expect(converted.sourceWork).toMatchObject({
      checklist: [
        {
          completed: true,
          convertedWork: {
            id: converted.work.id,
            key: converted.work.key,
            title: converted.work.title,
          },
          id: "item-1",
        },
      ],
    });
    await expect(
      workLifecycle.list("account-1", PROJECT_ID),
    ).resolves.toHaveLength(2);

    await expect(
      workLifecycle.updateChecklist("account-1", {
        baseRevision: converted.sourceWork.revision,
        checklist: [
          {
            completed: true,
            id: "item-1",
            text: "Publish the release",
          },
        ],
        clientIdempotencyKey: "checklist-convert-remove-link",
        workId: sourceWork.id,
      }),
    ).rejects.toBeInstanceOf(WorkChecklistConversionRequiredError);

    await expect(
      workLifecycle.convertChecklistItem("account-1", {
        baseRevision: withChecklist.revision,
        clientIdempotencyKey: "checklist-convert-confirm",
        itemId: "item-1",
        previewId: preview.previewId,
        workId: sourceWork.id,
      }),
    ).resolves.toMatchObject({
      sourceWork: { id: sourceWork.id },
      work: { id: converted.work.id },
    });
  });

  test("previews an explicitly selected surviving Work without auto-merging similar titles", async () => {
    const workLifecycle = createMemoryWorkLifecycle();
    const survivingWork = await workLifecycle.create(
      "account-1",
      createInput("merge-survivor", {
        description: "The canonical payment failure flow.",
        title: "Investigate payment failures",
        type: "Research",
      }),
    );
    const duplicateWork = await workLifecycle.create(
      "account-1",
      createInput("merge-duplicate", {
        description: "The same payment failure flow from capture.",
        title: "Investigate payment failure",
        type: "Research",
      }),
    );

    const preview = await workLifecycle.previewMerge("account-1", {
      duplicateWorkId: duplicateWork.id,
      survivingWorkId: survivingWork.id,
    });

    expect(preview).toMatchObject({
      duplicateWork: {
        id: duplicateWork.id,
        key: duplicateWork.key,
        revision: duplicateWork.revision,
      },
      survivingWork: {
        id: survivingWork.id,
        key: survivingWork.key,
        revision: survivingWork.revision,
      },
    });
    expect(preview?.fields).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          conflict: true,
          key: "title",
          survivingValue: "Investigate payment failures",
          duplicateValue: "Investigate payment failure",
        }),
      ]),
    );
    expect(preview?.previewId).toMatch(WORK_MERGE_PREVIEW_PATTERN);
    await expect(
      workLifecycle.list("account-1", PROJECT_ID),
    ).resolves.toHaveLength(2);
  });

  test("merges a selected duplicate into one survivor, redirects its identity, rewrites relations, and safely undoes", async () => {
    const duplicateRelation: WorkMergeRelationSnapshot = {
      createdAt: "2026-09-18T09:01:00.000Z",
      id: "relation-duplicate-origin",
      kind: "Origin",
      sourceWorkId: `${PROJECT_ID}-work-2`,
      targetLabel: "CANT-9",
      targetProjectId: PROJECT_ID,
      targetRecordId: "external-record-1",
    };
    const workLifecycle = createMemoryWorkLifecycle({
      mergeRelations: [duplicateRelation],
    });
    const survivingWork = await workLifecycle.create(
      "account-1",
      createInput("merge-survivor-record", {
        description: "The canonical payment failure flow.",
        title: "Investigate payment failures",
        type: "Research",
      }),
    );
    const duplicateWork = await workLifecycle.create(
      "account-1",
      createInput("merge-duplicate-record", {
        description: "The same payment failure flow from capture.",
        title: "Investigate payment failure",
        type: "Research",
      }),
    );

    const preview = await workLifecycle.previewMerge("account-1", {
      duplicateWorkId: duplicateWork.id,
      survivingWorkId: survivingWork.id,
    });
    if (!preview) {
      throw new Error("Expected a Work Merge Preview.");
    }
    expect(preview.relations).toEqual([
      expect.objectContaining({
        action: "Rewrite source",
        id: duplicateRelation.id,
      }),
    ]);

    await expect(
      workLifecycle.merge("account-1", {
        baseRevision: survivingWork.revision,
        clientIdempotencyKey: "merge-without-preview",
        duplicateRevision: duplicateWork.revision,
        duplicateWorkId: duplicateWork.id,
        fieldResolutions: {
          description: "surviving",
          title: "duplicate",
        },
        previewId: "work-merge:stale",
        survivingWorkId: survivingWork.id,
      }),
    ).rejects.toBeInstanceOf(WorkMergePreviewRequiredError);

    await expect(
      workLifecycle.merge("account-1", {
        baseRevision: survivingWork.revision,
        clientIdempotencyKey: "merge-without-field-resolution",
        duplicateRevision: duplicateWork.revision,
        duplicateWorkId: duplicateWork.id,
        fieldResolutions: {},
        previewId: preview.previewId,
        survivingWorkId: survivingWork.id,
      }),
    ).rejects.toBeInstanceOf(WorkMergeResolutionRequiredError);

    const merged = await workLifecycle.merge("account-1", {
      baseRevision: survivingWork.revision,
      clientIdempotencyKey: "merge-selected-duplicate",
      duplicateRevision: duplicateWork.revision,
      duplicateWorkId: duplicateWork.id,
      fieldResolutions: {
        description: "surviving",
        title: "duplicate",
      },
      previewId: preview.previewId,
      survivingWorkId: survivingWork.id,
    });
    expect(merged).toMatchObject({
      retiredIdentity: {
        id: duplicateWork.id,
        key: duplicateWork.key,
        kind: "Retired identity",
        origin: { id: duplicateWork.id, key: duplicateWork.key },
        survivingWork: {
          id: survivingWork.id,
          key: survivingWork.key,
          title: duplicateWork.title,
        },
      },
      work: {
        id: survivingWork.id,
        title: duplicateWork.title,
      },
    });
    await expect(
      workLifecycle.find("account-1", duplicateWork.id),
    ).resolves.toBeNull();
    await expect(
      workLifecycle.list("account-1", PROJECT_ID),
    ).resolves.toHaveLength(1);
    await expect(
      workLifecycle.resolve("account-1", { workId: duplicateWork.id }),
    ).resolves.toMatchObject({
      kind: "Retired",
      identity: {
        origin: { id: duplicateWork.id, key: duplicateWork.key },
        survivingWork: { id: survivingWork.id, title: duplicateWork.title },
      },
    });
    await expect(
      workLifecycle.resolve("account-1", {
        key: duplicateWork.key,
        projectId: PROJECT_ID,
      }),
    ).resolves.toMatchObject({ kind: "Retired" });

    await expect(
      workLifecycle.merge("account-1", {
        baseRevision: survivingWork.revision,
        clientIdempotencyKey: "merge-selected-duplicate",
        duplicateRevision: duplicateWork.revision,
        duplicateWorkId: duplicateWork.id,
        fieldResolutions: {
          description: "surviving",
          title: "duplicate",
        },
        previewId: preview.previewId,
        survivingWorkId: survivingWork.id,
      }),
    ).resolves.toMatchObject({
      mergeId: merged.mergeId,
      receiptId: merged.receiptId,
      work: { id: survivingWork.id, title: duplicateWork.title },
    });

    const changedAfterMerge = await workLifecycle.updateType("account-1", {
      baseRevision: merged.work.revision,
      clientIdempotencyKey: "edit-after-merge",
      type: "Bug",
      workId: survivingWork.id,
    });
    const undone = await workLifecycle.undoMerge("account-1", {
      baseRevision: changedAfterMerge.revision,
      clientIdempotencyKey: "undo-selected-duplicate",
      mergeId: merged.mergeId,
      survivingWorkId: survivingWork.id,
    });
    expect(undone).toMatchObject({
      description: survivingWork.description,
      title: survivingWork.title,
      type: "Bug",
    });
    await expect(
      workLifecycle.find("account-1", duplicateWork.id),
    ).resolves.toMatchObject({
      id: duplicateWork.id,
      key: duplicateWork.key,
      title: duplicateWork.title,
    });
    await expect(
      workLifecycle.resolve("account-1", { workId: duplicateWork.id }),
    ).resolves.toMatchObject({ kind: "Active" });
    await expect(
      workLifecycle.previewMerge("account-1", {
        duplicateWorkId: duplicateWork.id,
        survivingWorkId: survivingWork.id,
      }),
    ).resolves.toMatchObject({
      relations: [expect.objectContaining({ id: duplicateRelation.id })],
    });
  });

  test("keeps retired identity redirects permanent across chained merges and restores them on Undo", async () => {
    const workLifecycle = createMemoryWorkLifecycle();
    const firstSurvivor = await workLifecycle.create(
      "account-1",
      createInput("chain-first-survivor", {
        title: "Investigate payment failures",
      }),
    );
    const chainedDuplicate = await workLifecycle.create(
      "account-1",
      createInput("chain-duplicate", {
        title: "Investigate payment failure",
      }),
    );
    const finalSurvivor = await workLifecycle.create(
      "account-1",
      createInput("chain-final-survivor", {
        title: "Investigate payment failures",
        type: "Bug",
      }),
    );

    const firstPreview = await workLifecycle.previewMerge("account-1", {
      duplicateWorkId: chainedDuplicate.id,
      survivingWorkId: firstSurvivor.id,
    });
    if (!firstPreview) {
      throw new Error("Expected the first Work Merge Preview.");
    }
    const firstMergeFieldResolutions = Object.fromEntries(
      firstPreview.fields
        .filter((field) => field.conflict)
        .map((field) => [field.key, "surviving"]),
    );
    const firstMerge = await workLifecycle.merge("account-1", {
      baseRevision: firstSurvivor.revision,
      clientIdempotencyKey: "chain-first-merge",
      duplicateRevision: chainedDuplicate.revision,
      duplicateWorkId: chainedDuplicate.id,
      fieldResolutions: firstMergeFieldResolutions,
      previewId: firstPreview.previewId,
      survivingWorkId: firstSurvivor.id,
    });

    await expect(
      workLifecycle.resolve("account-1", { workId: chainedDuplicate.id }),
    ).resolves.toMatchObject({
      identity: { survivingWork: { id: firstSurvivor.id } },
      kind: "Retired",
    });

    const secondPreview = await workLifecycle.previewMerge("account-1", {
      duplicateWorkId: firstSurvivor.id,
      survivingWorkId: finalSurvivor.id,
    });
    if (!secondPreview) {
      throw new Error("Expected the second Work Merge Preview.");
    }
    const secondMerge = await workLifecycle.merge("account-1", {
      baseRevision: finalSurvivor.revision,
      clientIdempotencyKey: "chain-second-merge",
      duplicateRevision: firstMerge.work.revision,
      duplicateWorkId: firstSurvivor.id,
      fieldResolutions: Object.fromEntries(
        secondPreview.fields
          .filter((field) => field.conflict)
          .map((field) => [field.key, "surviving"]),
      ),
      previewId: secondPreview.previewId,
      survivingWorkId: finalSurvivor.id,
    });

    await expect(
      workLifecycle.resolve("account-1", { workId: firstSurvivor.id }),
    ).resolves.toMatchObject({
      identity: { survivingWork: { id: finalSurvivor.id } },
      kind: "Retired",
    });
    await expect(
      workLifecycle.resolve("account-1", { workId: chainedDuplicate.id }),
    ).resolves.toMatchObject({
      identity: { survivingWork: { id: finalSurvivor.id } },
      kind: "Retired",
    });

    await workLifecycle.undoMerge("account-1", {
      baseRevision: secondMerge.work.revision,
      clientIdempotencyKey: "chain-second-undo",
      mergeId: secondMerge.mergeId,
      survivingWorkId: finalSurvivor.id,
    });

    await expect(
      workLifecycle.resolve("account-1", { workId: firstSurvivor.id }),
    ).resolves.toMatchObject({ kind: "Active" });
    await expect(
      workLifecycle.resolve("account-1", { workId: chainedDuplicate.id }),
    ).resolves.toMatchObject({
      identity: { survivingWork: { id: firstSurvivor.id } },
      kind: "Retired",
    });
    await expect(
      workLifecycle.list("account-1", PROJECT_ID),
    ).resolves.toHaveLength(2);
  });

  test("blocks merge Undo that would leave included Work on a non-Feature survivor", async () => {
    const workLifecycle = createMemoryWorkLifecycle();
    const survivor = await workLifecycle.create(
      "account-1",
      createInput("undo-block-survivor", {
        title: "Keep this record",
        type: "Task",
      }),
    );
    const duplicate = await workLifecycle.create(
      "account-1",
      createInput("undo-block-duplicate", {
        title: "Canonical feature",
        type: "Feature",
      }),
    );

    const preview = await workLifecycle.previewMerge("account-1", {
      duplicateWorkId: duplicate.id,
      survivingWorkId: survivor.id,
    });
    if (!preview) {
      throw new Error("Expected a Work Merge Preview.");
    }
    const merged = await workLifecycle.merge("account-1", {
      baseRevision: survivor.revision,
      clientIdempotencyKey: "undo-block-merge",
      duplicateRevision: duplicate.revision,
      duplicateWorkId: duplicate.id,
      fieldResolutions: { title: "surviving", type: "duplicate" },
      previewId: preview.previewId,
      survivingWorkId: survivor.id,
    });
    expect(merged.work.type).toBe("Feature");

    const child = await workLifecycle.create(
      "account-1",
      createInput("undo-block-child", { title: "Included child" }),
    );
    await workLifecycle.includeWork("account-1", {
      baseRevision: child.revision,
      clientIdempotencyKey: "undo-block-include",
      featureId: merged.work.id,
      workId: child.id,
    });
    await expect(
      workLifecycle.find("account-1", child.id),
    ).resolves.toMatchObject({ primaryFeatureId: merged.work.id });

    await expect(
      workLifecycle.undoMerge("account-1", {
        baseRevision: merged.work.revision,
        clientIdempotencyKey: "undo-block-undo",
        mergeId: merged.mergeId,
        survivingWorkId: survivor.id,
      }),
    ).rejects.toBeInstanceOf(WorkFeatureExitBlockedError);

    await expect(
      workLifecycle.find("account-1", survivor.id),
    ).resolves.toMatchObject({ type: "Feature" });
    await expect(
      workLifecycle.find("account-1", child.id),
    ).resolves.toMatchObject({ primaryFeatureId: merged.work.id });
  });

  test("consolidates Included in relations and restores them on Undo", async () => {
    const workLifecycle = createMemoryWorkLifecycle({
      mergeInclusions: [
        {
          childWorkId: `${PROJECT_ID}-work-3`,
          childWorkKey: "CANT-3",
          childWorkRevision: 2,
          childWorkTitle: "Document payment behavior",
          duplicateFeatureId: `${PROJECT_ID}-work-2`,
        },
      ],
    });
    const survivingFeature = await workLifecycle.create(
      "account-1",
      createInput("merge-inclusion-survivor", {
        title: "Payment flow feature",
        type: "Feature",
      }),
    );
    const duplicateFeature = await workLifecycle.create(
      "account-1",
      createInput("merge-inclusion-duplicate", {
        title: "Payment flow capture",
        type: "Feature",
      }),
    );
    const includedWork = await workLifecycle.create(
      "account-1",
      createInput("merge-inclusion-child", {
        title: "Document payment behavior",
      }),
    );
    await workLifecycle.includeWork("account-1", {
      baseRevision: includedWork.revision,
      clientIdempotencyKey: "include-before-merge",
      featureId: duplicateFeature.id,
      workId: includedWork.id,
    });

    const preview = await workLifecycle.previewMerge("account-1", {
      duplicateWorkId: duplicateFeature.id,
      survivingWorkId: survivingFeature.id,
    });
    if (!preview) {
      throw new Error("Expected a Work Merge Preview.");
    }
    expect(preview.inclusions).toEqual([
      expect.objectContaining({
        action: "Rewrite Included in",
        childWorkId: includedWork.id,
      }),
    ]);

    const merged = await workLifecycle.merge("account-1", {
      baseRevision: survivingFeature.revision,
      clientIdempotencyKey: "merge-inclusion-confirm",
      duplicateRevision: duplicateFeature.revision,
      duplicateWorkId: duplicateFeature.id,
      fieldResolutions: { title: "duplicate" },
      previewId: preview.previewId,
      survivingWorkId: survivingFeature.id,
    });
    await expect(
      workLifecycle.find("account-1", includedWork.id),
    ).resolves.toMatchObject({ primaryFeatureId: survivingFeature.id });

    await workLifecycle.undoMerge("account-1", {
      baseRevision: merged.work.revision,
      clientIdempotencyKey: "undo-inclusion-merge",
      mergeId: merged.mergeId,
      survivingWorkId: survivingFeature.id,
    });
    await expect(
      workLifecycle.find("account-1", includedWork.id),
    ).resolves.toMatchObject({ primaryFeatureId: duplicateFeature.id });
  });

  test("does not restore a relation deleted after merge", async () => {
    const mergeRelations: WorkMergeRelationSnapshot[] = [
      {
        createdAt: "2026-09-18T09:01:00.000Z",
        id: "relation-deleted-after-merge",
        kind: "Related",
        sourceWorkId: `${PROJECT_ID}-work-2`,
        targetLabel: "External payment evidence",
        targetProjectId: PROJECT_ID,
        targetRecordId: "external-payment-evidence",
      },
    ];
    const workLifecycle = createMemoryWorkLifecycle({ mergeRelations });
    const survivingWork = await workLifecycle.create(
      "account-1",
      createInput("merge-relation-delete-survivor", {
        title: "Canonical payment flow",
      }),
    );
    const duplicateWork = await workLifecycle.create(
      "account-1",
      createInput("merge-relation-delete-duplicate", {
        title: "Captured payment flow",
      }),
    );
    const preview = await workLifecycle.previewMerge("account-1", {
      duplicateWorkId: duplicateWork.id,
      survivingWorkId: survivingWork.id,
    });
    if (!preview) {
      throw new Error("Expected a Work Merge Preview.");
    }

    const merged = await workLifecycle.merge("account-1", {
      baseRevision: survivingWork.revision,
      clientIdempotencyKey: "merge-relation-delete-confirm",
      duplicateRevision: duplicateWork.revision,
      duplicateWorkId: duplicateWork.id,
      fieldResolutions: { title: "duplicate" },
      previewId: preview.previewId,
      survivingWorkId: survivingWork.id,
    });
    mergeRelations.length = 0;

    await workLifecycle.undoMerge("account-1", {
      baseRevision: merged.work.revision,
      clientIdempotencyKey: "undo-relation-delete-merge",
      mergeId: merged.mergeId,
      survivingWorkId: survivingWork.id,
    });
    await expect(
      workLifecycle.previewMerge("account-1", {
        duplicateWorkId: duplicateWork.id,
        survivingWorkId: survivingWork.id,
      }),
    ).resolves.toMatchObject({ relations: [] });
  });

  test("restores a self relation removed by merge", async () => {
    const mergeRelations: WorkMergeRelationSnapshot[] = [
      {
        createdAt: "2026-09-18T09:01:00.000Z",
        id: "relation-merge-self",
        kind: "Related",
        sourceWorkId: `${PROJECT_ID}-work-2`,
        targetLabel: "Canonical payment flow",
        targetProjectId: PROJECT_ID,
        targetRecordId: `${PROJECT_ID}-work-1`,
      },
    ];
    const workLifecycle = createMemoryWorkLifecycle({ mergeRelations });
    const survivingWork = await workLifecycle.create(
      "account-1",
      createInput("merge-self-survivor", {
        title: "Canonical payment flow",
      }),
    );
    const duplicateWork = await workLifecycle.create(
      "account-1",
      createInput("merge-self-duplicate", {
        title: "Captured payment flow",
      }),
    );
    const preview = await workLifecycle.previewMerge("account-1", {
      duplicateWorkId: duplicateWork.id,
      survivingWorkId: survivingWork.id,
    });
    if (!preview) {
      throw new Error("Expected a Work Merge Preview.");
    }

    const merged = await workLifecycle.merge("account-1", {
      baseRevision: survivingWork.revision,
      clientIdempotencyKey: "merge-self-confirm",
      duplicateRevision: duplicateWork.revision,
      duplicateWorkId: duplicateWork.id,
      fieldResolutions: { title: "duplicate" },
      previewId: preview.previewId,
      survivingWorkId: survivingWork.id,
    });
    expect(mergeRelations).toHaveLength(0);

    await workLifecycle.undoMerge("account-1", {
      baseRevision: merged.work.revision,
      clientIdempotencyKey: "undo-self-merge",
      mergeId: merged.mergeId,
      survivingWorkId: survivingWork.id,
    });
    await expect(
      workLifecycle.previewMerge("account-1", {
        duplicateWorkId: duplicateWork.id,
        survivingWorkId: survivingWork.id,
      }),
    ).resolves.toMatchObject({
      relations: [expect.objectContaining({ id: "relation-merge-self" })],
    });
  });

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

  test("keeps archived Work in the Scope Tree with progress consistent with featureProgress", async () => {
    const workLifecycle = createMemoryWorkLifecycle();
    const feature = await workLifecycle.create(
      "account-1",
      createInput("scope-tree-archived-feature", {
        title: "Checkout Feature",
        type: "Feature",
      }),
    );
    const includedWork = await workLifecycle.create(
      "account-1",
      createInput("scope-tree-archived-included", {
        title: "Verify provider callback",
        type: "Task",
      }),
    );
    const included = await workLifecycle.includeWork("account-1", {
      baseRevision: includedWork.revision,
      clientIdempotencyKey: "scope-tree-archived-include",
      featureId: feature.id,
      workId: includedWork.id,
    });
    const archivedWork = await workLifecycle.archive("account-1", {
      baseRevision: included.revision,
      clientIdempotencyKey: "scope-tree-archived-work",
      workId: includedWork.id,
    });

    const tree = await workLifecycle.scopeTree("account-1", PROJECT_ID);
    expect(tree.features[0]?.includedWork.map((node) => node.work.id)).toEqual([
      archivedWork.id,
    ]);
    await expect(
      workLifecycle.featureProgress("account-1", feature.id),
    ).resolves.toEqual(tree.features[0]?.progress);
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

  test("adds, edits, reorders, and deletes owned checklist items", async () => {
    const workLifecycle = createMemoryWorkLifecycle();
    let parentWork = await workLifecycle.create(
      "account-1",
      createInput("checklist-crud-create"),
    );

    parentWork = await workLifecycle.updateChecklist("account-1", {
      baseRevision: parentWork.revision,
      checklist: [
        { completed: false, id: "item-1", text: "First step" },
        { completed: false, id: "item-2", text: "Second step" },
      ],
      clientIdempotencyKey: "checklist-add",
      workId: parentWork.id,
    });
    parentWork = await workLifecycle.updateChecklist("account-1", {
      baseRevision: parentWork.revision,
      checklist: [
        { completed: false, id: "item-2", text: "Edited second step" },
        { completed: false, id: "item-1", text: "First step" },
      ],
      clientIdempotencyKey: "checklist-edit-reorder",
      workId: parentWork.id,
    });
    parentWork = await workLifecycle.updateChecklist("account-1", {
      baseRevision: parentWork.revision,
      checklist: [
        { completed: false, id: "item-2", text: "Edited second step" },
      ],
      clientIdempotencyKey: "checklist-delete",
      workId: parentWork.id,
    });

    expect(parentWork.checklist).toEqual([
      { completed: false, id: "item-2", text: "Edited second step" },
    ]);
  });

  test("keeps completed checklist items off the Work lifecycle", async () => {
    const workLifecycle = createMemoryWorkLifecycle();
    const parentWork = await workLifecycle.create(
      "account-1",
      createInput("checklist-completion-create"),
    );

    const updated = await workLifecycle.updateChecklist("account-1", {
      baseRevision: parentWork.revision,
      checklist: [{ completed: true, id: "item-1", text: "Finished step" }],
      clientIdempotencyKey: "checklist-complete",
      workId: parentWork.id,
    });

    expect(updated).toMatchObject({
      checklist: [{ completed: true, id: "item-1", text: "Finished step" }],
      closureResult: null,
      status: "Not Started",
    });
    await expect(workLifecycle.list("account-1", PROJECT_ID)).resolves.toEqual([
      updated,
    ]);
  });

  test("rejects lifecycle, planning, Feature, Test Scenario, and Handoff fields on checklist items", () => {
    for (const forbiddenField of [
      "dueDate",
      "featureId",
      "handoffId",
      "priority",
      "relationId",
      "status",
      "testScenarioId",
    ]) {
      expect(
        workChecklistItemSchema.safeParse({
          completed: false,
          [forbiddenField]: "not-allowed",
          id: "item-1",
          text: "Finished step",
        }).success,
      ).toBe(false);
    }
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
      effort: null,
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
      targetDate: null,
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
