import {
  IMPORT_LABEL,
  type ImportReceipt,
  type ImportScope,
  type PreviewImportInput,
} from "@cantiara/api/data-import";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { client, orpc } from "@/utils/orpc";
import { useApplyImport } from "../../hooks/use-apply-import";
import { invalidateImportQueries } from "../../lib/invalidate-import-queries";
import { ImportView } from "../views/import-view";

function previewFile(input: PreviewImportInput, signal: AbortSignal) {
  return client.previewImport(input, { signal });
}

function reopenReceipt(idempotencyKey: string) {
  return client.reopenImportReceipt({ idempotencyKey });
}

/** Loads the Projects an import can target and renders the Import view. */
export default function ImportSurface() {
  const queryClient = useQueryClient();
  const refresh = useCallback(
    (receipt: ImportReceipt, scope: ImportScope) =>
      invalidateImportQueries(queryClient, receipt, scope),
    [queryClient],
  );
  const projects = useQuery(orpc.projects.queryOptions());
  const applyState = useApplyImport();

  if (projects.status === "pending") {
    return <p role="status">Loading {IMPORT_LABEL}…</p>;
  }
  return (
    <ImportView
      onApply={applyState.apply}
      onCancel={applyState.cancel}
      onCommitted={refresh}
      onPreview={previewFile}
      onReopenReceipt={reopenReceipt}
      projects={(projects.data ?? []).map(({ id, name }) => ({ id, name }))}
    />
  );
}
