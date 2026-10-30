import type { ExportPreview, ExportRequest } from "@cantiara/api/data-export";
import { client } from "@/utils/orpc";

/** Reads the closed-world preview. The Workspace is not changed. */
export function useExportPreview() {
  return function preview(request: ExportRequest) {
    return client.exportPreview(request);
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
