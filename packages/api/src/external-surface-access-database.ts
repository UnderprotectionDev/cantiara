import type { Database } from "@cantiara/db";
import {
  externalSurface,
  externalSurfaceSnapshotRevision,
} from "@cantiara/db/schema/external-surface";
import { and, desc, eq, sql } from "drizzle-orm";

import type { ExternalSurfaceStateReader } from "./external-surface-access";

/**
 * A frozen surface (`Keep approved surface`) serves only the revision it was
 * frozen on; an unfrozen one serves every revision, so its latest wins. Every
 * access-path read of a revision adds this condition.
 */
export function withinFrozenRevision(surfaceId: string) {
  return sql`${externalSurfaceSnapshotRevision.revision} <= coalesce((select s.frozen_revision from external_surface s where s.id = ${surfaceId}), ${externalSurfaceSnapshotRevision.revision})`;
}

/** Reads the live Dış yüzey row on every call; there is no caching layer here. */
export function createDatabaseExternalSurfaceStateReader(
  database: Database,
): ExternalSurfaceStateReader {
  return {
    read: async (surfaceId) => {
      const [surface] = await database
        .select({
          cancelledAt: externalSurface.cancelledAt,
          indexingEnabled: externalSurface.indexingEnabled,
        })
        .from(externalSurface)
        .where(eq(externalSurface.id, surfaceId))
        .limit(1);
      if (!surface) {
        return null;
      }
      const [latest] = await database
        .select({ revision: externalSurfaceSnapshotRevision.revision })
        .from(externalSurfaceSnapshotRevision)
        .where(
          and(
            eq(externalSurfaceSnapshotRevision.surfaceId, surfaceId),
            withinFrozenRevision(surfaceId),
          ),
        )
        .orderBy(desc(externalSurfaceSnapshotRevision.revision))
        .limit(1);
      return {
        cancelled: surface.cancelledAt !== null,
        indexingEnabled: surface.indexingEnabled,
        // No approved revision yet reads as cancelled: nothing may be shown.
        revision: latest?.revision ?? 0,
      };
    },
  };
}
