// biome-ignore-all lint/performance/noJsxPropsBind: Controls bind to the selected Test Handoff and its previewed package.
import {
  TEST_HANDOFF_LABEL,
  TEST_HANDOFF_PACKAGE_STATES,
  type TestHandoffPackagePreview,
  type TestHandoffPackageRecord,
  type TestHandoffRecord,
} from "@cantiara/api/planned-tests";
import { Button } from "@cantiara/ui/components/button";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { writeTextToClipboard } from "@/lib/clipboard";
import { errorText } from "../../lib/error-text";
import { downloadPackageText } from "../../lib/test-handoff-form";

export type PreviewTestHandoffPackage = (
  handoff: TestHandoffRecord,
) => Promise<TestHandoffPackagePreview>;
export type ProduceTestHandoffPackage = (
  handoff: TestHandoffRecord,
  preview: TestHandoffPackagePreview,
) => Promise<TestHandoffPackageRecord>;
export type LoadTestHandoffPackages = (
  handoff: TestHandoffRecord,
) => Promise<TestHandoffPackageRecord[]>;

const SECTION_LABELS: Record<string, string> = {
  ad_hoc_scope: "Ad hoc scope",
  design_references: "Design references",
  document_context: "Document context",
  scenarios: "Planned Test Case versions",
  work_context: "Work context",
};

function PackageCopies({
  handoff,
  record,
}: {
  handoff: TestHandoffRecord;
  record: TestHandoffPackageRecord;
}) {
  const [message, setMessage] = useState("");
  const base = `test-handoff-${handoff.id}-package-${record.packageVersion}`;
  async function copy(text: string, label: string) {
    try {
      await writeTextToClipboard(text);
      setMessage(`${label} copied.`);
    } catch {
      setMessage(`${label} could not be copied. Download it instead.`);
    }
  }
  const renderings = [
    {
      extension: "md",
      label: "Markdown package",
      text: record.markdown,
      type: "text/markdown",
    },
    {
      extension: "json",
      label: "JSON package",
      text: record.json,
      type: "application/json",
    },
  ] as const;
  return (
    <li className="space-y-2 rounded-md border border-border/70 p-3 text-sm">
      <p className="font-medium">
        {`Package version ${record.packageVersion}`}
        <span className="font-normal text-muted-foreground">
          {`, produced ${record.createdAt}, ${record.schemaVersion}`}
        </span>
      </p>
      <div className="flex flex-wrap gap-2">
        {renderings.map(({ extension, label, text, type }) => (
          <span className="flex flex-wrap gap-2" key={label}>
            <Button
              aria-label={`Copy ${label} version ${record.packageVersion}`}
              onClick={() => copy(text, label)}
              size="sm"
              type="button"
              variant="outline"
            >
              {`Copy ${label}`}
            </Button>
            <Button
              aria-label={`Download ${label} version ${record.packageVersion}`}
              onClick={() =>
                downloadPackageText(text, type, `${base}.${extension}`)
              }
              size="sm"
              type="button"
              variant="outline"
            >
              {`Download ${label}`}
            </Button>
          </span>
        ))}
      </div>
      <p aria-live="polite" className="text-muted-foreground text-xs">
        {message}
      </p>
    </li>
  );
}

/**
 * Package of one Test Handoff: closed-world preview, explicit confirm and the
 * produced Markdown and JSON copies. Producing writes a document only; it
 * starts no tool, grants no access and does not move the Handoff's state. A
 * blocked preview shows no rendering at all.
 */
export function TestHandoffPackagePanel({
  handoff,
  onPreview,
  onProduce,
  loadPackages,
  readOnly,
}: {
  handoff: TestHandoffRecord;
  loadPackages: LoadTestHandoffPackages;
  onPreview: PreviewTestHandoffPackage;
  onProduce: ProduceTestHandoffPackage;
  readOnly: boolean;
}) {
  const queryClient = useQueryClient();
  const [preview, setPreview] = useState<TestHandoffPackagePreview>();
  const [error, setError] = useState<string>();
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const shareable = TEST_HANDOFF_PACKAGE_STATES.includes(handoff.state);

  const packagesKey = [
    "test-handoff-packages",
    handoff.id,
    handoff.packageVersion,
  ] as const;
  const packagesQuery = useQuery({
    enabled: handoff.packageVersion !== 0,
    queryFn: () => loadPackages(handoff),
    queryKey: packagesKey,
  });
  const packages = packagesQuery.data ?? [];
  const shownError =
    error ||
    (packagesQuery.isError
      ? "Produced packages could not be loaded."
      : undefined);

  async function showPreview() {
    setError(undefined);
    setMessage("");
    setPending(true);
    try {
      setPreview(await onPreview(handoff));
    } catch (caught) {
      setPreview(undefined);
      setError(errorText(caught, "The package could not be previewed."));
    } finally {
      setPending(false);
    }
  }

  async function confirm() {
    if (!preview) {
      return;
    }
    setError(undefined);
    setPending(true);
    try {
      const produced = await onProduce(handoff, preview);
      setPreview(undefined);
      queryClient.setQueryData<TestHandoffPackageRecord[]>(
        packagesKey,
        (current) => [produced, ...(current ?? [])],
      );
      setMessage(`Package version ${produced.packageVersion} produced.`);
    } catch (caught) {
      setPreview(undefined);
      setError(errorText(caught, "The package was not produced."));
    } finally {
      setPending(false);
    }
  }

  return (
    <section
      aria-label={`Package of ${handoff.title}`}
      className="space-y-3 border-border/70 border-t pt-3"
    >
      <h5 className="font-medium text-sm">Package</h5>
      {shownError ? (
        <p className="text-destructive text-sm" role="alert">
          {shownError}
        </p>
      ) : null}
      {shareable ? null : (
        <p className="text-muted-foreground text-xs">
          {`A ${TEST_HANDOFF_LABEL} produces a package only while it is Ready to share or Shared. Mark it Ready to share first.`}
        </p>
      )}
      {shareable && !readOnly ? (
        <div className="space-y-1">
          <Button
            disabled={pending}
            onClick={showPreview}
            size="sm"
            type="button"
            variant="outline"
          >
            Preview package
          </Button>
          <p className="text-muted-foreground text-xs">
            A preview writes nothing. Producing a package starts no tool and
            grants no access.
          </p>
        </div>
      ) : null}
      {preview ? (
        <section
          aria-label={`Package preview of ${handoff.title}`}
          className="space-y-3 text-sm"
        >
          {preview.blockers.length > 0 ? (
            <ul
              aria-label="Package blockers"
              className="space-y-1"
              role="alert"
            >
              {preview.blockers.map((blocker) => (
                <li
                  className="text-destructive"
                  key={`${blocker.kind}:${blocker.path ?? ""}:${blocker.message}`}
                >
                  {blocker.message}
                </li>
              ))}
            </ul>
          ) : (
            <>
              <p className="font-medium">
                {`Package version ${preview.nextPackageVersion} will contain`}
              </p>
              <ul aria-label="Included in the package">
                {preview.included.map(({ count, section }) => (
                  <li key={section}>
                    {`${SECTION_LABELS[section] ?? section}: ${count}`}
                  </li>
                ))}
              </ul>
              <p className="font-medium">Never included</p>
              <ul aria-label="Never included in the package">
                {preview.excluded.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
              <section
                aria-labelledby={`${handoff.id}-preview-md`}
                className="space-y-1"
              >
                <p className="font-medium" id={`${handoff.id}-preview-md`}>
                  Markdown package
                </p>
                <pre
                  className="max-h-64 overflow-auto whitespace-pre-wrap rounded-md border border-border/70 p-2 text-xs"
                  // biome-ignore lint/a11y/noNoninteractiveTabindex: A scrollable preview must be reachable from the keyboard.
                  tabIndex={0}
                >
                  {preview.markdown}
                </pre>
              </section>
              <section
                aria-labelledby={`${handoff.id}-preview-json`}
                className="space-y-1"
              >
                <p className="font-medium" id={`${handoff.id}-preview-json`}>
                  JSON package
                </p>
                <pre
                  className="max-h-64 overflow-auto whitespace-pre-wrap rounded-md border border-border/70 p-2 text-xs"
                  // biome-ignore lint/a11y/noNoninteractiveTabindex: A scrollable preview must be reachable from the keyboard.
                  tabIndex={0}
                >
                  {preview.json}
                </pre>
              </section>
              <Button
                disabled={pending || !preview.canProduce}
                onClick={confirm}
                size="sm"
                type="button"
              >
                {`Produce package version ${preview.nextPackageVersion}`}
              </Button>
            </>
          )}
        </section>
      ) : null}
      <p aria-live="polite" className="text-muted-foreground text-xs">
        {message}
      </p>
      {packages.length > 0 ? (
        <ul
          aria-label={`Produced packages of ${handoff.title}`}
          className="space-y-2"
        >
          {packages.map((record) => (
            <PackageCopies
              handoff={handoff}
              key={record.packageVersion}
              record={record}
            />
          ))}
        </ul>
      ) : null}
    </section>
  );
}
