import {
  IMPORT_LABEL,
  type ImportReceipt,
  type ImportScope,
} from "@cantiara/api/data-import";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { orpc } from "@/utils/orpc";
import { useApplyImport } from "../../hooks/use-apply-import";
import { usePreviewImport } from "../../hooks/use-preview-import";
import { useReopenImportReceipt } from "../../hooks/use-reopen-import-receipt";
import { invalidateImportQueries } from "../../lib/invalidate-import-queries";
import { ImportView } from "../views/import-view";

/** Loads the Projects an import can target and renders the Import view. */
export default function ImportSurface() {
  const queryClient = useQueryClient();
  const refresh = useCallback(
    (receipt: ImportReceipt, scope: ImportScope) =>
      invalidateImportQueries(queryClient, receipt, scope),
    [queryClient],
  );
  const projects = useQuery(orpc.projects.queryOptions());
  const preview = usePreviewImport();
  const applyState = useApplyImport();
  const reopenReceipt = useReopenImportReceipt();

  if (projects.status === "pending") {
    return <p role="status">Loading {IMPORT_LABEL}…</p>;
  }
  return (
    <ImportView
      onApply={applyState.apply}
      onCancel={applyState.cancel}
      onCommitted={refresh}
      onPreview={preview}
      onReopenReceipt={reopenReceipt}
      projects={(projects.data ?? []).map(({ id, name }) => ({ id, name }))}
    />
  );
}
