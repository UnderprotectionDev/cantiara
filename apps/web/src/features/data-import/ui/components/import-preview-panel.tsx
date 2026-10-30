import {
  IMPORT_PREVIEW_NOTE,
  type ImportPreview,
  type ImportRowPreview,
} from "@cantiara/api/data-import";
import { useEffect, useRef } from "react";

function describeRow(row: ImportRowPreview) {
  if (row.action === "invalid") {
    return `Invalid: ${row.problems.join(" ")}`;
  }
  if (row.action === "update existing") {
    return `Matches an existing record. Choice: ${row.choice ?? "update existing"}`;
  }
  if (row.newIdentity) {
    return `Create with a new identity (the earlier origin ${row.newIdentity.previousOrigin} was ${row.newIdentity.reason})`;
  }
  return "Create";
}

function RowTable({
  caption,
  rows,
}: {
  caption: string;
  rows: readonly ImportRowPreview[];
}) {
  return (
    <table className="w-full text-left text-sm">
      <caption className="pb-2 text-left font-medium">{caption}</caption>
      <thead>
        <tr>
          <th className="pr-3 pb-1 font-medium" scope="col">
            Row
          </th>
          <th className="pr-3 pb-1 font-medium" scope="col">
            Result
          </th>
          <th className="pb-1 font-medium" scope="col">
            Values
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr className="align-top" key={row.rowNumber}>
            <th className="pr-3 font-normal" scope="row">
              {row.rowNumber}
            </th>
            <td className="pr-3">{describeRow(row)}</td>
            <td className="break-words text-muted-foreground">
              {Object.entries(row.values)
                .map(([field, value]) => `${field}: ${value}`)
                .join("; ")}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/**
 * The write-free preview: target scope, how columns map, what is lost, which
 * rows are new, matched or invalid. Focus moves to its heading when it
 * appears so keyboard and screen reader users land on the result.
 */
export function ImportPreviewPanel({ preview }: { preview: ImportPreview }) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.focus();
  }, []);
  const { counts } = preview;

  return (
    <section
      aria-labelledby="import-preview-title"
      className="space-y-5 rounded-lg border border-border/70 p-5"
    >
      <header className="space-y-1">
        <h3
          className="font-medium text-lg"
          id="import-preview-title"
          ref={heading}
          tabIndex={-1}
        >
          Preview: {preview.fileName}
        </h3>
        <p className="text-muted-foreground text-sm">
          {preview.format} into {preview.scope.label}
          {preview.catalogType ? ` as ${preview.catalogType}` : " as Document"}.
        </p>
        <p aria-live="polite" className="text-sm" role="status">
          {IMPORT_PREVIEW_NOTE}
        </p>
      </header>

      <dl className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-5">
        {[
          ["Rows", counts.total],
          ["Create", counts.create],
          ["Update existing", counts.updateExisting],
          ["Skip", counts.skip],
          ["Invalid", counts.invalid],
        ].map(([label, value]) => (
          <div key={label}>
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="font-medium">{value}</dd>
          </div>
        ))}
      </dl>

      <section aria-label="Mapping" className="space-y-2">
        <table className="w-full text-left text-sm">
          <caption className="pb-2 text-left font-medium">
            Column mapping
          </caption>
          <thead>
            <tr>
              <th className="pr-3 pb-1 font-medium" scope="col">
                Source column
              </th>
              <th className="pb-1 font-medium" scope="col">
                Goes to
              </th>
            </tr>
          </thead>
          <tbody>
            {preview.mapping.map((entry) => (
              <tr key={entry.source}>
                <th className="pr-3 font-normal" scope="row">
                  {entry.source}
                </th>
                <td>
                  {entry.origin
                    ? "Origin key"
                    : (entry.target ?? "Not imported")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section aria-label="Origin" className="space-y-1 text-sm">
        <h4 className="font-medium">Origin</h4>
        <p>{preview.origin.note}</p>
      </section>

      {preview.losses.length > 0 ? (
        <section aria-label="Losses" className="space-y-1 text-sm">
          <h4 className="font-medium">Losses</h4>
          <ul className="list-disc pl-5">
            {preview.losses.map((loss) => (
              <li key={`${loss.kind}:${loss.detail}`}>{loss.detail}</li>
            ))}
          </ul>
        </section>
      ) : null}

      {preview.invalidRows.length > 0 ? (
        <section aria-label="Invalid rows" className="space-y-1">
          <RowTable
            caption={`Invalid rows (${preview.invalidTotal}). Correct them in the file or leave them out before you apply.`}
            rows={preview.invalidRows}
          />
        </section>
      ) : null}

      <section aria-label="Rows" className="space-y-1">
        <RowTable
          caption={
            preview.rowsTruncated
              ? `First ${preview.rows.length} of ${counts.total} rows`
              : "Rows"
          }
          rows={preview.rows}
        />
      </section>
    </section>
  );
}
