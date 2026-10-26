import { Button } from "@cantiara/ui/components/button";
import { useCallback, useState } from "react";
import { useProjectActivity } from "../../hooks/use-project-activity";
import {
  NO_PROJECT_ACTIVITY_FILTERS,
  type ProjectActivityFilters,
  projectActivityFiltersKey,
} from "../../lib/project-activity-filters";
import { ProjectActivityView } from "../views/project-activity-view";

function ProjectActivityPages({
  filters,
  onApplyFilters,
  projectId,
}: {
  filters: ProjectActivityFilters;
  onApplyFilters: (filters: ProjectActivityFilters) => void;
  projectId: string;
}) {
  const { activity, query } = useProjectActivity({ filters, projectId });
  const { fetchNextPage, refetch } = query;
  const loadMore = useCallback(() => {
    fetchNextPage();
  }, [fetchNextPage]);
  const retry = useCallback(() => {
    refetch();
  }, [refetch]);

  if (query.isPending) {
    return <p role="status">Loading Project Activity…</p>;
  }
  if (!activity) {
    return (
      <div className="space-y-3">
        <p role="alert">Project Activity is unavailable.</p>
        <Button onClick={retry}>Retry</Button>
      </div>
    );
  }
  return (
    <ProjectActivityView
      activity={activity}
      filters={filters}
      hasMore={query.hasNextPage}
      loadingMore={query.isFetchingNextPage}
      loadMoreFailed={query.isFetchNextPageError}
      onApplyFilters={onApplyFilters}
      onLoadMore={loadMore}
      projectId={projectId}
    />
  );
}

/** Loads `Project Activity` of one Project. Read-only; a filter change restarts the list. */
export default function ProjectActivitySurface({
  projectId,
}: {
  projectId: string;
}) {
  const [filters, setFilters] = useState<ProjectActivityFilters>(
    NO_PROJECT_ACTIVITY_FILTERS,
  );
  return (
    <ProjectActivityPages
      filters={filters}
      key={projectActivityFiltersKey(filters)}
      onApplyFilters={setFilters}
      projectId={projectId}
    />
  );
}
