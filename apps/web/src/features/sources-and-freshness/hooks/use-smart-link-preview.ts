import type { SmartLinkPreviewAccess } from "@cantiara/api/smart-link-preview";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { fetchFresh } from "@/lib/fetch-fresh";
import { orpc } from "@/utils/orpc";

/**
 * Reads a live link preview through TanStack Query. A preview carries its own
 * access time and is never historical evidence, so each request is fresh and
 * nothing is kept in the cache afterwards.
 */
export function useSmartLinkPreview(): SmartLinkPreviewAccess {
  const queryClient = useQueryClient();
  return useCallback(
    (url) =>
      fetchFresh(queryClient, {
        ...orpc.smartLinkPreview.queryOptions({ input: { url } }),
        gcTime: 0,
      }),
    [queryClient],
  );
}
