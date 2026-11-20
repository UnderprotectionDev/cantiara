import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef } from "react";
import { toast } from "sonner";

import { client, orpc } from "@/utils/orpc";

export function useExtensionLinks() {
  const queryClient = useQueryClient();
  const links = useQuery(orpc.webCaptureLinks.queryOptions());
  const pairingCode = useRef<string | null>(null);
  const generatePairingCode = useMutation({
    meta: { onlineWrite: true },
    mutationKey: orpc.createWebCapturePairingCode.mutationKey(),
    mutationFn: async () => {
      pairingCode.current = null;
      const { code, expiresAt } = await client.createWebCapturePairingCode();
      pairingCode.current = code;
      return { expiresAt };
    },
  });
  const revokeLink = useMutation({
    meta: { onlineWrite: true },
    mutationKey: orpc.revokeWebCaptureLink.mutationKey(),
    mutationFn: (linkId: string) => client.revokeWebCaptureLink({ linkId }),
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
    pairingCode:
      generatePairingCode.data && pairingCode.current
        ? { code: pairingCode.current, ...generatePairingCode.data }
        : null,
    revokeLink,
  };
}
