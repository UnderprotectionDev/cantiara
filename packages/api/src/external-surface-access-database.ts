import type { Database } from "@cantiara/db";
import {
  externalSurface,
  externalSurfaceSnapshotRevision,
} from "@cantiara/db/schema/external-surface";
import { desc, eq } from "drizzle-orm";

import type { ExternalSurfaceStateReader } from "./external-surface-access";

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
        .where(eq(externalSurfaceSnapshotRevision.surfaceId, surfaceId))
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
