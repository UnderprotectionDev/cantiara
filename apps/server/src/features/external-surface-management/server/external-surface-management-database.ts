import type { Database } from "@cantiara/db";
import { workspace } from "@cantiara/db/schema/auth";
import { document } from "@cantiara/db/schema/document";
import {
  externalSurface,
  externalSurfaceSnapshotRevision,
} from "@cantiara/db/schema/external-surface";
import { project } from "@cantiara/db/schema/project";
import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import type {
  SurfaceDirectoryStore,
  SurfaceRecord,
} from "./external-surface-management";

/**
 * Read-only directory adapter over `external_surface` and its latest revision.
 * It selects the password hash only to answer a boolean and never selects the
 * token hash.
 */
export function createDatabaseSurfaceDirectory(
  database: Database,
): SurfaceDirectoryStore {
  return {
    async cancelDetached(accountId, surfaceId) {
      const [owned] = await database
        .select({ id: workspace.id })
        .from(workspace)
        .where(eq(workspace.ownerAccountId, accountId))
        .limit(1);
      if (!owned) {
        return false;
      }
      const rows = await database
        .update(externalSurface)
        .set({ cancelledAt: new Date() })
        .where(
          and(
            eq(externalSurface.id, surfaceId),
            eq(externalSurface.workspaceId, owned.id),
            isNull(externalSurface.cancelledAt),
          ),
        )
        .returning({ id: externalSurface.id });
      return rows.length > 0;
    },

    async records(accountId, scope) {
      const [owned] = await database
        .select({ id: workspace.id })
        .from(workspace)
        .where(eq(workspace.ownerAccountId, accountId))
        .limit(1);
      if (!owned) {
        return [];
      }
      if (scope.projectId) {
        const [scoped] = await database
          .select({ id: project.id })
          .from(project)
          .where(
            and(
              eq(project.id, scope.projectId),
              eq(project.workspaceId, owned.id),
            ),
          )
          .limit(1);
        if (!scoped) {
          return null;
        }
      }
      const surfaces = await database
        .select({
          cancelledAt: externalSurface.cancelledAt,
          documentId: externalSurface.documentId,
          expiresAt: externalSurface.expiresAt,
          hasPassword: externalSurface.passwordHash,
          projectId: externalSurface.projectId,
          projectName: project.name,
          rootId: externalSurface.rootId,
          rootKind: externalSurface.rootKind,
          surfaceId: externalSurface.id,
          surfaceKind: externalSurface.surfaceKind,
          wikiDocumentRevision: document.revision,
        })
        .from(externalSurface)
        .leftJoin(project, eq(project.id, externalSurface.projectId))
        .leftJoin(document, eq(document.id, externalSurface.documentId))
        .where(
          and(
            eq(externalSurface.workspaceId, owned.id),
            scope.projectId
              ? eq(externalSurface.projectId, scope.projectId)
              : undefined,
          ),
        );
      if (surfaces.length === 0) {
        return [];
      }
      const revisions = await database
        .selectDistinctOn([externalSurfaceSnapshotRevision.surfaceId], {
          createdAt: externalSurfaceSnapshotRevision.createdAt,
          number: externalSurfaceSnapshotRevision.revision,
          snapshot: externalSurfaceSnapshotRevision.snapshot,
          surfaceId: externalSurfaceSnapshotRevision.surfaceId,
        })
        .from(externalSurfaceSnapshotRevision)
        .where(
          inArray(
            externalSurfaceSnapshotRevision.surfaceId,
            surfaces.map((surface) => surface.surfaceId),
          ),
        )
        .orderBy(
          externalSurfaceSnapshotRevision.surfaceId,
          desc(externalSurfaceSnapshotRevision.revision),
        );
      const latest = new Map(revisions.map((r) => [r.surfaceId, r]));
      return surfaces.map(
        (surface): SurfaceRecord => ({
          cancelledAt: surface.cancelledAt,
          documentId: surface.documentId,
          expiresAt: surface.expiresAt,
          passwordProtected: surface.hasPassword !== null,
          projectId: surface.projectId,
          projectName: surface.projectName,
          revision: latest.get(surface.surfaceId) ?? null,
          rootId: surface.rootId,
          rootKind: surface.rootKind,
          surfaceId: surface.surfaceId,
          surfaceKind: surface.surfaceKind,
          wikiDocumentRevision: surface.wikiDocumentRevision,
        }),
      );
    },
  };
}
