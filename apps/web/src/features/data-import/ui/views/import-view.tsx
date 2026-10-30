import {
  type ApplyImportInput,
  IMPORT_LABEL,
  type ImportApplyResult,
  type ImportPreview,
  type PreviewImportInput,
} from "@cantiara/api/data-import";
import { useCallback, useState } from "react";
import { toggleExcludedRow } from "../../lib/import-form";
import { ImportApplyPanel } from "../components/import-apply-panel";
import { ImportPreviewPanel } from "../components/import-preview-panel";
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
  onPreview,
  projects,
}: {
  onApply: (input: ApplyImportInput) => Promise<ImportApplyResult>;
  onCancel: (stagingId: string) => Promise<unknown>;
  onPreview: (input: PreviewImportInput) => Promise<ImportPreview>;
  projects: readonly ImportProjectChoice[];
}) {
  const [shown, setShown] = useState<{
    input: PreviewImportInput;
    preview: ImportPreview;
  } | null>(null);

  const previewFile = useCallback(
    async (input: PreviewImportInput) => {
      const result = await onPreview(input);
      setShown({ input, preview: result });
      return result;
    },
    [onPreview],
  );

  const toggleRow = useCallback(
    (rowNumber: number) => {
      if (!shown) {
        return;
      }
      previewFile({
        ...shown.input,
        excludedRows: toggleExcludedRow(
          shown.input.excludedRows ?? [],
          rowNumber,
        ),
      }).catch(() => undefined);
    },
    [previewFile, shown],
  );

  const cancel = useCallback(() => {
    if (!shown) {
      return;
    }
    onCancel(shown.preview.stagingId)
      .then(() => setShown(null))
      .catch(() => undefined);
  }, [onCancel, shown]);

  return (
    <section aria-label={IMPORT_LABEL} className="space-y-6">
      <header className="space-y-1">
        <h2 className="font-semibold text-2xl tracking-tight">
          {IMPORT_LABEL}
        </h2>
        <p className="text-muted-foreground text-sm">
          A file becomes records in Cantiara. It stays a copy: there is no live
          link to the file.
        </p>
      </header>
      <ImportFileForm onPreview={previewFile} projects={projects} />
      {shown ? (
        <>
          <ImportPreviewPanel
            excludedRows={shown.input.excludedRows}
            onToggleRow={toggleRow}
            preview={shown.preview}
          />
          <ImportApplyPanel
            key={`${shown.preview.stagingId}:${shown.preview.finalSetFingerprint}`}
            onApply={onApply}
            onCancel={cancel}
            preview={shown.preview}
          />
        </>
      ) : null}
    </section>
  );
}
