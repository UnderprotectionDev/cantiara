import { securityEvent } from "@cantiara/db/schema/security-event";
import type { SecurityEventDatabase } from "@cantiara/db/security-events";
import type { LinkSharingSecurityEvents } from "./link-sharing";

/**
 * Appends secret-free Link Sharing access events to the irreversible security
 * log (ADR-0003, ADR-0019): an event type, an aliased actor, the surface id and
 * the access epoch. No token, password or content is ever written. The event id
 * is derived, so a retry cannot duplicate an event.
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
  };
}
