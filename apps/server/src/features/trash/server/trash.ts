import {
  fingerprintMutationPayload,
  type MutationPayload,
} from "@cantiara/api/mutation-and-undo";
import {
  MutationConflictError,
  MutationStaleBaseRevisionError,
} from "@cantiara/api/mutation-contract";
import {
  isTrashChildOnlyKind,
  isTrashRecordKind,
  keepApprovedSurfaceEligibility,
  type MoveToTrashInput,
  type MoveToTrashPreview,
  TRASH_RETENTION_DAYS,
  type TrashAccess,
  TrashAlreadyTrashedError,
  TrashChildRecordError,
  type TrashDeletionKind,
  type TrashEntry,
  TrashKeepSurfaceNotAllowedError,
  type TrashRecordKind,
  type TrashRecordRef,
  type TrashSurface,
  type TrashSurfaceDisposition,
  TrashSurfaceNotRevokedError,
  trashExpiresAt,
  trashRecordKey,
} from "@cantiara/api/trash";

/**
 * Trash behavior (spec 77, first slice): move and list. A moved record keeps
 * its internal id and scope; the entry is the only new fact, so there is no
 * copy to restore later. Every record kind reaches the store through the same
 * port, which the database adapter backs with a per-kind registry.
 */

export interface StoredTrashEntry extends TrashEntry {
  actorAccountId: string;
  baseRevision: number;
  idempotencyKey: string;
  idempotencyScope: string;
  payloadFingerprint: string;
}

/** What the owner record says about itself right now. */
export interface TrashRecordFacts {
  label: string;
  /**
   * `false` when the record may not enter Trash yet (an External Surface must
   * be revoked first); absent means movable.
   */
  movable?: boolean;
  revision: number;
  trashed: boolean;
}

export type TrashCommitOutcome =
  | { status: "moved" }
  | { currentRevision: number; status: "stale" }
  | { entry: StoredTrashEntry; status: "replayed" }
  | { status: "already-trashed" };

export interface TrashStore {
  /**
   * Stamps the owner record as trashed at `entry.baseRevision` and stores the
   * entry, atomically. Nothing is written unless both happen.
   */
  commit: (entry: StoredTrashEntry) => Promise<TrashCommitOutcome>;
  list: (projectId: string) => Promise<StoredTrashEntry[]>;
  /** `null` when the account does not own the Project. */
  project: (
    accountId: string,
    projectId: string,
  ) => Promise<{ workspaceId: string } | null>;
  /** The owner record in the Project, or `null` when it does not exist there. */
  record: (
    projectId: string,
    kind: TrashRecordKind,
    recordId: string,
  ) => Promise<TrashRecordFacts | null>;
  /** The stored result of an earlier attempt with the same idempotency key. */
  replay: (scope: string, key: string) => Promise<StoredTrashEntry | null>;
  /** Keys (`kind:id`) of the given records that are in Trash. */
  trashedKeys: (
    projectId: string,
    records: readonly TrashRecordRef[],
  ) => Promise<Set<string>>;
}

/**
 * Port to the External Surface contract (Link Sharing, Wiki Publishing). Trash
 * lists and triggers; revoke and freeze reuse those owners' paths and write
 * their own security events, so there is no second sharing engine here.
 */
export interface TrashSurfacePort {
  /** Every Dis yuzey attached to the source, in any state. */
  attached: (
    accountId: string,
    projectId: string,
    ref: TrashRecordRef,
  ) => Promise<TrashSurface[]>;
  /**
   * Freezes an Active surface on its last Onayli snapshot revizyonu; `false`
   * when it has none, so the caller revokes instead.
   */
  freeze: (accountId: string, surface: TrashSurface) => Promise<boolean>;
  /** Terminal revoke through the surface owner's own path. */
  revoke: (accountId: string, surface: TrashSurface) => Promise<void>;
}

const noSurfaces: TrashSurfacePort = {
  attached: () => Promise.resolve([]),
  freeze: () => Promise.resolve(false),
  revoke: () => Promise.resolve(),
};

/** A `keep` request is honored only when the pure rule allows it; otherwise it is rejected. */
function assertKeepAllowed(
  disposition: TrashSurfaceDisposition,
  deletion: TrashDeletionKind | undefined,
) {
  if (disposition !== "keep") {
    return;
  }
  const verdict = keepApprovedSurfaceEligibility({
    container: "project",
    deletion: deletion ?? "record",
    sourceCount: 1,
  });
  if (!verdict.eligible) {
    throw new TrashKeepSurfaceNotAllowedError(verdict.reason);
  }
}

/**
 * Freezes (`keep`) or revokes each Active surface. A surface that cannot
 * freeze is revoked, so no surface is ever left live.
 */
function settleSurfaces(
  port: TrashSurfacePort,
  accountId: string,
  active: readonly TrashSurface[],
  disposition: TrashSurfaceDisposition,
): Promise<NonNullable<TrashEntry["surfaces"]>> {
  return Promise.all(
    active.map(async (surface) => {
      if (disposition === "keep" && (await port.freeze(accountId, surface))) {
        return { disposition: "kept" as const, surfaceId: surface.surfaceId };
      }
      await port.revoke(accountId, surface);
      return { disposition: "revoked" as const, surfaceId: surface.surfaceId };
    }),
  );
}

/** Refuses a record that is already in Trash, not yet movable, or at another revision. */
function assertMovable(
  ref: TrashRecordRef,
  facts: TrashRecordFacts,
  baseRevision: number,
) {
  if (facts.trashed) {
    throw new TrashAlreadyTrashedError(ref);
  }
  if (facts.movable === false) {
    throw new TrashSurfaceNotRevokedError(ref.id);
  }
  if (facts.revision !== baseRevision) {
    throw staleRevision(ref.id, facts.label, facts.revision);
  }
}

function toEntry(stored: StoredTrashEntry): TrashEntry {
  return {
    expiresAt: stored.expiresAt,
    groupId: stored.groupId,
    id: stored.id,
    projectId: stored.projectId,
    recordId: stored.recordId,
    recordKind: stored.recordKind,
    recordLabel: stored.recordLabel,
    trashedAt: stored.trashedAt,
    workspaceId: stored.workspaceId,
  };
}

function staleRevision(
  recordId: string,
  label: string,
  currentRevision: number,
) {
  const value: MutationPayload = { label };
  return new MutationStaleBaseRevisionError({
    id: recordId,
    revision: currentRevision,
    value,
  });
}

export function createTrash(
  store: TrashStore,
  options: {
    newId?: () => string;
    now?: () => Date;
    surfaces?: TrashSurfacePort;
  } = {},
): TrashAccess {
  const surfaces = options.surfaces ?? noSurfaces;
  const now = options.now ?? (() => new Date());
  const newId = options.newId ?? (() => crypto.randomUUID());

  return {
    async living(accountId, projectId, records) {
      if (!(await store.project(accountId, projectId))) {
        return null;
      }
      const trashed = await store.trashedKeys(projectId, records);
      return records.filter((ref) => !trashed.has(trashRecordKey(ref)));
    },

    async preview(accountId, input, context) {
      if (!isTrashRecordKind(input.recordKind)) {
        return null;
      }
      const ref: TrashRecordRef = {
        id: input.recordId,
        kind: input.recordKind,
      };
      if (!(await store.project(accountId, input.projectId))) {
        return null;
      }
      if (!(await store.record(input.projectId, ref.kind, ref.id))) {
        return null;
      }
      const attached = await surfaces.attached(accountId, input.projectId, ref);
      const verdict = keepApprovedSurfaceEligibility({
        container: "project",
        deletion: context?.deletion ?? "record",
        sourceCount: 1,
      });
      const hasActive = attached.some(({ state }) => state === "Active");
      const preview: MoveToTrashPreview = {
        defaultDisposition: "revoke",
        keepApprovedSurface:
          verdict.eligible && hasActive
            ? { available: true }
            : {
                available: false,
                reason: verdict.eligible
                  ? "No active External Surface to keep."
                  : verdict.reason,
              },
        recordId: ref.id,
        recordKind: ref.kind,
        surfaces: attached,
      };
      return preview;
    },

    async move(accountId, input: MoveToTrashInput, context) {
      // A child record travels with its owner; refuse before touching storage.
      if (isTrashChildOnlyKind(input.recordKind)) {
        throw new TrashChildRecordError(input.recordKind);
      }
      if (!isTrashRecordKind(input.recordKind)) {
        return null;
      }
      const ref: TrashRecordRef = {
        id: input.recordId,
        kind: input.recordKind,
      };
      const project = await store.project(accountId, input.projectId);
      if (!project) {
        return null;
      }

      const disposition = input.surfaceDisposition ?? "revoke";
      // Fail closed before any write: the commit decides like the preview.
      assertKeepAllowed(disposition, context?.deletion);

      const payloadFingerprint = await fingerprintMutationPayload({
        baseRevision: input.baseRevision,
        projectId: input.projectId,
        recordId: ref.id,
        recordKind: ref.kind,
        // Revoke is the default and keeps the fingerprint of the first slice.
        ...(disposition === "keep" ? { surfaceDisposition: "keep" } : {}),
      });
      const idempotencyScope = `human:${accountId}:trash-move:${trashRecordKey(ref)}`;
      const replayed = (stored: StoredTrashEntry) => {
        if (stored.payloadFingerprint !== payloadFingerprint) {
          throw new MutationConflictError(ref.id);
        }
        return toEntry(stored);
      };

      const earlier = await store.replay(
        idempotencyScope,
        input.clientIdempotencyKey,
      );
      if (earlier) {
        return replayed(earlier);
      }

      const facts = await store.record(input.projectId, ref.kind, ref.id);
      if (!facts) {
        return null;
      }
      assertMovable(ref, facts, input.baseRevision);

      // Access ends before the record leaves view: a revoked or frozen
      // surface never outlives the move, and a lost race afterwards leaves the
      // surface closed (fail closed).
      const dispositions = await settleSurfaces(
        surfaces,
        accountId,
        (await surfaces.attached(accountId, input.projectId, ref)).filter(
          ({ state }) => state === "Active",
        ),
        disposition,
      );

      const trashedAt = now();
      const entry: StoredTrashEntry = {
        actorAccountId: accountId,
        baseRevision: input.baseRevision,
        expiresAt: trashExpiresAt(trashedAt).toISOString(),
        groupId: null,
        id: newId(),
        idempotencyKey: input.clientIdempotencyKey,
        idempotencyScope,
        payloadFingerprint,
        projectId: input.projectId,
        recordId: ref.id,
        recordKind: ref.kind,
        recordLabel: facts.label.slice(0, 255) || ref.kind,
        trashedAt: trashedAt.toISOString(),
        workspaceId: project.workspaceId,
      };

      const outcome = await store.commit(entry);
      switch (outcome.status) {
        case "moved":
          return dispositions.length > 0
            ? { ...toEntry(entry), surfaces: dispositions }
            : toEntry(entry);
        case "replayed":
          return replayed(outcome.entry);
        case "stale":
          throw staleRevision(ref.id, facts.label, outcome.currentRevision);
        case "already-trashed":
          throw new TrashAlreadyTrashedError(ref);
        default:
          return outcome satisfies never;
      }
    },

    async overview(accountId, projectId) {
      if (!(await store.project(accountId, projectId))) {
        return null;
      }
      const stored = await store.list(projectId);
      return {
        entries: stored
          .map(toEntry)
          .sort(
            (a, b) =>
              a.expiresAt.localeCompare(b.expiresAt) ||
              a.id.localeCompare(b.id),
          ),
        retentionDays: TRASH_RETENTION_DAYS,
      };
    },
  };
}
