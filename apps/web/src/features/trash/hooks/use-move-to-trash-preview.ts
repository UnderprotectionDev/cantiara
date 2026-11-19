import { useQueryClient } from "@tanstack/react-query";
import { orpc } from "@/utils/orpc";
import type { TrashCandidate } from "../lib/trash-candidates";

/** Reads the `Move to Trash` preview: attached External Surfaces and `Keep approved surface`. */
export function usePreviewMoveToTrash(projectId: string) {
  const queryClient = useQueryClient();
  return function preview(candidate: TrashCandidate) {
    return queryClient.query({
      ...orpc.moveToTrashPreview.queryOptions({
        input: {
          projectId,
          recordId: candidate.id,
          recordKind: candidate.kind,
        },
      }),
      gcTime: 0,
      staleTime: 0,
    });
  };
}
