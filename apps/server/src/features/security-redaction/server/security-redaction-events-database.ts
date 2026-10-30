import {
  SECURITY_REDACTION_EVENT_TYPE,
  SECURITY_REDACTION_REPLAY_KEY_VERSION,
  type SecurityRedactionEvent,
  type SecurityRedactionEventLog,
} from "@cantiara/api/security-redaction";
import { securityEvent } from "@cantiara/db/schema/security-event";
import type { SecurityEventDatabase } from "@cantiara/db/security-events";
import { asc, eq } from "drizzle-orm";

/**
 * The existing `security_event` table, no new column: the scope alias, the
 * operation id, the key version, the founder's reason and the replay locator
 * (length, salt, keyed digest) are packed into `target_session_alias` like the
 * Trash event packs its target alias. Only aliases, the reason and a keyed
 * digest are written, never a value.
 */
const SEPARATOR = "|";

export function packSecurityRedactionTarget(event: SecurityRedactionEvent) {
  // Ids, the reason and the scope may hold `|` or `:`, so free text is escaped.
  return [
    encodeURIComponent(event.scopeAlias),
    encodeURIComponent(event.operationId),
    String(event.replay.length),
    event.replay.salt,
    event.replay.digest,
    String(event.replay.keyVersion),
    encodeURIComponent(event.reason),
  ].join(SEPARATOR);
}

export function unpackSecurityRedactionTarget(
  packed: string,
): Pick<
  SecurityRedactionEvent,
  "operationId" | "reason" | "replay" | "scopeAlias"
> | null {
  const [encodedScope, encodedOperation, length, salt, digest, ...rest] =
    packed.split(SEPARATOR);
  const size = Number(length);
  // A row of the current shape appends key version and escaped reason; an
  // older row carries only the locator and reads back with today's defaults.
  if (rest.length !== 0 && rest.length !== 2) {
    return null;
  }
  if (
    !(
      encodedScope &&
      encodedOperation &&
      salt &&
      digest &&
      Number.isInteger(size)
    ) ||
    size <= 0
  ) {
    return null;
  }
  const [keyVersion, encodedReason] = rest;
  let version = SECURITY_REDACTION_REPLAY_KEY_VERSION;
  let reason = "";
  if (keyVersion !== undefined) {
    version = Number(keyVersion);
    if (!Number.isInteger(version) || version <= 0) {
      return null;
    }
  }
  try {
    if (encodedReason !== undefined) {
      reason = decodeURIComponent(encodedReason);
    }
    return {
      operationId: decodeURIComponent(encodedOperation),
      reason,
      replay: { digest, keyVersion: version, length: size, salt },
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
      const events: SecurityRedactionEvent[] = [];
      let unreadable = 0;
      for (const row of rows) {
        const target = unpackSecurityRedactionTarget(row.targetSessionAlias);
        if (!target) {
          // A row that cannot be read back is counted, never skipped silently.
          unreadable += 1;
          continue;
        }
        events.push({
          actorAlias: row.actorAlias,
          id: row.id,
          occurredAt: row.occurredAt.toISOString(),
          type: SECURITY_REDACTION_EVENT_TYPE,
          version: 1,
          ...target,
        });
      }
      return { events, unreadable };
    },
  };
}
