import type { ShareManifest } from "@cantiara/api/link-sharing";
import { SHARE_MANIFEST_FORMAT } from "@cantiara/api/link-sharing";
import type { Database } from "@cantiara/db";
import {
  externalSurface,
  externalSurfaceSnapshotRevision,
  linkShareGateAttempt,
  linkShareVisitorSession,
} from "@cantiara/db/schema/external-surface";
import { and, desc, eq, gt, inArray, lt, sql } from "drizzle-orm";
import {
  ATTEMPT_RETENTION_MS,
  createLinkSharingVisitor,
  type LinkSharingVisitorAccess,
  type LinkSharingVisitorStore,
  type VisitorSurface,
} from "./link-sharing-visitor";

const SURFACE_KIND = "Link-limited share";

const surfaceColumns = {
  accessEpoch: externalSurface.accessEpoch,
  cancelledAt: externalSurface.cancelledAt,
  passwordHash: externalSurface.passwordHash,
  surfaceId: externalSurface.id,
};

function createStore(database: Database): LinkSharingVisitorStore {
  const readSurface = async (
    where: ReturnType<typeof eq>,
  ): Promise<VisitorSurface | null> => {
    const [row] = await database
      .select(surfaceColumns)
      .from(externalSurface)
      .where(and(eq(externalSurface.surfaceKind, SURFACE_KIND), where))
      .limit(1);
    return row ?? null;
  };

  return {
    async bumpFailure(key, now) {
      const cutoff = new Date(now.getTime() - ATTEMPT_RETENTION_MS);
      const [row] = await database
        .insert(linkShareGateAttempt)
        .values({ failures: 1, key, lastAttemptAt: now })
        .onConflictDoUpdate({
          set: {
            failures: sql`case when ${linkShareGateAttempt.lastAttemptAt} < ${cutoff} then 1 else ${linkShareGateAttempt.failures} + 1 end`,
            lastAttemptAt: now,
          },
          target: linkShareGateAttempt.key,
        })
        .returning({ failures: linkShareGateAttempt.failures });
      return row?.failures ?? 1;
    },
    async clearFailures(keys) {
      if (keys.length > 0) {
        await database
          .delete(linkShareGateAttempt)
          .where(inArray(linkShareGateAttempt.key, keys));
      }
    },
    async createSession(session) {
      await database.insert(linkShareVisitorSession).values(session);
    },
    async findSession(id) {
      const [row] = await database
        .select()
        .from(linkShareVisitorSession)
        .where(eq(linkShareVisitorSession.id, id))
        .limit(1);
      return row ?? null;
    },
    async lockedUntil(keys, now) {
      const rows = await database
        .select({ lockedUntil: linkShareGateAttempt.lockedUntil })
        .from(linkShareGateAttempt)
        .where(
          and(
            inArray(linkShareGateAttempt.key, keys),
            gt(linkShareGateAttempt.lockedUntil, now),
          ),
        );
      const ends = rows
        .map((row) => row.lockedUntil)
        .filter((end): end is Date => end !== null);
      return ends.length === 0
        ? null
        : new Date(Math.max(...ends.map((end) => end.getTime())));
    },
    async lockUntil(key, until) {
      await database
        .update(linkShareGateAttempt)
        .set({ lockedUntil: until })
        .where(eq(linkShareGateAttempt.key, key));
    },
    async purge(now) {
      await database
        .delete(linkShareGateAttempt)
        .where(
          lt(
            linkShareGateAttempt.lastAttemptAt,
            new Date(now.getTime() - ATTEMPT_RETENTION_MS),
          ),
        );
      await database
        .delete(linkShareVisitorSession)
        .where(lt(linkShareVisitorSession.expiresAt, now));
    },
    async snapshot(surfaceId) {
      const [revision] = await database
        .select({
          revision: externalSurfaceSnapshotRevision.revision,
          snapshot: externalSurfaceSnapshotRevision.snapshot,
        })
        .from(externalSurfaceSnapshotRevision)
        .where(eq(externalSurfaceSnapshotRevision.surfaceId, surfaceId))
        .orderBy(desc(externalSurfaceSnapshotRevision.revision))
        .limit(1);
      const manifest = revision?.snapshot as Partial<ShareManifest> | undefined;
      return revision &&
        manifest?.format === SHARE_MANIFEST_FORMAT &&
        manifest.version === 1
        ? {
            approvedAt: manifest.approvedAt ?? "",
            label: manifest.label ?? "Approved snapshot",
            manifest: manifest as ShareManifest,
            revision: revision.revision,
          }
        : null;
    },
    surface: (surfaceId) => readSurface(eq(externalSurface.id, surfaceId)),
    surfaceByTokenHash: (tokenHash) =>
      readSurface(eq(externalSurface.tokenHash, tokenHash)),
  };
}

export function createDatabaseLinkSharingVisitor(
  database: Database,
  options: { rateSecret: string },
): LinkSharingVisitorAccess {
  return createLinkSharingVisitor(createStore(database), options);
}
