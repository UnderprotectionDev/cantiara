import type {
  MutationPayload,
  MutationTarget,
} from "@cantiara/api/mutation-and-undo";
import {
  featureHealthUpdateSchema,
  type WorkLifecycleAccess,
  type WorkLifecycleMutationContracts,
  type WorkLifecycleMutationValue,
  type WorkMergeMutation,
  type WorkOriginPosition,
  type WorkProfile,
  type WorkRetiredIdentity,
  workCaptureProvenanceSchema,
  workChecklistSchema,
  workClosureResultSchema,
  workOriginPositionSchema,
  workStatusSchema,
  workTypeSchema,
} from "@cantiara/api/work-lifecycle";
import type { Database } from "@cantiara/db";
import { workspace } from "@cantiara/db/schema/auth";
import {
  project,
  work,
  workKeyAllocation,
  workRetiredIdentity,
} from "@cantiara/db/schema/index";
import type { SQL } from "drizzle-orm";
import { and, asc, eq, inArray, isNotNull, isNull } from "drizzle-orm";
import type {
  CustomFieldValueFinalization,
  CustomFieldValueFinalizationWriter,
} from "../../custom-fields/server/custom-fields-mutation-database";
import {
  createDatabaseMutationContract,
  type MutationDatabaseExecutor,
  type MutationDatabaseTargetAdapter,
} from "../../mutation-and-undo/server/mutation-contract-database";
import {
  createDatabaseWorkRelations,
  type WorkRelationsMutationAdapter,
} from "../../relations/server/work-relations";
import {
  createWork,
  createWorkLifecycle,
  WorkCreationConflictError,
  type WorkCreationReservation,
  WorkFeatureExitBlockedError,
  WorkInclusionConflictError,
  type WorkLifecycleStore,
  WorkMergeConflictError,
  WorkProjectNotFoundError,
  WorkRecreatePreviewRequiredError,
} from "./work-lifecycle";

type WorkDatabaseRecord = typeof work.$inferSelect;
type WorkKeyAllocationRecord = typeof workKeyAllocation.$inferSelect;
type WorkRetiredIdentityRecord = typeof workRetiredIdentity.$inferSelect;

function originRecordValues(originPosition?: WorkOriginPosition) {
  return {
    originComponentId: originPosition?.componentId ?? null,
    originLocation: originPosition?.location ?? null,
    originOwnerRecordId: originPosition?.ownerRecordId ?? null,
    originSourceVersion: originPosition?.sourceVersion ?? null,
  };
}

function toWorkProfile(record: WorkDatabaseRecord): WorkProfile {
  const originPosition =
    record.originOwnerRecordId && record.originComponentId
      ? workOriginPositionSchema.parse({
          componentId: record.originComponentId,
          ...(record.originLocation ? { location: record.originLocation } : {}),
          ownerRecordId: record.originOwnerRecordId,
          sourceVersion: record.originSourceVersion,
        })
      : undefined;
  return {
    archivedAt: record.archivedAt?.toISOString() ?? null,
    captureProvenance: record.captureProvenance
      ? workCaptureProvenanceSchema.parse(record.captureProvenance)
      : null,
    checklist: workChecklistSchema.parse(record.checklist),
    closureReason: record.closureReason,
    closureResult: record.closureResult
      ? workClosureResultSchema.parse(record.closureResult)
      : null,
    createdAt: record.createdAt.toISOString(),
    description: record.description,
    featureHealthHistory: featureHealthUpdateSchema
      .array()
      .parse(record.featureHealthHistory),
    id: record.id,
    key: record.key,
    number: record.number,
    ...(originPosition ? { originPosition } : {}),
    primaryFeatureId: record.primaryFeatureId,
    primarySpecId: record.primarySpecId,
    projectId: record.projectId,
    recreatedFrom:
      record.recreatedFromWorkId && record.recreatedFromWorkKey
        ? {
            id: record.recreatedFromWorkId,
            key: record.recreatedFromWorkKey,
          }
        : null,
    revision: record.revision,
    status: workStatusSchema.parse(record.status),
    title: record.title,
    type: workTypeSchema.parse(record.type),
    updatedAt: record.updatedAt.toISOString(),
  };
}

function toReservation(record: WorkKeyAllocationRecord) {
  return {
    id: record.id,
    key: record.key,
    number: record.number,
    payloadFingerprint: record.payloadFingerprint ?? "",
    projectId: record.projectId,
    shortCode: record.shortCode,
    workId: record.workId,
  } satisfies WorkCreationReservation;
}

function toRetiredIdentity(
  record: WorkRetiredIdentityRecord,
  survivingWork: Pick<WorkDatabaseRecord, "id" | "key" | "title">,
): WorkRetiredIdentity {
  return {
    id: record.id,
    key: record.key,
    kind: "Retired identity",
    origin: { id: record.id, key: record.key },
    projectId: record.projectId,
    retiredAt: record.retiredAt.toISOString(),
    survivingWork: {
      id: survivingWork.id,
      key: survivingWork.key,
      title: survivingWork.title,
    },
  };
}

async function findWorkspaceId(
  executor: MutationDatabaseExecutor,
  accountId: string,
) {
  const [record] = await executor
    .select({ id: workspace.id })
    .from(workspace)
    .where(eq(workspace.ownerAccountId, accountId))
    .limit(1);
  return record?.id ?? null;
}

async function findOwnedProject(
  executor: MutationDatabaseExecutor,
  accountId: string,
  projectId: string,
  lock: boolean,
) {
  const workspaceId = await findWorkspaceId(executor, accountId);
  if (!workspaceId) {
    return null;
  }

  const query = executor
    .select()
    .from(project)
    .where(and(eq(project.id, projectId), eq(project.workspaceId, workspaceId)))
    .limit(1);
  const records = lock ? await query.for("update") : await query;
  const [record] = records;
  return record ? { record, workspaceId } : null;
}

async function findOwnedWork(
  executor: MutationDatabaseExecutor,
  accountId: string,
  workId: string,
  lock: boolean,
) {
  const workspaceId = await findWorkspaceId(executor, accountId);
  if (!workspaceId) {
    return null;
  }

  const query = executor
    .select({ record: work })
    .from(work)
    .innerJoin(project, eq(work.projectId, project.id))
    .where(and(eq(work.id, workId), eq(project.workspaceId, workspaceId)))
    .limit(1);
  const records = lock ? await query.for("update") : await query;
  const [result] = records;
  return result?.record ?? null;
}

function emptyWorkTarget(
  targetId: string,
): MutationTarget<WorkLifecycleMutationValue> {
  return {
    id: targetId,
    revision: 0,
    value: { work: null },
  };
}

function featureIdFromMutationPayload(payload: MutationPayload | undefined) {
  if (
    typeof payload !== "object" ||
    payload === null ||
    Array.isArray(payload)
  ) {
    return null;
  }
  const record = payload as Record<string, unknown>;
  const featureId = record.featureId ?? record.primaryFeatureId;
  return typeof featureId === "string" ? featureId : null;
}

function mergeWorkIdFromMutationPayload(
  payload: MutationPayload | undefined,
  field: "duplicateWorkId" | "retiredTargetId",
) {
  if (
    typeof payload !== "object" ||
    payload === null ||
    Array.isArray(payload)
  ) {
    return null;
  }
  const value = (payload as Record<string, unknown>)[field];
  return typeof value === "string" ? value : null;
}

async function lockOwnedWorksInOrder(
  executor: MutationDatabaseExecutor,
  accountId: string,
  workIds: string[],
  index = 0,
): Promise<void> {
  const workId = workIds[index];
  if (workId === undefined) {
    return;
  }
  await findOwnedWork(executor, accountId, workId, true);
  await lockOwnedWorksInOrder(executor, accountId, workIds, index + 1);
}

async function selectRecreateSelection(
  executor: MutationDatabaseExecutor,
  relations: WorkRelationsMutationAdapter,
  accountId: string,
  workspaceId: string,
  recreate: WorkLifecycleMutationValue["recreate"] | undefined,
) {
  if (!recreate) {
    return { selectedRelations: [], sourceWork: null };
  }
  const selection = await relations.selectRecreateRelations(
    executor,
    accountId,
    workspaceId,
    recreate,
  );
  if (!selection) {
    throw new WorkRecreatePreviewRequiredError();
  }
  return selection;
}

function createWorkMutationTarget(
  accountId: string,
  relations: WorkRelationsMutationAdapter,
  customFieldValueWriter?: CustomFieldValueFinalizationWriter,
  customFieldValues: readonly CustomFieldValueFinalization[] = [],
): MutationDatabaseTargetAdapter<WorkLifecycleMutationValue> {
  return {
    find: async (_executor, targetId) => emptyWorkTarget(targetId),

    // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Work creation keeps allocation, relation persistence, and custom field finalization in one mutation transaction.
    async update(executor, input) {
      const nextWork = input.nextValue.work;
      if (!nextWork) {
        return null;
      }

      const ownedProject = await findOwnedProject(
        executor,
        accountId,
        nextWork.projectId,
        false,
      );
      if (!ownedProject) {
        return null;
      }

      const [allocation] = await executor
        .select()
        .from(workKeyAllocation)
        .where(
          and(
            eq(workKeyAllocation.projectId, nextWork.projectId),
            eq(workKeyAllocation.workId, nextWork.id),
          ),
        )
        .limit(1);
      if (
        !allocation ||
        allocation.key !== nextWork.key ||
        allocation.number !== nextWork.number
      ) {
        return null;
      }

      const { recreate } = input.nextValue;
      const recreateSelection = await selectRecreateSelection(
        executor,
        relations,
        accountId,
        ownedProject.workspaceId,
        recreate,
      );

      const [created] = await executor
        .insert(work)
        .values({
          archivedAt: nextWork.archivedAt
            ? new Date(nextWork.archivedAt)
            : null,
          captureProvenance: nextWork.captureProvenance,
          checklist: nextWork.checklist,
          closureReason: nextWork.closureReason,
          closureResult: nextWork.closureResult,
          createdAt: new Date(nextWork.createdAt),
          description: nextWork.description,
          featureHealthHistory: nextWork.featureHealthHistory,
          id: nextWork.id,
          key: nextWork.key,
          number: nextWork.number,
          ...originRecordValues(nextWork.originPosition),
          primaryFeatureId: nextWork.primaryFeatureId,
          primarySpecId: nextWork.primarySpecId,
          projectId: nextWork.projectId,
          recreatedFromWorkId: nextWork.recreatedFrom?.id,
          recreatedFromWorkKey: nextWork.recreatedFrom?.key,
          revision: input.expectedRevision + 1,
          status: nextWork.status,
          title: nextWork.title,
          type: nextWork.type,
          updatedAt: input.committedAt,
        })
        .onConflictDoNothing()
        .returning();
      if (created) {
        if (recreate && recreateSelection.sourceWork) {
          await relations.persistRecreatedRelations(
            executor,
            input.committedAt,
            {
              id: created.id,
              key: created.key,
              projectId: created.projectId,
            },
            recreateSelection,
          );
        }
        if (customFieldValueWriter && customFieldValues.length > 0) {
          await customFieldValueWriter.apply(executor, {
            accountId,
            committedAt: input.committedAt,
            projectId: created.projectId,
            recordId: created.id,
            values: customFieldValues,
          });
        }
        return {
          id: created.id,
          revision: created.revision,
          value: { work: toWorkProfile(created) },
        };
      }

      const [existing] = await executor
        .select()
        .from(work)
        .where(eq(work.id, nextWork.id))
        .limit(1);
      return existing
        ? {
            id: existing.id,
            revision: existing.revision,
            value: { work: toWorkProfile(existing) },
          }
        : null;
    },
  };
}

async function assertValidPrimaryFeature(
  executor: MutationDatabaseExecutor,
  accountId: string,
  nextWork: WorkProfile,
) {
  if (!nextWork.primaryFeatureId) {
    return;
  }
  const primaryFeature = await findOwnedWork(
    executor,
    accountId,
    nextWork.primaryFeatureId,
    true,
  );
  if (
    primaryFeature?.type !== "Feature" ||
    primaryFeature.projectId !== nextWork.projectId ||
    nextWork.type === "Feature"
  ) {
    throw new WorkInclusionConflictError(
      "Primary Feature inclusion is no longer valid.",
    );
  }
}

async function assertFeatureExitReady(
  executor: MutationDatabaseExecutor,
  currentWork: WorkDatabaseRecord,
  nextWork: WorkProfile,
) {
  if (currentWork.type !== "Feature" || nextWork.type === "Feature") {
    return;
  }
  const includedWork = await executor
    .select({ id: work.id })
    .from(work)
    .where(eq(work.primaryFeatureId, currentWork.id))
    .for("update");
  const blockers = {
    featureHealthUpdateCount: currentWork.featureHealthHistory.length,
    hasPrimarySpec: currentWork.primarySpecId !== null,
    includedWorkCount: includedWork.length,
  };
  if (
    blockers.includedWorkCount > 0 ||
    blockers.featureHealthUpdateCount > 0 ||
    blockers.hasPrimarySpec
  ) {
    throw new WorkFeatureExitBlockedError(blockers);
  }
}

function workRecordValues(
  nextWork: WorkProfile,
  revision: number,
  updatedAt: Date,
) {
  return {
    archivedAt: nextWork.archivedAt ? new Date(nextWork.archivedAt) : null,
    captureProvenance: nextWork.captureProvenance,
    checklist: nextWork.checklist,
    closureReason: nextWork.closureReason,
    closureResult: nextWork.closureResult,
    createdAt: new Date(nextWork.createdAt),
    description: nextWork.description,
    featureHealthHistory: nextWork.featureHealthHistory,
    id: nextWork.id,
    key: nextWork.key,
    number: nextWork.number,
    ...originRecordValues(nextWork.originPosition),
    primaryFeatureId: nextWork.primaryFeatureId,
    primarySpecId: nextWork.primarySpecId,
    projectId: nextWork.projectId,
    recreatedFromWorkId: nextWork.recreatedFrom?.id,
    recreatedFromWorkKey: nextWork.recreatedFrom?.key,
    revision,
    status: nextWork.status,
    title: nextWork.title,
    type: nextWork.type,
    updatedAt,
  };
}

async function updateWorkForMerge(
  executor: MutationDatabaseExecutor,
  accountId: string,
  relations: WorkRelationsMutationAdapter,
  input: Parameters<
    NonNullable<
      MutationDatabaseTargetAdapter<WorkLifecycleMutationValue>["update"]
    >
  >[1],
  mutation: WorkMergeMutation,
) {
  const nextWork = input.nextValue.work;
  if (!nextWork || nextWork.id !== input.targetId) {
    return null;
  }
  const survivingWork = await findOwnedWork(
    executor,
    accountId,
    input.targetId,
    true,
  );
  const duplicateWork = await findOwnedWork(
    executor,
    accountId,
    mutation.duplicateWorkId,
    true,
  );
  if (
    !(survivingWork && duplicateWork) ||
    duplicateWork.revision !== mutation.duplicateWorkRevision ||
    duplicateWork.projectId !== survivingWork.projectId ||
    mutation.duplicateWork.id !== duplicateWork.id ||
    mutation.duplicateWork.key !== duplicateWork.key
  ) {
    throw new WorkMergeConflictError();
  }
  if (
    mutation.operation !== "merge" ||
    !relations.persistMergedRelations ||
    (mutation.inclusions.length > 0 && !relations.persistMergedInclusions)
  ) {
    throw new WorkMergeConflictError();
  }
  await assertValidPrimaryFeature(executor, accountId, nextWork);
  await assertFeatureExitReady(executor, survivingWork, nextWork);
  if (
    nextWork.type !== "Feature" &&
    (nextWork.featureHealthHistory.length > 0 ||
      nextWork.primarySpecId !== null ||
      mutation.inclusions.length > 0)
  ) {
    throw new WorkFeatureExitBlockedError({
      featureHealthUpdateCount: nextWork.featureHealthHistory.length,
      hasPrimarySpec: nextWork.primarySpecId !== null,
      includedWorkCount: mutation.inclusions.length,
    });
  }

  const [updated] = await executor
    .update(work)
    .set(
      workRecordValues(nextWork, input.expectedRevision + 1, input.committedAt),
    )
    .where(
      and(
        eq(work.id, input.targetId),
        eq(work.revision, input.expectedRevision),
      ),
    )
    .returning();
  if (!updated) {
    return null;
  }

  await relations.persistMergedRelations(
    executor,
    input.committedAt,
    {
      id: survivingWork.id,
      key: survivingWork.key,
      projectId: survivingWork.projectId,
    },
    duplicateWork.id,
    mutation.relations,
  );
  if (relations.persistMergedInclusions) {
    const inclusionsPersisted = await relations.persistMergedInclusions(
      executor,
      input.committedAt,
      {
        id: survivingWork.id,
        key: survivingWork.key,
        projectId: survivingWork.projectId,
      },
      duplicateWork.id,
      mutation.inclusions,
    );
    if (!inclusionsPersisted) {
      throw new WorkMergeConflictError(
        "Merged Work inclusion is no longer available.",
      );
    }
  }
  // Retired identities that already redirect to the Work being retired are
  // re-pointed to the new survivor so chained merges never lose a permanent
  // redirect to the row deletion cascade.
  if (mutation.retiredRedirectIds.length > 0) {
    await executor
      .update(workRetiredIdentity)
      .set({ survivingWorkId: updated.id })
      .where(
        and(
          inArray(workRetiredIdentity.id, mutation.retiredRedirectIds),
          eq(workRetiredIdentity.survivingWorkId, duplicateWork.id),
        ),
      );
  }
  const [retired] = await executor
    .insert(workRetiredIdentity)
    .values({
      id: duplicateWork.id,
      key: duplicateWork.key,
      mergeId: mutation.mergeId,
      projectId: duplicateWork.projectId,
      retiredAt: input.committedAt,
      survivingWorkId: updated.id,
    })
    .onConflictDoNothing()
    .returning();
  if (!retired) {
    throw new WorkMergeConflictError();
  }
  await executor
    .delete(work)
    .where(
      and(
        eq(work.id, duplicateWork.id),
        eq(work.revision, duplicateWork.revision),
      ),
    );
  return {
    id: updated.id,
    revision: updated.revision,
    value: { work: toWorkProfile(updated) },
  };
}

async function updateWorkForMergeUndo(
  executor: MutationDatabaseExecutor,
  accountId: string,
  relations: WorkRelationsMutationAdapter,
  input: Parameters<
    NonNullable<
      MutationDatabaseTargetAdapter<WorkLifecycleMutationValue>["update"]
    >
  >[1],
  mutation: WorkMergeMutation,
) {
  const nextWork = input.nextValue.work;
  if (!nextWork || nextWork.id !== input.targetId) {
    return null;
  }
  const survivingWork = await findOwnedWork(
    executor,
    accountId,
    input.targetId,
    true,
  );
  if (
    !survivingWork ||
    mutation.operation !== "undo" ||
    mutation.duplicateWork.id !== mutation.duplicateWorkId
  ) {
    throw new WorkMergeConflictError();
  }
  const [retired] = await executor
    .select()
    .from(workRetiredIdentity)
    .where(
      and(
        eq(workRetiredIdentity.id, mutation.duplicateWorkId),
        eq(workRetiredIdentity.mergeId, mutation.mergeId),
        eq(workRetiredIdentity.survivingWorkId, survivingWork.id),
      ),
    )
    .limit(1);
  if (
    !(
      retired &&
      relations.restoreMergedRelations &&
      (mutation.inclusions.length === 0 || relations.restoreMergedInclusions)
    )
  ) {
    throw new WorkMergeConflictError();
  }

  const { duplicateWork } = mutation;
  const [restored] = await executor
    .insert(work)
    .values(
      workRecordValues(
        duplicateWork,
        duplicateWork.revision + 1,
        input.committedAt,
      ),
    )
    .onConflictDoNothing()
    .returning();
  if (!restored) {
    throw new WorkMergeConflictError();
  }
  await relations.restoreMergedRelations(
    executor,
    input.committedAt,
    {
      id: survivingWork.id,
      key: survivingWork.key,
      projectId: survivingWork.projectId,
    },
    duplicateWork.id,
    mutation.relations,
  );
  await relations.restoreMergedInclusions?.(
    executor,
    input.committedAt,
    {
      id: survivingWork.id,
      key: survivingWork.key,
      projectId: survivingWork.projectId,
    },
    duplicateWork.id,
    mutation.inclusions,
  );
  // Redirects that this merge re-pointed to the current survivor follow the
  // restored duplicate back, so undoing a chained merge restores the redirect
  // chain exactly as it was.
  if (mutation.retiredRedirectIds.length > 0) {
    await executor
      .update(workRetiredIdentity)
      .set({ survivingWorkId: duplicateWork.id })
      .where(
        and(
          inArray(workRetiredIdentity.id, mutation.retiredRedirectIds),
          eq(workRetiredIdentity.survivingWorkId, survivingWork.id),
        ),
      );
  }
  await executor
    .delete(workRetiredIdentity)
    .where(eq(workRetiredIdentity.id, duplicateWork.id));

  // The restored combination must satisfy the same Feature exit contract as
  // an explicit type change: inclusions moved back to the duplicate above are
  // no longer counted, while Work included after the merge still blocks.
  await assertValidPrimaryFeature(executor, accountId, nextWork);
  if (nextWork.type !== "Feature") {
    const includedWork = await executor
      .select({ id: work.id })
      .from(work)
      .where(eq(work.primaryFeatureId, survivingWork.id))
      .for("update");
    const blockers = {
      featureHealthUpdateCount: nextWork.featureHealthHistory.length,
      hasPrimarySpec: nextWork.primarySpecId !== null,
      includedWorkCount: includedWork.length,
    };
    if (
      blockers.includedWorkCount > 0 ||
      blockers.featureHealthUpdateCount > 0 ||
      blockers.hasPrimarySpec
    ) {
      throw new WorkFeatureExitBlockedError(blockers);
    }
  }

  const [updated] = await executor
    .update(work)
    .set(
      workRecordValues(nextWork, input.expectedRevision + 1, input.committedAt),
    )
    .where(
      and(
        eq(work.id, input.targetId),
        eq(work.revision, input.expectedRevision),
      ),
    )
    .returning();
  return updated
    ? {
        id: updated.id,
        revision: updated.revision,
        value: { work: toWorkProfile(updated) },
      }
    : null;
}

function createWorkUpdateMutationTarget(
  accountId: string,
  relations: WorkRelationsMutationAdapter,
): MutationDatabaseTargetAdapter<WorkLifecycleMutationValue> {
  return {
    async find(executor, targetId, lock, context) {
      if (lock) {
        const mergeParticipantId =
          mergeWorkIdFromMutationPayload(context?.payload, "duplicateWorkId") ??
          mergeWorkIdFromMutationPayload(context?.payload, "retiredTargetId");
        if (mergeParticipantId && mergeParticipantId !== targetId) {
          const participantIds = [targetId, mergeParticipantId].sort();
          await lockOwnedWorksInOrder(executor, accountId, participantIds);
        }
        const featureId = featureIdFromMutationPayload(context?.payload);
        if (featureId && featureId !== targetId) {
          // Mutations involving included Work lock the parent Feature before
          // the child Work; Feature exit uses the same order.
          await findOwnedWork(executor, accountId, featureId, true);
        }
      }
      const record = await findOwnedWork(executor, accountId, targetId, lock);
      return record
        ? {
            id: record.id,
            revision: record.revision,
            value: { work: toWorkProfile(record) },
          }
        : null;
    },

    async update(executor, input) {
      const nextWork = input.nextValue.work;
      if (!nextWork || nextWork.id !== input.targetId) {
        return null;
      }

      const mergeMutation = input.nextValue.merge;
      if (mergeMutation?.operation === "merge") {
        return updateWorkForMerge(
          executor,
          accountId,
          relations,
          input,
          mergeMutation,
        );
      }
      if (mergeMutation?.operation === "undo") {
        return updateWorkForMergeUndo(
          executor,
          accountId,
          relations,
          input,
          mergeMutation,
        );
      }

      const currentWork = await findOwnedWork(
        executor,
        accountId,
        input.targetId,
        true,
      );
      if (!currentWork) {
        return null;
      }

      await assertValidPrimaryFeature(executor, accountId, nextWork);
      await assertFeatureExitReady(executor, currentWork, nextWork);

      const ownedProject = await findOwnedProject(
        executor,
        accountId,
        nextWork.projectId,
        false,
      );
      if (!ownedProject) {
        return null;
      }

      const [updated] = await executor
        .update(work)
        .set({
          archivedAt: nextWork.archivedAt
            ? new Date(nextWork.archivedAt)
            : null,
          closureReason: nextWork.closureReason,
          closureResult: nextWork.closureResult,
          featureHealthHistory: nextWork.featureHealthHistory,
          primaryFeatureId: nextWork.primaryFeatureId,
          primarySpecId: nextWork.primarySpecId,
          revision: input.expectedRevision + 1,
          status: nextWork.status,
          type: nextWork.type,
          updatedAt: input.committedAt,
        })
        .where(
          and(
            eq(work.id, input.targetId),
            eq(work.projectId, nextWork.projectId),
            eq(work.revision, input.expectedRevision),
          ),
        )
        .returning();
      return updated
        ? {
            id: updated.id,
            revision: updated.revision,
            value: { work: toWorkProfile(updated) },
          }
        : null;
    },
  };
}

function reserveExistingAllocation(
  existing: WorkKeyAllocationRecord,
  payloadFingerprint: string,
) {
  if (
    !existing.payloadFingerprint ||
    existing.payloadFingerprint !== payloadFingerprint
  ) {
    throw new WorkCreationConflictError();
  }

  return toReservation(existing);
}

export interface WorkLifecycleProjectDocumentAccess {
  hasProjectDocument: (
    accountId: string,
    projectId: string,
    documentId: string,
  ) => Promise<boolean>;
}

export function createDatabaseWorkLifecycle(
  database: Database,
  options: {
    customFieldValueWriter?: CustomFieldValueFinalizationWriter;
    projectDocumentAccess?: WorkLifecycleProjectDocumentAccess;
  } = {},
) {
  const relations = createDatabaseWorkRelations(database);
  const { customFieldValueWriter, projectDocumentAccess } = options;
  const store: WorkLifecycleStore = {
    async find(accountId, workId) {
      const workspaceId = await findWorkspaceId(database, accountId);
      if (!workspaceId) {
        return null;
      }
      const [result] = await database
        .select({ record: work })
        .from(work)
        .innerJoin(project, eq(work.projectId, project.id))
        .where(and(eq(work.id, workId), eq(project.workspaceId, workspaceId)))
        .limit(1);
      return result ? toWorkProfile(result.record) : null;
    },

    async findByKey(accountId, projectId, key) {
      const workspaceId = await findWorkspaceId(database, accountId);
      if (!workspaceId) {
        return null;
      }
      const [result] = await database
        .select({ record: work })
        .from(work)
        .innerJoin(project, eq(work.projectId, project.id))
        .where(
          and(
            eq(work.key, key),
            eq(work.projectId, projectId),
            eq(project.workspaceId, workspaceId),
          ),
        )
        .limit(1);
      return result ? toWorkProfile(result.record) : null;
    },

    async findRetiredIdentity(accountId, input) {
      const workspaceId = await findWorkspaceId(database, accountId);
      if (!workspaceId) {
        return null;
      }
      const conditions = [eq(project.workspaceId, workspaceId)];
      if ("workId" in input) {
        conditions.push(eq(workRetiredIdentity.id, input.workId));
      } else {
        conditions.push(
          eq(workRetiredIdentity.projectId, input.projectId),
          eq(workRetiredIdentity.key, input.key),
        );
      }
      // The surviving Work is joined live so a renamed survivor never serves
      // a stale title through the permanent redirect.
      const [result] = await database
        .select({ record: workRetiredIdentity, survivor: work })
        .from(workRetiredIdentity)
        .innerJoin(project, eq(workRetiredIdentity.projectId, project.id))
        .innerJoin(work, eq(workRetiredIdentity.survivingWorkId, work.id))
        .where(and(...conditions))
        .limit(1);
      return result ? toRetiredIdentity(result.record, result.survivor) : null;
    },

    async listRetiredIdentityIdsBySurvivor(accountId, survivingWorkId) {
      const workspaceId = await findWorkspaceId(database, accountId);
      if (!workspaceId) {
        return [];
      }
      const records = await database
        .select({ id: workRetiredIdentity.id })
        .from(workRetiredIdentity)
        .innerJoin(project, eq(workRetiredIdentity.projectId, project.id))
        .where(
          and(
            eq(workRetiredIdentity.survivingWorkId, survivingWorkId),
            eq(project.workspaceId, workspaceId),
          ),
        )
        .orderBy(asc(workRetiredIdentity.id));
      return records.map((record) => record.id);
    },

    async findProject(accountId, projectId) {
      const ownedProject = await findOwnedProject(
        database,
        accountId,
        projectId,
        false,
      );
      return ownedProject
        ? { id: ownedProject.record.id, name: ownedProject.record.name }
        : null;
    },

    async findByClientIdempotencyKey(accountId, projectId, key) {
      const workspaceId = await findWorkspaceId(database, accountId);
      if (!workspaceId) {
        return null;
      }
      const [result] = await database
        .select({
          payloadFingerprint: workKeyAllocation.payloadFingerprint,
          record: work,
        })
        .from(workKeyAllocation)
        .innerJoin(work, eq(work.id, workKeyAllocation.workId))
        .innerJoin(project, eq(work.projectId, project.id))
        .where(
          and(
            eq(workKeyAllocation.projectId, projectId),
            eq(workKeyAllocation.clientIdempotencyKey, key),
            eq(work.projectId, projectId),
            eq(project.workspaceId, workspaceId),
          ),
        )
        .limit(1);
      return result
        ? {
            payloadFingerprint: result.payloadFingerprint ?? "",
            work: toWorkProfile(result.record),
          }
        : null;
    },

    async list(accountId, projectId, listOptions) {
      const workspaceId = await findWorkspaceId(database, accountId);
      if (!workspaceId) {
        return [];
      }
      let archivedFilter: SQL | undefined;
      if (listOptions?.archived === "all") {
        archivedFilter = undefined;
      } else if (listOptions?.archived) {
        archivedFilter = isNotNull(work.archivedAt);
      } else {
        archivedFilter = isNull(work.archivedAt);
      }
      const records = await database
        .select({ record: work })
        .from(work)
        .innerJoin(project, eq(work.projectId, project.id))
        .where(
          and(
            eq(work.projectId, projectId),
            eq(project.workspaceId, workspaceId),
            archivedFilter,
          ),
        )
        .orderBy(asc(work.number));
      return records.map(({ record }) => toWorkProfile(record));
    },

    async listIncluded(accountId, featureId) {
      const workspaceId = await findWorkspaceId(database, accountId);
      if (!workspaceId) {
        return [];
      }
      const records = await database
        .select({ record: work })
        .from(work)
        .innerJoin(project, eq(work.projectId, project.id))
        .where(
          and(
            eq(work.primaryFeatureId, featureId),
            eq(project.workspaceId, workspaceId),
          ),
        )
        .orderBy(asc(work.number));
      return records.map(({ record }) => toWorkProfile(record));
    },

    ...(projectDocumentAccess
      ? { hasProjectDocument: projectDocumentAccess.hasProjectDocument }
      : {}),

    reserveCreate(
      accountId,
      projectId,
      clientIdempotencyKey,
      payloadFingerprint,
    ) {
      return database.transaction(
        // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Work key reservation handles ownership, retry recovery, allocation, and project numbering in one transaction.
        async (transaction) => {
          const ownedProject = await findOwnedProject(
            transaction,
            accountId,
            projectId,
            true,
          );
          if (!ownedProject) {
            throw new WorkProjectNotFoundError(projectId);
          }

          const existingQuery = transaction
            .select()
            .from(workKeyAllocation)
            .where(
              and(
                eq(workKeyAllocation.projectId, projectId),
                eq(
                  workKeyAllocation.clientIdempotencyKey,
                  clientIdempotencyKey,
                ),
              ),
            )
            .limit(1)
            .for("update");
          const [existing] = await existingQuery;
          if (existing) {
            const [existingWork] = await transaction
              .select({ id: work.id })
              .from(work)
              .where(eq(work.id, existing.workId))
              .limit(1);
            if (!existingWork) {
              const [updated] = await transaction
                .update(workKeyAllocation)
                .set({
                  payloadFingerprint,
                  reservedAt: new Date(),
                })
                .where(eq(workKeyAllocation.id, existing.id))
                .returning();
              if (!updated) {
                throw new WorkCreationConflictError();
              }
              return toReservation(updated);
            }
            return reserveExistingAllocation(existing, payloadFingerprint);
          }

          const number = ownedProject.record.workCount + 1;
          const workId = crypto.randomUUID();
          const reservedAt = new Date();
          const [updatedProject] = await transaction
            .update(project)
            .set({
              revision: ownedProject.record.revision + 1,
              updatedAt: reservedAt,
              workCount: number,
            })
            .where(
              and(
                eq(project.id, projectId),
                eq(project.revision, ownedProject.record.revision),
              ),
            )
            .returning({ shortCode: project.shortCode });
          if (!updatedProject) {
            throw new WorkCreationConflictError();
          }

          const [allocation] = await transaction
            .insert(workKeyAllocation)
            .values({
              clientIdempotencyKey,
              id: crypto.randomUUID(),
              key: `${updatedProject.shortCode}-${number}`,
              number,
              payloadFingerprint,
              projectId,
              reservedAt,
              shortCode: updatedProject.shortCode,
              workId,
            })
            .onConflictDoNothing()
            .returning();
          if (allocation) {
            return toReservation(allocation);
          }

          const [racedAllocation] = await transaction
            .select()
            .from(workKeyAllocation)
            .where(
              and(
                eq(workKeyAllocation.projectId, projectId),
                eq(
                  workKeyAllocation.clientIdempotencyKey,
                  clientIdempotencyKey,
                ),
              ),
            )
            .limit(1);
          if (!racedAllocation) {
            throw new WorkCreationConflictError();
          }
          return toReservation(racedAllocation);
        },
      );
    },
  };

  const mutationContracts = {
    create: (accountId: string) =>
      createDatabaseMutationContract<WorkLifecycleMutationValue>(database, {
        target: createWorkMutationTarget(accountId, relations),
      }),
    update: (accountId: string) =>
      createDatabaseMutationContract<WorkLifecycleMutationValue>(database, {
        target: createWorkUpdateMutationTarget(accountId, relations),
      }),
  } satisfies WorkLifecycleMutationContracts;
  const lifecycle = createWorkLifecycle({
    mutationContracts,
    relations,
    store,
  });

  if (!customFieldValueWriter) {
    return lifecycle;
  }

  return {
    ...lifecycle,
    createWithCustomFieldValues(
      accountId: string,
      rawInput: Parameters<WorkLifecycleAccess["create"]>[1],
      customFieldValues: readonly CustomFieldValueFinalization[],
    ) {
      const orderedCustomFieldValues = [...customFieldValues].sort(
        (left, right) => left.definitionId.localeCompare(right.definitionId),
      );
      const mutation =
        createDatabaseMutationContract<WorkLifecycleMutationValue>(database, {
          target: createWorkMutationTarget(
            accountId,
            relations,
            customFieldValueWriter,
            orderedCustomFieldValues,
          ),
        });
      return createWork(
        mutationContracts,
        store,
        accountId,
        rawInput,
        undefined,
        mutation,
        { customFieldValues: orderedCustomFieldValues },
      );
    },
  };
}
