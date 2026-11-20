import type { ExportPreview, ExportRequest } from "@cantiara/api/data-export";
import { useQueryClient } from "@tanstack/react-query";
import { fetchFresh } from "@/lib/fetch-fresh";
import { client, orpc } from "@/utils/orpc";

/** Reads the closed-world preview. The Workspace is not changed. */
export function useExportPreview() {
  const cache = useQueryClient();
  return function preview(request: ExportRequest) {
    return fetchFresh(cache, {
      ...orpc.exportPreview.queryOptions({ input: request }),
      gcTime: 0,
    });
  };
}

/** Asks for the artifact of a preview the founder confirmed. */
export function useExportProduce() {
  return function produce(request: ExportRequest, preview: ExportPreview) {
    return client.exportProduce({
      ...request,
      previewFingerprint: preview.fingerprint,
    });
  };
}
