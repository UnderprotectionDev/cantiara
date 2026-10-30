import { IMPORT_LABEL } from "@cantiara/api/data-import";
import { useQuery } from "@tanstack/react-query";
import { orpc } from "@/utils/orpc";
import { useApplyImport } from "../../hooks/use-apply-import";
import { usePreviewImport } from "../../hooks/use-preview-import";
import { useReopenImportReceipt } from "../../hooks/use-reopen-import-receipt";
import { ImportView } from "../views/import-view";

/** Loads the Projects an import can target and renders the Import view. */
export default function ImportSurface() {
  const projects = useQuery(orpc.projects.queryOptions());
  const preview = usePreviewImport();
  const applyState = useApplyImport();
  const reopenReceipt = useReopenImportReceipt();

  if (projects.isPending) {
    return <p role="status">Loading {IMPORT_LABEL}…</p>;
  }
  return (
    <ImportView
      onApply={applyState.apply}
      onCancel={applyState.cancel}
      onPreview={preview}
      onReopenReceipt={reopenReceipt}
      projects={(projects.data ?? []).map(({ id, name }) => ({ id, name }))}
    />
  );
}
