import type { TrashEntry } from "@cantiara/api/trash";
import { client } from "@/utils/orpc";

/**
 * Reads the restore conflict preview of one Trash entry: dependencies that
 * were permanently deleted, are in Trash or changed meaning. It only reads;
 * nothing is rebound.
 */
export function usePreviewRestoreFromTrash(projectId: string) {
  return function previewRestore(entry: TrashEntry) {
    return client.restoreFromTrashPreview({ entryId: entry.id, projectId });
  };
}
