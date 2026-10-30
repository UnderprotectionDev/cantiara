// biome-ignore-all lint/performance/noJsxPropsBind: The reopen handler is the only action of this section.
import {
  IMPORT_RECEIPT_LABEL,
  type ImportReceipt,
} from "@cantiara/api/data-import";
import { Button } from "@cantiara/ui/components/button";
import { useState } from "react";
import { importErrorText, lastApplyKey } from "../../lib/import-form";
import { ImportReceiptPanel } from "./import-receipt";

/**
 * Reopens the durable receipt of the last Apply Import after a dropped
 * connection: the result is the same receipt, read back by its key.
 */
export function ImportReceiptReopen({
  onReopen,
}: {
  onReopen: (idempotencyKey: string) => Promise<ImportReceipt>;
}) {
  const [key] = useState(() => lastApplyKey() ?? undefined);
  const [state, setState] = useState<
    | { kind: "idle" }
    | { kind: "reopening" }
    | { kind: "done"; receipt: ImportReceipt }
    | { error: string; kind: "failed" }
  >({ kind: "idle" });

  if (key === undefined) {
    return null;
  }

  const reopen = async () => {
    setState({ kind: "reopening" });
    try {
      const receipt = await onReopen(key);
      setState({ kind: "done", receipt });
    } catch (caught) {
      setState({
        error: importErrorText(caught),
        kind: "failed",
      });
    }
  };

  return (
    <section
      aria-label={`${IMPORT_RECEIPT_LABEL} reopen`}
      className="space-y-3 rounded-lg border border-border/70 p-5"
    >
      {state.kind === "failed" ? (
        <p className="text-destructive text-sm" role="alert">
          {state.error}
        </p>
      ) : null}
      {state.kind === "done" ? (
        <ImportReceiptPanel receipt={state.receipt} reopened />
      ) : (
        <Button
          disabled={state.kind === "reopening"}
          onClick={reopen}
          type="button"
        >
          {state.kind === "reopening"
            ? "Reading the receipt…"
            : "Reopen receipt"}
        </Button>
      )}
    </section>
  );
}
