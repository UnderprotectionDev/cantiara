import type {
  ExportArtifact,
  ExportPreview,
  ExportRequest,
} from "@cantiara/api/data-export";
import { useState } from "react";
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
  const [pending, setPending] = useState(false);
  const [refusal, setRefusal] = useState<string | null>(null);
  const [reviewing, setReviewing] = useState<{
    preview: ExportPreview;
    request: ExportRequest;
  } | null>(null);
  const [produced, setProduced] = useState<ExportArtifact | null>(null);

  async function review(request: ExportRequest) {
    setPending(true);
    setRefusal(null);
    setProduced(null);
    setReviewing(null);
    try {
      setReviewing({ preview: await onPreview(request), request });
    } catch (error) {
      setRefusal(exportRefusalMessage(error));
    } finally {
      setPending(false);
    }
  }

  async function confirm() {
    if (!reviewing) {
      return;
    }
    setPending(true);
    setRefusal(null);
    try {
      setProduced(await onProduce(reviewing.request, reviewing.preview));
    } catch (error) {
      setRefusal(exportRefusalMessage(error));
    } finally {
      setPending(false);
    }
  }

  return {
    cancel: () => {
      setReviewing(null);
      setProduced(null);
      setRefusal(null);
    },
    confirm,
    pending,
    produced,
    refusal,
    review,
    reviewing,
  };
}
