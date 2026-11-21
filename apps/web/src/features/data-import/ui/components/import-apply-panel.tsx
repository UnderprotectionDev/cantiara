// biome-ignore-all lint/performance/noJsxPropsBind: The handlers close over this panel's own apply state.
import {
  type ApplyImportInput,
  IMPORT_APPLY_LABEL,
  IMPORT_FINALIZING_LABEL,
  type ImportApplyResult,
  type ImportPreview,
  type ImportReceipt,
  type ImportScope,
} from "@cantiara/api/data-import";
import { Button } from "@cantiara/ui/components/button";
import { useMutation } from "@tanstack/react-query";
import { useRef } from "react";
import { buildSupportReferenceFailure } from "@/features/web-macos-client/lib/support-reference";
import { SupportReferenceNotice } from "@/features/web-macos-client/ui/components/support-reference";
import { orpc } from "@/utils/orpc";
import {
  applyBlockedReason,
  newApplyKey,
  rememberLastApplyKey,
} from "../../lib/import-form";
import { ImportReceiptPanel } from "./import-receipt";

/**
 * The separate `Apply Import` confirmation after the exact diff. Once it is
 * pressed the commit barrier may pass, so `Cancel` goes away and the status
 * reads `Finalizing` until the full commit or the full rollback receipt. A
 * retry reuses the same key, so it can only return the same result.
 */
export function ImportApplyPanel({
  busy,
  onApply,
  onAttempt,
  onCancel,
  onCommitted,
  preview,
  scope,
}: {
  busy: boolean;
  onApply: (input: ApplyImportInput) => Promise<ImportApplyResult>;
  onAttempt: (key: string) => void;
  onCancel: () => void;
  onCommitted?: (receipt: ImportReceipt, scope: ImportScope) => Promise<void>;
  preview: ImportPreview;
  scope: ImportScope;
}) {
  const applyKey = useRef<string | null>(null);
  const blocked = applyBlockedReason(preview);
  const commit = useMutation(
    orpc.applyImport.mutationOptions({
      meta: { onlineWrite: true, presentsSupportFailure: true },
      mutationFn: (input) => onApply(input),
      onSuccess: async (completed) => {
        if (completed.status === "committed") {
          await onCommitted?.(completed.receipt, scope);
        }
      },
    }),
  );

  function apply() {
    const key = applyKey.current ?? newApplyKey();
    applyKey.current = key;
    // A dropped connection can still leave a receipt reopenable by this key.
    rememberLastApplyKey(key);
    onAttempt(key);
    commit.mutate({
      finalSetFingerprint: preview.finalSetFingerprint,
      idempotencyKey: key,
      stagingId: preview.stagingId,
    });
  }

  const result = commit.data;
  if (result && result.status !== "finalizing") {
    return <ImportReceiptPanel receipt={result.receipt} />;
  }
  const finalizing = result?.status === "finalizing";
  const past = commit.isPending || finalizing;
  const buttonLabel = commit.isError ? "Retry" : IMPORT_APPLY_LABEL;
  const failure = commit.isError
    ? buildSupportReferenceFailure(commit.error, { kind: "mutation" })
    : null;
  const updateRequired = failure?.reasonCode === "update-required";

  return (
    <section
      aria-label={IMPORT_APPLY_LABEL}
      className="space-y-3 rounded-lg border border-border/70 p-5"
    >
      {blocked ? <p className="text-sm">{blocked}</p> : null}
      {commit.isError ? (
        <p className="text-sm text-destructive" role="alert">
          {commit.error.message ||
            "The import could not be applied. Retry with the same key."}
        </p>
      ) : null}
      {failure ? (
        <SupportReferenceNotice
          failure={
            updateRequired
              ? failure
              : { ...failure, retryBound: "Retry with the same key." }
          }
        />
      ) : null}
      {past ? (
        <p aria-live="polite" className="text-sm" role="status">
          {IMPORT_FINALIZING_LABEL}
        </p>
      ) : null}
      <div className="flex gap-2">
        {finalizing ? (
          <Button
            disabled={busy}
            onClick={apply}
            type="button"
            variant="outline"
          >
            Check result
          </Button>
        ) : (
          <Button
            disabled={blocked !== null || past || updateRequired || busy}
            onClick={apply}
            type="button"
          >
            {buttonLabel}
          </Button>
        )}
        {past ? null : (
          <Button
            disabled={busy}
            onClick={onCancel}
            type="button"
            variant="outline"
          >
            Cancel
          </Button>
        )}
      </div>
    </section>
  );
}
