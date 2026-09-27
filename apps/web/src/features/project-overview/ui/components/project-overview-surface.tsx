import type { AccountPreferences } from "@cantiara/api/account-preferences";
import type { ProjectOverviewSources } from "@cantiara/api/project-overview";
import type { ProjectProfile } from "@cantiara/api/project-shell";
import { useQuery } from "@tanstack/react-query";

import { ROADMAP_HASH } from "@/features/project-shell/lib/project-shell-navigation";
import { orpc } from "@/utils/orpc";

import ProjectOverviewView from "./project-overview";

export default function ProjectOverviewSurface({
  accountFormattingPreferences,
  project,
}: {
  accountFormattingPreferences?: AccountPreferences;
  project: ProjectProfile;
}) {
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
        milestones,
        moduleHrefs: { Milestones: roadmapHref },
      }}
    />
  );
}
