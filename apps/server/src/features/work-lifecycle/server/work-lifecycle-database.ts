import type { MutationTarget } from "@cantiara/api/mutation-and-undo";
import {
  type WorkLifecycleMutationValue,
  type WorkProfile,
  type WorkRecreateRelationKind,
  workCaptureProvenanceSchema,
  workChecklistSchema,
  workClosureResultSchema,
  workStatusSchema,
  workTypeSchema,
} from "@cantiara/api/work-lifecycle";
import type { Database } from "@cantiara/db";
import { workspace } from "@cantiara/db/schema/auth";
import {
  project,
  work,
  workKeyAllocation,
  workRelation,
} from "@cantiara/db/schema/index";
import { and, asc, eq, inArray } from "drizzle-orm";

import {
  createDatabaseMutationContract,
  type MutationDatabaseExecutor,
  type MutationDatabaseTargetAdapter,
} from "../../mutation-and-undo/server/mutation-contract-database";
import { describeWorkRecreateRelation } from "../../relations/server/work-recreate-relations";
import {
  createWorkLifecycle,
  WorkCreationConflictError,
  type WorkCreationReservation,
  type WorkLifecycleStore,
  WorkProjectNotFoundError,
} from "./work-lifecycle";

type WorkDatabaseRecord = typeof work.$inferSelect;
type WorkKeyAllocationRecord = typeof workKeyAllocation.$inferSelect;
type WorkRelationRecord = typeof workRelation.$inferSelect;

function toWorkProfile(record: WorkDatabaseRecord): WorkProfile {
  return {
    captureProvenance: record.captureProvenance
      ? workCaptureProvenanceSchema.parse(record.captureProvenance)
      : null,
    checklist: workChecklistSchema.parse(record.checklist),
    closureResult: record.closureResult
      ? workClosureResultSchema.parse(record.closureResult)
      : null,
    createdAt: record.createdAt.toISOString(),
    description: record.description,
    id: record.id,
    key: record.key,
    number: record.number,
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

async function findRecreateRelationSelection(
  executor: MutationDatabaseExecutor,
  accountId: string,
  workspaceId: string,
  recreate: WorkLifecycleMutationValue["recreate"],
): Promise<{
  selectedRelations: WorkRelationRecord[];
  sourceWork: WorkDatabaseRecord | null;
} | null> {
  if (!recreate) {
    return { selectedRelations: [], sourceWork: null };
  }
  const sourceWork = await findOwnedWork(
    executor,
    accountId,
    recreate.sourceWorkId,
    false,
  );
  if (!sourceWork) {
    return null;
  }
  const selectedRelationIds = [...new Set(recreate.selectedRelationIds)];
  const selectedRelations =
    selectedRelationIds.length === 0
      ? []
      : await executor
          .select({ relation: workRelation })
          .from(workRelation)
          .innerJoin(project, eq(workRelation.targetProjectId, project.id))
          .where(
            and(
              eq(workRelation.sourceWorkId, sourceWork.id),
              inArray(workRelation.id, selectedRelationIds),
              eq(project.workspaceId, workspaceId),
            ),
          )
          .then((records) =>
            records
              .map(({ relation }) => relation)
              .filter(
                (relation) =>
                  describeWorkRecreateRelation(
                    relation.kind as WorkRecreateRelationKind,
                  ).portable,
              ),
          );
  if (selectedRelations.length !== selectedRelationIds.length) {
    return null;
  }
  return { selectedRelations, sourceWork };
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

function createWorkMutationTarget(
  accountId: string,
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
      const recreateSelection = await findRecreateRelationSelection(
        executor,
        accountId,
        ownedProject.workspaceId,
        recreate,
      );
      if (!recreateSelection) {
        return null;
      }
      const { selectedRelations, sourceWork } = recreateSelection;

      const [created] = await executor
        .insert(work)
        .values({
          captureProvenance: nextWork.captureProvenance,
          checklist: nextWork.checklist,
          closureResult: nextWork.closureResult,
          createdAt: new Date(nextWork.createdAt),
          description: nextWork.description,
          id: nextWork.id,
          key: nextWork.key,
          number: nextWork.number,
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
        if (recreate && sourceWork) {
          await executor.insert(workRelation).values([
            ...selectedRelations.map((relation) => ({
              createdAt: input.committedAt,
              id: crypto.randomUUID(),
              kind: relation.kind,
              sourceWorkId: created.id,
              targetLabel: relation.targetLabel,
              targetProjectId: relation.targetProjectId,
              targetRecordId: relation.targetRecordId,
            })),
            {
              createdAt: input.committedAt,
              id: crypto.randomUUID(),
              kind: "Origin",
              sourceWorkId: created.id,
              targetLabel: sourceWork.key,
              targetProjectId: sourceWork.projectId,
              targetRecordId: sourceWork.id,
            },
          ]);
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

function createWorkUpdateMutationTarget(
  accountId: string,
): MutationDatabaseTargetAdapter<WorkLifecycleMutationValue> {
  return {
    async find(executor, targetId, lock) {
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
          revision: input.expectedRevision + 1,
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

export function createDatabaseWorkLifecycle(database: Database) {
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
        .select({ record: work })
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
      return result ? toWorkProfile(result.record) : null;
    },

    async list(accountId, projectId) {
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
          ),
        )
        .orderBy(asc(work.number));
      return records.map(({ record }) => toWorkProfile(record));
    },

    async listRecreateRelations(accountId, workId) {
      const sourceWork = await findOwnedWork(
        database,
        accountId,
        workId,
        false,
      );
      const workspaceId = await findWorkspaceId(database, accountId);
      if (!(sourceWork && workspaceId)) {
        return [];
      }
      const records = await database
        .select({
          relation: workRelation,
          targetProjectName: project.name,
        })
        .from(workRelation)
        .innerJoin(project, eq(workRelation.targetProjectId, project.id))
        .where(
          and(
            eq(workRelation.sourceWorkId, sourceWork.id),
            eq(project.workspaceId, workspaceId),
          ),
        )
        .orderBy(asc(workRelation.createdAt), asc(workRelation.id));
      return records.map(({ relation, targetProjectName }) => {
        const kind = relation.kind as WorkRecreateRelationKind;
        return {
          id: relation.id,
          kind,
          ...describeWorkRecreateRelation(kind),
          targetLabel: relation.targetLabel,
          targetProjectName,
        };
      });
    },

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
          target: createWorkMutationTarget(accountId),
        }),
      update: (accountId) =>
        createDatabaseMutationContract<WorkLifecycleMutationValue>(database, {
          target: createWorkUpdateMutationTarget(accountId),
        }),
    },
    store,
  });
}
