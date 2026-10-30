import {
  SECURITY_REDACTION_EVENT_TYPE,
  type SecurityRedactionEvent,
  type SecurityRedactionEventLog,
} from "@cantiara/api/security-redaction";
import { securityEvent } from "@cantiara/db/schema/security-event";
import type { SecurityEventDatabase } from "@cantiara/db/security-events";
import { asc, eq } from "drizzle-orm";

/**
 * The existing `security_event` table, no new column: the scope alias, the
 * operation id and the replay locator (length, salt, keyed digest) are packed
 * into `target_session_alias` like the Trash event packs its target alias.
 * Only aliases and a keyed digest are written, never a value.
 */
const SEPARATOR = "|";

export function packSecurityRedactionTarget(event: SecurityRedactionEvent) {
  // Ids may hold `|` or `:`, so the free-text components are escaped.
  return [
    encodeURIComponent(event.scopeAlias),
    encodeURIComponent(event.operationId),
    String(event.replay.length),
    event.replay.salt,
    event.replay.digest,
  ].join(SEPARATOR);
}

export function unpackSecurityRedactionTarget(
  packed: string,
): Pick<
  SecurityRedactionEvent,
  "operationId" | "replay" | "scopeAlias"
> | null {
  const [encodedScope, encodedOperation, length, salt, digest, ...rest] =
    packed.split(SEPARATOR);
  const size = Number(length);
  if (
    rest.length > 0 ||
    !(encodedScope && encodedOperation && salt && digest) ||
    !Number.isInteger(size) ||
    size <= 0
  ) {
    return null;
  }
  try {
    return {
      operationId: decodeURIComponent(encodedOperation),
      replay: { digest, length: size, salt },
      scopeAlias: decodeURIComponent(encodedScope),
    };
  } catch {
    return null;
  }
}

/** Append-only, idempotent on the event id; a production store is spec 85's. */
export function createDatabaseSecurityRedactionEventLog(
  database: SecurityEventDatabase,
): SecurityRedactionEventLog {
  return {
    async append(event) {
      await database
        .insert(securityEvent)
        .values({
          actorAlias: event.actorAlias,
          id: event.id,
          occurredAt: new Date(event.occurredAt),
          targetSessionAlias: packSecurityRedactionTarget(event),
          type: event.type,
          version: event.version,
        })
        .onConflictDoNothing({ target: securityEvent.id });
    },
    async list() {
      const rows = await database
        .select()
        .from(securityEvent)
        .where(eq(securityEvent.type, SECURITY_REDACTION_EVENT_TYPE))
        .orderBy(asc(securityEvent.occurredAt));
      return rows.flatMap((row): SecurityRedactionEvent[] => {
        const target = unpackSecurityRedactionTarget(row.targetSessionAlias);
        return target
          ? [
              {
                actorAlias: row.actorAlias,
                id: row.id,
                occurredAt: row.occurredAt.toISOString(),
                type: SECURITY_REDACTION_EVENT_TYPE,
                version: 1,
                ...target,
              },
            ]
          : [];
      });
    },
  };
}
