import { useQuery } from "@tanstack/react-query";
import { useCallback } from "react";
import { orpc } from "@/utils/orpc";
import { useProjectActivity } from "../../hooks/use-project-activity";
import { NO_PROJECT_ACTIVITY_FILTERS } from "../../lib/project-activity-filters";
import { RecordActivityView } from "../views/project-activity-view";
import StoryTimelineSurface from "./story-timeline-surface";

function WorkRecordActivity({
  projectId,
  workId,
}: {
  projectId: string;
  workId: string;
}) {
  const { activity, query } = useProjectActivity({
    filters: NO_PROJECT_ACTIVITY_FILTERS,
    projectId,
    sourceRecord: { recordId: workId, recordType: "Work" },
  });
  const { fetchNextPage } = query;
  const loadMore = useCallback(() => {
    fetchNextPage();
  }, [fetchNextPage]);
  if (query.isPending) {
    return <p role="status">Loading Record history…</p>;
  }
  if (!activity) {
    return <p role="alert">Record history is unavailable.</p>;
  }
  return (
    <RecordActivityView
      activity={activity}
      hasMore={query.hasNextPage}
      loadingMore={query.isFetchingNextPage}
      loadMoreFailed={query.isFetchNextPageError}
      onLoadMore={loadMore}
      projectId={projectId}
    />
  );
}

/**
 * History of the opened Work record: its own Kayıt geçmişi (`Record history`)
 * and, only for a Feature-type Work, the Feature `Story Timeline`.
 */
export default function WorkRecordHistorySurface({
  projectId,
  workId,
}: {
  projectId: string;
  workId: string;
}) {
  const work = useQuery(orpc.work.queryOptions({ input: { workId } }));
  return (
    <div className="space-y-6">
      {work.data?.type === "Feature" ? (
        <StoryTimelineSurface projectId={projectId} workId={workId} />
      ) : null}
      <WorkRecordActivity projectId={projectId} workId={workId} />
    </div>
  );
}
