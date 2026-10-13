import {
  FAVORITE_SOURCE_TYPES,
  type FavoriteEntry,
  type FavoriteSource,
  FavoriteSourceUnavailableError,
  favoriteSourceSchema,
} from "@cantiara/api/favorites";
import type { Database } from "@cantiara/db";
import { decision } from "@cantiara/db/schema/decision";
import { document } from "@cantiara/db/schema/document";
import { project } from "@cantiara/db/schema/project";
import {
  smartCollection,
  smartCollectionView,
} from "@cantiara/db/schema/smart-collection";
import { work } from "@cantiara/db/schema/work";
import { asc, eq, inArray, sql } from "drizzle-orm";

interface MembershipReference {
  addedAt: Date;
  sourceRecordId: string;
  sourceRecordType: string;
}
interface SourceSummary {
  archivedAt: Date | null;
  id: string;
  projectId: string | null;
  title: string;
  trashedAt: Date | null;
  viewId: string | null;
  workspaceId: string | null;
}

/** Membership availability does not depend on a collection having a named view. */
export async function favoriteSourceExists(
  database: Database,
  workspaceId: string,
  source: FavoriteSource,
) {
  const [record] = await readSourceType(database, source.sourceRecordType, [
    source.sourceRecordId,
  ]);
  return record?.workspaceId === workspaceId && !record.trashedAt;
}

/** Read current source identity in batches; never store source content in Favorites. */
export async function readFavoriteSources(
  database: Database,
  workspaceId: string,
  memberships: MembershipReference[],
): Promise<FavoriteEntry[]> {
  const sourceMaps = new Map<
    FavoriteSource["sourceRecordType"],
    Map<string, SourceSummary>
  >();
  await Promise.all(
    FAVORITE_SOURCE_TYPES.map(async (type) => {
      const ids = memberships
        .filter((entry) => entry.sourceRecordType === type)
        .map((entry) => entry.sourceRecordId);
      if (ids.length === 0) {
        return;
      }
      const rows = await readSourceType(database, type, ids);
      const byId = new Map<string, SourceSummary>();
      for (const row of rows) {
        if (!byId.has(row.id)) {
          byId.set(row.id, row);
        }
      }
      sourceMaps.set(type, byId);
    }),
  );
  return memberships.map((membership): FavoriteEntry => {
    const source = favoriteSourceSchema.parse({
      sourceRecordId: membership.sourceRecordId,
      sourceRecordType: membership.sourceRecordType,
    });
    const reference = { ...source, addedAt: membership.addedAt.toISOString() };
    const row = sourceMaps
      .get(source.sourceRecordType)
      ?.get(source.sourceRecordId);
    if (!row) {
      return {
        ...reference,
        status: "unavailable",
        reason: "Permanently deleted",
      };
    }
    if (
      row.workspaceId !== workspaceId ||
      (source.sourceRecordType === "Smart Collection" && !row.viewId)
    ) {
      return { ...reference, status: "unavailable", reason: "No access" };
    }
    let life: "Archived" | "In Trash" | null = null;
    if (row.archivedAt) {
      life = "Archived";
    }
    if (row.trashedAt) {
      life = "In Trash";
    }
    return {
      ...reference,
      status: "available",
      title: row.title,
      projectId: row.projectId,
      viewId: row.viewId,
      life,
    };
  });
}

function readSourceType(
  database: Database,
  type: FavoriteSource["sourceRecordType"],
  ids: string[],
): Promise<SourceSummary[]> {
  const empty = { trashedAt: sql<null>`null`, viewId: sql<null>`null` };
  switch (type) {
    case "Project":
      return database
        .select({
          id: project.id,
          title: project.name,
          projectId: project.id,
          workspaceId: project.workspaceId,
          archivedAt: project.archivedAt,
          ...empty,
        })
        .from(project)
        .where(inArray(project.id, ids));
    case "Document":
      return database
        .select({
          id: document.id,
          title: document.title,
          projectId: document.projectId,
          workspaceId: sql<
            string | null
          >`coalesce(${document.workspaceId}, ${project.workspaceId})`,
          archivedAt:
            sql<Date | null>`coalesce(${document.archivedAt}, ${project.archivedAt})`.mapWith(
              document.archivedAt,
            ),
          ...empty,
        })
        .from(document)
        .leftJoin(project, eq(document.projectId, project.id))
        .where(inArray(document.id, ids));
    case "Work":
      return database
        .select({
          id: work.id,
          title: work.title,
          projectId: work.projectId,
          workspaceId: project.workspaceId,
          archivedAt:
            sql<Date | null>`coalesce(${work.archivedAt}, ${project.archivedAt})`.mapWith(
              work.archivedAt,
            ),
          viewId: empty.viewId,
          trashedAt: work.trashedAt,
        })
        .from(work)
        .leftJoin(project, eq(work.projectId, project.id))
        .where(inArray(work.id, ids));
    case "Decision":
      return database
        .select({
          id: decision.id,
          title: decision.title,
          projectId: decision.projectId,
          workspaceId: project.workspaceId,
          archivedAt: project.archivedAt,
          ...empty,
        })
        .from(decision)
        .leftJoin(project, eq(decision.projectId, project.id))
        .where(inArray(decision.id, ids));
    case "Smart Collection":
      return database
        .select({
          id: smartCollection.id,
          title: smartCollection.name,
          projectId: smartCollection.projectId,
          workspaceId: project.workspaceId,
          archivedAt: project.archivedAt,
          trashedAt: empty.trashedAt,
          viewId: smartCollectionView.id,
        })
        .from(smartCollection)
        .leftJoin(project, eq(smartCollection.projectId, project.id))
        .leftJoin(
          smartCollectionView,
          eq(smartCollectionView.collectionId, smartCollection.id),
        )
        .where(inArray(smartCollection.id, ids))
        .orderBy(asc(smartCollectionView.id));
    default:
      throw new FavoriteSourceUnavailableError();
  }
}
