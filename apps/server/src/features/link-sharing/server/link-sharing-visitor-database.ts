import { withinFrozenRevision } from "@cantiara/api/external-surface-access-database";
import type {
  ShareManifest,
  ShareManifestItem,
} from "@cantiara/api/link-sharing";
import { SHARE_MANIFEST_FORMAT } from "@cantiara/api/link-sharing";
import type { Database } from "@cantiara/db";
import { decision } from "@cantiara/db/schema/decision";
import {
  externalSurface,
  externalSurfaceSnapshotRevision,
  linkShareGateAttempt,
  linkShareVisitorSession,
} from "@cantiara/db/schema/external-surface";
import { feedback } from "@cantiara/db/schema/feedback";
import {
  fileAttachment,
  fileAttachmentVersion,
} from "@cantiara/db/schema/file-attachments";
import { productionIncident } from "@cantiara/db/schema/production-incident";
import { projectMilestone } from "@cantiara/db/schema/project-milestone";
import { projectRelease } from "@cantiara/db/schema/project-release";
import { risk } from "@cantiara/db/schema/risk";
import { work } from "@cantiara/db/schema/work";
import { and, desc, eq, gt, inArray, isNull, lt, sql } from "drizzle-orm";
import type { LinkSharingAudit } from "./link-sharing-audit";
import {
  ATTEMPT_RETENTION_MS,
  createLinkSharingVisitor,
  type LinkSharingVisitorAccess,
  type LinkSharingVisitorStore,
  latestInstant,
  type VisitorSurface,
} from "./link-sharing-visitor";

const SURFACE_KIND = "Link-limited share";

const surfaceColumns = {
  accessEpoch: externalSurface.accessEpoch,
  cancelledAt: externalSurface.cancelledAt,
  expiresAt: externalSurface.expiresAt,
  passwordHash: externalSurface.passwordHash,
  surfaceId: externalSurface.id,
};

/** A live item id `field:<record kind>:<record id>:<field key>` parsed. */
const LIVE_ITEM = /^field:([^:]+):([^:]+):([^:]+)$/;

/**
 * The live allow-list values are re-read from their source at request time,
 * mirroring the share readers' field mapping exactly (spec 73 live fields).
 * A record that is gone (trashed, removed) yields no value, so nothing nulls
 * the frozen snapshot: the field row simply disappears from the page.
 */
const LIVE_FIELD_SOURCES = [
  {
    kind: "Work",
    read: (database: Database, ids: string[]) =>
      database
        .select({
          closureResult: work.closureResult,
          id: work.id,
          plannedStartDate: work.plannedStartDate,
          reappearDate: work.reappearDate,
          roadmapHorizon: work.roadmapHorizon,
          status: work.status,
          targetDate: work.targetDate,
        })
        .from(work)
        .where(and(inArray(work.id, ids), isNull(work.trashedAt))),
  },
  {
    kind: "Decision",
    read: (database: Database, ids: string[]) =>
      database
        .select({ id: decision.id, status: decision.life })
        .from(decision)
        .where(inArray(decision.id, ids)),
  },
  {
    kind: "Risk",
    read: (database: Database, ids: string[]) =>
      database
        .select({ id: risk.id, status: risk.life })
        .from(risk)
        .where(inArray(risk.id, ids)),
  },
  {
    kind: "Feedback",
    read: (database: Database, ids: string[]) =>
      database
        .select({ id: feedback.id, status: feedback.status })
        .from(feedback)
        .where(inArray(feedback.id, ids)),
  },
  {
    kind: "Production Incident",
    read: (database: Database, ids: string[]) =>
      database
        .select({
          id: productionIncident.id,
          status: productionIncident.status,
        })
        .from(productionIncident)
        .where(inArray(productionIncident.id, ids)),
  },
  {
    kind: "Milestone",
    read: (database: Database, ids: string[]) =>
      database
        .select({
          id: projectMilestone.id,
          status: projectMilestone.status,
          targetDate: projectMilestone.targetDate,
        })
        .from(projectMilestone)
        .where(inArray(projectMilestone.id, ids)),
  },
  {
    kind: "Project Release",
    read: (database: Database, ids: string[]) =>
      database
        .select({ id: projectRelease.id, status: projectRelease.status })
        .from(projectRelease)
        .where(inArray(projectRelease.id, ids)),
  },
] as const;

/** The live fields of one manifest item id: `field:<kind>:<id>:<key>` or null. */
function liveItemKeys(itemId: string) {
  const match = LIVE_ITEM.exec(itemId);
  return match
    ? {
        fieldKey: match[3] ?? "",
        kind: match[1] ?? "",
        recordId: match[2] ?? "",
      }
    : null;
}

/** Grouped live items: record kind → record id → set of field keys. */
function liveKeysOf(manifest: ShareManifest) {
  const keys = new Map<string, Map<string, Set<string>>>();
  for (const item of manifest.items) {
    const parsed =
      item.live && item.kind === "Field" ? liveItemKeys(item.itemId) : null;
    if (parsed) {
      const forKind = keys.get(parsed.kind) ?? new Map();
      const fields = forKind.get(parsed.recordId) ?? new Set<string>();
      fields.add(parsed.fieldKey);
      forKind.set(parsed.recordId, fields);
      keys.set(parsed.kind, forKind);
    }
  }
  return keys;
}

/** One source read in parallel with the other kinds. */
async function liveValuesOfKind(
  database: Database,
  source: (typeof LIVE_FIELD_SOURCES)[number],
  forKind: Map<string, Set<string>>,
): Promise<Record<string, string | null>> {
  const { kind } = source;
  const rows = await source.read(database, [...forKind.keys()]);
  const values: Record<string, string | null> = {};
  for (const [recordId, fieldKeys] of forKind) {
    const row = (rows.find((entry) => entry.id === recordId) ?? null) as Record<
      string,
      unknown
    > | null;
    for (const fieldKey of fieldKeys) {
      // Missing record or value: the field row stops being shown (fail
      // closed); present values are the source's current strings.
      const value = row ? row[fieldKey] : undefined;
      values[`field:${kind}:${recordId}:${fieldKey}`] =
        typeof value === "string" ? value : null;
    }
  }
  return values;
}

/**
 * `Live` fields show the current source value: reads the exact allow-listed
 * fields the manifest names and overlays them on the otherwise frozen
 * snapshot, one parallel source read per kind.
 */
async function liveValues(
  database: Database,
  manifest: ShareManifest,
): Promise<Record<string, string | null>> {
  const keys = liveKeysOf(manifest);
  const wanted = LIVE_FIELD_SOURCES.filter(({ kind }) => keys.has(kind));
  if (wanted.length === 0) {
    return {};
  }
  const perKind = await Promise.all(
    wanted.map((source) =>
      liveValuesOfKind(database, source, keys.get(source.kind) ?? new Map()),
    ),
  );
  const values: Record<string, string | null> = {};
  for (const kindValues of perKind) {
    Object.assign(values, kindValues);
  }
  return values;
}

/** The delivered snapshot: the manifest with the live items' current values. */
function withLiveValues(
  manifest: ShareManifest,
  values: Record<string, string | null>,
): ShareManifest {
  const items: ShareManifestItem[] = manifest.items.map((item) =>
    item.live && Object.hasOwn(values, item.itemId) && item.kind === "Field"
      ? { ...item, value: values[item.itemId] ?? null }
      : item,
  );
  return { ...manifest, items };
}

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
    async attachment(attachmentId, versionId) {
      // The exact stored version of an Active attachment; a removed, trashed
      // or redacted one is not found, so its URL answers `410 Gone`.
      const [row] = await database
        .select({
          byteSize: fileAttachmentVersion.byteSize,
          contentHash: fileAttachmentVersion.contentHash,
          fileName: fileAttachmentVersion.fileName,
          mimeType: fileAttachmentVersion.detectedMimeType,
          objectKey: fileAttachmentVersion.objectKey,
        })
        .from(fileAttachmentVersion)
        .innerJoin(
          fileAttachment,
          eq(fileAttachment.id, fileAttachmentVersion.attachmentId),
        )
        .where(
          and(
            eq(fileAttachmentVersion.id, versionId),
            eq(fileAttachmentVersion.attachmentId, attachmentId),
            eq(fileAttachment.lifecycleStatus, "Active"),
          ),
        )
        .limit(1);
      return row ?? null;
    },
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
      return latestInstant(ends);
    },
    async lockUntil(key, until) {
      await database
        .update(linkShareGateAttempt)
        .set({ lockedUntil: until })
        .where(eq(linkShareGateAttempt.key, key));
    },
    async purge(now) {
      await purgeLinkSharingVisitorData(database, now);
    },
    async snapshot(surfaceId) {
      const [revision] = await database
        .select({
          revision: externalSurfaceSnapshotRevision.revision,
          snapshot: externalSurfaceSnapshotRevision.snapshot,
        })
        .from(externalSurfaceSnapshotRevision)
        .where(
          and(
            eq(externalSurfaceSnapshotRevision.surfaceId, surfaceId),
            withinFrozenRevision(surfaceId),
          ),
        )
        .orderBy(desc(externalSurfaceSnapshotRevision.revision))
        .limit(1);
      const frozen = revision?.snapshot as Partial<ShareManifest> | undefined;
      if (
        !(
          revision &&
          frozen?.format === SHARE_MANIFEST_FORMAT &&
          frozen.version === 1
        )
      ) {
        return null;
      }
      const manifest = frozen as ShareManifest;
      // `Live` fields read their current source value here, once per page
      // request; everything else stays frozen at approval time.
      const values = await liveValues(database, manifest);
      return {
        approvedAt: manifest.approvedAt,
        label: manifest.label,
        manifest: withLiveValues(manifest, values),
        revision: revision.revision,
      };
    },
    surface: (surfaceId) => readSurface(eq(externalSurface.id, surfaceId)),
    surfaceByTokenHash: (tokenHash) =>
      readSurface(eq(externalSurface.tokenHash, tokenHash)),
  };
}

export function createDatabaseLinkSharingVisitor(
  database: Database,
  options: { audit?: LinkSharingAudit; rateSecret: string },
): LinkSharingVisitorAccess {
  return createLinkSharingVisitor(createStore(database), options);
}

/**
 * Deletes gate attempt rows past the 24-hour retention and sessions past
 * their end; wired into the maintenance worker because the gate itself only
 * purges lazily on the next exchange.
 */
export async function purgeLinkSharingVisitorData(
  database: Database,
  now = new Date(),
) {
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
}
