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
  type MoveProjectDeleteGroupInput,
  type MoveToTrashInput,
  type MoveToTrashPreview,
  type RestoreFromTrashInput,
  type RestoreResult,
  TRASH_RETENTION_DAYS,
  type TrashAccess,
  TrashAlreadyTrashedError,
  TrashChildRecordError,
  type TrashDeletionKind,
  type TrashEntry,
  TrashKeepSurfaceNotAllowedError,
  type TrashRecordKind,
  type TrashRecordRef,
  type TrashSourceContainer,
  type TrashSurface,
  type TrashSurfaceDisposition,
  TrashSurfaceNotRevokedError,
  trashExpiresAt,
  trashRecordKey,
} from "@cantiara/api/trash";
import {
  isTrashConfigurationKind,
  type TrashConfigurationImpact,
  type TrashRestoreConflict,
  TrashRestoreConflictError,
} from "@cantiara/api/trash-configuration";

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

export interface StoredRestoreReceipt {
  idempotencyKey: string;
  idempotencyScope: string;
  payloadFingerprint: string;
  result: RestoreResult;
}

export type TrashRestoreOutcome =
  | { status: "restored" }
  | { currentRevision: number; recordId: string; status: "stale" }
  | { receipt: StoredRestoreReceipt; status: "replayed" }
  | { status: "gone" };

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
  /** Moves every entry of one Project delete group atomically, or none. */
  commitGroup: (entries: StoredTrashEntry[]) => Promise<TrashCommitOutcome>;
  commitRestore: (
    entries: StoredTrashEntry[],
    receipt: StoredRestoreReceipt,
  ) => Promise<TrashRestoreOutcome>;
  /**
   * Un-stamps every record of the plan at its trashed revision, closes the
   * entries and stores the receipt, atomically. Same ids, same scope.
   */
  /**
   * Where the Project's records live right now: `project` while the Project
   * exists and is not archived, `gone` otherwise. Keep approved surface
   * eligibility reads this instead of assuming a living container.
   */
  container: (projectId: string) => Promise<TrashSourceContainer>;
  /** One entry of the Project, or `null`. */
  find: (
    projectId: string,
    entryId: string,
  ) => Promise<StoredTrashEntry | null>;
  /** Every entry of one Project delete group. */
  group: (projectId: string, groupId: string) => Promise<StoredTrashEntry[]>;
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
  /** The receipt of an earlier restore with the same idempotency key. */
  restoreReceipt: (
    scope: string,
    key: string,
  ) => Promise<StoredRestoreReceipt | null>;
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

/**
 * Port to the configuration definitions (Configuration Trash). It reads what a
 * move would affect and which dependencies a restore could not resolve; it
 * never rebinds a dependency, so a conflict stays visible to the founder.
 */
export interface TrashConfigurationPort {
  /** Affected stored values and living dependents of a definition. */
  impact: (
    projectId: string,
    ref: TrashRecordRef,
  ) => Promise<TrashConfigurationImpact>;
  /**
   * Dependencies of a definition in Trash that are permanently deleted, in
   * Trash or meaning-changed. `unit` holds the keys restoring together.
   */
  restoreConflicts: (
    projectId: string,
    ref: TrashRecordRef,
    unit: ReadonlySet<string>,
  ) => Promise<TrashRestoreConflict[]>;
}

const noConfiguration: TrashConfigurationPort = {
  impact: () => Promise.resolve({ dependents: [], storedValues: [] }),
  restoreConflicts: () => Promise.resolve([]),
};

/** Conflicts of every configuration member of a restore unit. */
async function unitConflicts(
  port: TrashConfigurationPort,
  unit: readonly StoredTrashEntry[],
) {
  const keys = new Set(
    unit.map((member) =>
      trashRecordKey({ id: member.recordId, kind: member.recordKind }),
    ),
  );
  const found = await Promise.all(
    unit
      .filter((member) => isTrashConfigurationKind(member.recordKind))
      .map((member) =>
        port.restoreConflicts(
          member.projectId,
          { id: member.recordId, kind: member.recordKind },
          keys,
        ),
      ),
  );
  return found.flat();
}

const noSurfaces: TrashSurfacePort = {
  attached: () => Promise.resolve([]),
  freeze: () => Promise.resolve(false),
  revoke: () => Promise.resolve(),
};

/**
 * Eligibility from real facts: the container the Project is in now, how many
 * records the deletion moves and which deletion it belongs to.
 */
async function keepVerdict(
  store: TrashStore,
  projectId: string,
  deletion: TrashDeletionKind | undefined,
  sourceCount: number,
) {
  return keepApprovedSurfaceEligibility({
    container: await store.container(projectId),
    deletion: deletion ?? "record",
    sourceCount,
  });
}

/** A `keep` request is honored only when the pure rule allows it; otherwise it is rejected. */
async function assertKeepAllowed(
  store: TrashStore,
  projectId: string,
  disposition: TrashSurfaceDisposition,
  deletion: TrashDeletionKind | undefined,
) {
  if (disposition !== "keep") {
    return;
  }
  const verdict = await keepVerdict(store, projectId, deletion, 1);
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
    revision: stored.baseRevision + 1,
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

/** The members of a Project delete group as sorted refs; `null` for an unknown kind. */
function groupMemberRefs(
  members: MoveProjectDeleteGroupInput["members"],
): (TrashRecordRef & { baseRevision: number })[] | null {
  const refs: (TrashRecordRef & { baseRevision: number })[] = [];
  for (const member of members) {
    // A child record travels with its owner, also inside a group.
    if (isTrashChildOnlyKind(member.recordKind)) {
      throw new TrashChildRecordError(member.recordKind);
    }
    if (!isTrashRecordKind(member.recordKind)) {
      return null;
    }
    refs.push({
      baseRevision: member.baseRevision,
      id: member.recordId,
      kind: member.recordKind,
    });
  }
  return refs.sort((a, b) =>
    trashRecordKey(a).localeCompare(trashRecordKey(b)),
  );
}

/** Every member's owner facts, all movable at their base revision; `null` if one is missing. */
async function loadGroupFacts(
  store: TrashStore,
  projectId: string,
  refs: readonly (TrashRecordRef & { baseRevision: number })[],
) {
  const facts = await Promise.all(
    refs.map((ref) => store.record(projectId, ref.kind, ref.id)),
  );
  const found: TrashRecordFacts[] = [];
  for (const [index, fact] of facts.entries()) {
    const ref = refs[index];
    if (!(fact && ref)) {
      return null;
    }
    assertMovable(ref, fact, ref.baseRevision);
    found.push(fact);
  }
  return found;
}

/** Every member is in Trash at its expected revision; `false` when a record is gone. */
async function assertRestorable(
  store: TrashStore,
  unit: readonly StoredTrashEntry[],
  expectedOf: (member: StoredTrashEntry) => number,
) {
  const facts = await Promise.all(
    unit.map((member) =>
      store.record(member.projectId, member.recordKind, member.recordId),
    ),
  );
  for (const [index, fact] of facts.entries()) {
    const member = unit[index];
    if (!(fact && member)) {
      return false;
    }
    if (fact.revision !== expectedOf(member)) {
      throw staleRevision(member.recordId, fact.label, fact.revision);
    }
  }
  return true;
}

export function createTrash(
  store: TrashStore,
  options: {
    configuration?: TrashConfigurationPort;
    newId?: () => string;
    now?: () => Date;
    surfaces?: TrashSurfacePort;
  } = {},
): TrashAccess {
  const configuration = options.configuration ?? noConfiguration;
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
      const verdict = await keepVerdict(
        store,
        input.projectId,
        context?.deletion,
        1,
      );
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
      return isTrashConfigurationKind(ref.kind)
        ? {
            ...preview,
            configuration: await configuration.impact(input.projectId, ref),
          }
        : preview;
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
      await assertKeepAllowed(
        store,
        input.projectId,
        disposition,
        context?.deletion,
      );

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

      // Active surfaces are settled only after the owner record is stamped:
      // revoke and freeze are irreversible, so a move that loses the race
      // (stale revision, already trashed) must leave every surface untouched.
      // A settle that fails after the commit is healed by the retry, which
      // replays the entry and settles the still Active surfaces again.
      const settleActive = async () =>
        await settleSurfaces(
          surfaces,
          accountId,
          (await surfaces.attached(accountId, input.projectId, ref)).filter(
            ({ state }) => state === "Active",
          ),
          disposition,
        );
      const replayedWithSurfaces = async (stored: StoredTrashEntry) => {
        const entry = replayed(stored);
        const dispositions = await settleActive();
        return dispositions.length > 0
          ? { ...entry, surfaces: dispositions }
          : entry;
      };

      const earlier = await store.replay(
        idempotencyScope,
        input.clientIdempotencyKey,
      );
      if (earlier) {
        return await replayedWithSurfaces(earlier);
      }

      const facts = await store.record(input.projectId, ref.kind, ref.id);
      if (!facts) {
        return null;
      }
      assertMovable(ref, facts, input.baseRevision);

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
        revision: input.baseRevision + 1,
        trashedAt: trashedAt.toISOString(),
        workspaceId: project.workspaceId,
      };

      const outcome = await store.commit(entry);
      switch (outcome.status) {
        case "moved": {
          const dispositions = await settleActive();
          return dispositions.length > 0
            ? { ...toEntry(entry), surfaces: dispositions }
            : toEntry(entry);
        }
        case "replayed":
          return await replayedWithSurfaces(outcome.entry);
        case "stale":
          throw staleRevision(ref.id, facts.label, outcome.currentRevision);
        case "already-trashed":
          throw new TrashAlreadyTrashedError(ref);
        default:
          return outcome satisfies never;
      }
    },

    async moveGroup(accountId, input) {
      const project = await store.project(accountId, input.projectId);
      if (!project) {
        return null;
      }
      const refs = groupMemberRefs(input.members);
      if (!refs) {
        return null;
      }
      const payloadFingerprint = await fingerprintMutationPayload({
        deletion: "project-delete-group",
        members: refs.map(({ baseRevision, id, kind }) => ({
          baseRevision,
          recordId: id,
          recordKind: kind,
        })),
        projectId: input.projectId,
      });
      const scopeOf = (ref: TrashRecordRef) =>
        `human:${accountId}:trash-move:${trashRecordKey(ref)}`;
      const revokeGroupSurfaces = async (
        actor: string,
        projectId: string,
        members: readonly TrashRecordRef[],
      ) => {
        await Promise.all(
          members.map(async (member) =>
            settleSurfaces(
              surfaces,
              actor,
              (await surfaces.attached(actor, projectId, member)).filter(
                ({ state }) => state === "Active",
              ),
              "revoke",
            ),
          ),
        );
      };
      const replayGroup = async (replayId: string | null) => {
        if (!replayId) {
          return null;
        }
        const stored = await store.group(input.projectId, replayId);
        await revokeGroupSurfaces(
          accountId,
          input.projectId,
          stored.map((member) => ({
            id: member.recordId,
            kind: member.recordKind,
          })),
        );
        return stored.map(toEntry).sort((a, b) => a.id.localeCompare(b.id));
      };

      const [first] = refs;
      const earlier = first
        ? await store.replay(scopeOf(first), input.clientIdempotencyKey)
        : null;
      if (earlier) {
        if (earlier.payloadFingerprint !== payloadFingerprint) {
          throw new MutationConflictError(earlier.recordId);
        }
        return await replayGroup(earlier.groupId);
      }

      const facts = await loadGroupFacts(store, input.projectId, refs);
      if (!facts) {
        return null;
      }
      // One clock for the whole group: the same instant, the same expiry.
      const trashedAt = now();
      const groupId = newId();
      const entries: StoredTrashEntry[] = refs.map((ref, index) => ({
        actorAccountId: accountId,
        baseRevision: ref.baseRevision,
        expiresAt: trashExpiresAt(trashedAt).toISOString(),
        groupId,
        id: newId(),
        idempotencyKey: input.clientIdempotencyKey,
        idempotencyScope: scopeOf(ref),
        payloadFingerprint,
        projectId: input.projectId,
        recordId: ref.id,
        recordKind: ref.kind,
        recordLabel: facts[index]?.label.slice(0, 255) || ref.kind,
        revision: ref.baseRevision + 1,
        trashedAt: trashedAt.toISOString(),
        workspaceId: project.workspaceId,
      }));
      const outcome = await store.commitGroup(entries);
      switch (outcome.status) {
        case "moved":
          // Group deletion never keeps a surface: every Active one is revoked,
          // but only once the whole group is committed (compare-then-act).
          await revokeGroupSurfaces(accountId, input.projectId, refs);
          return entries.map(toEntry);
        case "replayed":
          return await replayGroup(outcome.entry.groupId);
        case "stale":
          throw staleRevision(
            first?.id ?? "",
            first?.kind ?? "",
            outcome.currentRevision,
          );
        case "already-trashed":
          throw new TrashAlreadyTrashedError(first ?? { id: "", kind: "Work" });
        default:
          return outcome satisfies never;
      }
    },

    async restore(accountId, input: RestoreFromTrashInput) {
      if (!(await store.project(accountId, input.projectId))) {
        return null;
      }
      const payloadFingerprint = await fingerprintMutationPayload({
        baseRevision: input.baseRevision,
        entryId: input.entryId,
        projectId: input.projectId,
      });
      const scope = `human:${accountId}:trash-restore:${input.entryId}`;
      const replayed = (stored: StoredRestoreReceipt) => {
        if (stored.payloadFingerprint !== payloadFingerprint) {
          throw new MutationConflictError(input.entryId);
        }
        return stored.result;
      };
      const earlier = await store.restoreReceipt(
        scope,
        input.clientIdempotencyKey,
      );
      if (earlier) {
        return replayed(earlier);
      }

      const entry = await store.find(input.projectId, input.entryId);
      if (!entry) {
        return null;
      }
      // A group member is never restored on its own clock: the whole group
      // comes back, or nothing does.
      const unit = entry.groupId
        ? await store.group(input.projectId, entry.groupId)
        : [entry];
      const expectedOf = (member: StoredTrashEntry) =>
        member.id === entry.id ? input.baseRevision : member.baseRevision + 1;
      // A dependency that is gone, in Trash or changed meaning is a conflict
      // for the founder to see, never a silent rebind.
      const conflicts = await unitConflicts(configuration, unit);
      if (conflicts.length > 0) {
        throw new TrashRestoreConflictError(conflicts);
      }
      if (!(await assertRestorable(store, unit, expectedOf))) {
        return null;
      }

      const receipt: StoredRestoreReceipt = {
        idempotencyKey: input.clientIdempotencyKey,
        idempotencyScope: scope,
        payloadFingerprint,
        result: {
          entryId: entry.id,
          groupId: entry.groupId,
          projectId: entry.projectId,
          records: unit.map((member) => ({
            recordId: member.recordId,
            recordKind: member.recordKind,
            revision: expectedOf(member) + 1,
          })),
          restoredAt: now().toISOString(),
        },
      };
      const outcome = await store.commitRestore(unit, receipt);
      switch (outcome.status) {
        case "restored":
          return receipt.result;
        case "replayed":
          return replayed(outcome.receipt);
        case "stale":
          throw staleRevision(
            outcome.recordId,
            entry.recordLabel,
            outcome.currentRevision,
          );
        case "gone":
          return null;
        default:
          return outcome satisfies never;
      }
    },

    async restorePreview(accountId, input) {
      if (!(await store.project(accountId, input.projectId))) {
        return null;
      }
      const entry = await store.find(input.projectId, input.entryId);
      if (!entry) {
        return null;
      }
      const unit = entry.groupId
        ? await store.group(input.projectId, entry.groupId)
        : [entry];
      const conflicts = await unitConflicts(configuration, unit);
      return {
        conflicts,
        entryId: entry.id,
        restorable: conflicts.length === 0,
      };
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
