import type { BuildInPublicSnapshot } from "@cantiara/api/build-in-public";
import type { FileAttachmentAccess } from "@cantiara/api/file-attachments";
import type { Database } from "@cantiara/db";
import { workspace } from "@cantiara/db/schema/auth";
import {
  externalSurface,
  externalSurfaceSnapshotRevision,
} from "@cantiara/db/schema/external-surface";
import { fileAttachmentVersion } from "@cantiara/db/schema/file-attachments";
import { and, desc, eq } from "drizzle-orm";

import { slugsOf } from "./build-in-public-database";
import type {
  BuildInPublicAssetSource,
  BuildInPublicSlugReader,
  BuildInPublicSnapshotReader,
  BuildInPublicViewer,
} from "./build-in-public-http";

const TRAILING_SLASH = /\/$/u;

/** The newest Onaylı snapshot revizyonu of one surface, from the surface's own revision table only. */
export function createDatabaseBuildInPublicSnapshots(
  database: Database,
): BuildInPublicSnapshotReader {
  return {
    latest: async (surfaceId) => {
      const [row] = await database
        .select({ snapshot: externalSurfaceSnapshotRevision.snapshot })
        .from(externalSurfaceSnapshotRevision)
        .where(eq(externalSurfaceSnapshotRevision.surfaceId, surfaceId))
        .orderBy(desc(externalSurfaceSnapshotRevision.revision))
        .limit(1);
      const snapshot = row?.snapshot as BuildInPublicSnapshot | undefined;
      return snapshot?.kind === "Build in Public" ? snapshot : null;
    },
  };
}

export function createDatabaseBuildInPublicSlugs(
  database: Database,
): BuildInPublicSlugReader {
  return { read: (surfaceId) => slugsOf(database, surfaceId) };
}

/**
 * Reads the exact approved File Attachment version through the File Attachment
 * owner's `readAsset`; the object-store key and URL never leave that owner.
 */
export function createDatabaseBuildInPublicAssets(
  database: Database,
  fileAttachments: FileAttachmentAccess | undefined,
): BuildInPublicAssetSource {
  return {
    open: async (surfaceId, file) => {
      if (!fileAttachments) {
        return null;
      }
      const [owner] = await database
        .select({ accountId: workspace.ownerAccountId })
        .from(externalSurface)
        .innerJoin(workspace, eq(workspace.id, externalSurface.workspaceId))
        .where(eq(externalSurface.id, surfaceId))
        .limit(1);
      const [version] = await database
        .select({ id: fileAttachmentVersion.id })
        .from(fileAttachmentVersion)
        .where(
          and(
            eq(fileAttachmentVersion.attachmentId, file.attachmentId),
            eq(fileAttachmentVersion.version, file.version),
          ),
        )
        .limit(1);
      if (!(owner && version)) {
        return null;
      }
      try {
        const asset = await fileAttachments.readAsset(owner.accountId, {
          attachmentId: file.attachmentId,
          variant: "original",
          versionId: version.id,
        });
        return {
          bytes: asset.bytes,
          contentType: asset.contentType,
          fileName: asset.fileName,
        };
      } catch {
        // A missing or unreadable file reads as gone; nothing about it is explained.
        return null;
      }
    },
  };
}

/**
 * Owner controls for the signed-in founder only. `accountOf` reads the
 * founder's session cookie (a visitor has none); the surface must belong to a
 * Workspace that account owns. A stale or foreign session gets nothing.
 */
export function createDatabaseBuildInPublicViewer(
  database: Database,
  options: {
    accountOf: (request: Request) => Promise<string | null>;
    appOrigin: string;
  },
): BuildInPublicViewer {
  return {
    controls: async (request, surfaceId) => {
      const accountId = await options.accountOf(request);
      if (!accountId) {
        return null;
      }
      const [row] = await database
        .select({
          ownerAccountId: workspace.ownerAccountId,
          projectId: externalSurface.projectId,
        })
        .from(externalSurface)
        .innerJoin(workspace, eq(workspace.id, externalSurface.workspaceId))
        .where(eq(externalSurface.id, surfaceId))
        .limit(1);
      if (!row?.projectId || row.ownerAccountId !== accountId) {
        return null;
      }
      const project = `${options.appOrigin.replace(TRAILING_SLASH, "")}/projects/${encodeURIComponent(row.projectId)}`;
      return {
        diffHref: `${project}#build-in-public-publish-diff`,
        sourceHref: project,
      };
    },
  };
}
