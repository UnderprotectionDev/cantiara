import type { TrashEntry } from "@cantiara/api/trash";
import { useQueryClient } from "@tanstack/react-query";
import { useRef } from "react";
import { runOnlineOnlyWrite } from "@/features/web-macos-client/store/client-shell";
import { client, orpc } from "@/utils/orpc";

/**
 * Restores one Trash entry online. The record keeps its internal id and
 * scope; a Project delete group comes back as one unit. The key belongs to one
 * attempt at one entry revision, so a retry is replayed by the server.
 */
export function useRestoreFromTrash(projectId: string) {
  const queryClient = useQueryClient();
  const attempt = useRef<{ fingerprint: string; key: string } | null>(null);
  return async function restore(entry: TrashEntry) {
    const fingerprint = `${entry.id}:${entry.revision}`;
    if (attempt.current?.fingerprint !== fingerprint) {
      attempt.current = { fingerprint, key: crypto.randomUUID() };
    }
    const { key } = attempt.current;
    try {
      const result = await runOnlineOnlyWrite(() =>
        client.restoreFromTrash({
          baseRevision: entry.revision,
          clientIdempotencyKey: key,
          entryId: entry.id,
          projectId,
        }),
      );
      attempt.current = null;
      return result;
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
