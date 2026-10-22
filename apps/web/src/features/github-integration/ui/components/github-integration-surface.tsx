// biome-ignore-all lint/performance/noJsxPropsBind: Handlers bind to the Project.
import { Button } from "@cantiara/ui/components/button";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { runOnlineOnlyWrite } from "@/features/web-macos-client/store/client-shell";
import { client, orpc } from "@/utils/orpc";
import {
  type GitHubIntegrationActions,
  GitHubIntegrationView,
} from "../views/github-integration-view";

/** The Project GitHub area: GitHub App install, Repository links, first triage. */
export default function GitHubIntegrationSurface({
  projectId,
}: {
  projectId: string;
}) {
  const queryClient = useQueryClient();
  const options = orpc.projectGitHubOverview.queryOptions({
    input: { projectId },
  });
  const overview = useQuery(options);
  const actions = useMemo<GitHubIntegrationActions>(() => {
    const refresh = () =>
      queryClient.invalidateQueries({ queryKey: options.queryKey });
    const write = async <T,>(action: () => Promise<T>) => {
      const result = await runOnlineOnlyWrite(action);
      await refresh();
      return result;
    };
    return {
      loadRepositories: async (installationId) =>
        (await client.gitHubAppRepositories({ installationId, projectId }))
          .repositories,
      loadPreview: (action, linkId) =>
        action === "Disconnect"
          ? client.previewGitHubDisconnect({ linkId, projectId })
          : client.previewGitHubReconnect({ linkId, projectId }),
      loadTriage: (linkId) => client.gitHubTriagePreview({ linkId, projectId }),
      onDisconnect: (linkId) =>
        write(() => client.disconnectGitHubRepository({ linkId, projectId })),
      onLink: (values) =>
        write(() => client.linkGitHubRepository({ ...values, projectId })),
      onReconnect: (linkId) =>
        write(() => client.reconnectGitHubRepository({ linkId, projectId })),
      onSearch: async (query) =>
        (await client.searchGitHubRecords({ projectId, query })).records,
      onSkipTriage: (linkId) =>
        write(() => client.skipGitHubTriage({ linkId, projectId })),
      onSyncNow: (linkId) =>
        write(() => client.syncGitHubNow({ linkId, projectId })),
      onStartInstall: async () => {
        const { installUrl } = await runOnlineOnlyWrite(() =>
          client.startGitHubAppInstall({ projectId }),
        );
        window.location.assign(installUrl);
      },
    };
  }, [options.queryKey, projectId, queryClient]);

  if (overview.isPending) {
    return <p role="status">Loading GitHub…</p>;
  }
  if (!overview.data) {
    return (
      <div className="space-y-3">
        <p role="alert">GitHub is unavailable.</p>
        <Button onClick={() => overview.refetch().catch(() => undefined)}>
          Retry
        </Button>
      </div>
    );
  }
  return <GitHubIntegrationView actions={actions} overview={overview.data} />;
}
