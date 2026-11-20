import {
  type ApplyImportInput,
  IMPORT_LABEL,
  type ImportApplyResult,
  type ImportPreview,
  type ImportReceipt,
  type ImportScope,
  type PreviewImportInput,
} from "@cantiara/api/data-import";
import { useMutation } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import { orpc } from "@/utils/orpc";
import { usePreviewImport } from "../../hooks/use-preview-import";
import { importErrorText, lastApplyKey } from "../../lib/import-form";
import { ImportApplyPanel } from "../components/import-apply-panel";
import { ImportPreviewPanel } from "../components/import-preview-panel";
import { ImportReceiptReopen } from "../components/import-receipt-reopen";
import ImportFileForm, {
  type ImportProjectChoice,
} from "../forms/import-file-form";

/**
 * Import: one file, one type, one place, previewed before any write. The
 * preview is write-free; `Apply Import` is the separate confirmation that
 * writes the exact set shown, atomically and once.
 */
export function ImportView({
  onApply,
  onCancel,
  onCommitted,
  onPreview,
  onReopenReceipt,
  projects,
}: {
  onApply: (input: ApplyImportInput) => Promise<ImportApplyResult>;
  onCancel: (stagingId: string) => Promise<unknown>;
  onCommitted?: (receipt: ImportReceipt, scope: ImportScope) => Promise<void>;
  onPreview: (
    input: PreviewImportInput,
    signal: AbortSignal,
  ) => Promise<ImportPreview>;
  onReopenReceipt?: (idempotencyKey: string) => Promise<ImportReceipt>;
  projects: readonly ImportProjectChoice[];
}) {
  const [receiptKey, setReceiptKey] = useState(lastApplyKey);
  const { choose, clear, excludedRows, preview, selection, toggleRow } =
    usePreviewImport(onPreview);
  const cancelPreview = useMutation({
    mutationKey: orpc.cancelImport.mutationKey(),
    meta: { onlineWrite: true },
    mutationFn: ({ stagingId }: { revision: number; stagingId: string }) =>
      onCancel(stagingId),
    onSuccess: (_, { revision }) => clear(revision),
  });
  const shown = preview.data;
  const isCancelling =
    cancelPreview.isPending &&
    cancelPreview.variables.revision === selection?.revision;
  const cancelError =
    cancelPreview.isError &&
    cancelPreview.variables?.revision === selection?.revision
      ? cancelPreview.error
      : null;
  const actionError = preview.error ?? cancelError;
  const cancel = useCallback(() => {
    if (shown && selection && !preview.isFetching && !isCancelling) {
      cancelPreview.mutate({
        revision: selection.revision,
        stagingId: shown.preview.stagingId,
      });
    }
  }, [cancelPreview, isCancelling, preview.isFetching, selection, shown]);

  return (
    <section aria-label={IMPORT_LABEL} className="space-y-6">
      <header className="space-y-1">
        <h2 className="text-2xl font-semibold tracking-tight">
          {IMPORT_LABEL}
        </h2>
        <p className="text-sm text-muted-foreground">
          A file becomes records in Cantiara. It stays a copy: there is no live
          link to the file.
        </p>
      </header>
      <ImportFileForm
        onPreview={choose}
        previewing={preview.isFetching && !shown}
        projects={projects}
      />
      {onReopenReceipt ? (
        <ImportReceiptReopen
          onReopen={onReopenReceipt}
          receiptKey={receiptKey}
        />
      ) : null}
      {actionError ? (
        <p className="text-sm text-destructive" role="alert">
          {importErrorText(actionError)}
        </p>
      ) : null}
      {shown ? (
        <>
          <ImportPreviewPanel
            excludedRows={excludedRows}
            onToggleRow={toggleRow}
            preview={shown.preview}
          />
          <ImportApplyPanel
            busy={preview.isPlaceholderData || isCancelling}
            key={`${shown.preview.stagingId}:${shown.preview.finalSetFingerprint}`}
            onApply={onApply}
            onAttempt={setReceiptKey}
            onCancel={cancel}
            onCommitted={onCommitted}
            preview={shown.preview}
            scope={shown.scope}
          />
        </>
      ) : null}
    </section>
  );
}
