import type { AccountPreferences } from "@cantiara/api/account-preferences";
import type { ProjectOverviewSources } from "@cantiara/api/project-overview";
import type { ProjectProfile } from "@cantiara/api/project-shell";
import { useQuery } from "@tanstack/react-query";
import { projectGoalsHref } from "@/features/project-goals/ui/components/project-goals-view";

import { ROADMAP_HASH } from "@/features/project-shell/lib/project-shell-navigation";
import { riskHref } from "@/features/risks/ui/components/project-risks-view";
import { orpc } from "@/utils/orpc";
import ProjectOverviewView from "./project-overview";

export default function ProjectOverviewSurface({
  accountFormattingPreferences,
  project,
}: {
  accountFormattingPreferences?: AccountPreferences;
  project: ProjectProfile;
}) {
  const risksQuery = useQuery(
    orpc.projectRisks.queryOptions({ input: { projectId: project.id } }),
  );
  const risks = risksQuery.data?.records.map((record) => ({
    id: record.id,
    title: record.title,
    status: record.life,
    description: record.impact,
    href: riskHref(project.id, record.id),
  }));
  const goalsQuery = useQuery(
    orpc.projectGoals.queryOptions({ input: { projectId: project.id } }),
  );
  const goals = goalsQuery.data?.records.map((goal) => ({
    id: goal.id,
    title: goal.title,
    description: goal.description,
    href: projectGoalsHref(project.id, goal.id),
  }));
  const milestonesQuery = useQuery(
    orpc.projectMilestones.queryOptions({ input: { projectId: project.id } }),
  );
  const roadmapHref = `/projects/${encodeURIComponent(project.id)}#${ROADMAP_HASH}`;
  const milestones: ProjectOverviewSources["milestones"] =
    milestonesQuery.data?.map((milestone) => ({
      description: milestone.description,
      href: roadmapHref,
      id: milestone.id,
      status: milestone.status,
      targetDate: milestone.targetDate,
      title: milestone.title,
    }));

  return (
    <ProjectOverviewView
      accountFormattingPreferences={accountFormattingPreferences}
      project={project}
      sources={{
        goals,
        milestones,
        risks,
        moduleHrefs: {
          Goals: projectGoalsHref(project.id),
          Risks: riskHref(project.id),
          Milestones: roadmapHref,
        },
      }}
    />
  );
}
