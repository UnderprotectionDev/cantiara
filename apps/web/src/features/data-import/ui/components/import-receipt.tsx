import {
  IMPORT_RECEIPT_LABEL,
  type ImportReceipt,
} from "@cantiara/api/data-import";
import { useEffect, useRef } from "react";

/**
 * The durable result of one Apply Import: a full commit or a full rollback.
 * Focus lands on its heading so keyboard and screen reader users hear it.
 */
export function ImportReceiptPanel({
  receipt,
  reopened = false,
}: {
  receipt: ImportReceipt;
  reopened?: boolean;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.focus();
  }, []);
  const rolledBack = receipt.status === "rolled-back";

  return (
    <section
      aria-labelledby="import-receipt-title"
      className="space-y-3 rounded-lg border border-border/70 p-5"
    >
      <h3
        className="font-medium text-lg"
        id="import-receipt-title"
        ref={heading}
        tabIndex={-1}
      >
        {IMPORT_RECEIPT_LABEL}
      </h3>
      <p className="text-sm" role="status">
        {rolledBack
          ? "Rolled back. Nothing was written."
          : `Committed. ${receipt.fileName} was written to ${receipt.scopeLabel} once.`}
        {reopened ? " This is the same receipt, reopened." : ""}
      </p>
      {rolledBack && receipt.reason ? (
        <p className="text-sm">{receipt.reason}</p>
      ) : null}
      {rolledBack && receipt.supportReference ? (
        <p className="text-muted-foreground text-sm">
          Support reference: {receipt.supportReference}
        </p>
      ) : null}
      <dl className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
        {[
          ["Created", receipt.counts.created],
          ["Updated", receipt.counts.updated],
          ["Skipped", receipt.counts.skipped],
          ["Dropped", receipt.counts.excluded],
        ].map(([label, value]) => (
          <div key={label}>
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="font-medium">{value}</dd>
          </div>
        ))}
      </dl>
      {receipt.provenance ? (
        <p className="text-muted-foreground text-sm">
          Origins kept under {receipt.provenance}.
        </p>
      ) : null}
    </section>
  );
}
