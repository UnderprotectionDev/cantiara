import type { Database } from "@cantiara/db";
import { auditRecord } from "@cantiara/db/schema/auth";
import { and, count, eq, gte, inArray, sql } from "drizzle-orm";
import type { LinkSharingAudit } from "./link-sharing-audit";

/**
 * Appends to the existing 365-day `audit_record` class; the Account Access
 * maintenance prunes it. Rows hold an alias and a surface id, nothing else.
 * A rate-limit reservation is the entry itself, appended inside one
 * transaction serialized by a per-actor advisory lock, so a concurrent
 * burst can never pass the check together and land after it.
 */
export function createDatabaseLinkSharingAudit(
  database: Database,
): LinkSharingAudit {
  return {
    async append(record) {
      await database
        .insert(auditRecord)
        .values({
          actorAlias: record.actorAlias,
          id: record.id,
          occurredAt: record.occurredAt,
          targetSessionAlias: record.targetAlias,
          type: record.type,
        })
        .onConflictDoNothing({ target: auditRecord.id });
    },
    async countSince(actorAlias, types, since) {
      const [row] = await database
        .select({ total: count() })
        .from(auditRecord)
        .where(
          and(
            eq(auditRecord.actorAlias, actorAlias),
            inArray(auditRecord.type, [...types]),
            gte(auditRecord.occurredAt, since),
          ),
        );
      return row?.total ?? 0;
    },
    reserve(input) {
      return database.transaction(async (executor) => {
        await executor.execute(
          sql`select pg_advisory_xact_lock(hashtext(${input.actorAlias}))`,
        );
        const [existing] = await executor
          .select({ id: auditRecord.id })
          .from(auditRecord)
          .where(eq(auditRecord.id, input.id))
          .limit(1);
        if (existing) {
          return true;
        }
        const [row] = await executor
          .select({ total: count() })
          .from(auditRecord)
          .where(
            and(
              eq(auditRecord.actorAlias, input.actorAlias),
              inArray(auditRecord.type, [...input.counted]),
              gte(auditRecord.occurredAt, input.since),
            ),
          );
        if ((row?.total ?? 0) >= input.limit) {
          return false;
        }
        await executor.insert(auditRecord).values({
          actorAlias: input.actorAlias,
          id: input.id,
          occurredAt: input.occurredAt,
          targetSessionAlias: input.targetAlias,
          type: input.type,
        });
        return true;
      });
    },
  };
}
