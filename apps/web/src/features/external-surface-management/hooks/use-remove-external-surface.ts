import { useQueryClient } from "@tanstack/react-query";
import { runOnlineOnlyWrite } from "@/features/web-macos-client/store/client-shell";
import { client, orpc } from "@/utils/orpc";

/** `Revoke / Unpublish` of one surface, online only; the directory is read again after. */
export function useRemoveExternalSurface() {
  const queryClient = useQueryClient();
  return async (surfaceId: string) => {
    try {
      return await runOnlineOnlyWrite(() =>
        client.removeExternalSurface({ surfaceId }),
      );
    } finally {
      await queryClient.invalidateQueries({
        queryKey: orpc.listExternalSurfaces.key(),
      });
    }
  };
}
