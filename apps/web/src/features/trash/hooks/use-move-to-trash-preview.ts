import { client } from "@/utils/orpc";
import type { TrashCandidate } from "../lib/trash-candidates";

/** Reads the `Move to Trash` preview: attached External Surfaces and `Keep approved surface`. */
export function usePreviewMoveToTrash(projectId: string) {
  return function preview(candidate: TrashCandidate) {
    return client.moveToTrashPreview({
      projectId,
      recordId: candidate.id,
      recordKind: candidate.kind,
    });
  };
}
