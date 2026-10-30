// biome-ignore-all lint/performance/noJsxPropsBind: Handlers bind to this surface's state.

import {
  EXPORT_LABEL,
  type ExportArtifact,
  type ExportCatalogEntry,
  type ExportPreview,
  type ExportRequest,
} from "@cantiara/api/data-export";
import { useExportFlow } from "../../hooks/use-export-flow";
import { ExportPreviewPanel } from "../components/export-preview-panel";
import { ExportForm } from "../forms/export-form";

/**
 * Export: one record type of one Project as JSON or CSV, reviewed in a
 * closed-world preview first. It is not a single Document export, a Workspace
 * archive or a live sync.
 */
export function ExportView({
  catalog,
  onPreview,
  onProduce,
  projects,
}: {
  catalog: readonly ExportCatalogEntry[];
  onPreview: (request: ExportRequest) => Promise<ExportPreview>;
  onProduce: (
    request: ExportRequest,
    preview: ExportPreview,
  ) => Promise<ExportArtifact>;
  projects: ReadonlyArray<{ id: string; name: string }>;
}) {
  const flow = useExportFlow({ onPreview, onProduce });
  return (
    <div className="space-y-4">
      <header className="space-y-1">
        <h2 className="font-semibold text-lg">{EXPORT_LABEL}</h2>
        <p className="text-muted-foreground text-sm">
          Take the records you choose out as JSON or CSV. You review exactly
          what leaves before anything is produced.
        </p>
      </header>
      <ExportForm
        catalog={catalog}
        disabled={flow.pending}
        onPreview={(request) => {
          flow.review(request).catch(() => undefined);
        }}
        projects={projects}
      />
      {flow.refusal ? (
        <p className="text-sm" role="alert">
          {flow.refusal}
        </p>
      ) : null}
      {flow.reviewing ? (
        <ExportPreviewPanel
          disabled={flow.pending}
          onCancel={flow.cancel}
          onConfirm={() => {
            flow.confirm().catch(() => undefined);
          }}
          preview={flow.reviewing.preview}
          produced={flow.produced}
        />
      ) : null}
      <p aria-live="polite" className="sr-only">
        {flow.pending ? "Working…" : ""}
      </p>
    </div>
  );
}
