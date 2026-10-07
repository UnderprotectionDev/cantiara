import {
  listUnplannedRoadmapCandidates,
  presentRoadmap,
  type RoadmapOriginLink,
  type RoadmapView,
} from "@cantiara/api/roadmap-horizon";
import type { WorkProfile } from "@cantiara/api/work-lifecycle";

/** Shared current-view membership for the Roadmap list and visual viewport. */
export function projectRoadmapWorks(
  works: WorkProfile[],
  origins: RoadmapOriginLink[],
  view: RoadmapView | null,
) {
  const roadmapWorks = works.map((work) => ({
    ...work,
    horizon: work.roadmapHorizon ?? null,
    originResearchIds: origins
      .filter((origin) => origin.targetFeatureId === work.id)
      .map((origin) => origin.sourceResearchId),
    plannedStartDate: work.plannedStartDate ?? null,
  }));
  const candidates = listUnplannedRoadmapCandidates(roadmapWorks, view);
  const candidateIds = new Set(candidates.map(({ work }) => work.id));
  const shown = presentRoadmap(roadmapWorks, view).filter(
    ({ work }) => !candidateIds.has(work.id),
  );
  return { candidates, shown };
}
