// biome-ignore-all lint/performance/noJsxPropsBind: The handlers close over this panel's own apply state.
import {
  type ApplyImportInput,
  IMPORT_APPLY_LABEL,
  IMPORT_FINALIZING_LABEL,
  type ImportApplyResult,
  type ImportPreview,
  type ImportReceipt,
} from "@cantiara/api/data-import";
import { Button } from "@cantiara/ui/components/button";
import { useState } from "react";
import {
  applyBlockedReason,
  newApplyKey,
  rememberLastApplyKey,
} from "../../lib/import-form";
import { ImportReceiptPanel } from "./import-receipt";

type ApplyState =
  | { kind: "idle" }
  | { kind: "applying" }
  | { kind: "finalizing" }
  | { error: string; kind: "failed" }
  | { kind: "done"; receipt: ImportReceipt };

/**
 * The separate `Apply Import` confirmation after the exact diff. Once it is
 * pressed the commit barrier may pass, so `Cancel` goes away and the status
 * reads `Finalizing` until the full commit or the full rollback receipt. A
 * retry reuses the same key, so it can only return the same result.
 */
export function ImportApplyPanel({
  onApply,
  onCancel,
  preview,
}: {
  onApply: (input: ApplyImportInput) => Promise<ImportApplyResult>;
  onCancel: () => void;
  preview: ImportPreview;
}) {
  const [state, setState] = useState<ApplyState>({ kind: "idle" });
  const [key] = useState(newApplyKey);
  const blocked = applyBlockedReason(preview);

  async function apply() {
    setState({ kind: "applying" });
    // A receipt a dropped connection never showed stays reopenable by this key.
    rememberLastApplyKey(key);
    try {
      const result = await onApply({
        finalSetFingerprint: preview.finalSetFingerprint,
        idempotencyKey: key,
        stagingId: preview.stagingId,
      });
      setState(
        result.status === "finalizing"
          ? { kind: "finalizing" }
          : { kind: "done", receipt: result.receipt },
      );
    } catch (caught) {
      setState({
        error:
          caught instanceof Error && caught.message
            ? caught.message
            : "The import could not be applied. Retry with the same key.",
        kind: "failed",
      });
    }
  }

  if (state.kind === "done") {
    return <ImportReceiptPanel receipt={state.receipt} />;
  }
  const past = state.kind === "applying" || state.kind === "finalizing";
  const buttonLabel = state.kind === "failed" ? "Retry" : IMPORT_APPLY_LABEL;

  return (
    <section
      aria-label={IMPORT_APPLY_LABEL}
      className="space-y-3 rounded-lg border border-border/70 p-5"
    >
      {blocked ? <p className="text-sm">{blocked}</p> : null}
      {state.kind === "failed" ? (
        <p className="text-destructive text-sm" role="alert">
          {state.error}
        </p>
      ) : null}
      {past ? (
        <p aria-live="polite" className="text-sm" role="status">
          {IMPORT_FINALIZING_LABEL}
        </p>
      ) : null}
      <div className="flex gap-2">
        {state.kind === "finalizing" ? (
          <Button onClick={apply} type="button" variant="outline">
            Check result
          </Button>
        ) : (
          <Button
            disabled={blocked !== null || past}
            onClick={apply}
            type="button"
          >
            {buttonLabel}
          </Button>
        )}
        {past ? null : (
          <Button onClick={onCancel} type="button" variant="outline">
            Cancel
          </Button>
        )}
      </div>
    </section>
  );
}
