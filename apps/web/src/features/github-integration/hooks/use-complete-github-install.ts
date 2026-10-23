import { useQuery } from "@tanstack/react-query";

import { client } from "@/utils/orpc";
import type { GitHubAppSetup } from "../lib/github-app-setup-search";

/**
 * Finishes the GitHub App install GitHub redirected back from. The server
 * checks the signed state against the signed-in account, so a forged or
 * foreign link is refused; the query runs once and never retries.
 */
export function useCompleteGitHubInstall(setup: GitHubAppSetup) {
  const { installationId, state } = setup;
  return useQuery({
    enabled: installationId !== undefined && state !== undefined,
    gcTime: 0,
    queryFn: () =>
      client.completeGitHubAppInstall({
        installationId: installationId ?? 0,
        state: state ?? "",
      }),
    queryKey: ["github-app-install-complete", installationId, state],
    retry: false,
    staleTime: Number.POSITIVE_INFINITY,
  });
}
