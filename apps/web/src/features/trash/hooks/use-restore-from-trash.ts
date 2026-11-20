import type { TrashEntry } from "@cantiara/api/trash";
import { client } from "@/utils/orpc";

export function useRestoreFromTrash(projectId: string) {
  return function restore(entry: TrashEntry, clientIdempotencyKey: string) {
    return client.restoreFromTrash({
      baseRevision: entry.revision,
      clientIdempotencyKey,
      entryId: entry.id,
      projectId,
    });
  };
}
