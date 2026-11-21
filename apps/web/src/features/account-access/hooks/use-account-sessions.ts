import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { runOnlineOnlyWrite } from "@/features/web-macos-client/store/client-shell";
import { client, orpc } from "@/utils/orpc";

export function useAccountSessions() {
  const queryClient = useQueryClient();
  const sessions = useQuery(orpc.sessions.queryOptions());
  const revokeSessionKey = orpc.revokeSession.mutationKey();
  const revokeOtherSessionsKey = orpc.revokeOtherSessions.mutationKey();
  const revokeSession = useMutation({
    mutationKey: revokeSessionKey,
    mutationFn: (sessionId: string) =>
      runOnlineOnlyWrite(() => client.revokeSession({ sessionId })),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: orpc.sessions.key() });
      toast.success("Session revoked.");
    },
  });
  const revokeOtherSessions = useMutation({
    mutationKey: revokeOtherSessionsKey,
    mutationFn: () => runOnlineOnlyWrite(() => client.revokeOtherSessions()),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: orpc.sessions.key() });
      toast.success("Other sessions revoked.");
    },
  });

  const otherSessionCount =
    sessions.data?.filter((productSession) => !productSession.current).length ??
    0;

  function isRevoking() {
    return (
      queryClient.isMutating({ mutationKey: revokeSessionKey }) > 0 ||
      queryClient.isMutating({ mutationKey: revokeOtherSessionsKey }) > 0
    );
  }

  return {
    isRevoking,
    otherSessionCount,
    revokeOtherSessions,
    revokeSession,
    sessions,
  };
}

export type AccountSessionsController = ReturnType<typeof useAccountSessions>;
