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
  type MoveToTrashInput,
  TRASH_RETENTION_DAYS,
  type TrashAccess,
  TrashAlreadyTrashedError,
  TrashChildRecordError,
  type TrashEntry,
  type TrashRecordKind,
  type TrashRecordRef,
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
  options: { newId?: () => string; now?: () => Date } = {},
): TrashAccess {
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

    async move(accountId, input: MoveToTrashInput) {
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

      const payloadFingerprint = await fingerprintMutationPayload({
        baseRevision: input.baseRevision,
        projectId: input.projectId,
        recordId: ref.id,
        recordKind: ref.kind,
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
      if (facts.trashed) {
        throw new TrashAlreadyTrashedError(ref);
      }
      if (facts.revision !== input.baseRevision) {
        throw staleRevision(ref.id, facts.label, facts.revision);
      }

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
          return toEntry(entry);
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
