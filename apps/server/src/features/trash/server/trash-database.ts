import {
  isTrashRecordKind,
  type TrashAccess,
  type TrashRecordKind,
  trashRecordKey,
} from "@cantiara/api/trash";
import type { Database } from "@cantiara/db";
import { workspace } from "@cantiara/db/schema/auth";
import { project } from "@cantiara/db/schema/project";
import { trashEntry } from "@cantiara/db/schema/trash";
import { and, asc, eq, inArray } from "drizzle-orm";

import { createTrash, type StoredTrashEntry, type TrashStore } from "./trash";
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
    trashedAt: row.trashedAt.toISOString(),
    workspaceId: row.workspaceId,
  };
}

export function createDatabaseTrashStore(database: Database): TrashStore {
  return {
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
        await transaction.insert(trashEntry).values({
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
        });
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

export function createDatabaseTrash(database: Database): TrashAccess {
  return createTrash(createDatabaseTrashStore(database));
}
