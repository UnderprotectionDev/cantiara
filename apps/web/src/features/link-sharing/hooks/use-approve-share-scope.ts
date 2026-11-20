import type { ApproveShareScopeInput } from "@cantiara/api/link-sharing";
import { hashKey, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef } from "react";
import { client, orpc } from "@/utils/orpc";
import type { IssuedShareLink } from "../lib/share-access";

/** A changed selection starts a new approval. A retry replays its approval id. */
export function useApproveShareScope(
  issueLink: (link: IssuedShareLink) => void,
) {
  const queryClient = useQueryClient();
  const attempt = useRef<{ fingerprint: string; id: string } | null>(null);
  const approval = useMutation({
    ...orpc.approveShareScope.mutationOptions(),
    mutationFn: async (input: ApproveShareScopeInput) => {
      const { accessToken, ...approved } =
        await client.approveShareScope(input);
      if (accessToken) {
        issueLink({ surfaceId: approved.surfaceId, token: accessToken });
      }
      return approved;
    },
    onSuccess: (_, input) => {
      if (attempt.current?.id === input.approvalId) {
        attempt.current = null;
      }
    },
    onSettled: (_, __, { root }) =>
      queryClient.invalidateQueries({
        queryKey: orpc.previewShareScope.queryKey({ input: { root } }),
      }),
  });
  return function approve(input: Omit<ApproveShareScopeInput, "approvalId">) {
    const fingerprint = hashKey([input]);
    if (attempt.current?.fingerprint !== fingerprint) {
      attempt.current = { fingerprint, id: crypto.randomUUID() };
    }
    return approval.mutateAsync({ ...input, approvalId: attempt.current.id });
  };
}
