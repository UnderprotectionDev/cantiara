import {
  type ExportArtifact,
  type ExportDataset,
  type ExportFormatProducer,
  exportScopeProjectIds,
} from "@cantiara/api/data-export";

/** Renders a finished HTML page to a PDF; returns the PDF as base64. */
export type ExportPdfRenderer = (html: string) => Promise<string>;

const HTML_EXTENSION = /\.html$/;
const HTML_ESCAPES: Record<string, string> = {
  '"': "&quot;",
  "&": "&amp;",
  "'": "&#39;",
  "<": "&lt;",
  ">": "&gt;",
};

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (character) => HTML_ESCAPES[character] ?? "",
  );
}

function cellText(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }
  if (typeof value === "string") {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map(cellText).join("; ");
  }
  if (typeof value === "object") {
    return JSON.stringify(value);
  }
  return String(value);
}

/**
 * The printable page of an exact-view snapshot: view name and kind, scope,
 * filters, columns, sort and production time, then the table. Inert HTML only
 * (no script, no remote resource); every value is escaped.
 */
export function buildPdfSnapshotHtml(dataset: ExportDataset): string {
  const { manifest } = dataset;
  const { view } = manifest;
  const title = view?.name ?? `${manifest.recordType} snapshot`;
  const filters = Object.entries(manifest.filters);
  const sort = view?.sort
    ? `${view.sort.field} (${view.sort.direction === "asc" ? "ascending" : "descending"})`
    : "none";
  const meta: [string, string][] = [
    ["View", view ? `${view.kind}: ${view.name}` : "none"],
    ["Record type", manifest.recordType],
    [
      "Scope",
      manifest.scope.kind === "project"
        ? `Project ${exportScopeProjectIds(manifest.scope).join(", ")}`
        : `Projects ${exportScopeProjectIds(manifest.scope).join(", ")}`,
    ],
    [
      "Filters",
      filters.length === 0
        ? "none"
        : filters.map(([key, value]) => `${key} = ${value}`).join("; "),
    ],
    ["Columns", dataset.fields.map((field) => field.label).join(", ")],
    ["Sort", sort],
    ["Records", String(manifest.recordCount)],
    ["Produced", manifest.producedAt],
  ];
  const head = dataset.fields
    .map((field) => `<th scope="col">${escapeHtml(field.label)}</th>`)
    .join("");
  const body = dataset.records
    .map(
      (record) =>
        `<tr>${dataset.fields
          .map(
            (field) =>
              `<td>${escapeHtml(cellText(record.values[field.key]))}</td>`,
          )
          .join("")}</tr>`,
    )
    .join("");
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${escapeHtml(title)}</title><style>body{font:10pt sans-serif;color:#111}h1{font-size:16pt}dl{display:grid;grid-template-columns:max-content 1fr;gap:2px 12px}dt{font-weight:600}table{border-collapse:collapse;width:100%;margin-top:12px}td,th{border:1px solid #bbb;padding:4px;text-align:left;vertical-align:top;overflow-wrap:anywhere}thead{display:table-header-group}tr{break-inside:avoid}</style></head><body><h1>${escapeHtml(title)}</h1><dl>${meta
    .map(([name, value]) => `<dt>${name}</dt><dd>${escapeHtml(value)}</dd>`)
    .join(
      "",
    )}</dl><p>One-time snapshot as of ${escapeHtml(manifest.producedAt)}. It is not a live view and does not stay in sync. Secrets, share tokens and link passwords are never included.</p><table><caption>${escapeHtml(title)}</caption><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></body></html>`;
}

function fileDate(producedAt: string): string {
  return producedAt.slice(0, 10);
}

/**
 * PDF snapshot producer. `produce` builds the page the preview measures;
 * `finalize` renders it through the injected renderer only after confirmation.
 */
export function createPdfExportProducer(options: {
  render: ExportPdfRenderer;
}): ExportFormatProducer {
  return {
    finalize: async (artifact): Promise<ExportArtifact> => ({
      ...artifact,
      bytes: await options.render(artifact.bytes),
      encoding: "base64",
      fileName: artifact.fileName.replace(HTML_EXTENSION, ".pdf"),
      mediaType: "application/pdf",
    }),
    format: "PDF",
    produce(dataset) {
      const { manifest } = dataset;
      const name = (manifest.view?.name ?? manifest.recordType)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
      return {
        bytes: buildPdfSnapshotHtml(dataset),
        fileName: `cantiara-${name || "view"}-${fileDate(manifest.producedAt)}.html`,
        manifest,
        mediaType: "text/html",
      };
    },
  };
}
