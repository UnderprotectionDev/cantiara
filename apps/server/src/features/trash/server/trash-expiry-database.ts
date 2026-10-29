import {
  isTrashRecordKind,
  TRASH_PERMANENT_DELETE_EVENT_TYPE,
  type TrashRecordKind,
} from "@cantiara/api/trash";
import type { Database } from "@cantiara/db";
import { auditRecord } from "@cantiara/db/schema/auth";
import { externalSurface } from "@cantiara/db/schema/external-surface";
import { githubExternalRecordTombstone } from "@cantiara/db/schema/github-integration";
import {
  mutationHistory,
  mutationReceipt,
  mutationStaging,
  mutationTarget,
} from "@cantiara/db/schema/mutation";
import { workRelation } from "@cantiara/db/schema/relation";
import { securityEvent } from "@cantiara/db/schema/security-event";
import { trashEntry } from "@cantiara/db/schema/trash";
import type { SecurityEventDatabase } from "@cantiara/db/security-events";
import { and, asc, eq, inArray, isNull, like, lte, or } from "drizzle-orm";

import type { StoredTrashEntry } from "./trash";
import {
  parseTrashTargetAlias,
  type TrashDeleteBlocker,
  type TrashEventLog,
  type TrashExpiryStore,
  type TrashPermanentDeleteEvent,
} from "./trash-expiry";
import {
  type TrashRecordExecutor,
  trashRecordAdapters,
} from "./trash-records-database";

const REPLAY_BATCH_SIZE = 1000;
const LIKE_ESCAPE = /[\\%_]/g;

/** The irreversible security log adapter: append-only, secret-free, one row per record. */
export function createDatabaseTrashEventLog(
  database: SecurityEventDatabase,
): TrashEventLog {
  return {
    async append(event) {
      await database
        .insert(securityEvent)
        .values({
          actorAlias: event.actorAlias,
          id: event.id,
          occurredAt: new Date(event.occurredAt),
          targetSessionAlias: event.targetAlias,
          type: event.type,
          version: event.version,
        })
        .onConflictDoNothing({ target: securityEvent.id });
    },
    async list() {
      const rows = await database
        .select()
        .from(securityEvent)
        .where(eq(securityEvent.type, TRASH_PERMANENT_DELETE_EVENT_TYPE))
        .orderBy(asc(securityEvent.occurredAt));
      return rows.flatMap((row): TrashPermanentDeleteEvent[] =>
        row.version === 1
          ? [
              {
                actorAlias: row.actorAlias,
                id: row.id,
                occurredAt: row.occurredAt.toISOString(),
                targetAlias: row.targetSessionAlias,
                type: TRASH_PERMANENT_DELETE_EVENT_TYPE,
                version: 1,
              },
            ]
          : [],
      );
    },
  };
}

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

/** Receipts, history and staged writes that still name the record carry its content. */
async function eraseMutationTraces(
  executor: TrashRecordExecutor,
  recordId: string,
) {
  const suffix = `%:${recordId.replace(LIKE_ESCAPE, "\\$&")}`;
  await executor
    .delete(mutationReceipt)
    .where(
      or(
        eq(mutationReceipt.targetId, recordId),
        like(mutationReceipt.targetId, suffix),
      ),
    );
  await executor
    .delete(mutationHistory)
    .where(
      or(
        eq(mutationHistory.targetId, recordId),
        like(mutationHistory.targetId, suffix),
      ),
    );
  await executor
    .delete(mutationTarget)
    .where(
      or(eq(mutationTarget.id, recordId), like(mutationTarget.id, suffix)),
    );
  await executor
    .delete(mutationStaging)
    .where(
      or(
        eq(mutationStaging.targetId, recordId),
        like(mutationStaging.targetId, suffix),
      ),
    );
}

/**
 * Removes one record's content and everything that would show it, then marks
 * the living relations that pointed at it `Permanently deleted`. A GitHub
 * record adapter returns a content-free tombstone (provider kind, source id,
 * number, local alias) so a webhook cannot recreate it.
 */
async function eraseRecord(
  executor: TrashRecordExecutor,
  kind: TrashRecordKind,
  recordId: string,
  at: Date,
) {
  const erased = await trashRecordAdapters[kind].erase(executor, recordId);
  if (!erased) {
    return false;
  }
  await eraseMutationTraces(executor, recordId);
  await executor
    .update(workRelation)
    .set({ brokenReason: "Permanently deleted" })
    .where(
      and(
        eq(workRelation.targetRecordType, kind),
        eq(workRelation.targetRecordId, recordId),
      ),
    );
  if (erased.githubTombstone) {
    await executor
      .insert(githubExternalRecordTombstone)
      .values({ ...erased.githubTombstone, deletedAt: at })
      .onConflictDoNothing();
  }
  return true;
}

async function writeAudit(
  executor: TrashRecordExecutor,
  event: TrashPermanentDeleteEvent,
) {
  // Aliased identity, event type, time and actor only.
  await executor
    .insert(auditRecord)
    .values({
      actorAlias: event.actorAlias,
      id: `audit:${event.id}`,
      occurredAt: new Date(event.occurredAt),
      targetSessionAlias: event.targetAlias,
      type: event.type,
    })
    .onConflictDoNothing({ target: auditRecord.id });
}

/** The replay history grouped by record kind, then by record id (last event wins). */
function eventsByKind(history: readonly TrashPermanentDeleteEvent[]) {
  const byKind = new Map<
    TrashRecordKind,
    Map<string, TrashPermanentDeleteEvent>
  >();
  for (const event of history) {
    const target = parseTrashTargetAlias(event.targetAlias);
    if (target && isTrashRecordKind(target.kind)) {
      const ids = byKind.get(target.kind) ?? new Map();
      ids.set(target.recordId, event);
      byKind.set(target.kind, ids);
    }
  }
  return byKind;
}

/** Erases one resurrected record, its entry and living-relation presence in one transaction. */
function replayOne(
  database: Database,
  kind: TrashRecordKind,
  recordId: string,
  event: TrashPermanentDeleteEvent,
) {
  return database.transaction(async (transaction) => {
    await eraseRecord(transaction, kind, recordId, new Date(event.occurredAt));
    await transaction
      .delete(trashEntry)
      .where(
        and(eq(trashEntry.recordKind, kind), eq(trashEntry.recordId, recordId)),
      );
    await writeAudit(transaction, event);
  });
}

export function createDatabaseTrashExpiry(
  database: Database,
): TrashExpiryStore {
  return {
    async blockers(unit) {
      const found = new Set<TrashDeleteBlocker>();
      for (const entry of unit) {
        // biome-ignore lint/performance/noAwaitInLoops: A unit is a handful of records; each lookup is one indexed query.
        const [live] = await database
          .select({ id: externalSurface.id })
          .from(externalSurface)
          .where(
            and(
              isNull(externalSurface.cancelledAt),
              isNull(externalSurface.trashedAt),
              or(
                and(
                  eq(externalSurface.rootKind, entry.recordKind),
                  eq(externalSurface.rootId, entry.recordId),
                ),
                entry.recordKind === "Document"
                  ? eq(externalSurface.documentId, entry.recordId)
                  : undefined,
              ),
            ),
          )
          .limit(1);
        if (live) {
          found.add("active-surface");
        }
        // Sensitive content: the redaction engine (spec 78) does not exist
        // yet, so there is no pending-removal state to read; a permanent
        // delete removes the content itself.
      }
      return [...found];
    },

    async due(now) {
      const dueRows = await database
        .select()
        .from(trashEntry)
        .where(lte(trashEntry.expiresAt, now))
        .orderBy(asc(trashEntry.expiresAt), asc(trashEntry.id));
      const groupIds = [
        ...new Set(
          dueRows.flatMap((row) => (row.groupId ? [row.groupId] : [])),
        ),
      ];
      const groupRows =
        groupIds.length > 0
          ? await database
              .select()
              .from(trashEntry)
              .where(inArray(trashEntry.groupId, groupIds))
              .orderBy(asc(trashEntry.id))
          : [];
      const units: StoredTrashEntry[][] = [];
      for (const row of dueRows) {
        if (!row.groupId) {
          units.push([toStored(row)]);
        }
      }
      for (const groupId of groupIds) {
        // The group is one unit: every member goes, whichever row was due.
        units.push(
          groupRows.filter((row) => row.groupId === groupId).map(toStored),
        );
      }
      return units;
    },

    async erase(unit, events) {
      return await database.transaction(async (transaction) => {
        const current = await transaction
          .select({ id: trashEntry.id })
          .from(trashEntry)
          .where(
            inArray(
              trashEntry.id,
              unit.map(({ id }) => id),
            ),
          )
          .for("update");
        if (current.length !== unit.length) {
          return false;
        }
        for (const entry of unit) {
          // biome-ignore lint/performance/noAwaitInLoops: Records of one unit are erased inside one transaction, in order.
          await eraseRecord(
            transaction,
            entry.recordKind,
            entry.recordId,
            new Date(events[0]?.occurredAt ?? Date.now()),
          );
        }
        await transaction.delete(trashEntry).where(
          inArray(
            trashEntry.id,
            unit.map(({ id }) => id),
          ),
        );
        await Promise.all(
          events.map((event) => writeAudit(transaction, event)),
        );
        return true;
      });
    },

    async eraseResurrected(history) {
      let erased = 0;
      for (const [kind, events] of eventsByKind(history)) {
        const ids = [...events.keys()];
        for (let offset = 0; offset < ids.length; offset += REPLAY_BATCH_SIZE) {
          // biome-ignore lint/performance/noAwaitInLoops: Bound each IN list below the PostgreSQL parameter limit.
          const alive = await trashRecordAdapters[kind].existing(
            database,
            ids.slice(offset, offset + REPLAY_BATCH_SIZE),
          );
          const replayed = alive.flatMap((recordId) => {
            const event = events.get(recordId);
            return event ? [{ event, recordId }] : [];
          });
          for (const { event, recordId } of replayed) {
            // biome-ignore lint/performance/noAwaitInLoops: Apply the protected replay in order before the server accepts writes.
            await replayOne(database, kind, recordId, event);
            erased += 1;
          }
        }
      }
      return erased;
    },
  };
}
