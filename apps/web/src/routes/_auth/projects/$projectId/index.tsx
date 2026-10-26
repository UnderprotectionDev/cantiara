import { createFileRoute } from "@tanstack/react-router";
import { useCallback } from "react";

import GitHubIntegrationSurface from "@/features/github-integration/ui/components/github-integration-surface";
import ProjectActivitySurface from "@/features/project-history/ui/components/project-activity-surface";
import StoryTimelineSurface from "@/features/project-history/ui/components/story-timeline-surface";
import ProjectReleasesView from "@/features/project-release-planning/ui/views/project-releases-view";
import ProjectShellView from "@/features/project-shell/ui/views/project-shell-view";
import ReleaseEvidencePackSurface from "@/features/release-evidence/ui/components/release-evidence-pack-surface";
import { smartCollectionWorkPrefillFromSearch } from "@/features/smart-collections/lib/smart-collection-work-prefill";

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

  const workHistoryArea = useCallback(
    (workId: string) => (
      <StoryTimelineSurface
        key={workId}
        projectId={projectId}
        workId={workId}
      />
    ),
    [projectId],
  );

  return (
    <ProjectShellView
      accountId={session.data?.user.id}
      githubArea={
        <GitHubIntegrationSurface key={projectId} projectId={projectId} />
      }
      projectHistoryArea={
        <>
          <StoryTimelineSurface key={projectId} projectId={projectId} />
          <ProjectActivitySurface key={projectId} projectId={projectId} />
        </>
      }
      projectId={projectId}
      releaseEvidenceArea={releaseEvidenceArea}
      releasesArea={ProjectReleasesView}
      workHistoryArea={workHistoryArea}
    />
  );
}
