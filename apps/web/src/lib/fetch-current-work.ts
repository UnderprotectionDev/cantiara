import type { QueryClient } from "@tanstack/react-query";
import { orpc } from "@/utils/orpc";

// Undo and close commands carry the Work's current `baseRevision`; the read
// must be fresh (never served from cache), so it forces a refetch through
// TanStack Query on the shared `work` key.
export function fetchCurrentWork(queryClient: QueryClient, workId: string) {
  return queryClient.query({
    ...orpc.work.queryOptions({ input: { workId } }),
    staleTime: 0,
  });
}
