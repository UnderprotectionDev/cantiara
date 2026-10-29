import { useQueryClient } from "@tanstack/react-query";
import { useRef } from "react";
import { runOnlineOnlyWrite } from "@/features/web-macos-client/store/client-shell";
import { client, orpc } from "@/utils/orpc";

type ApproveInput = Parameters<typeof client.approveShareScope>[0];

/**
 * Approves one scope online. The approval id belongs to one attempt, so a retry
 * of the same selection is replayed by the server instead of adding a second
 * revision; a changed selection gets a new id. The preview is read again after.
 */
export function useApproveShareScope() {
  const queryClient = useQueryClient();
  const attempt = useRef<{ fingerprint: string; id: string } | null>(null);
  return async function approve(input: Omit<ApproveInput, "approvalId">) {
    const fingerprint = JSON.stringify(input);
    if (attempt.current?.fingerprint !== fingerprint) {
      attempt.current = { fingerprint, id: crypto.randomUUID() };
    }
    const { id } = attempt.current;
    try {
      const approved = await runOnlineOnlyWrite(() =>
        client.approveShareScope({ ...input, approvalId: id }),
      );
      attempt.current = null;
      return approved;
    } finally {
      await queryClient.invalidateQueries({
        queryKey: orpc.previewShareScope.key(),
      });
    }
  };
}
