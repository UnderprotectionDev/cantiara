import type { TrashEntry } from "@cantiara/api/trash";
import { client } from "@/utils/orpc";
import { useIdempotentTrashWrite } from "./use-idempotent-trash-write";

/**
 * Restores one Trash entry online. The record keeps its internal id and
 * scope; a Project delete group comes back as one unit. The key belongs to one
 * attempt at one entry revision, so a retry is replayed by the server.
 */
export function useRestoreFromTrash(projectId: string) {
  const write = useIdempotentTrashWrite();
  return function restore(entry: TrashEntry) {
    return write(`${entry.id}:${entry.revision}`, (clientIdempotencyKey) =>
      client.restoreFromTrash({
        baseRevision: entry.revision,
        clientIdempotencyKey,
        entryId: entry.id,
        projectId,
      }),
    );
  };
}
