import type { Database } from "@cantiara/db";
import { auditRecord } from "@cantiara/db/schema/auth";
import { and, count, eq, gte, inArray } from "drizzle-orm";
import type { LinkSharingAudit } from "./link-sharing-audit";

/**
 * Appends to the existing 365-day `audit_record` class; the Account Access
 * maintenance prunes it. Rows hold an alias and a surface id, nothing else.
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
  };
}
