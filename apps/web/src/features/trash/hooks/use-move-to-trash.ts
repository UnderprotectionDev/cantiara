import type { TrashSurfaceDisposition } from "@cantiara/api/trash";
import { useQueryClient } from "@tanstack/react-query";
import { useRef } from "react";
import { runOnlineOnlyWrite } from "@/features/web-macos-client/store/client-shell";
import { client, orpc } from "@/utils/orpc";
import type { TrashCandidate } from "../lib/trash-candidates";

/**
 * Moves one record to Trash online. The idempotency key belongs to one
 * attempt at one record revision, so a retry is replayed by the server and a
 * changed record gets a new key. Trash and the source lists are refreshed.
 */
export function useMoveToTrash(projectId: string) {
  const queryClient = useQueryClient();
  const attempt = useRef<{ fingerprint: string; key: string } | null>(null);
  return async function move(
    candidate: TrashCandidate,
    surfaceDisposition: TrashSurfaceDisposition = "revoke",
  ) {
    const fingerprint = `${candidate.kind}:${candidate.id}:${candidate.revision}:${surfaceDisposition}`;
    if (attempt.current?.fingerprint !== fingerprint) {
      attempt.current = { fingerprint, key: crypto.randomUUID() };
    }
    const { key } = attempt.current;
    try {
      const entry = await runOnlineOnlyWrite(() =>
        client.moveToTrash({
          baseRevision: candidate.revision,
          clientIdempotencyKey: key,
          projectId,
          recordId: candidate.id,
          recordKind: candidate.kind,
          surfaceDisposition,
        }),
      );
      attempt.current = null;
      return entry;
    } finally {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: orpc.trash.key() }),
        queryClient.invalidateQueries({ queryKey: orpc.projectRisks.key() }),
        queryClient.invalidateQueries({
          queryKey: orpc.projectDecisions.key(),
        }),
      ]);
    }
  };
}
