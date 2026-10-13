import type { ReturnCanvasViewport } from "@cantiara/api/return-visual-tour";
import type { RoadmapView } from "@cantiara/api/roadmap-horizon";
import { useQuery } from "@tanstack/react-query";
import { orpc } from "@/utils/orpc";
import RoadmapCanvas from "./roadmap-canvas";

/** Reuses the Roadmap's authorized live queries; never reads another return summary. */
export default function LiveRoadmapCanvas({
  projectId,
  view,
  onReady,
}: {
  projectId: string;
  view: RoadmapView | null;
  onReady?: (canvas: ReturnCanvasViewport) => void;
}) {
  const works = useQuery(
    orpc.projectWorks.queryOptions({ input: { archived: false, projectId } }),
  );
  const origins = useQuery(
    orpc.projectRoadmapOrigins.queryOptions({ input: { projectId } }),
  );
  const milestones = useQuery(
    orpc.projectMilestones.queryOptions({ input: { projectId } }),
  );
  if (works.isPending || origins.isPending || milestones.isPending) {
    return <p role="status">Loading Roadmap…</p>;
  }
  const available = !(works.isError || origins.isError || milestones.isError);
  return (
    <>
      {!available && (
        <p role="alert">Roadmap is unavailable. Reload and try again.</p>
      )}
      <RoadmapCanvas
        available={available}
        milestones={available ? (milestones.data ?? []) : []}
        onReady={onReady}
        origins={available ? (origins.data ?? []) : []}
        projectId={projectId}
        view={view}
        works={
          available
            ? (works.data ?? []).filter((work) => work.archivedAt === null)
            : []
        }
      />
    </>
  );
}
