import type { ProjectShellAccess } from "@cantiara/api/project-shell";
import {
  type WorkDraft,
  type WorkDraftMutationValue,
  workDraftFormSchema,
} from "@cantiara/api/work-drafts";
import type { WorkLifecycleAccess } from "@cantiara/api/work-lifecycle";
import type { Database } from "@cantiara/db";
import { workDraft } from "@cantiara/db/schema/work-draft";
import { and, desc, eq, isNull } from "drizzle-orm";

import type {
  MutationDatabaseExecutor,
  MutationDatabaseTargetAdapter,
} from "../../mutation-and-undo/server/mutation-contract-database";
import { createDatabaseMutationContract } from "../../mutation-and-undo/server/mutation-contract-database";
import {
  createWorkDrafts,
  isFinalizationReservationStale,
  type WorkDraftRecord,
  type WorkDraftStore,
} from "./work-drafts";

type WorkDraftDatabaseRecord = typeof workDraft.$inferSelect;

function toWorkDraftValue(record: WorkDraftDatabaseRecord): WorkDraft {
  const values = workDraftFormSchema.parse({
    checklist: record.checklist,
    customFieldValues: record.customFieldValues,
    description: record.description,
    projectId: record.projectId,
    title: record.title,
    type: record.type,
  });
  return {
    ...values,
    createdAt: record.createdAt.toISOString(),
    id: record.id,
    revision: record.revision,
    updatedAt: record.updatedAt.toISOString(),
  };
}

function toWorkDraftRecord(record: WorkDraftDatabaseRecord): WorkDraftRecord {
  return {
    ...toWorkDraftValue(record),
    consumedAt: record.consumedAt?.toISOString() ?? null,
    finalizedWorkId: record.finalizedWorkId,
    finalizingClientIdempotencyKey: record.finalizingClientIdempotencyKey,
  };
}

async function findDraft(
  executor: MutationDatabaseExecutor,
  accountId: string,
  draftId: string,
  lock = false,
) {
  const query = executor
    .select()
    .from(workDraft)
    .where(and(eq(workDraft.accountId, accountId), eq(workDraft.id, draftId)))
    .limit(1);
  const records = lock ? await query.for("update") : await query;
  const [record] = records;
  return record ?? null;
}

const workDraftMutationTargetAdapter: MutationDatabaseTargetAdapter<WorkDraftMutationValue> =
  {
    async find(executor, targetId, lock) {
      const target = parseWorkDraftTarget(targetId);
      if (!target) {
        return null;
      }
      const record = await findDraft(
        executor,
        target.accountId,
        target.draftId,
        lock,
      );
      if (!record) {
        return {
          id: targetId,
          revision: 0,
          value: { draft: null },
        };
      }
      if (record.consumedAt || record.finalizingClientIdempotencyKey) {
        return {
          id: targetId,
          revision: record.revision,
          value: { draft: null },
        };
      }
      return {
        id: targetId,
        revision: record.revision,
        value: { draft: toWorkDraftValue(record) },
      };
    },

    async update(executor, input) {
      const target = parseWorkDraftTarget(input.targetId);
      const nextDraft = input.nextValue.draft;
      if (!target) {
        return null;
      }

      const current = await findDraft(
        executor,
        target.accountId,
        target.draftId,
        true,
      );
      if (current?.consumedAt || current?.finalizingClientIdempotencyKey) {
        return null;
      }

      if (!nextDraft) {
        const deleted = await executor
          .delete(workDraft)
          .where(
            and(
              eq(workDraft.accountId, target.accountId),
              eq(workDraft.id, target.draftId),
              eq(workDraft.revision, input.expectedRevision),
            ),
          )
          .returning({ id: workDraft.id });
        return deleted.length > 0
          ? {
              id: input.targetId,
              revision: input.expectedRevision + 1,
              value: { draft: null },
            }
          : null;
      }

      const nextRevision = input.expectedRevision + 1;
      if (current) {
        const [updated] = await executor
          .update(workDraft)
          .set({
            checklist: nextDraft.checklist,
            customFieldValues: nextDraft.customFieldValues,
            description: nextDraft.description,
            projectId: nextDraft.projectId,
            revision: nextRevision,
            title: nextDraft.title,
            type: nextDraft.type,
            updatedAt: input.committedAt,
          })
          .where(
            and(
              eq(workDraft.accountId, target.accountId),
              eq(workDraft.id, target.draftId),
              eq(workDraft.revision, input.expectedRevision),
            ),
          )
          .returning();
        return updated
          ? {
              id: input.targetId,
              revision: updated.revision,
              value: { draft: toWorkDraftValue(updated) },
            }
          : null;
      }

      const [inserted] = await executor
        .insert(workDraft)
        .values({
          accountId: target.accountId,
          checklist: nextDraft.checklist,
          customFieldValues: nextDraft.customFieldValues,
          description: nextDraft.description,
          id: target.draftId,
          projectId: nextDraft.projectId,
          revision: nextRevision,
          title: nextDraft.title,
          type: nextDraft.type,
          updatedAt: input.committedAt,
        })
        .onConflictDoNothing()
        .returning();
      return inserted
        ? {
            id: input.targetId,
            revision: inserted.revision,
            value: { draft: toWorkDraftValue(inserted) },
          }
        : null;
    },
  };

function parseWorkDraftTarget(targetId: string) {
  const prefix = "work-draft:";
  if (!targetId.startsWith(prefix)) {
    return null;
  }
  const value = targetId.slice(prefix.length);
  const separator = value.indexOf(":");
  if (separator <= 0 || separator === value.length - 1) {
    return null;
  }
  return {
    accountId: value.slice(0, separator),
    draftId: value.slice(separator + 1),
  };
}

function createWorkDraftStore(
  database: Database,
  now: () => Date = () => new Date(),
): WorkDraftStore {
  return {
    async find(accountId, draftId) {
      const record = await findDraft(database, accountId, draftId);
      return record ? toWorkDraftRecord(record) : null;
    },

    async list(accountId, projectId) {
      const conditions = [
        eq(workDraft.accountId, accountId),
        isNull(workDraft.consumedAt),
        ...(projectId ? [eq(workDraft.projectId, projectId)] : []),
      ];
      const records = await database
        .select()
        .from(workDraft)
        .where(and(...conditions))
        .orderBy(desc(workDraft.updatedAt));
      return records.map(toWorkDraftRecord);
    },

    async markConsumed(accountId, draftId, workId, consumedAt) {
      const [updated] = await database
        .update(workDraft)
        .set({
          consumedAt: new Date(consumedAt),
          finalizedWorkId: workId,
        })
        .where(
          and(
            eq(workDraft.accountId, accountId),
            eq(workDraft.id, draftId),
            isNull(workDraft.consumedAt),
          ),
        )
        .returning();
      return updated ? toWorkDraftRecord(updated) : null;
    },

    async releaseFinalization(accountId, draftId, clientIdempotencyKey) {
      await database
        .update(workDraft)
        .set({ finalizingClientIdempotencyKey: null })
        .where(
          and(
            eq(workDraft.accountId, accountId),
            eq(workDraft.id, draftId),
            eq(workDraft.finalizingClientIdempotencyKey, clientIdempotencyKey),
            isNull(workDraft.consumedAt),
          ),
        );
    },

    reserveFinalization(accountId, draftId, clientIdempotencyKey) {
      return database.transaction(
        // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Reservation recovery keeps the lock, lease, and optimistic update in one transaction.
        async (transaction) => {
          const record = await findDraft(transaction, accountId, draftId, true);
          if (!record) {
            return { status: "not-found" as const };
          }
          const current = toWorkDraftRecord(record);
          if (current.consumedAt) {
            return { draft: current, status: "consumed" as const };
          }
          if (
            current.finalizingClientIdempotencyKey &&
            current.finalizingClientIdempotencyKey !== clientIdempotencyKey
          ) {
            // A reservation older than the crash-recovery lease is dead; a retry
            // takes it over instead of leaving the Draft locked forever.
            if (isFinalizationReservationStale(current.updatedAt, now())) {
              const [takenOver] = await transaction
                .update(workDraft)
                .set({
                  finalizingClientIdempotencyKey: clientIdempotencyKey,
                  updatedAt: now(),
                })
                .where(
                  and(
                    eq(workDraft.accountId, accountId),
                    eq(workDraft.id, draftId),
                    eq(
                      workDraft.finalizingClientIdempotencyKey,
                      current.finalizingClientIdempotencyKey,
                    ),
                  ),
                )
                .returning();
              return takenOver
                ? {
                    draft: toWorkDraftRecord(takenOver),
                    status: "reserved" as const,
                  }
                : { status: "not-found" as const };
            }
            return { draft: current, status: "finalizing" as const };
          }
          if (current.finalizingClientIdempotencyKey === clientIdempotencyKey) {
            return { draft: current, status: "reserved" as const };
          }
          const [reserved] = await transaction
            .update(workDraft)
            .set({
              finalizingClientIdempotencyKey: clientIdempotencyKey,
              updatedAt: now(),
            })
            .where(
              and(
                eq(workDraft.accountId, accountId),
                eq(workDraft.id, draftId),
              ),
            )
            .returning();
          return reserved
            ? {
                draft: toWorkDraftRecord(reserved),
                status: "reserved" as const,
              }
            : { status: "not-found" as const };
        },
      );
    },
  };
}

export function createDatabaseWorkDrafts(
  database: Database,
  workLifecycle: WorkLifecycleAccess,
  projects: Pick<ProjectShellAccess, "find">,
  now?: () => Date,
) {
  const mutationContract =
    createDatabaseMutationContract<WorkDraftMutationValue>(database, {
      target: workDraftMutationTargetAdapter,
    });
  return createWorkDrafts({
    mutationContract,
    ...(now ? { now } : {}),
    projects,
    store: createWorkDraftStore(database, now),
    workLifecycle,
  });
}

export { workDraftMutationTargetAdapter };
