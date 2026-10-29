import type { Database } from "@cantiara/db";
import {
  externalSurface,
  externalSurfacePurgeRequest,
} from "@cantiara/db/schema/external-surface";
import { and, eq, inArray, isNotNull, lte, ne, sql } from "drizzle-orm";
import type { PurgeRecord, SurfacePurgeStore } from "./external-surface-purge";

function record(
  row: typeof externalSurfacePurgeRequest.$inferSelect,
): PurgeRecord {
  return {
    attempts: row.attempts,
    completedAt: row.completedAt,
    nextAttemptAt: row.nextAttemptAt,
    status: row.status as PurgeRecord["status"],
    surfaceId: row.surfaceId,
  };
}

export function createDatabaseSurfacePurges(
  database: Database,
): SurfacePurgeStore {
  return {
    async ensure(surfaceId) {
      const removed = await database
        .select({ id: externalSurface.id })
        .from(externalSurface)
        .leftJoin(
          externalSurfacePurgeRequest,
          eq(externalSurfacePurgeRequest.surfaceId, externalSurface.id),
        )
        .where(
          and(
            isNotNull(externalSurface.cancelledAt),
            sql`${externalSurfacePurgeRequest.surfaceId} is null`,
            surfaceId ? eq(externalSurface.id, surfaceId) : undefined,
          ),
        );
      if (removed.length === 0) {
        return;
      }
      await database
        .insert(externalSurfacePurgeRequest)
        .values(removed.map((row) => ({ surfaceId: row.id })))
        .onConflictDoNothing({ target: externalSurfacePurgeRequest.surfaceId });
    },

    async due(now, limit) {
      const rows = await database
        .select()
        .from(externalSurfacePurgeRequest)
        .where(
          and(
            ne(externalSurfacePurgeRequest.status, "Done"),
            lte(externalSurfacePurgeRequest.nextAttemptAt, now),
          ),
        )
        .limit(limit);
      return rows.map(record);
    },

    async save(next) {
      await database
        .update(externalSurfacePurgeRequest)
        .set({
          attempts: next.attempts,
          completedAt: next.completedAt,
          nextAttemptAt: next.nextAttemptAt,
          status: next.status,
        })
        .where(eq(externalSurfacePurgeRequest.surfaceId, next.surfaceId));
    },

    async statuses(surfaceIds) {
      if (surfaceIds.length === 0) {
        return [];
      }
      const rows = await database
        .select()
        .from(externalSurfacePurgeRequest)
        .where(inArray(externalSurfacePurgeRequest.surfaceId, surfaceIds));
      return rows.map(record);
    },
  };
}
