import { securityEvent } from "@cantiara/db/schema/security-event";
import type { SecurityEventDatabase } from "@cantiara/db/security-events";
import { asc, inArray } from "drizzle-orm";
import type {
  LinkSharingSecurityEvents,
  ShareAccessEvent,
} from "./link-sharing";

const EVENT_TYPES: ShareAccessEvent["type"][] = [
  "link-sharing.password-changed",
  "link-sharing.token-rotated",
  "link-sharing.surface-revoked",
  "link-sharing.sessions-revoked",
];

/**
 * Appends secret-free Link Sharing access events to the irreversible security
 * log (ADR-0003, ADR-0019): an event type, an aliased actor, the surface id and
 * the access epoch. No token, password or content is ever written. The event id
 * is derived (`type:surfaceId:epoch`), so a retry cannot duplicate an event and
 * replay reads the epoch back from it.
 */
export function createDatabaseLinkSharingSecurityEvents(
  database: SecurityEventDatabase,
): LinkSharingSecurityEvents {
  return {
    async append(event) {
      await database
        .insert(securityEvent)
        .values({
          actorAlias: event.actor,
          id: `${event.type}:${event.surfaceId}:${event.accessEpoch}`,
          occurredAt: event.occurredAt,
          targetSessionAlias: event.surfaceId,
          type: event.type,
          version: 1,
        })
        .onConflictDoNothing({ target: securityEvent.id });
    },
    async list() {
      const rows = await database
        .select()
        .from(securityEvent)
        .where(inArray(securityEvent.type, EVENT_TYPES))
        .orderBy(asc(securityEvent.occurredAt));
      return rows.flatMap((row) => {
        const epoch = Number(row.id.slice(row.id.lastIndexOf(":") + 1));
        if (row.version !== 1 || !Number.isInteger(epoch)) {
          throw new Error("Unsupported Link Sharing security event.");
        }
        return [
          {
            accessEpoch: epoch,
            actor: row.actorAlias,
            occurredAt: row.occurredAt,
            surfaceId: row.targetSessionAlias,
            type: row.type as ShareAccessEvent["type"],
          },
        ];
      });
    },
  };
}
