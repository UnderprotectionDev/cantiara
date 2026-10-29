import {
  TRASH_PERMANENT_DELETE_EVENT_TYPE,
  type TrashRecordKind,
} from "@cantiara/api/trash";

import type { StoredTrashEntry } from "./trash";

/**
 * Trash expiry (spec 77): the duration-end permanent delete. A due entry, or a
 * whole Project delete group when any member is due (they share one clock),
 * loses its content, its entries and its place in every living relation, and
 * leaves only content-free marks: a Denetim kaydi, an irreversible security
 * event for restore replay and, for a GitHub record, a tombstone. Nothing
 * permanent happens while an active External Surface still uses a record or
 * sensitive content is not yet removed.
 */

export const TRASH_RETENTION_ACTOR_ALIAS = "system:trash-retention";

/** Secret-free: aliased actor, record kind and id, time. No title, no content. */
export interface TrashPermanentDeleteEvent {
  actorAlias: string;
  id: string;
  occurredAt: string;
  targetAlias: string;
  type: typeof TRASH_PERMANENT_DELETE_EVENT_TYPE;
  version: 1;
}

export interface TrashEventLog {
  append: (event: TrashPermanentDeleteEvent) => Promise<void>;
  list: () => Promise<TrashPermanentDeleteEvent[]>;
}

export type TrashDeleteBlocker = "active-surface" | "sensitive-content";

export interface TrashExpiryStore {
  /** Which refusals apply to the unit right now (empty when it may be deleted). */
  blockers: (
    unit: readonly StoredTrashEntry[],
  ) => Promise<TrashDeleteBlocker[]>;
  /** Units whose clock ended at `now`; a group is one unit. */
  due: (now: Date) => Promise<StoredTrashEntry[][]>;
  /**
   * In one transaction: re-verify the unit is still in Trash, run
   * `beforeCommit` (the cross-database event append), remove the contents and
   * entries, mark living relations and write the audit records. `false` when
   * the unit is no longer in Trash (it was restored meanwhile).
   */
  erase: (
    unit: readonly StoredTrashEntry[],
    events: readonly TrashPermanentDeleteEvent[],
    beforeCommit: () => Promise<void>,
  ) => Promise<boolean>;
  /**
   * Erases records a replay found alive again (restored from an old backup)
   * for the given events. Returns how many records were erased.
   */
  eraseResurrected: (
    events: readonly TrashPermanentDeleteEvent[],
  ) => Promise<number>;
}

export function trashTargetAlias(kind: TrashRecordKind, recordId: string) {
  return `${kind}:${recordId}`;
}

export function parseTrashTargetAlias(
  alias: string,
): { kind: string; recordId: string } | null {
  const at = alias.indexOf(":");
  return at > 0 && at < alias.length - 1
    ? { kind: alias.slice(0, at), recordId: alias.slice(at + 1) }
    : null;
}

export function trashPermanentDeleteEvent(
  entry: Pick<StoredTrashEntry, "recordId" | "recordKind" | "trashedAt">,
  actorAlias: string,
  at: Date,
): TrashPermanentDeleteEvent {
  return {
    actorAlias,
    // Derived from the identity and the trash time, so a retry never duplicates.
    id: `trash-delete:${entry.recordKind}:${entry.recordId}:${entry.trashedAt}`,
    occurredAt: at.toISOString(),
    targetAlias: trashTargetAlias(entry.recordKind, entry.recordId),
    type: TRASH_PERMANENT_DELETE_EVENT_TYPE,
    version: 1,
  };
}

export interface TrashSweepResult {
  blocked: { blockers: TrashDeleteBlocker[]; entryIds: string[] }[];
  deleted: number;
}

export interface TrashMaintenance {
  /** Re-erases records an old backup brought back after their permanent delete. */
  replayPermanentDeletes: () => Promise<number>;
  /** Permanently deletes every unit whose 30 days ended. */
  sweepExpired: (now?: Date) => Promise<TrashSweepResult>;
}

export function createTrashMaintenance(
  store: TrashExpiryStore,
  events: TrashEventLog,
): TrashMaintenance {
  async function replayPermanentDeletes() {
    const history = await events.list();
    if (history.length === 0) {
      return 0;
    }
    return await store.eraseResurrected(history);
  }

  return {
    replayPermanentDeletes,

    async sweepExpired(now = new Date()) {
      await replayPermanentDeletes();
      const result: TrashSweepResult = { blocked: [], deleted: 0 };
      for (const unit of await store.due(now)) {
        // biome-ignore lint/performance/noAwaitInLoops: One unit at a time keeps each permanent delete its own bounded transaction.
        const blockers = await store.blockers(unit);
        if (blockers.length > 0) {
          result.blocked.push({
            blockers,
            entryIds: unit.map(({ id }) => id),
          });
          continue;
        }
        const unitEvents = unit.map((entry) =>
          trashPermanentDeleteEvent(entry, TRASH_RETENTION_ACTOR_ALIAS, now),
        );
        const erased = await store.erase(unit, unitEvents, async () => {
          await Promise.all(unitEvents.map((event) => events.append(event)));
        });
        if (erased) {
          result.deleted += unit.length;
        }
      }
      return result;
    },
  };
}
