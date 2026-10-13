import { securityEvent } from "@cantiara/db/schema/security-event";
import type { SecurityEventDatabase } from "@cantiara/db/security-events";
import { asc, eq } from "drizzle-orm";

const EVENT_TYPE = "document.external-surface-cancelled";

export interface DocumentSurfaceCancellation {
  actorAlias: string;
  occurredAt: Date;
  surfaceId: string;
}

export interface DocumentSurfaceCancellations {
  append: (event: DocumentSurfaceCancellation) => Promise<void>;
  list: () => Promise<DocumentSurfaceCancellation[]>;
}

export function createDatabaseDocumentSurfaceCancellations(
  database: SecurityEventDatabase,
): DocumentSurfaceCancellations {
  return {
    async append(event) {
      await database
        .insert(securityEvent)
        .values({
          id: `${EVENT_TYPE}:${event.surfaceId}`,
          type: EVENT_TYPE,
          version: 1,
          actorAlias: event.actorAlias,
          targetSessionAlias: event.surfaceId,
          occurredAt: event.occurredAt,
        })
        .onConflictDoNothing({ target: securityEvent.id });
    },
    async list() {
      const records = await database
        .select()
        .from(securityEvent)
        .where(eq(securityEvent.type, EVENT_TYPE))
        .orderBy(asc(securityEvent.occurredAt));
      return records.map((record) => {
        if (record.version !== 1) {
          throw new Error("Unsupported Document surface cancellation event.");
        }
        return {
          surfaceId: record.targetSessionAlias,
          actorAlias: record.actorAlias,
          occurredAt: record.occurredAt,
        };
      });
    },
  };
}
