import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { client, orpc } from "@/utils/orpc";
import type { GitHubAppSetup } from "../lib/github-app-setup-search";

/** Completes the callback once per signed setup while this surface is open. */
export function useCompleteGitHubInstall(setup: GitHubAppSetup) {
  const { installationId, state } = setup;
  const queryClient = useQueryClient();
  const attempted = useRef<GitHubAppSetup | undefined>(undefined);
  const completion = useMutation({
    mutationKey: orpc.completeGitHubAppInstall.mutationKey(),
    meta: { onlineWrite: true, privateInput: true },
    mutationFn: async (id: number) => {
      if (!state) {
        throw new Error("The GitHub App install could not be finished.");
      }
      const { installation, projectId } = await client.completeGitHubAppInstall(
        {
          installationId: id,
          state,
        },
      );
      return {
        installation: { accountLogin: installation.accountLogin },
        projectId,
      };
    },
    onSuccess: ({ projectId }) =>
      queryClient.invalidateQueries({
        queryKey: orpc.projectGitHubOverview.queryKey({ input: { projectId } }),
      }),
  });
  const { mutate } = completion;
  useEffect(() => {
    if (
      installationId === undefined ||
      !state ||
      (attempted.current?.installationId === installationId &&
        attempted.current?.state === state)
    ) {
      return;
    }
    attempted.current = { installationId, state };
    mutate(installationId);
  }, [installationId, mutate, state]);
  return {
    data:
      state && completion.variables === installationId
        ? completion.data
        : undefined,
    error: completion.error,
    isError: completion.isError,
    isPending: Boolean(state) && (completion.isIdle || completion.isPending),
  };
}
