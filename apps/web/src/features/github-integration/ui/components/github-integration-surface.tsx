// biome-ignore-all lint/performance/noJsxPropsBind: Handlers bind to the Project.

import { DEFAULT_ACCOUNT_PREFERENCES } from "@cantiara/api/account-preferences";
import { Button } from "@cantiara/ui/components/button";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouteContext } from "@tanstack/react-router";
import { useCallback, useMemo } from "react";
import { fetchFresh } from "@/lib/fetch-fresh";
import { executeWrite } from "@/utils/execute-write";
import {
  accountPreferencesQueryOptions,
  client,
  invalidateSmartCollectionMembership,
  orpc,
} from "@/utils/orpc";
import { linkWorkTargetOf } from "../../lib/github-forms";
import {
  type GitHubIntegrationActions,
  GitHubIntegrationView,
} from "../views/github-integration-view";
import { GitHubChecksPanel } from "./github-checks-panel";
import { GitHubPrContextCards } from "./github-pr-context-card";
import {
  type GitHubWorkLinkActions,
  GitHubWorkLinksPanel,
} from "./github-work-links-panel";

/** The Project GitHub area: GitHub App install, Repository links, first triage. */
export default function GitHubIntegrationSurface({
  projectId,
}: {
  projectId: string;
}) {
  const queryClient = useQueryClient();
  const { session } = useRouteContext({ from: "/_auth" });
  const formattingPreferences =
    useQuery(accountPreferencesQueryOptions(session.data.user.id)).data ??
    DEFAULT_ACCOUNT_PREFERENCES;
  const options = orpc.projectGitHubOverview.queryOptions({
    input: { projectId },
  });
  const overview = useQuery(options);
  const linksOptions = orpc.projectGitHubWorkLinks.queryOptions({
    input: { projectId },
  });
  const workLinks = useQuery({ ...linksOptions, enabled: overview.isSuccess });
  const checksOptions = orpc.projectGitHubChecks.queryOptions({
    input: { projectId },
  });
  const prContextOptions = orpc.projectGitHubPrContext.queryOptions({
    input: { projectId },
  });
  const checks = useQuery({ ...checksOptions, enabled: overview.isSuccess });
  const prContext = useQuery({
    ...prContextOptions,
    enabled: overview.isSuccess,
  });
  const recordsOptions = orpc.searchGitHubRecords.queryOptions({
    input: { projectId, query: "" },
  });
  const records = useQuery({ ...recordsOptions, enabled: overview.isSuccess });
  const refreshGitHub = useCallback(
    () =>
      Promise.all(
        [
          options.queryKey,
          checksOptions.queryKey,
          linksOptions.queryKey,
          prContextOptions.queryKey,
          recordsOptions.queryKey,
        ].map((queryKey) => queryClient.invalidateQueries({ queryKey })),
      ),
    [
      checksOptions.queryKey,
      linksOptions.queryKey,
      options.queryKey,
      prContextOptions.queryKey,
      queryClient,
      recordsOptions.queryKey,
    ],
  );
  const write = useCallback(
    <T,>(action: () => Promise<T>) =>
      executeWrite(queryClient, projectId, action, async (_, error) => {
        if (!error) {
          await refreshGitHub();
        }
      }),
    [projectId, queryClient, refreshGitHub],
  );
  const linkActions = useMemo<GitHubWorkLinkActions>(
    () => ({
      onCreateWork: (values) =>
        executeWrite(
          queryClient,
          { ...values, projectId },
          (input) => client.createGitHubWorkAndLink(input),
          async (_, error) => {
            if (!error) {
              await Promise.all([
                refreshGitHub(),
                queryClient.invalidateQueries({
                  queryKey: orpc.projectWorks.queryKey({
                    input: { projectId },
                  }),
                }),
                ...invalidateSmartCollectionMembership(queryClient),
              ]);
            }
          },
        ),
      onDismissSignal: (signalId) =>
        client.dismissGitHubAttentionSignal({ projectId, signalId }),
      onLinkWork: (values) =>
        write(() =>
          client.linkGitHubWork({
            projectId,
            role: values.role as "Contextual" | "Required for completion",
            target: linkWorkTargetOf(values),
            workId: values.workId,
          }),
        ),
      onPreviewCreateWork: (recordId) =>
        fetchFresh(queryClient, {
          ...orpc.previewGitHubCreateWork.queryOptions({
            input: { projectId, recordId },
          }),
          gcTime: 0,
        }),
      onUnlink: (linkId) => client.unlinkGitHubWork({ linkId, projectId }),
    }),
    [projectId, queryClient, refreshGitHub, write],
  );
  const actions = useMemo<GitHubIntegrationActions>(
    () => ({
      loadRepositories: async (installationId) =>
        (await client.gitHubAppRepositories({ installationId, projectId }))
          .repositories,
      loadPreview: (action, linkId) =>
        action === "Disconnect"
          ? client.previewGitHubDisconnect({ linkId, projectId })
          : client.previewGitHubReconnect({ linkId, projectId }),
      loadTriage: (linkId) => client.gitHubTriagePreview({ linkId, projectId }),
      onDisconnect: (linkId) =>
        client.disconnectGitHubRepository({ linkId, projectId }),
      onLink: (values) =>
        write(() => client.linkGitHubRepository({ ...values, projectId })),
      onReconnect: (linkId) =>
        client.reconnectGitHubRepository({ linkId, projectId }),
      onSearch: async (query) =>
        (await client.searchGitHubRecords({ projectId, query })).records,
      onSkipTriage: (linkId) => client.skipGitHubTriage({ linkId, projectId }),
      onSyncNow: (linkId) => client.syncGitHubNow({ linkId, projectId }),
      onStartInstall: async () => {
        const { installUrl } = await client.startGitHubAppInstall({
          projectId,
        });
        window.location.assign(installUrl);
      },
    }),
    [projectId, write],
  );

  if (overview.status === "pending") {
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
  return (
    <div className="space-y-6">
      <GitHubIntegrationView
        actions={actions}
        formattingPreferences={formattingPreferences}
        onCommandSuccess={refreshGitHub}
        overview={overview.data}
        projectId={projectId}
      />
      {prContext.data && overview.data.links.length > 0 ? (
        <GitHubPrContextCards data={prContext.data} projectId={projectId} />
      ) : null}
      {checks.data && overview.data.links.length > 0 ? (
        <GitHubChecksPanel data={checks.data} />
      ) : null}
      {workLinks.data && overview.data.links.length > 0 ? (
        <GitHubWorkLinksPanel
          actions={linkActions}
          data={workLinks.data}
          onCommandSuccess={refreshGitHub}
          records={records.data?.records ?? []}
          repositories={overview.data.links.map((link) => ({
            id: link.id,
            label: `${link.owner}/${link.name}`,
          }))}
        />
      ) : null}
    </div>
  );
}
