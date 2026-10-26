import { useQuery } from "@tanstack/react-query";
import { orpc } from "@/utils/orpc";
import { StoryTimelineView } from "../views/story-timeline-view";

/**
 * Loads the Story Timeline of a Project, or of one Feature-type Work when
 * `workId` is given. Read-only. Callers mount the Feature scope only for a
 * Feature-type Work; any other Work has no story of its own.
 */
export default function StoryTimelineSurface({
  projectId,
  workId,
}: {
  projectId: string;
  workId?: string;
}) {
  const input = workId
    ? { projectId, scope: "Feature" as const, workId }
    : { projectId, scope: "Project" as const };
  const timeline = useQuery(orpc.projectStoryTimeline.queryOptions({ input }));
  if (timeline.isPending) {
    return <p role="status">Loading Story Timeline…</p>;
  }
  if (!timeline.data) {
    return <p role="alert">Story Timeline is unavailable.</p>;
  }
  return <StoryTimelineView projectId={projectId} timeline={timeline.data} />;
}
