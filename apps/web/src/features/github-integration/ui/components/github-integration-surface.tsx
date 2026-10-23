// biome-ignore-all lint/performance/noJsxPropsBind: Handlers bind to the Project.
import { DEFAULT_ACCOUNT_PREFERENCES } from "@cantiara/api/account-preferences";
import { Button } from "@cantiara/ui/components/button";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouteContext } from "@tanstack/react-router";
import { useMemo } from "react";
import { runOnlineOnlyWrite } from "@/features/web-macos-client/store/client-shell";
import { accountPreferencesQueryOptions, client, orpc } from "@/utils/orpc";
import type { LinkWorkValues } from "../forms/link-work-form";
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

function targetOf(values: LinkWorkValues) {
  if (values.target === "record") {
    return { kind: "record" as const, recordId: values.recordId };
  }
  if (values.target === "Commit") {
    return {
      kind: "Commit" as const,
      linkId: values.linkId,
      sha: values.reference,
    };
  }
  return {
    kind: "Branch" as const,
    linkId: values.linkId,
    name: values.reference,
  };
}

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
  const linkActions = useMemo<GitHubWorkLinkActions>(() => {
    const write = async <T,>(action: () => Promise<T>) => {
      const result = await runOnlineOnlyWrite(action);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: options.queryKey }),
        queryClient.invalidateQueries({ queryKey: checksOptions.queryKey }),
        queryClient.invalidateQueries({ queryKey: linksOptions.queryKey }),
        queryClient.invalidateQueries({ queryKey: prContextOptions.queryKey }),
        queryClient.invalidateQueries({ queryKey: recordsOptions.queryKey }),
      ]);
      return result;
    };
    return {
      onCreateWork: (values) =>
        write(() => client.createGitHubWorkAndLink({ ...values, projectId })),
      onDismissSignal: (signalId) =>
        write(() =>
          client.dismissGitHubAttentionSignal({ projectId, signalId }),
        ),
      onLinkWork: (values) =>
        write(() =>
          client.linkGitHubWork({
            projectId,
            role: values.role as "Contextual" | "Required for completion",
            target: targetOf(values),
            workId: values.workId,
          }),
        ),
      onPreviewCreateWork: (recordId) =>
        client.previewGitHubCreateWork({ projectId, recordId }),
      onUnlink: (linkId) =>
        write(() => client.unlinkGitHubWork({ linkId, projectId })),
    };
  }, [
    checksOptions.queryKey,
    linksOptions.queryKey,
    options.queryKey,
    prContextOptions.queryKey,
    projectId,
    queryClient,
    recordsOptions.queryKey,
  ]);
  const actions = useMemo<GitHubIntegrationActions>(() => {
    const write = async <T,>(action: () => Promise<T>) => {
      const result = await runOnlineOnlyWrite(action);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: options.queryKey }),
        queryClient.invalidateQueries({ queryKey: checksOptions.queryKey }),
        queryClient.invalidateQueries({ queryKey: linksOptions.queryKey }),
        queryClient.invalidateQueries({ queryKey: prContextOptions.queryKey }),
        queryClient.invalidateQueries({ queryKey: recordsOptions.queryKey }),
      ]);
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
  }, [
    checksOptions.queryKey,
    linksOptions.queryKey,
    options.queryKey,
    prContextOptions.queryKey,
    projectId,
    queryClient,
    recordsOptions.queryKey,
  ]);

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
  return (
    <div className="space-y-6">
      <GitHubIntegrationView
        actions={actions}
        formattingPreferences={formattingPreferences}
        overview={overview.data}
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
