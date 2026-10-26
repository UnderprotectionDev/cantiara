import type {
  ProjectActivity,
  ProjectActivityInput,
} from "@cantiara/api/project-activity";
import { projectActivityEntriesOfRows } from "@cantiara/api/project-activity-cluster";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { orpc } from "@/utils/orpc";
import type { ProjectActivityFilters } from "../lib/project-activity-filters";

/**
 * Cursor-paged Project Activity through TanStack Query. All loaded pages are
 * merged and re-grouped by each row's `group`, so a cluster is not split at a
 * page edge and a filter never merges rows across a hidden boundary.
 */
export function useProjectActivity({
  filters,
  projectId,
  sourceRecord,
}: {
  filters: ProjectActivityFilters;
  projectId: string;
  sourceRecord?: ProjectActivityInput["sourceRecord"];
}) {
  const base: ProjectActivityInput = {
    ...filters,
    projectId,
    ...(sourceRecord ? { sourceRecord } : {}),
  };
  const query = useInfiniteQuery(
    orpc.projectActivity.infiniteOptions({
      getNextPageParam: (page: ProjectActivity) => page.nextCursor ?? undefined,
      initialPageParam: undefined as string | undefined,
      input: (cursor: string | undefined) =>
        cursor ? { ...base, cursor } : base,
    }),
  );
  const activity = useMemo((): ProjectActivity | null => {
    const [first] = query.data?.pages ?? [];
    if (!(first && query.data)) {
      return null;
    }
    const rows = query.data.pages.flatMap((page) => page.rows);
    return {
      ...first,
      entries: projectActivityEntriesOfRows(rows),
      rows,
    };
  }, [query.data]);
  return { activity, query };
}
