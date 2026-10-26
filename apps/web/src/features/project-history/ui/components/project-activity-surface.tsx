// biome-ignore-all lint/performance/noJsxPropsBind: Handlers bind to the current filters and cursor.
import type { ProjectActivity } from "@cantiara/api/project-activity";
import { Button } from "@cantiara/ui/components/button";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { client, orpc } from "@/utils/orpc";
import {
  NO_PROJECT_ACTIVITY_FILTERS,
  type ProjectActivityFilters,
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
  const input = { ...filters, projectId };
  const first = useQuery(orpc.projectActivity.queryOptions({ input }));
  const [older, setOlder] = useState<{
    cursor: string | null;
    rows: ProjectActivity["rows"];
  } | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  if (first.isPending) {
    return <p role="status">Loading Project Activity…</p>;
  }
  if (!first.data) {
    return (
      <div className="space-y-3">
        <p role="alert">Project Activity is unavailable.</p>
        <Button onClick={() => first.refetch().catch(() => undefined)}>
          Retry
        </Button>
      </div>
    );
  }
  const cursor = older ? older.cursor : first.data.nextCursor;
  const activity: ProjectActivity = {
    ...first.data,
    rows: [...first.data.rows, ...(older?.rows ?? [])],
  };
  return (
    <ProjectActivityView
      activity={activity}
      filters={filters}
      hasMore={cursor !== null}
      loadingMore={loadingMore}
      onApplyFilters={onApplyFilters}
      onLoadMore={() => {
        if (cursor === null) {
          return;
        }
        setLoadingMore(true);
        client
          .projectActivity({ ...input, cursor })
          .then((page) =>
            setOlder({
              cursor: page.nextCursor,
              rows: [...(older?.rows ?? []), ...page.rows],
            }),
          )
          .catch(() => undefined)
          .finally(() => setLoadingMore(false));
      }}
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
      key={`${filters.sourceTypes.join()}|${filters.eventTypes.join()}`}
      onApplyFilters={setFilters}
      projectId={projectId}
    />
  );
}
