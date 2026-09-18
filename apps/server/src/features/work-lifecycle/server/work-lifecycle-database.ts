import type {
  MutationPayload,
  MutationTarget,
} from "@cantiara/api/mutation-and-undo";
import {
  featureHealthUpdateSchema,
  type WorkLifecycleMutationValue,
  type WorkProfile,
  workCaptureProvenanceSchema,
  workChecklistSchema,
  workClosureResultSchema,
  workStatusSchema,
  workTypeSchema,
} from "@cantiara/api/work-lifecycle";
import type { Database } from "@cantiara/db";
import { workspace } from "@cantiara/db/schema/auth";
import { project, work, workKeyAllocation } from "@cantiara/db/schema/index";
import { and, asc, eq, isNotNull, isNull } from "drizzle-orm";

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
  createWorkLifecycle,
  WorkCreationConflictError,
  type WorkCreationReservation,
  WorkFeatureExitBlockedError,
  WorkInclusionConflictError,
  type WorkLifecycleStore,
  WorkProjectNotFoundError,
  WorkRecreatePreviewRequiredError,
} from "./work-lifecycle";

type WorkDatabaseRecord = typeof work.$inferSelect;
type WorkKeyAllocationRecord = typeof workKeyAllocation.$inferSelect;

function toWorkProfile(record: WorkDatabaseRecord): WorkProfile {
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
): MutationDatabaseTargetAdapter<WorkLifecycleMutationValue> {
  return {
    find: async (_executor, targetId) => emptyWorkTarget(targetId),

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

function createWorkUpdateMutationTarget(
  accountId: string,
): MutationDatabaseTargetAdapter<WorkLifecycleMutationValue> {
  return {
    async find(executor, targetId, lock, context) {
      if (lock) {
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
  options: { projectDocumentAccess?: WorkLifecycleProjectDocumentAccess } = {},
) {
  const relations = createDatabaseWorkRelations(database);
  const { projectDocumentAccess } = options;
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
      const records = await database
        .select({ record: work })
        .from(work)
        .innerJoin(project, eq(work.projectId, project.id))
        .where(
          and(
            eq(work.projectId, projectId),
            eq(project.workspaceId, workspaceId),
            listOptions?.archived
              ? isNotNull(work.archivedAt)
              : isNull(work.archivedAt),
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
      return database.transaction(async (transaction) => {
        const ownedProject = await findOwnedProject(
          transaction,
          accountId,
          projectId,
          true,
        );
        if (!ownedProject) {
          throw new WorkProjectNotFoundError(projectId);
        }

        const [existing] = await transaction
          .select()
          .from(workKeyAllocation)
          .where(
            and(
              eq(workKeyAllocation.projectId, projectId),
              eq(workKeyAllocation.clientIdempotencyKey, clientIdempotencyKey),
            ),
          )
          .limit(1);
        if (existing) {
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
              eq(workKeyAllocation.clientIdempotencyKey, clientIdempotencyKey),
            ),
          )
          .limit(1);
        if (!racedAllocation) {
          throw new WorkCreationConflictError();
        }
        return toReservation(racedAllocation);
      });
    },
  };

  return createWorkLifecycle({
    mutationContracts: {
      create: (accountId) =>
        createDatabaseMutationContract<WorkLifecycleMutationValue>(database, {
          target: createWorkMutationTarget(accountId, relations),
        }),
      update: (accountId) =>
        createDatabaseMutationContract<WorkLifecycleMutationValue>(database, {
          target: createWorkUpdateMutationTarget(accountId),
        }),
    },
    relations,
    store,
  });
}
