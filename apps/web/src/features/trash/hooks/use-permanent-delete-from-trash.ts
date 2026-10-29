import type { TrashEntry } from "@cantiara/api/trash";
import { useQueryClient } from "@tanstack/react-query";
import { useRef } from "react";
import { requestGitHubIdentityGrant } from "@/features/account-access/lib/github-identity-confirmation";
import { runOnlineOnlyWrite } from "@/features/web-macos-client/store/client-shell";
import { client, orpc } from "@/utils/orpc";

/**
 * Early `Permanently Delete` for one Trash entry (or its whole Project delete
 * group). The Account Access `Confirm GitHub Identity` grant is minted by that
 * feature's existing flow and only carried here; the server consumes it once.
 * The key belongs to one attempt at one entry revision, so a retry replays.
 */
export function usePermanentDeleteFromTrash(projectId: string) {
  const queryClient = useQueryClient();
  const attempt = useRef<{ fingerprint: string; key: string } | null>(null);
  return {
    async confirmIdentity() {
      const grant = await requestGitHubIdentityGrant("early-permanent-delete");
      if (!grant) {
        throw new Error("Confirm GitHub Identity did not return a grant.");
      }
      return grant;
    },
    async permanentlyDelete(
      entry: TrashEntry,
      confirmation: { grant: string; typedName: string },
    ) {
      const fingerprint = `${entry.id}:${entry.revision}`;
      if (attempt.current?.fingerprint !== fingerprint) {
        attempt.current = { fingerprint, key: crypto.randomUUID() };
      }
      const { key } = attempt.current;
      try {
        const result = await runOnlineOnlyWrite(() =>
          client.permanentlyDeleteFromTrash({
            baseRevision: entry.revision,
            clientIdempotencyKey: key,
            entryId: entry.id,
            grant: confirmation.grant,
            projectId,
            typedName: confirmation.typedName,
          }),
        );
        attempt.current = null;
        return result;
      } finally {
        await queryClient.invalidateQueries({ queryKey: orpc.trash.key() });
      }
    },
    preview: (entry: TrashEntry) =>
      client.previewPermanentDeleteFromTrash({
        entryId: entry.id,
        projectId,
      }),
  };
}
