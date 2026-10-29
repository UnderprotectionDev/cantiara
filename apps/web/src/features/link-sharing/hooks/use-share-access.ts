import { useQueryClient } from "@tanstack/react-query";
import { runOnlineOnlyWrite } from "@/features/web-macos-client/store/client-shell";
import { client, orpc } from "@/utils/orpc";

/**
 * Link password and Share token writes for one surface, online only. Both end
 * every open visitor session on the server; the preview is read again after.
 */
export function useShareAccess(surfaceId: string | undefined) {
  const queryClient = useQueryClient();
  async function run<T>(write: (id: string) => Promise<T>) {
    if (!surfaceId) {
      throw new Error("Nothing is shared yet");
    }
    try {
      return await runOnlineOnlyWrite(() => write(surfaceId));
    } finally {
      await queryClient.invalidateQueries({
        queryKey: orpc.previewShareScope.key(),
      });
    }
  }
  return {
    rotateToken: () => run((id) => client.rotateShareToken({ surfaceId: id })),
    setPassword: (password: string | null) =>
      run((id) => client.setLinkPassword({ password, surfaceId: id })),
  };
}
