import { evidenceFlowSourceTypeSchema } from "@cantiara/api/document-evidence";
import { feedbackStatusSchema } from "@cantiara/api/feedback";
import { feedRowKindSchema, feedSortSchema } from "@cantiara/api/feedback-feed";
import { validationRecordSchema } from "@cantiara/api/project-source-records";
import { createFileRoute } from "@tanstack/react-router";
import { useCallback } from "react";
import { z } from "zod";
import SharesAndPublicationsSurface from "@/features/external-surface-management/ui/components/shares-and-publications-surface";
import GitHubIntegrationSurface from "@/features/github-integration/ui/components/github-integration-surface";
import ProductionIncidentsView from "@/features/production-incidents/ui/views/production-incidents-view";
import ClosureSummarySurface from "@/features/project-closure-summary/ui/components/closure-summary-surface";
import { projectActivityFiltersSchema } from "@/features/project-history/lib/project-activity-filters";
import ProjectActivitySurface from "@/features/project-history/ui/components/project-activity-surface";
import StoryTimelineSurface from "@/features/project-history/ui/components/story-timeline-surface";
import WorkRecordHistorySurface from "@/features/project-history/ui/components/work-record-history-surface";
import ProjectReleasesView from "@/features/project-release-planning/ui/views/project-releases-view";
import ProjectArchiveControl from "@/features/project-retirement/ui/components/project-archive-control";
import ProjectShellView from "@/features/project-shell/ui/views/project-shell-view";
import ProjectUpdatesSurface from "@/features/project-updates/ui/components/project-updates-surface";
import ReleaseEvidencePackSurface from "@/features/release-evidence/ui/components/release-evidence-pack-surface";
import { smartCollectionInsightSearchSchema } from "@/features/smart-collections/lib/smart-collection-insights";
import { smartCollectionWorkPrefillFromSearch } from "@/features/smart-collections/lib/smart-collection-work-prefill";
import TrashSurface from "@/features/trash/ui/components/trash-surface";
import ValueChainSurface from "@/features/value-chain/ui/components/value-chain-surface";

import { optionalRouteId } from "@/lib/optional-route-id";

const projectViewSearch = z.object({
  backlogSort: z
    .enum(["Priority", "Date", "Field"])
    .optional()
    .catch(undefined),
  backlogMetricId: optionalRouteId,
  backlogField: z.enum(["Title", "Status"]).optional().catch(undefined),
  roadmapView: optionalRouteId,
  activity: projectActivityFiltersSchema.optional().catch(undefined),
  review: optionalRouteId,
  flow: optionalRouteId,
  tag: optionalRouteId,
  insights: smartCollectionInsightSearchSchema.optional().catch(undefined),
  shareRoot: z.string().trim().min(1).max(512).optional().catch(undefined),
  validationStatus: validationRecordSchema.shape.status
    .optional()
    .catch(undefined),
  feed: z
    .object({
      sort: feedSortSchema.optional().catch(undefined),
      sourceType: feedRowKindSchema.optional().catch(undefined),
      status: feedbackStatusSchema.optional().catch(undefined),
    })
    .optional()
    .catch(undefined),
  evidence: z
    .object({
      subjectId: optionalRouteId,
      sourceType: evidenceFlowSourceTypeSchema,
    })
    .optional()
    .catch(undefined),
  workArchived: z.boolean().optional().catch(undefined),
  workView: z.literal("List").optional().catch(undefined),
});

export const Route = createFileRoute("/_auth/projects/$projectId/")({
  validateSearch: (search) => {
    const configurationReturn =
      typeof search.configurationReturn === "string" &&
      search.configurationReturn.length > 0
        ? search.configurationReturn
        : undefined;

    return {
      ...smartCollectionWorkPrefillFromSearch(search),
      ...projectViewSearch.parse(search),
      ...(search.documentsArchived === true
        ? { documentsArchived: true as const }
        : {}),
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
      <WorkRecordHistorySurface
        key={workId}
        projectId={projectId}
        workId={workId}
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
      archiveArea={
        <ProjectArchiveControl key={projectId} projectId={projectId} />
      }
      githubArea={
        <GitHubIntegrationSurface key={projectId} projectId={projectId} />
      }
      productionArea={ProductionIncidentsView}
      projectHistoryArea={
        <>
          <StoryTimelineSurface key={projectId} projectId={projectId} />
          <ProjectActivitySurface key={projectId} projectId={projectId} />
          <ClosureSummarySurface key={projectId} projectId={projectId} />
        </>
      }
      projectId={projectId}
      projectUpdatesArea={
        <ProjectUpdatesSurface key={projectId} projectId={projectId} />
      }
      releaseEvidenceArea={releaseEvidenceArea}
      releasesArea={ProjectReleasesView}
      sharesAndPublicationsArea={
        <SharesAndPublicationsSurface key={projectId} projectId={projectId} />
      }
      trashArea={<TrashSurface key={projectId} projectId={projectId} />}
      valueChainArea={valueChainArea}
      workHistoryArea={workHistoryArea}
    />
  );
}
