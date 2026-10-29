import type {
  BuildInPublicAccess,
  BuildInPublicSnapshot,
  DueDatePresentation,
} from "@cantiara/api/build-in-public";
import type { Database } from "@cantiara/db";
import { workspace } from "@cantiara/db/schema/auth";
import {
  buildInPublicSetting,
  buildInPublicSlug,
  buildInPublicWorkCopy,
} from "@cantiara/db/schema/build-in-public";
import {
  externalSurface,
  externalSurfaceSnapshotRevision,
} from "@cantiara/db/schema/external-surface";
import { project } from "@cantiara/db/schema/project";
import { projectRelease } from "@cantiara/db/schema/project-release";
import { projectReleaseScope } from "@cantiara/db/schema/project-release-planning";
import { work } from "@cantiara/db/schema/work";
import { and, asc, desc, eq, isNotNull, isNull, sql } from "drizzle-orm";
import {
  type BuildInPublicFacts,
  type BuildInPublicStore,
  createBuildInPublic,
} from "./build-in-public";
import { projectMembersOf } from "./build-in-public-project-view-database";
import type { BuildInPublicPublicationStore } from "./build-in-public-publication";

const SURFACE_KIND = "Build in Public";

function createFacts(database: Database): BuildInPublicFacts {
  return {
    // The File Attachment owner has no Work-owned attachment relation yet, so
    // no Work attachment is previewed here; the seam takes them from this port
    // as soon as one exists, with their exact versions.
    attachments: async () => [],

    members: (_accountId, projectId) => projectMembersOf(database, projectId),

    project: async (accountId, projectId) => {
      const [row] = await database
        .select({ workspaceId: project.workspaceId })
        .from(project)
        .innerJoin(workspace, eq(workspace.id, project.workspaceId))
        .where(
          and(
            eq(project.id, projectId),
            eq(workspace.ownerAccountId, accountId),
          ),
        )
        .limit(1);
      return row ?? null;
    },

    publishedReleaseMembership: async (_accountId, projectId) => {
      const rows = await database
        .select({
          releaseName: projectRelease.name,
          workId: projectReleaseScope.workId,
        })
        .from(projectReleaseScope)
        .innerJoin(
          projectRelease,
          eq(projectRelease.id, projectReleaseScope.releaseId),
        )
        .where(
          and(
            eq(projectReleaseScope.projectId, projectId),
            isNull(projectReleaseScope.removedAt),
            eq(projectRelease.status, "Published"),
          ),
        )
        .orderBy(asc(projectRelease.name));
      return rows;
    },

    roadmapWorks: async (_accountId, projectId) => {
      const rows = await database
        .select()
        .from(work)
        .where(
          and(
            eq(work.projectId, projectId),
            isNotNull(work.roadmapHorizon),
            isNull(work.trashedAt),
            isNull(work.archivedAt),
          ),
        )
        .orderBy(asc(work.number));
      return rows.map((row) => ({
        closureResult: row.closureResult,
        description: row.description,
        id: row.id,
        key: row.key,
        roadmapHorizon: row.roadmapHorizon ?? "",
        status: row.status,
        targetDate: row.targetDate,
        title: row.title,
      }));
    },
  };
}

/** A Build in Public surface is a Project surface whose revisions carry this snapshot kind. */
const activeSurface = (projectId: string) =>
  and(
    eq(externalSurface.projectId, projectId),
    eq(externalSurface.surfaceKind, SURFACE_KIND),
    isNull(externalSurface.cancelledAt),
  );

/** Slug rows of one surface: the canonical one and the earlier ones that redirect to it. */
export async function slugsOf(database: Database, surfaceId: string) {
  const rows = await database
    .select({
      canonical: buildInPublicSlug.canonical,
      slug: buildInPublicSlug.slug,
    })
    .from(buildInPublicSlug)
    .where(eq(buildInPublicSlug.surfaceId, surfaceId))
    .orderBy(asc(buildInPublicSlug.createdAt));
  return {
    aliases: rows.filter((row) => !row.canonical).map((row) => row.slug),
    canonical: rows.find((row) => row.canonical)?.slug ?? null,
  };
}

function createStore(
  database: Database,
): BuildInPublicStore & BuildInPublicPublicationStore {
  return {
    cancel: async (surfaceId) =>
      await database.transaction(async (transaction) => {
        const rows = await transaction
          .update(externalSurface)
          .set({ cancelledAt: new Date() })
          .where(
            and(
              eq(externalSurface.id, surfaceId),
              isNull(externalSurface.cancelledAt),
            ),
          )
          .returning({ id: externalSurface.id });
        // The redirect dies with the surface and points at nothing afterwards.
        await transaction
          .delete(buildInPublicSlug)
          .where(eq(buildInPublicSlug.surfaceId, surfaceId));
        return rows.length > 0;
      }),

    changeSlug: async ({ slug, surfaceId, workspaceId }) =>
      await database.transaction(async (transaction) => {
        await transaction.execute(
          sql`select pg_advisory_xact_lock(hashtext(${`build-in-public-slug:${workspaceId}`}))`,
        );
        const [owner] = await transaction
          .select({ surfaceId: buildInPublicSlug.surfaceId })
          .from(buildInPublicSlug)
          .where(
            and(
              eq(buildInPublicSlug.workspaceId, workspaceId),
              eq(buildInPublicSlug.slug, slug),
            ),
          )
          .limit(1);
        if (owner && owner.surfaceId !== surfaceId) {
          return false;
        }
        // The earlier canonical slug stays as a redirect; the new one is canonical.
        await transaction
          .update(buildInPublicSlug)
          .set({ canonical: false })
          .where(eq(buildInPublicSlug.surfaceId, surfaceId));
        await transaction
          .insert(buildInPublicSlug)
          .values({ canonical: true, slug, surfaceId, workspaceId })
          .onConflictDoUpdate({
            set: { canonical: true },
            target: [buildInPublicSlug.workspaceId, buildInPublicSlug.slug],
          });
        return true;
      }),

    setIndexing: async (surfaceId, enabled) => {
      const rows = await database
        .update(externalSurface)
        .set({ indexingEnabled: enabled })
        .where(
          and(
            eq(externalSurface.id, surfaceId),
            isNull(externalSurface.cancelledAt),
          ),
        )
        .returning({ id: externalSurface.id });
      return rows.length > 0;
    },

    slugOwner: async (workspaceId, slug) => {
      const [row] = await database
        .select({ surfaceId: buildInPublicSlug.surfaceId })
        .from(buildInPublicSlug)
        .where(
          and(
            eq(buildInPublicSlug.workspaceId, workspaceId),
            eq(buildInPublicSlug.slug, slug),
          ),
        )
        .limit(1);
      return row?.surfaceId ?? null;
    },

    slugs: (surfaceId) => slugsOf(database, surfaceId),

    copies: async (projectId) => {
      const rows = await database
        .select()
        .from(buildInPublicWorkCopy)
        .where(eq(buildInPublicWorkCopy.projectId, projectId));
      return rows.map((row) => ({
        dueDatePresentation: row.dueDatePresentation as DueDatePresentation,
        publicStatusLabel: row.publicStatusLabel,
        publicSummary: row.publicSummary,
        publicTitle: row.publicTitle,
        workId: row.workId,
      }));
    },

    latest: async (projectId) => {
      const [row] = await database
        .select({
          indexingEnabled: externalSurface.indexingEnabled,
          revision: externalSurfaceSnapshotRevision.revision,
          snapshot: externalSurfaceSnapshotRevision.snapshot,
          surfaceId: externalSurface.id,
        })
        .from(externalSurface)
        .innerJoin(
          externalSurfaceSnapshotRevision,
          eq(externalSurfaceSnapshotRevision.surfaceId, externalSurface.id),
        )
        .where(activeSurface(projectId))
        .orderBy(desc(externalSurfaceSnapshotRevision.revision))
        .limit(1);
      const snapshot = row?.snapshot as BuildInPublicSnapshot | undefined;
      return row && snapshot?.kind === "Build in Public"
        ? {
            indexingEnabled: row.indexingEnabled,
            revision: row.revision,
            snapshot,
            surfaceId: row.surfaceId,
          }
        : null;
    },

    publish: async ({ projectId, slug, snapshot, workspaceId }) =>
      await database.transaction(async (transaction) => {
        // Serialises the first approval of one Project so only one surface is born.
        await transaction.execute(
          sql`select pg_advisory_xact_lock(hashtext(${`build-in-public:${projectId}`}))`,
        );
        const [existing] = await transaction
          .select({ id: externalSurface.id })
          .from(externalSurface)
          .where(activeSurface(projectId))
          .limit(1)
          .for("update");
        const surfaceId = existing?.id ?? crypto.randomUUID();
        if (!existing) {
          await transaction.insert(externalSurface).values({
            id: surfaceId,
            projectId,
            surfaceKind: SURFACE_KIND,
            workspaceId,
          });
        }
        // A surface always has its own canonical slug (surfaces published before
        // slugs existed get theirs on the next approval); the id is never reused.
        const [named] = await transaction
          .select({ slug: buildInPublicSlug.slug })
          .from(buildInPublicSlug)
          .where(
            and(
              eq(buildInPublicSlug.surfaceId, surfaceId),
              eq(buildInPublicSlug.canonical, true),
            ),
          )
          .limit(1);
        if (!named) {
          await transaction
            .insert(buildInPublicSlug)
            .values({ canonical: true, slug, surfaceId, workspaceId });
        }
        const [latest] = await transaction
          .select({ revision: externalSurfaceSnapshotRevision.revision })
          .from(externalSurfaceSnapshotRevision)
          .where(eq(externalSurfaceSnapshotRevision.surfaceId, surfaceId))
          .orderBy(desc(externalSurfaceSnapshotRevision.revision))
          .limit(1);
        const revision = (latest?.revision ?? 0) + 1;
        await transaction.insert(externalSurfaceSnapshotRevision).values({
          createdAt: new Date(snapshot.approvedAt),
          id: crypto.randomUUID(),
          revision,
          snapshot,
          surfaceId,
        });
        return {
          approvedAt: snapshot.approvedAt,
          projectId,
          revision,
          surfaceId,
        };
      }),

    saveCopy: async ({ copy, projectId }) => {
      await database
        .insert(buildInPublicWorkCopy)
        .values({
          dueDatePresentation: copy.dueDatePresentation,
          projectId,
          publicStatusLabel: copy.publicStatusLabel,
          publicSummary: copy.publicSummary,
          publicTitle: copy.publicTitle,
          workId: copy.workId,
        })
        .onConflictDoUpdate({
          set: {
            dueDatePresentation: copy.dueDatePresentation,
            publicStatusLabel: copy.publicStatusLabel,
            publicSummary: copy.publicSummary,
            publicTitle: copy.publicTitle,
            updatedAt: new Date(),
          },
          target: buildInPublicWorkCopy.workId,
        });
    },

    saveSetting: async ({ projectId, setting, workspaceId }) => {
      await database
        .insert(buildInPublicSetting)
        .values({
          enabled: setting.enabled,
          projectId,
          statusMap: setting.statusMap,
          workspaceId,
        })
        .onConflictDoUpdate({
          set: {
            enabled: setting.enabled,
            statusMap: setting.statusMap,
            updatedAt: new Date(),
          },
          target: buildInPublicSetting.projectId,
        });
    },

    setting: async (projectId) => {
      const [row] = await database
        .select()
        .from(buildInPublicSetting)
        .where(eq(buildInPublicSetting.projectId, projectId))
        .limit(1);
      return row ? { enabled: row.enabled, statusMap: row.statusMap } : null;
    },
  };
}

export function createDatabaseBuildInPublic(
  database: Database,
): BuildInPublicAccess {
  return createBuildInPublic({
    facts: createFacts(database),
    store: createStore(database),
  });
}
