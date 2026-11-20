// biome-ignore-all lint/performance/noJsxPropsBind: The reopen handler is the only action of this section.
import {
  IMPORT_RECEIPT_LABEL,
  type ImportReceipt,
} from "@cantiara/api/data-import";
import { Button } from "@cantiara/ui/components/button";
import { useReopenImportReceipt } from "../../hooks/use-reopen-import-receipt";
import { importErrorText } from "../../lib/import-form";
import { ImportReceiptPanel } from "./import-receipt";

/**
 * Reopens the durable receipt of the last Apply Import after a dropped
 * connection: the result is the same receipt, read back by its key.
 */
export function ImportReceiptReopen({
  onReopen,
  receiptKey,
}: {
  onReopen: (idempotencyKey: string) => Promise<ImportReceipt>;
  receiptKey: string | null;
}) {
  const receipt = useReopenImportReceipt(receiptKey, onReopen);

  if (receiptKey === null) {
    return null;
  }

  return (
    <section
      aria-label={`${IMPORT_RECEIPT_LABEL} reopen`}
      className="space-y-3 rounded-lg border border-border/70 p-5"
    >
      {receipt.isError ? (
        <p className="text-sm text-destructive" role="alert">
          {importErrorText(receipt.error)}
        </p>
      ) : null}
      {receipt.data ? (
        <ImportReceiptPanel receipt={receipt.data} reopened />
      ) : (
        <Button
          disabled={receipt.isFetching}
          onClick={() => receipt.refetch().catch(() => undefined)}
          type="button"
        >
          {receipt.isFetching ? "Reading the receipt…" : "Reopen receipt"}
        </Button>
      )}
    </section>
  );
}
