import type { TrashSurfaceDisposition } from "@cantiara/api/trash";
import { client } from "@/utils/orpc";
import type { TrashCandidate } from "../lib/trash-candidates";

export function useMoveToTrash(projectId: string) {
  return function move(
    candidate: TrashCandidate,
    surfaceDisposition: TrashSurfaceDisposition,
    clientIdempotencyKey: string,
  ) {
    return client.moveToTrash({
      baseRevision: candidate.revision,
      clientIdempotencyKey,
      projectId,
      recordId: candidate.id,
      recordKind: candidate.kind,
      surfaceDisposition,
    });
  };
}
