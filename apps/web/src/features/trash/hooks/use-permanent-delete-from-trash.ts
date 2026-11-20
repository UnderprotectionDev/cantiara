import type { TrashEntry } from "@cantiara/api/trash";
import { useQueryClient } from "@tanstack/react-query";
import { requestGitHubIdentityGrant } from "@/features/account-access/lib/github-identity-confirmation";
import { client, orpc } from "@/utils/orpc";

/**
 * Early `Permanently Delete` for one Trash entry (or its whole Project delete
 * group). The Account Access `Confirm GitHub Identity` grant is minted by that
 * feature's existing flow and only carried here; the server consumes it once.
 * The key belongs to one attempt at one entry revision, so a retry replays.
 */
export function usePermanentDeleteFromTrash(projectId: string) {
  const queryClient = useQueryClient();
  return {
    async confirmIdentity() {
      const grant = await requestGitHubIdentityGrant("early-permanent-delete");
      if (!grant) {
        throw new Error("Confirm GitHub Identity did not return a grant.");
      }
      return grant;
    },
    permanentlyDelete(
      entry: TrashEntry,
      confirmation: {
        grant: string;
        typedName: string;
        clientIdempotencyKey: string;
      },
    ) {
      return client.permanentlyDeleteFromTrash({
        ...confirmation,
        baseRevision: entry.revision,
        entryId: entry.id,
        projectId,
      });
    },
    preview: (entry: TrashEntry) =>
      queryClient.query({
        ...orpc.previewPermanentDeleteFromTrash.queryOptions({
          input: { entryId: entry.id, projectId },
        }),
        gcTime: 0,
        staleTime: 0,
      }),
  };
}
