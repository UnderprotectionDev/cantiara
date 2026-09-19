import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { runOnlineOnlyWrite } from "@/features/web-macos-client/store/client-shell";
import { client, orpc } from "@/utils/orpc";

export function useExtensionLinks() {
  const queryClient = useQueryClient();
  const links = useQuery(orpc.webCaptureLinks.queryOptions());
  const [pairingCode, setPairingCode] = useState<{
    code: string;
    expiresAt: string;
  } | null>(null);
  const generatePairingCode = useMutation({
    mutationFn: () =>
      runOnlineOnlyWrite(() => client.createWebCapturePairingCode()),
    onSuccess: (nextPairingCode) => {
      setPairingCode(nextPairingCode);
    },
  });
  const revokeLink = useMutation({
    mutationFn: (linkId: string) =>
      runOnlineOnlyWrite(() => client.revokeWebCaptureLink({ linkId })),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: orpc.webCaptureLinks.key(),
      });
      toast.success("Extension link revoked.");
    },
  });

  return {
    generatePairingCode,
    links,
    pairingCode,
    revokeLink,
  };
}
