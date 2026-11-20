import type {
  ExportArtifact,
  ExportPreview,
  ExportRequest,
} from "@cantiara/api/data-export";
import { useMutation } from "@tanstack/react-query";
import { buildSupportReferenceFailure } from "@/features/web-macos-client/lib/support-reference";
import { orpc } from "@/utils/orpc";
import { exportRefusalMessage } from "../lib/export-refusal";

/**
 * The Export review state. The preview comes first and nothing is produced
 * until the founder confirms that exact preview; a refusal stays visible.
 */
export function useExportFlow({
  onPreview,
  onProduce,
}: {
  onPreview: (request: ExportRequest) => Promise<ExportPreview>;
  onProduce: (
    request: ExportRequest,
    preview: ExportPreview,
  ) => Promise<ExportArtifact>;
}) {
  const inspect = useMutation({
    mutationKey: orpc.exportPreview.mutationKey(),
    gcTime: 0,
    meta: { presentsSupportFailure: true },
    mutationFn: onPreview,
  });
  const produce = useMutation({
    mutationKey: orpc.exportProduce.mutationKey(),
    gcTime: 0,
    meta: { presentsSupportFailure: true },
    mutationFn: ({
      request,
      preview,
    }: {
      request: ExportRequest;
      preview: ExportPreview;
    }) => onProduce(request, preview),
  });
  const reviewing = inspect.isSuccess
    ? { preview: inspect.data, request: inspect.variables }
    : null;
  const error = produce.error ?? inspect.error;

  return {
    cancel: () => {
      inspect.reset();
      produce.reset();
    },
    confirm: () => {
      if (reviewing && !produce.isPending) {
        produce.mutate(reviewing);
      }
    },
    failure: error
      ? buildSupportReferenceFailure(error, { kind: "query" })
      : null,
    pending: inspect.isPending || produce.isPending,
    produced: produce.data ?? null,
    refusal: error ? exportRefusalMessage(error) : null,
    review: (request: ExportRequest) => {
      produce.reset();
      inspect.mutate(request);
    },
    reviewing,
  };
}
