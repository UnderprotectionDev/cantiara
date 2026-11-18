import type { TrashEntry } from "@cantiara/api/trash";
import { useQueryClient } from "@tanstack/react-query";
import { orpc } from "@/utils/orpc";

/**
 * Reads the restore conflict preview of one Trash entry: dependencies that
 * were permanently deleted, are in Trash or changed meaning. It only reads;
 * nothing is rebound.
 */
export function usePreviewRestoreFromTrash(projectId: string) {
  const queryClient = useQueryClient();
  return function previewRestore(entry: TrashEntry) {
    return queryClient.query({
      ...orpc.restoreFromTrashPreview.queryOptions({
        input: { entryId: entry.id, projectId },
      }),
      gcTime: 0,
      staleTime: 0,
    });
  };
}
