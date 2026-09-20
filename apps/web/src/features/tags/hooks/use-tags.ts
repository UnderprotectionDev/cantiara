import { useQuery } from "@tanstack/react-query";

import { orpc } from "@/utils/orpc";

export function useTags(projectId: string, tagId?: string) {
  const tagsQuery = useQuery(orpc.tags.queryOptions({ input: { projectId } }));
  const recordsQuery = useQuery(
    orpc.tagRecords.queryOptions({
      input: tagId ? { projectId, tagId } : { projectId },
    }),
  );

  return { recordsQuery, tagsQuery };
}
