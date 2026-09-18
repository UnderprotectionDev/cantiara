import type { MutationTarget } from "@cantiara/api/mutation-and-undo";
import {
  type WorkLifecycleMutationValue,
  type WorkProfile,
  workCaptureProvenanceSchema,
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
  createWorkLifecycle,
  WorkCreationConflictError,
  type WorkCreationReservation,
  type WorkLifecycleStore,
  WorkProjectNotFoundError,
} from "./work-lifecycle";

type WorkDatabaseRecord = typeof work.$inferSelect;
type WorkKeyAllocationRecord = typeof workKeyAllocation.$inferSelect;

function toWorkProfile(record: WorkDatabaseRecord): WorkProfile {
  return {
    archivedAt: record.archivedAt?.toISOString() ?? null,
    captureProvenance: record.captureProvenance
      ? workCaptureProvenanceSchema.parse(record.captureProvenance)
      : null,
    closureResult: record.closureResult
      ? workClosureResultSchema.parse(record.closureResult)
      : null,
    createdAt: record.createdAt.toISOString(),
    id: record.id,
    key: record.key,
    number: record.number,
    projectId: record.projectId,
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

      const [created] = await executor
        .insert(work)
        .values({
          archivedAt: nextWork.archivedAt
            ? new Date(nextWork.archivedAt)
            : null,
          captureProvenance: nextWork.captureProvenance,
          closureResult: nextWork.closureResult,
          createdAt: new Date(nextWork.createdAt),
          id: nextWork.id,
          key: nextWork.key,
          number: nextWork.number,
          projectId: nextWork.projectId,
          revision: input.expectedRevision + 1,
          status: nextWork.status,
          title: nextWork.title,
          type: nextWork.type,
          updatedAt: input.committedAt,
        })
        .onConflictDoNothing()
        .returning();
      if (created) {
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
          archivedAt: nextWork.archivedAt
            ? new Date(nextWork.archivedAt)
            : null,
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

    async list(accountId, projectId, options) {
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
            options?.archived
              ? isNotNull(work.archivedAt)
              : isNull(work.archivedAt),
          ),
        )
        .orderBy(asc(work.number));
      return records.map(({ record }) => toWorkProfile(record));
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
