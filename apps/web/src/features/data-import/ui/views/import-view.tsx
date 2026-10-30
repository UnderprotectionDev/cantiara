import {
  IMPORT_LABEL,
  type ImportPreview,
  type PreviewImportInput,
} from "@cantiara/api/data-import";
import { useCallback, useState } from "react";
import { ImportPreviewPanel } from "../components/import-preview-panel";
import ImportFileForm, {
  type ImportProjectChoice,
} from "../forms/import-file-form";

/**
 * Import: one file, one type, one place, previewed before any write. The
 * preview is the only step here; the separate `Apply Import` confirmation is
 * a later ticket.
 */
export function ImportView({
  onPreview,
  projects,
}: {
  onPreview: (input: PreviewImportInput) => Promise<ImportPreview>;
  projects: readonly ImportProjectChoice[];
}) {
  const [preview, setPreview] = useState<ImportPreview | null>(null);

  const previewFile = useCallback(
    async (input: PreviewImportInput) => {
      const result = await onPreview(input);
      setPreview(result);
      return result;
    },
    [onPreview],
  );

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
      {preview ? <ImportPreviewPanel preview={preview} /> : null}
    </section>
  );
}
