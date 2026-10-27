// biome-ignore-all lint/performance/noJsxPropsBind: The create handler binds to this Project.

import { DEFAULT_ACCOUNT_PREFERENCES } from "@cantiara/api/account-preferences";
import type { ProjectOverviewSources } from "@cantiara/api/project-overview";
import { Button } from "@cantiara/ui/components/button";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { orpc } from "@/utils/orpc";
import { useCreateProjectUpdate } from "../../hooks/use-create-project-update";
import {
  buildProjectUpdateSnapshot,
  projectUpdateLinkCandidates,
} from "../../lib/project-update-form";
import type { ProjectUpdateFormSubmit } from "../forms/project-update-form";
import { ProjectUpdatesView } from "../views/project-updates-view";

/**
 * Loads the Project Updates chronology and the live summary sources (the same
 * Goals, Milestones, Decisions and Risks the Project overview reads). The
 * summary shown here is what the next save freezes.
 */
export default function ProjectUpdatesSurface({
  projectId,
}: {
  projectId: string;
}) {
  const input = { projectId };
  const updates = useQuery(orpc.projectUpdates.queryOptions({ input }));
  const profile = useQuery(orpc.project.queryOptions({ input }));
  const risks = useQuery(orpc.projectRisks.queryOptions({ input }));
  const decisions = useQuery(orpc.projectDecisions.queryOptions({ input }));
  const milestones = useQuery(orpc.projectMilestones.queryOptions({ input }));
  const goals = useQuery(orpc.projectGoals.queryOptions({ input }));
  const preferences = useQuery(orpc.accountPreferences.queryOptions());
  const create = useCreateProjectUpdate();

  const sources = useMemo<ProjectOverviewSources>(
    () => ({
      decisions: decisions.data?.records.map((record) => ({
        id: record.id,
        status: record.life,
        title: record.title,
      })),
      goals: goals.data?.records.map((goal) => ({
        description: goal.description,
        href: `/projects/${encodeURIComponent(projectId)}`,
        id: goal.id,
        title: goal.title,
      })),
      milestones: milestones.data?.map((milestone) => ({
        id: milestone.id,
        status: milestone.status,
        targetDate: milestone.targetDate,
        title: milestone.title,
      })),
      risks: risks.data?.records.map((record) => ({
        id: record.id,
        status: record.life,
        title: record.title,
      })),
    }),
    [decisions.data, goals.data, milestones.data, projectId, risks.data],
  );
  const liveSummary = useMemo(
    () =>
      profile.data ? buildProjectUpdateSnapshot(profile.data, sources) : null,
    [profile.data, sources],
  );
  const candidates = useMemo(
    () => projectUpdateLinkCandidates(sources),
    [sources],
  );

  if (updates.isPending || profile.isPending) {
    return <p role="status">Loading Project Updates…</p>;
  }
  if (updates.isError || !updates.data || !liveSummary) {
    return (
      <div className="space-y-3">
        <p role="alert">Project Updates are unavailable.</p>
        <Button
          onClick={() => {
            updates.refetch().catch(() => undefined);
          }}
          type="button"
          variant="outline"
        >
          Retry
        </Button>
      </div>
    );
  }
  const overview = updates.data;
  return (
    <ProjectUpdatesView
      candidates={candidates}
      formatting={preferences.data ?? DEFAULT_ACCOUNT_PREFERENCES}
      liveSummary={liveSummary}
      onCreate={(values: ProjectUpdateFormSubmit) =>
        create({ ...values, projectId, snapshot: liveSummary })
      }
      projectId={projectId}
      readOnly={overview.readOnly}
      updates={overview.updates}
    />
  );
}
