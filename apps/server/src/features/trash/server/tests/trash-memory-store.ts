import type { TrashRecordKind, TrashRecordRef } from "@cantiara/api/trash";
import { trashRecordKey } from "@cantiara/api/trash";
import type {
  StoredRestoreReceipt,
  StoredTrashEntry,
  TrashRecordFacts,
  TrashStore,
} from "../trash";
import type {
  TrashEventLog,
  TrashExpiryStore,
  TrashPermanentDeleteEvent,
} from "../trash-expiry";
import { parseTrashTargetAlias } from "../trash-expiry";

interface MemoryRecord {
  /** An External Surface that still serves the record, so delete is refused. */
  activeSurface?: boolean;
  /** A frozen Kept surface still serves visitors, so delete is refused. */
  keptSurface?: boolean;
  label: string;
  movable?: boolean;
  revision: number;
  /** Sensitive content not yet securely removed, so delete is refused. */
  sensitiveContent?: boolean;
  trashed?: boolean;
}

/**
 * In-memory harness for the Trash seam: one account's Projects and their
 * owner records. Moving a record stamps it trashed and bumps its revision, as
 * the database adapter does, so the record keeps its row and id. Restore
 * un-stamps the same record; permanent delete removes it and leaves only the
 * content-free marks (`audit`, `events`, `deletedMarks`).
 */
export function createMemoryTrash(options: {
  accountId: string;
  /** Makes the next erase transaction fail, as a database commit failure would. */
  failEraseCommit?: boolean;
  projects: Map<
    string,
    {
      /** An archived Project is not a living container for `Keep approved surface`. */
      archived?: boolean;
      records: Map<string, MemoryRecord>;
      workspaceId: string;
    }
  >;
}) {
  const entries: StoredTrashEntry[] = [];
  const receipts: StoredRestoreReceipt[] = [];
  const events: TrashPermanentDeleteEvent[] = [];
  const audit: {
    actorAlias: string;
    id: string;
    occurredAt: string;
    targetAlias: string;
    type: string;
  }[] = [];
  /** Living relations whose target is gone get the `Permanently deleted` mark. */
  const deletedMarks = new Set<string>();
  const records = (projectId: string) =>
    options.projects.get(projectId)?.records;
  const key = (kind: TrashRecordKind, id: string) =>
    trashRecordKey({ id, kind });

  const store: TrashStore = {
    commit: (entry) => {
      const owner = records(entry.projectId)?.get(
        key(entry.recordKind, entry.recordId),
      );
      const duplicate = entries.find(
        (stored) =>
          stored.idempotencyScope === entry.idempotencyScope &&
          stored.idempotencyKey === entry.idempotencyKey,
      );
      if (duplicate) {
        return Promise.resolve({ entry: duplicate, status: "replayed" });
      }
      if (!owner || owner.trashed) {
        return Promise.resolve({ status: "already-trashed" });
      }
      if (owner.revision !== entry.baseRevision) {
        return Promise.resolve({
          currentRevision: owner.revision,
          status: "stale",
        });
      }
      owner.trashed = true;
      owner.revision += 1;
      entries.push(structuredClone(entry));
      return Promise.resolve({ status: "moved" });
    },
    commitGroup: (group) => {
      const owners = group.map((entry) =>
        records(entry.projectId)?.get(key(entry.recordKind, entry.recordId)),
      );
      for (const [index, entry] of group.entries()) {
        const owner = owners[index];
        if (!owner || owner.trashed) {
          return Promise.resolve({ status: "already-trashed" });
        }
        if (owner.revision !== entry.baseRevision) {
          return Promise.resolve({
            currentRevision: owner.revision,
            status: "stale",
          });
        }
      }
      // All checked: stamp every member or none.
      for (const [index, entry] of group.entries()) {
        const owner = owners[index];
        if (owner) {
          owner.trashed = true;
          owner.revision += 1;
        }
        entries.push(structuredClone(entry));
      }
      return Promise.resolve({ status: "moved" });
    },
    commitRestore: (unit, receipt) => {
      const duplicate = receipts.find(
        (stored) =>
          stored.idempotencyScope === receipt.idempotencyScope &&
          stored.idempotencyKey === receipt.idempotencyKey,
      );
      if (duplicate) {
        return Promise.resolve({ receipt: duplicate, status: "replayed" });
      }
      const owners = unit.map((entry) =>
        records(entry.projectId)?.get(key(entry.recordKind, entry.recordId)),
      );
      for (const [index, entry] of unit.entries()) {
        const owner = owners[index];
        const stored = entries.find((e) => e.id === entry.id);
        if (!(owner && stored)) {
          return Promise.resolve({ status: "gone" });
        }
        const expected = receipt.result.records[index]?.revision;
        if (owner.revision + 1 !== expected) {
          return Promise.resolve({
            currentRevision: owner.revision,
            recordId: entry.recordId,
            status: "stale",
          });
        }
      }
      for (const [index, entry] of unit.entries()) {
        const owner = owners[index];
        if (owner) {
          owner.trashed = false;
          owner.revision += 1;
        }
        entries.splice(
          entries.findIndex((e) => e.id === entry.id),
          1,
        );
      }
      receipts.push(structuredClone(receipt));
      return Promise.resolve({ status: "restored" });
    },
    container: (projectId) => {
      const project = options.projects.get(projectId);
      return Promise.resolve(project && !project.archived ? "project" : "gone");
    },
    find: (projectId, entryId) => {
      const found = entries.find(
        (e) => e.projectId === projectId && e.id === entryId,
      );
      return Promise.resolve(found ? structuredClone(found) : null);
    },
    group: (projectId, groupId) =>
      Promise.resolve(
        structuredClone(
          entries.filter(
            (e) => e.projectId === projectId && e.groupId === groupId,
          ),
        ),
      ),
    list: (projectId) =>
      Promise.resolve(
        structuredClone(entries.filter((e) => e.projectId === projectId)),
      ),
    project: (accountId, projectId) => {
      const project = options.projects.get(projectId);
      return Promise.resolve(
        accountId === options.accountId && project
          ? { workspaceId: project.workspaceId }
          : null,
      );
    },
    record: (projectId, kind, id): Promise<TrashRecordFacts | null> => {
      const owner = records(projectId)?.get(key(kind, id));
      return Promise.resolve(
        owner
          ? {
              label: owner.label,
              movable: owner.movable,
              revision: owner.revision,
              trashed: owner.trashed === true,
            }
          : null,
      );
    },
    replay: (scope, replayKey) => {
      const found = entries.find(
        (e) => e.idempotencyScope === scope && e.idempotencyKey === replayKey,
      );
      return Promise.resolve(found ? structuredClone(found) : null);
    },
    restoreReceipt: (scope, receiptKey) => {
      const found = receipts.find(
        (r) => r.idempotencyScope === scope && r.idempotencyKey === receiptKey,
      );
      return Promise.resolve(found ? structuredClone(found) : null);
    },
    trashedKeys: (projectId, refs: readonly TrashRecordRef[]) => {
      const inTrash = new Set(
        entries
          .filter((e) => e.projectId === projectId)
          .map((e) => key(e.recordKind, e.recordId)),
      );
      return Promise.resolve(
        new Set(refs.map(trashRecordKey).filter((k) => inTrash.has(k))),
      );
    },
  };

  function remove(entry: StoredTrashEntry) {
    records(entry.projectId)?.delete(key(entry.recordKind, entry.recordId));
    const at = entries.findIndex((e) => e.id === entry.id);
    if (at >= 0) {
      entries.splice(at, 1);
    }
    deletedMarks.add(key(entry.recordKind, entry.recordId));
  }

  const expiry: TrashExpiryStore = {
    blockers: (unit) => {
      const found = new Set<"active-surface" | "sensitive-content">();
      for (const entry of unit) {
        const owner = records(entry.projectId)?.get(
          key(entry.recordKind, entry.recordId),
        );
        if (owner?.activeSurface || owner?.keptSurface) {
          found.add("active-surface");
        }
        if (owner?.sensitiveContent) {
          found.add("sensitive-content");
        }
      }
      return Promise.resolve([...found]);
    },
    due: (now) => {
      const units = new Map<string, StoredTrashEntry[]>();
      for (const entry of entries) {
        units.set(entry.groupId ?? entry.id, [
          ...(units.get(entry.groupId ?? entry.id) ?? []),
          entry,
        ]);
      }
      // A group is due as one unit when its shared clock ended.
      return Promise.resolve(
        structuredClone(
          [...units.values()].filter((unit) =>
            unit.some((entry) => new Date(entry.expiresAt) <= now),
          ),
        ),
      );
    },
    erase: (unit, unitEvents) => {
      if (!unit.every((entry) => entries.some((e) => e.id === entry.id))) {
        return Promise.resolve(false);
      }
      if (options.failEraseCommit) {
        return Promise.reject(new Error("commit failed"));
      }
      for (const entry of unit) {
        remove(entry);
      }
      for (const event of unitEvents) {
        audit.push({
          actorAlias: event.actorAlias,
          id: `audit:${event.id}`,
          occurredAt: event.occurredAt,
          targetAlias: event.targetAlias,
          type: event.type,
        });
      }
      return Promise.resolve(true);
    },
    eraseResurrected: (history) => {
      let erased = 0;
      for (const event of history) {
        const target = parseTrashTargetAlias(event.targetAlias);
        for (const project of options.projects.values()) {
          if (
            target &&
            project.records.delete(`${target.kind}:${target.recordId}`)
          ) {
            erased += 1;
          }
        }
      }
      return Promise.resolve(erased);
    },
  };

  const eventLog: TrashEventLog = {
    append: (event) => {
      if (!events.some((e) => e.id === event.id)) {
        events.push(event);
      }
      return Promise.resolve();
    },
    list: () => Promise.resolve(structuredClone(events)),
  };

  return {
    audit,
    deletedMarks,
    entries,
    eventLog,
    events,
    expiry,
    receipts,
    store,
  };
}
