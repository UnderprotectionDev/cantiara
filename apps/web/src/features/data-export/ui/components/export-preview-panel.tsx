// biome-ignore-all lint/performance/noJsxPropsBind: Handlers bind to this surface's state.

import {
  EXPORT_LABEL,
  type ExportArtifact,
  type ExportFormat,
  type ExportPreview,
} from "@cantiara/api/data-export";
import { Button } from "@cantiara/ui/components/button";
import { type ReactNode, useEffect, useMemo, useRef } from "react";

function Section({ children, title }: { children: ReactNode; title: string }) {
  return (
    <section className="space-y-1">
      <h4 className="font-medium text-sm">{title}</h4>
      {children}
    </section>
  );
}

function Download({ artifact }: { artifact: ExportArtifact }) {
  const url = useMemo(() => {
    const content =
      artifact.encoding === "base64"
        ? Uint8Array.from(atob(artifact.bytes), (char) => char.charCodeAt(0))
        : artifact.bytes;
    return URL.createObjectURL(
      new Blob([content], { type: artifact.mediaType }),
    );
  }, [artifact]);
  useEffect(() => () => URL.revokeObjectURL(url), [url]);
  return (
    <a
      className="font-medium text-sm underline"
      download={artifact.fileName}
      href={url}
    >
      Download {artifact.fileName}
    </a>
  );
}

/**
 * The closed-world review shown before anything is produced: what leaves, what
 * is left out, what the format loses, what is never included, and the limits.
 * Focus lands on the heading; Escape cancels.
 */
export function ExportPreviewPanel({
  disabled,
  onCancel,
  onConfirm,
  onUseAlternative,
  preview,
  produced,
}: {
  disabled: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  onUseAlternative?: (format: ExportFormat) => void;
  preview: ExportPreview;
  produced: ExportArtifact | null;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.focus();
  }, []);
  return (
    // biome-ignore lint/a11y/noNoninteractiveElementInteractions: Escape cancels the review for keyboard users.
    <section
      aria-labelledby="export-preview-title"
      className="space-y-4 rounded-lg border border-border/70 p-4"
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          onCancel();
        }
      }}
    >
      <h3
        className="font-medium"
        id="export-preview-title"
        ref={heading}
        tabIndex={-1}
      >
        {EXPORT_LABEL} {preview.recordType} as {preview.format}
      </h3>
      <Section title="Scope">
        <p className="text-sm">
          {preview.recordCount} {preview.recordType} records of{" "}
          {preview.scope.kind === "project"
            ? "one Project"
            : `${preview.scope.projectIds.length} Projects`}
          , about {Math.max(1, Math.ceil(preview.estimatedBytes / 1024))} KB.
          Limit: {preview.limits.maxRows.toLocaleString("en-US")} rows or 25 MB,
          whichever comes first.
        </p>
      </Section>
      <Section title="Fields">
        <ul aria-label="Fields exported" className="text-sm">
          {preview.fields.map((field) => (
            <li key={field.key}>{field.label}</li>
          ))}
        </ul>
      </Section>
      {preview.hiddenFields.length > 0 ? (
        <Section title="Left out">
          <ul aria-label="Fields left out" className="text-sm">
            {preview.hiddenFields.map((field) => (
              <li key={field.key}>{field.label}</li>
            ))}
          </ul>
        </Section>
      ) : null}
      <Section title="Relations">
        <p className="text-sm">
          {preview.relations.length} relations between selected records are
          included.
          {preview.relationsOmitted > 0
            ? ` ${preview.relationsOmitted} relations to records outside this selection are left out.`
            : ""}
        </p>
      </Section>
      {preview.lost.length > 0 ? (
        <Section title="Lost in this format">
          <ul aria-label="Lost in this format" className="text-sm">
            {preview.lost.map((loss) => (
              <li key={loss.kind}>{loss.detail}</li>
            ))}
          </ul>
        </Section>
      ) : null}
      {preview.view ? (
        <Section title="View">
          <p className="text-sm">
            {preview.view.kind} "{preview.view.name}"
            {preview.view.sort
              ? `, sorted by ${preview.view.sort.field} (${preview.view.sort.direction === "asc" ? "ascending" : "descending"})`
              : ""}
            . This is a one-time snapshot: it creates no saved view, report or
            subscription.
          </p>
        </Section>
      ) : null}
      {preview.escapes ? (
        <Section title="Spreadsheet safety">
          <p className="text-sm">
            {preview.escapes.count === 0
              ? "No cell looks like a formula."
              : `${preview.escapes.count} cells that start with =, +, -, @, a tab or a carriage return get a leading ' so a spreadsheet reads them as data.`}{" "}
            JSON keeps these values as they are.
          </p>
        </Section>
      ) : null}
      {preview.pdfNotice ? (
        <Section title="PDF accessibility">
          <p className="text-sm" role="note">
            {preview.pdfNotice.limitation}
          </p>
          {onUseAlternative ? (
            <Button
              disabled={disabled}
              onClick={() => {
                onUseAlternative(preview.pdfNotice?.alternative ?? "CSV");
              }}
              size="sm"
              type="button"
              variant="outline"
            >
              Use {preview.pdfNotice.alternative} instead
            </Button>
          ) : null}
        </Section>
      ) : null}
      <Section title="Secret">
        <p className="text-sm">
          Secrets, share tokens and link passwords are never included.
          {preview.secretsExcluded.length > 0
            ? ` Removed from this selection: ${preview.secretsExcluded.join(", ")}.`
            : ""}
        </p>
      </Section>
      <p className="text-muted-foreground text-sm">{preview.nature}</p>
      <p className="text-muted-foreground text-sm">{preview.residency}</p>
      {preview.formatAvailable ? null : (
        <p className="text-sm" role="status">
          {preview.format} files are not available yet, so this preview cannot
          be confirmed.
        </p>
      )}
      <div className="flex flex-wrap items-center gap-2">
        {produced ? (
          <Download artifact={produced} />
        ) : (
          <Button
            disabled={disabled || !preview.formatAvailable}
            onClick={onConfirm}
            type="button"
          >
            {EXPORT_LABEL}
          </Button>
        )}
        <Button
          disabled={disabled}
          onClick={onCancel}
          type="button"
          variant="outline"
        >
          Cancel
        </Button>
      </div>
    </section>
  );
}
