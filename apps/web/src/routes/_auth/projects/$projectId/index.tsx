import { createFileRoute } from "@tanstack/react-router";
import { useCallback } from "react";

import GitHubIntegrationSurface from "@/features/github-integration/ui/components/github-integration-surface";
import ProductionIncidentsView from "@/features/production-incidents/ui/views/production-incidents-view";
import ProjectReleasesView from "@/features/project-release-planning/ui/views/project-releases-view";
import ProjectShellView from "@/features/project-shell/ui/views/project-shell-view";
import ReleaseEvidencePackSurface from "@/features/release-evidence/ui/components/release-evidence-pack-surface";
import { smartCollectionWorkPrefillFromSearch } from "@/features/smart-collections/lib/smart-collection-work-prefill";
import ValueChainSurface from "@/features/value-chain/ui/components/value-chain-surface";

export const Route = createFileRoute("/_auth/projects/$projectId/")({
  validateSearch: (search) => {
    const configurationReturn =
      typeof search.configurationReturn === "string" &&
      search.configurationReturn.length > 0
        ? search.configurationReturn
        : undefined;

    return {
      ...smartCollectionWorkPrefillFromSearch(search),
      ...(configurationReturn ? { configurationReturn } : {}),
    };
  },
  component: RouteComponent,
});

function RouteComponent() {
  const { projectId } = Route.useParams();
  const { session } = Route.useRouteContext();
  const releaseEvidenceArea = useCallback(
    (releaseId: string) => (
      <ReleaseEvidencePackSurface
        key={releaseId}
        projectId={projectId}
        releaseId={releaseId}
      />
    ),
    [projectId],
  );

  const valueChainArea = useCallback(
    (goalId: string) => (
      <ValueChainSurface goalId={goalId} key={goalId} projectId={projectId} />
    ),
    [projectId],
  );

  return (
    <ProjectShellView
      accountId={session.data?.user.id}
      githubArea={
        <GitHubIntegrationSurface key={projectId} projectId={projectId} />
      }
      productionArea={ProductionIncidentsView}
      projectId={projectId}
      releaseEvidenceArea={releaseEvidenceArea}
      releasesArea={ProjectReleasesView}
      valueChainArea={valueChainArea}
    />
  );
}
