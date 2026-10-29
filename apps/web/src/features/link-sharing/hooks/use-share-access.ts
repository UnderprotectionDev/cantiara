import { useQueryClient } from "@tanstack/react-query";
import { useRef } from "react";
import { runOnlineOnlyWrite } from "@/features/web-macos-client/store/client-shell";
import { client, orpc } from "@/utils/orpc";

/**
 * Link password, Share token, expiry and revoke writes for one surface, online
 * only. Password, token, reopen and revoke end every open visitor session on
 * the server; the preview is read again after.
 */
export function useShareAccess(surfaceId: string | undefined) {
  const queryClient = useQueryClient();
  const reshareId = useRef(crypto.randomUUID());
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
    reopen: (expiresAt: string | null) =>
      run((id) =>
        client.reopenShareLink({
          confirmOldHoldersRegainAccess: true,
          expiresAt,
          surfaceId: id,
        }),
      ),
    // One id per attempt: a retry after a lost answer cannot mint a second surface.
    reshare: async (expiresAt: string | null) => {
      const shared = await run((id) =>
        client.reshareShareLink({
          expiresAt,
          newSurfaceId: reshareId.current,
          surfaceId: id,
        }),
      );
      reshareId.current = crypto.randomUUID();
      return shared;
    },
    revoke: () => run((id) => client.revokeShareLink({ surfaceId: id })),
    rotateToken: () => run((id) => client.rotateShareToken({ surfaceId: id })),
    setExpiry: (expiresAt: string | null) =>
      run((id) => client.setShareExpiry({ expiresAt, surfaceId: id })),
    setPassword: (password: string | null) =>
      run((id) => client.setLinkPassword({ password, surfaceId: id })),
  };
}
