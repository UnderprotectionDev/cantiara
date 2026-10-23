// biome-ignore-all lint/performance/noJsxPropsBind: The output binds its own copy and download handlers.
import type { SchemaSqlExport } from "@cantiara/api/schema-artifacts";
import { Button } from "@cantiara/ui/components/button";
import { useState } from "react";
import { writeTextToClipboard } from "@/lib/clipboard";

import { downloadSqlText } from "../../lib/sql-download";

/**
 * Reviewable SQL with copy and `.sql` export. The product never runs it;
 * export carries the manifest as a second file.
 */
export function SqlOutput({
  exported,
  label,
  sql,
}: {
  exported: SchemaSqlExport | null;
  label: string;
  sql: string;
}) {
  const [message, setMessage] = useState("");
  async function copy() {
    try {
      await writeTextToClipboard(sql);
      setMessage(`${label} copied.`);
    } catch {
      setMessage(`${label} could not be copied. Select the text instead.`);
    }
  }
  return (
    <div className="space-y-2">
      <section aria-label={label}>
        <pre
          className="max-h-96 overflow-auto rounded-md border bg-muted/40 p-3 text-xs"
          // biome-ignore lint/a11y/noNoninteractiveTabindex: Keyboard users scroll the SQL.
          tabIndex={0}
        >
          {sql}
        </pre>
      </section>
      <div className="flex flex-wrap gap-2">
        <Button onClick={copy} size="sm" type="button" variant="outline">
          {`Copy ${label}`}
        </Button>
        {exported ? (
          <>
            <Button
              onClick={() =>
                downloadSqlText(
                  exported.sql,
                  "application/sql",
                  exported.filename,
                )
              }
              size="sm"
              type="button"
              variant="outline"
            >
              {`Export ${exported.filename}`}
            </Button>
            <Button
              onClick={() =>
                downloadSqlText(
                  JSON.stringify(exported.manifest, null, 2),
                  "application/json",
                  exported.manifestFilename,
                )
              }
              size="sm"
              type="button"
              variant="outline"
            >
              {`Export ${exported.manifestFilename}`}
            </Button>
          </>
        ) : (
          <p className="text-muted-foreground text-sm">
            Export opens after Statically Validated.
          </p>
        )}
      </div>
      <p aria-live="polite" className="text-muted-foreground text-sm">
        {message}
      </p>
    </div>
  );
}
