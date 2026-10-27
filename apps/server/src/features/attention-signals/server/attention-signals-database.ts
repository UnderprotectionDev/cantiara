import type { StoredAttentionSignal } from "@cantiara/api/attention-signals";
import type { Database } from "@cantiara/db";
import { attentionSignal } from "@cantiara/db/schema/attention-signals";
import { and, eq } from "drizzle-orm";

import {
  type AttentionSignalStore,
  createAttentionSignals,
} from "./attention-signals";

const toStored = (
  row: typeof attentionSignal.$inferSelect,
): StoredAttentionSignal => ({
  closedAt: row.closedAt?.toISOString() ?? null,
  eventId: row.eventId,
  group: { id: row.groupId, kind: row.groupKind },
  id: row.id,
  occurredAt: row.occurredAt.toISOString(),
  projectId: row.projectId,
  readAt: row.readAt?.toISOString() ?? null,
  reason: row.reason,
  signalId: row.signalId as StoredAttentionSignal["signalId"],
  targetId: row.targetId,
});

export function createDatabaseAttentionSignalStore(
  database: Database,
): AttentionSignalStore {
  return {
    async insertIfAbsent(accountId, signal) {
      const [inserted] = await database
        .insert(attentionSignal)
        .values({
          accountId,
          eventId: signal.eventId,
          groupId: signal.group.id,
          groupKind: signal.group.kind,
          id: signal.id,
          occurredAt: new Date(signal.occurredAt),
          projectId: signal.projectId,
          reason: signal.reason,
          signalId: signal.signalId,
          targetId: signal.targetId,
        })
        .onConflictDoNothing()
        .returning();
      if (inserted) {
        return { created: true, signal: toStored(inserted) };
      }
      const [existing] = await database
        .select()
        .from(attentionSignal)
        .where(
          and(
            eq(attentionSignal.accountId, accountId),
            eq(attentionSignal.signalId, signal.signalId),
            eq(attentionSignal.eventId, signal.eventId),
            eq(attentionSignal.targetId, signal.targetId),
          ),
        );
      if (!existing) {
        throw new Error(
          "Attention signal vanished after a conflicting insert.",
        );
      }
      return { created: false, signal: toStored(existing) };
    },

    async list(accountId) {
      const rows = await database
        .select()
        .from(attentionSignal)
        .where(eq(attentionSignal.accountId, accountId));
      return rows.map(toStored);
    },
  };
}

export function createDatabaseAttentionSignals(database: Database) {
  return createAttentionSignals(createDatabaseAttentionSignalStore(database));
}
