import type { LinkSharingAccess } from "@cantiara/api/link-sharing";
import type {
  TrashSurface,
  TrashSurfaceKind,
  TrashSurfaceState,
} from "@cantiara/api/trash";
import type { WikiPublishingAccess } from "@cantiara/api/wiki-publishing";
import type { Database } from "@cantiara/db";
import { workspace } from "@cantiara/db/schema/auth";
import {
  externalSurface,
  externalSurfaceSnapshotRevision,
} from "@cantiara/db/schema/external-surface";
import { securityEvent } from "@cantiara/db/schema/security-event";
import type { SecurityEventDatabase } from "@cantiara/db/security-events";
import { and, eq, isNull, or, sql } from "drizzle-orm";

import type { TrashSurfacePort } from "./trash";

const LINK_SHARE_KIND = "Link-limited share";
const REVOKED_EVENT = "trash.surface-revoked";
const KEPT_EVENT = "trash.surface-kept";

/** A secret-free aliased actor, the same shape Link Sharing writes. */
async function actorAlias(accountId: string) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(accountId),
  );
  const hex = Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
  return `account:${hex.slice(0, 16)}`;
}

function stateOf(row: {
  cancelledAt: Date | null;
  frozenRevision: number | null;
}): TrashSurfaceState {
  if (row.cancelledAt) {
    return "Revoked";
  }
  return row.frozenRevision === null ? "Active" : "Kept";
}

/**
 * Trash's side of the External Surface contract. It lists the surfaces on a
 * source and triggers revoke (through Link Sharing or Wiki Publishing, which
 * own token, visitor-session and cache cutoff) or freeze (`Keep approved
 * surface`). Each outcome appends a secret-free event to the irreversible
 * security log: the event id is derived from type and surface, so a retry
 * never duplicates one, and no token, URL or content is ever written.
 */
export function createDatabaseTrashSurfaces(
  database: Database,
  options: {
    events: SecurityEventDatabase;
    linkSharing: Pick<LinkSharingAccess, "revoke">;
    now?: () => Date;
    wikiPublishing: Pick<WikiPublishingAccess, "unpublish">;
  },
): TrashSurfacePort {
  const now = options.now ?? (() => new Date());

  async function appendEvent(
    type: string,
    accountId: string,
    surfaceId: string,
  ) {
    await options.events
      .insert(securityEvent)
      .values({
        actorAlias: await actorAlias(accountId),
        id: `${type}:${surfaceId}`,
        occurredAt: now(),
        targetSessionAlias: surfaceId,
        type,
        version: 1,
      })
      .onConflictDoNothing({ target: securityEvent.id });
  }

  return {
    async attached(accountId, projectId, ref) {
      const rows = await database
        .select({
          cancelledAt: externalSurface.cancelledAt,
          frozenRevision: externalSurface.frozenRevision,
          id: externalSurface.id,
          surfaceKind: externalSurface.surfaceKind,
        })
        .from(externalSurface)
        .innerJoin(workspace, eq(workspace.id, externalSurface.workspaceId))
        .where(
          and(
            eq(workspace.ownerAccountId, accountId),
            isNull(externalSurface.trashedAt),
            or(
              and(
                eq(externalSurface.rootKind, ref.kind),
                eq(externalSurface.rootId, ref.id),
                eq(externalSurface.projectId, projectId),
              ),
              ref.kind === "Document"
                ? eq(externalSurface.documentId, ref.id)
                : undefined,
            ),
          ),
        )
        .orderBy(externalSurface.createdAt, externalSurface.id);
      return rows.map((row): TrashSurface => {
        const kind: TrashSurfaceKind =
          row.surfaceKind === LINK_SHARE_KIND
            ? LINK_SHARE_KIND
            : "Published Wiki Document";
        return {
          kind,
          state: stateOf(row),
          surfaceId: row.id,
        };
      });
    },

    async freeze(accountId, surface) {
      // One statement: the surface freezes on the revision that is latest at
      // this instant, and never when it was revoked, already frozen or has no
      // approved revision.
      const frozen = await database
        .update(externalSurface)
        .set({
          frozenRevision: sql`(select max(r.revision) from ${externalSurfaceSnapshotRevision} r where r.surface_id = ${externalSurface.id})`,
        })
        .where(
          and(
            eq(externalSurface.id, surface.surfaceId),
            isNull(externalSurface.cancelledAt),
            isNull(externalSurface.frozenRevision),
            sql`exists (select 1 from ${externalSurfaceSnapshotRevision} r where r.surface_id = ${externalSurface.id})`,
          ),
        )
        .returning({ id: externalSurface.id });
      if (frozen.length === 0) {
        return false;
      }
      await appendEvent(KEPT_EVENT, accountId, surface.surfaceId);
      return true;
    },

    async revoke(accountId, surface) {
      // The owner's path ends tokens, visitor sessions and cache.
      if (surface.kind === LINK_SHARE_KIND) {
        await options.linkSharing.revoke(accountId, {
          surfaceId: surface.surfaceId,
        });
      } else {
        const [row] = await database
          .select({ documentId: externalSurface.documentId })
          .from(externalSurface)
          .where(eq(externalSurface.id, surface.surfaceId))
          .limit(1);
        const unpublished = row?.documentId
          ? await options.wikiPublishing
              .unpublish(accountId, row.documentId)
              .catch(() => null)
          : null;
        if (!unpublished) {
          // A project-scoped source is not a Personal Wiki Document, so the
          // Wiki path does not know it; the terminal cancel is the same fact.
          await database
            .update(externalSurface)
            .set({ cancelledAt: now() })
            .where(
              and(
                eq(externalSurface.id, surface.surfaceId),
                isNull(externalSurface.cancelledAt),
              ),
            );
        }
      }
      await appendEvent(REVOKED_EVENT, accountId, surface.surfaceId);
    },
  };
}
