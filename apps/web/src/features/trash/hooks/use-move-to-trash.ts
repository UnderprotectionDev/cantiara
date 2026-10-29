import type { TrashSurfaceDisposition } from "@cantiara/api/trash";
import { client } from "@/utils/orpc";
import type { TrashCandidate } from "../lib/trash-candidates";
import { useIdempotentTrashWrite } from "./use-idempotent-trash-write";

/**
 * Moves one record to Trash online. The idempotency key belongs to one
 * attempt at one record revision, so a retry is replayed by the server and a
 * changed record gets a new key. Trash and the source lists are refreshed.
 */
export function useMoveToTrash(projectId: string) {
  const write = useIdempotentTrashWrite();
  return function move(
    candidate: TrashCandidate,
    surfaceDisposition: TrashSurfaceDisposition = "revoke",
  ) {
    return write(
      `${candidate.kind}:${candidate.id}:${candidate.revision}:${surfaceDisposition}`,
      (clientIdempotencyKey) =>
        client.moveToTrash({
          baseRevision: candidate.revision,
          clientIdempotencyKey,
          projectId,
          recordId: candidate.id,
          recordKind: candidate.kind,
          surfaceDisposition,
        }),
    );
  };
}
