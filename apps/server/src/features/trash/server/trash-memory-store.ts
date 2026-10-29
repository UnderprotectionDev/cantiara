import type { TrashRecordKind, TrashRecordRef } from "@cantiara/api/trash";
import { trashRecordKey } from "@cantiara/api/trash";

import type { StoredTrashEntry, TrashRecordFacts, TrashStore } from "./trash";

/**
 * In-memory harness for the Trash seam: one account's Projects and their
 * owner records. Moving a record stamps it trashed and bumps its revision, as
 * the database adapter does, so the record keeps its row and id.
 */
export function createMemoryTrash(options: {
  accountId: string;
  projects: Map<
    string,
    {
      records: Map<
        string,
        { label: string; revision: number; trashed?: boolean }
      >;
      workspaceId: string;
    }
  >;
}) {
  const entries: StoredTrashEntry[] = [];
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

  return { entries, store };
}
