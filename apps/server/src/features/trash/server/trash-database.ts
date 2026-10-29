import {
  isTrashRecordKind,
  type TrashAccess,
  type TrashRecordKind,
  trashRecordKey,
} from "@cantiara/api/trash";
import type { Database } from "@cantiara/db";
import { workspace } from "@cantiara/db/schema/auth";
import { project } from "@cantiara/db/schema/project";
import { trashEntry, trashRestoreReceipt } from "@cantiara/db/schema/trash";
import { and, asc, eq, inArray } from "drizzle-orm";

import {
  createTrash,
  type StoredRestoreReceipt,
  type StoredTrashEntry,
  type TrashStore,
  type TrashSurfacePort,
} from "./trash";
import { trashRecordAdapters } from "./trash-records-database";

function toStored(row: typeof trashEntry.$inferSelect): StoredTrashEntry {
  return {
    actorAccountId: row.actorAccountId,
    baseRevision: row.baseRevision,
    expiresAt: row.expiresAt.toISOString(),
    groupId: row.groupId,
    id: row.id,
    idempotencyKey: row.idempotencyKey,
    idempotencyScope: row.idempotencyScope,
    payloadFingerprint: row.payloadFingerprint,
    projectId: row.projectId,
    recordId: row.recordId,
    recordKind: row.recordKind as TrashRecordKind,
    recordLabel: row.recordLabel,
    revision: row.baseRevision + 1,
    trashedAt: row.trashedAt.toISOString(),
    workspaceId: row.workspaceId,
  };
}

function toReceipt(
  row: typeof trashRestoreReceipt.$inferSelect,
): StoredRestoreReceipt {
  return {
    idempotencyKey: row.idempotencyKey,
    idempotencyScope: row.idempotencyScope,
    payloadFingerprint: row.payloadFingerprint,
    result: row.result as StoredRestoreReceipt["result"],
  };
}

function entryValues(entry: StoredTrashEntry) {
  return {
    actorAccountId: entry.actorAccountId,
    baseRevision: entry.baseRevision,
    expiresAt: new Date(entry.expiresAt),
    groupId: entry.groupId,
    id: entry.id,
    idempotencyKey: entry.idempotencyKey,
    idempotencyScope: entry.idempotencyScope,
    payloadFingerprint: entry.payloadFingerprint,
    projectId: entry.projectId,
    recordId: entry.recordId,
    recordKind: entry.recordKind,
    recordLabel: entry.recordLabel,
    trashedAt: new Date(entry.trashedAt),
    workspaceId: entry.workspaceId,
  };
}

/** Thrown inside a transaction to roll the whole unit back with a typed outcome. */
class Rollback<T> extends Error {
  readonly outcome: T;

  constructor(outcome: T) {
    super("rollback");
    this.outcome = outcome;
  }
}

export function createDatabaseTrashStore(database: Database): TrashStore {
  return {
    async commitGroup(group) {
      try {
        return await database.transaction(async (transaction) => {
          for (const entry of group) {
            const adapter = trashRecordAdapters[entry.recordKind];
            // biome-ignore lint/performance/noAwaitInLoops: Stamps run in order inside one transaction so the first loss rolls the group back.
            const stamped = await adapter.stamp(
              transaction,
              entry.projectId,
              entry.recordId,
              entry.baseRevision,
              new Date(entry.trashedAt),
            );
            if (!stamped) {
              const [earlier] = await transaction
                .select()
                .from(trashEntry)
                .where(
                  and(
                    eq(trashEntry.idempotencyScope, entry.idempotencyScope),
                    eq(trashEntry.idempotencyKey, entry.idempotencyKey),
                  ),
                )
                .limit(1);
              if (earlier) {
                throw new Rollback({
                  entry: toStored(earlier),
                  status: "replayed" as const,
                });
              }
              const facts = await adapter.read(
                transaction,
                entry.projectId,
                entry.recordId,
              );
              throw new Rollback(
                facts && !facts.trashed
                  ? {
                      currentRevision: facts.revision,
                      status: "stale" as const,
                    }
                  : { status: "already-trashed" as const },
              );
            }
          }
          await transaction.insert(trashEntry).values(group.map(entryValues));
          return { status: "moved" as const };
        });
      } catch (error) {
        if (error instanceof Rollback) {
          return error.outcome;
        }
        throw error;
      }
    },

    async commitRestore(unit, receipt) {
      try {
        return await database.transaction(async (transaction) => {
          const [earlier] = await transaction
            .select()
            .from(trashRestoreReceipt)
            .where(
              and(
                eq(
                  trashRestoreReceipt.idempotencyScope,
                  receipt.idempotencyScope,
                ),
                eq(trashRestoreReceipt.idempotencyKey, receipt.idempotencyKey),
              ),
            )
            .limit(1);
          if (earlier) {
            throw new Rollback({
              receipt: toReceipt(earlier),
              status: "replayed" as const,
            });
          }
          for (const [index, entry] of unit.entries()) {
            const restored = receipt.result.records[index];
            const adapter = trashRecordAdapters[entry.recordKind];
            // biome-ignore lint/performance/noAwaitInLoops: Un-stamps run in order inside one transaction so the first loss rolls the group back.
            const cleared = await adapter.unstamp(
              transaction,
              entry.projectId,
              entry.recordId,
              (restored?.revision ?? 1) - 1,
            );
            if (!cleared) {
              const facts = await adapter.read(
                transaction,
                entry.projectId,
                entry.recordId,
              );
              throw new Rollback(
                facts
                  ? {
                      currentRevision: facts.revision,
                      recordId: entry.recordId,
                      status: "stale" as const,
                    }
                  : { status: "gone" as const },
              );
            }
          }
          await transaction.delete(trashEntry).where(
            inArray(
              trashEntry.id,
              unit.map(({ id }) => id),
            ),
          );
          await transaction.insert(trashRestoreReceipt).values({
            idempotencyKey: receipt.idempotencyKey,
            idempotencyScope: receipt.idempotencyScope,
            payloadFingerprint: receipt.payloadFingerprint,
            projectId: receipt.result.projectId,
            restoredAt: new Date(receipt.result.restoredAt),
            result: receipt.result,
          });
          return { status: "restored" as const };
        });
      } catch (error) {
        if (error instanceof Rollback) {
          return error.outcome;
        }
        throw error;
      }
    },

    async find(projectId, entryId) {
      const [row] = await database
        .select()
        .from(trashEntry)
        .where(
          and(eq(trashEntry.projectId, projectId), eq(trashEntry.id, entryId)),
        )
        .limit(1);
      return row ? toStored(row) : null;
    },

    async group(projectId, groupId) {
      const rows = await database
        .select()
        .from(trashEntry)
        .where(
          and(
            eq(trashEntry.projectId, projectId),
            eq(trashEntry.groupId, groupId),
          ),
        )
        .orderBy(asc(trashEntry.id));
      return rows.map(toStored);
    },

    async restoreReceipt(scope, key) {
      const [row] = await database
        .select()
        .from(trashRestoreReceipt)
        .where(
          and(
            eq(trashRestoreReceipt.idempotencyScope, scope),
            eq(trashRestoreReceipt.idempotencyKey, key),
          ),
        )
        .limit(1);
      return row ? toReceipt(row) : null;
    },

    async commit(entry) {
      return await database.transaction(async (transaction) => {
        const adapter = trashRecordAdapters[entry.recordKind];
        const stamped = await adapter.stamp(
          transaction,
          entry.projectId,
          entry.recordId,
          entry.baseRevision,
          new Date(entry.trashedAt),
        );
        if (!stamped) {
          // Lost a race: the record moved on, was trashed, or the same key won.
          const [earlier] = await transaction
            .select()
            .from(trashEntry)
            .where(
              and(
                eq(trashEntry.idempotencyScope, entry.idempotencyScope),
                eq(trashEntry.idempotencyKey, entry.idempotencyKey),
              ),
            )
            .limit(1);
          if (earlier) {
            return { entry: toStored(earlier), status: "replayed" as const };
          }
          const facts = await adapter.read(
            transaction,
            entry.projectId,
            entry.recordId,
          );
          return facts && !facts.trashed
            ? { currentRevision: facts.revision, status: "stale" as const }
            : { status: "already-trashed" as const };
        }
        await transaction.insert(trashEntry).values(entryValues(entry));
        return { status: "moved" as const };
      });
    },

    async list(projectId) {
      const rows = await database
        .select()
        .from(trashEntry)
        .where(eq(trashEntry.projectId, projectId))
        .orderBy(asc(trashEntry.expiresAt), asc(trashEntry.id));
      return rows.map(toStored);
    },

    async project(accountId, projectId) {
      const [row] = await database
        .select({ workspaceId: project.workspaceId })
        .from(project)
        .innerJoin(workspace, eq(project.workspaceId, workspace.id))
        .where(
          and(
            eq(project.id, projectId),
            eq(workspace.ownerAccountId, accountId),
          ),
        )
        .limit(1);
      return row ?? null;
    },

    async record(projectId, kind, recordId) {
      return await trashRecordAdapters[kind].read(
        database,
        projectId,
        recordId,
      );
    },

    async replay(scope, key) {
      const [row] = await database
        .select()
        .from(trashEntry)
        .where(
          and(
            eq(trashEntry.idempotencyScope, scope),
            eq(trashEntry.idempotencyKey, key),
          ),
        )
        .limit(1);
      return row ? toStored(row) : null;
    },

    async trashedKeys(projectId, records) {
      const ids = records.map((ref) => ref.id);
      if (ids.length === 0) {
        return new Set();
      }
      const rows = await database
        .select({
          recordId: trashEntry.recordId,
          recordKind: trashEntry.recordKind,
        })
        .from(trashEntry)
        .where(
          and(
            eq(trashEntry.projectId, projectId),
            inArray(trashEntry.recordId, ids),
          ),
        );
      return new Set(
        rows
          .filter((row) => isTrashRecordKind(row.recordKind))
          .map((row) =>
            trashRecordKey({
              id: row.recordId,
              kind: row.recordKind as TrashRecordKind,
            }),
          ),
      );
    },
  };
}

export function createDatabaseTrash(
  database: Database,
  surfaces?: TrashSurfacePort,
): TrashAccess {
  return createTrash(createDatabaseTrashStore(database), { surfaces });
}
