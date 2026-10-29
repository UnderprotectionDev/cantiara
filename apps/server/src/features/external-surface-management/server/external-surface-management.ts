import {
  ACTIVE_LABEL,
  CHANGE_EXPIRY_LABEL,
  EXPIRED_LABEL,
  type ExternalSurfaceManagementAccess,
  ExternalSurfaceManagementStateError,
  OPEN_SOURCE_LABEL,
  type PurgeRequest,
  REVIEW_DIFF_LABEL,
  REVOKE_UNPUBLISH_LABEL,
  REVOKED_LABEL,
  type SurfaceAction,
  type SurfaceRow,
  type SurfaceStatus,
  type SurfaceVisibilityKind,
} from "@cantiara/api/external-surface-management";
import type { SurfacePurges } from "./external-surface-purge";

/** One stored Dış yüzey with the latest approved revision; no secret ever reaches it. */
export interface SurfaceRecord {
  cancelledAt: Date | null;
  documentId: string | null;
  expiresAt: Date | null;
  passwordProtected: boolean;
  projectId: string | null;
  projectName: string | null;
  /** The latest Onaylı snapshot revizyonu; read for labels only and never returned. */
  revision: { createdAt: Date; number: number; snapshot: unknown } | null;
  rootId: string | null;
  rootKind: string | null;
  surfaceId: string;
  surfaceKind: string | null;
  /** Wiki only: the live Document revision, null when the Document is gone. */
  wikiDocumentRevision: number | null;
}

export interface SurfaceDirectoryStore {
  /**
   * The same terminal `cancelled_at` write the Wiki store performs, for a Wiki
   * surface whose Document is gone and so has no `unpublish` path; false when
   * the surface is not the account's or is already cancelled.
   */
  cancelDetached: (accountId: string, surfaceId: string) => Promise<boolean>;
  /** The account's surfaces (all of them, or one Project's); `null` when the Project is not the account's. */
  records: (
    accountId: string,
    scope: { projectId?: string },
  ) => Promise<SurfaceRecord[] | null>;
}

/** What a Link Sharing source says about itself now; `null` when the source is gone. */
export interface LinkSourceState {
  hasChanges: boolean;
}

export interface SurfaceDirectoryPorts {
  /** Reads the live source of a Link share through the Link Sharing preview. */
  linkSource: (
    accountId: string,
    record: SurfaceRecord,
  ) => Promise<LinkSourceState | null>;
  now?: () => Date;
  /** The cache and index purge requests of removed surfaces. */
  purges: SurfacePurges;
  /** Link Sharing `Revoke`: the shared terminal transition; null when not the account's. */
  revokeLink: (accountId: string, surfaceId: string) => Promise<unknown | null>;
  store: SurfaceDirectoryStore;
  /** Wiki Publishing `Unpublish` of the Document's active surface. */
  unpublishWiki: (
    accountId: string,
    documentId: string,
  ) => Promise<unknown | null>;
}

const PENDING: PurgeRequest = {
  attempts: 0,
  nextAttemptAt: null,
  status: "Pending",
};

interface SnapshotFacts {
  approvedAt: string | null;
  redacted: boolean;
  title: string;
}

/** Reads only the labels a row needs; the body, items and members stay behind. */
function snapshotFacts(snapshot: unknown): SnapshotFacts {
  const value =
    snapshot && typeof snapshot === "object"
      ? (snapshot as Record<string, unknown>)
      : {};
  const root =
    value.root && typeof value.root === "object"
      ? (value.root as Record<string, unknown>)
      : {};
  const { title: own } = value;
  const { title: rooted } = root;
  let title = "";
  if (typeof own === "string") {
    title = own;
  } else if (typeof rooted === "string") {
    title = rooted;
  }
  return {
    approvedAt: typeof value.approvedAt === "string" ? value.approvedAt : null,
    redacted: typeof value.redactedAt === "string",
    title,
  };
}

function visibilityOf(record: SurfaceRecord): SurfaceVisibilityKind {
  if (record.surfaceKind === "Link-limited share") {
    return "Link";
  }
  const kind =
    record.revision?.snapshot && typeof record.revision.snapshot === "object"
      ? (record.revision.snapshot as { kind?: unknown }).kind
      : null;
  return kind === "Wiki Document" ? "Wiki" : "Build in Public";
}

function statusOf(record: SurfaceRecord, now: Date): SurfaceStatus {
  if (record.cancelledAt) {
    return REVOKED_LABEL;
  }
  if (record.expiresAt && record.expiresAt.getTime() <= now.getTime()) {
    return EXPIRED_LABEL;
  }
  return ACTIVE_LABEL;
}

function actionsOf(
  visibility: SurfaceVisibilityKind,
  status: SurfaceStatus,
  hasUnpublishedChanges: boolean,
  detached: boolean,
): SurfaceAction[] {
  if (status === REVOKED_LABEL) {
    return [];
  }
  const actions: SurfaceAction[] = [];
  // A kept, detached surface has no live source to open or compare.
  if (!detached) {
    actions.push(OPEN_SOURCE_LABEL);
    if (hasUnpublishedChanges) {
      actions.push(REVIEW_DIFF_LABEL);
    }
  }
  if (visibility === "Link") {
    actions.push(CHANGE_EXPIRY_LABEL);
  }
  actions.push(REVOKE_UNPUBLISH_LABEL);
  return actions;
}

function sourceOf(record: SurfaceRecord, facts: SnapshotFacts) {
  if (record.rootKind && record.rootId) {
    return {
      id: record.rootId,
      kind: record.rootKind,
      projectId: record.projectId,
      title: facts.title,
    };
  }
  if (record.documentId) {
    return {
      id: record.documentId,
      kind: "Document",
      projectId: record.projectId,
      title: facts.title,
    };
  }
  return {
    id: record.projectId ?? record.surfaceId,
    kind: record.projectId ? "Project" : "Document",
    projectId: record.projectId,
    title: facts.title || (record.projectName ?? ""),
  };
}

async function sourceState(
  ports: SurfaceDirectoryPorts,
  accountId: string,
  record: SurfaceRecord,
  visibility: SurfaceVisibilityKind,
) {
  if (record.cancelledAt) {
    // A removed surface has no source to compare; it only answers `410 Gone`.
    return { detached: false, hasChanges: false };
  }
  if (visibility === "Link") {
    const live = await ports.linkSource(accountId, record);
    return live
      ? { detached: false, hasChanges: live.hasChanges }
      : { detached: true, hasChanges: false };
  }
  if (visibility === "Wiki") {
    const approved =
      record.revision?.snapshot && typeof record.revision.snapshot === "object"
        ? (record.revision.snapshot as { documentRevision?: unknown })
            .documentRevision
        : undefined;
    if (record.wikiDocumentRevision === null) {
      return { detached: true, hasChanges: false };
    }
    return {
      detached: false,
      hasChanges:
        typeof approved === "number" && record.wikiDocumentRevision > approved,
    };
  }
  // Build in Public (spec 75) owns its own source diff; none exists yet.
  return { detached: false, hasChanges: false };
}

export function createExternalSurfaceManagement(
  ports: SurfaceDirectoryPorts,
): ExternalSurfaceManagementAccess {
  const now = ports.now ?? (() => new Date());
  return {
    async list(accountId, input) {
      const records = await ports.store.records(accountId, {
        projectId: input.projectId,
      });
      if (!records) {
        return null;
      }
      const moment = now();
      const purges = await ports.purges.status(
        records
          .filter((record) => record.cancelledAt)
          .map((record) => record.surfaceId),
      );
      const rows: SurfaceRow[] = await Promise.all(
        records.map(async (record) => {
          const visibility = visibilityOf(record);
          const facts = snapshotFacts(record.revision?.snapshot);
          const status = statusOf(record, moment);
          const state = await sourceState(ports, accountId, record, visibility);
          const approvedAt =
            facts.approvedAt ?? record.revision?.createdAt.toISOString();
          return {
            actions: actionsOf(
              visibility,
              status,
              state.hasChanges,
              state.detached,
            ),
            expiresAt: record.expiresAt?.toISOString() ?? null,
            frozenDetached: state.detached,
            hasUnpublishedChanges: state.hasChanges,
            lastApprovedAt: approvedAt ?? null,
            passwordProtected: record.passwordProtected,
            projectId: record.projectId,
            purge: record.cancelledAt
              ? (purges.get(record.surfaceId) ?? PENDING)
              : null,
            redaction: facts.redacted ? "Redacted" : "None",
            revision: record.revision?.number ?? 0,
            source: sourceOf(record, facts),
            status,
            surfaceId: record.surfaceId,
            visibility,
          };
        }),
      );
      return {
        rows: rows.sort((a, b) =>
          (b.lastApprovedAt ?? "").localeCompare(a.lastApprovedAt ?? ""),
        ),
      };
    },

    async remove(accountId, input) {
      const records = await ports.store.records(accountId, {});
      const record = records?.find(
        (entry) => entry.surfaceId === input.surfaceId,
      );
      if (!record) {
        return null;
      }
      if (!record.cancelledAt) {
        const removed = await terminate(record, accountId);
        if (!removed) {
          return null;
        }
      }
      // Hygiene only: a failed purge is retried and never reopens the URL.
      const purge = await ports.purges.request(record.surfaceId);
      return { purge, status: REVOKED_LABEL, surfaceId: record.surfaceId };
    },
  };

  /** The shared lifecycle of each kind; the directory has no softer revoke of its own. */
  async function terminate(record: SurfaceRecord, accountId: string) {
    const visibility = visibilityOf(record);
    if (visibility === "Link") {
      return await ports.revokeLink(accountId, record.surfaceId);
    }
    if (visibility === "Wiki") {
      return record.documentId
        ? await ports.unpublishWiki(accountId, record.documentId)
        : await ports.store.cancelDetached(accountId, record.surfaceId);
    }
    throw new ExternalSurfaceManagementStateError(
      "Build in Public is removed from its own surface.",
    );
  }
}
