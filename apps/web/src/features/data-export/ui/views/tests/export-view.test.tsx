// @vitest-environment happy-dom
// biome-ignore-all lint/performance/noJsxPropsBind: Handlers bind to this surface's state.
import type {
  ExportCatalogEntry,
  ExportPreview,
} from "@cantiara/api/data-export";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { ExportPreviewPanel } from "../../components/export-preview-panel";
import { ExportView } from "../export-view";

const catalog: ExportCatalogEntry[] = [
  { available: true, family: "Work", recordType: "Task" },
  { available: false, family: "Decisions and uncertainty", recordType: "Risk" },
];

const preview: ExportPreview = {
  estimatedBytes: 2048,
  fields: [{ key: "title", label: "Title" }],
  filters: {},
  fingerprint: "f",
  format: "CSV",
  formatAvailable: false,
  hiddenFields: [{ key: "status", label: "Status" }],
  limits: { maxBytes: 25 * 1024 * 1024, maxRows: 10_000 },
  lost: [{ detail: "Relations are not carried.", kind: "relations" }],
  nature: "Not a live link.",
  recordCount: 3,
  recordType: "Task",
  records: [],
  relations: [],
  relationsOmitted: 2,
  residency: "Your live Workspace data stays in the EU region.",
  scope: { kind: "project", projectId: "p1" },
  secretsExcluded: ["shareToken"],
};

const DISABLED_EXPORT = /<button[^>]*disabled=""[^>]*>Export</;

describe("Export view", () => {
  test("names Export with JSON and CSV only, and no other surface", () => {
    const html = renderToStaticMarkup(
      <ExportView
        catalog={catalog}
        onPreview={() => Promise.reject(new Error("unused"))}
        onProduce={() => Promise.reject(new Error("unused"))}
        projects={[{ id: "p1", name: "Alpha" }]}
      />,
    );
    expect(html).toContain("Export");
    expect(html).toContain("JSON");
    expect(html).toContain("CSV");
    expect(html).toContain("Risk (not available yet)");
    for (const absent of ["Markdown", "PDF", "Exit Package", "Document"]) {
      expect(html).not.toContain(absent);
    }
  });
});

describe("Export preview panel", () => {
  const render = (value: ExportPreview) =>
    renderToStaticMarkup(
      <ExportPreviewPanel
        disabled={false}
        onCancel={() => undefined}
        onConfirm={() => undefined}
        preview={value}
        produced={null}
      />,
    );

  test("lists scope, fields, left out, loss, secrets and residency before confirm", () => {
    const html = render(preview);
    expect(html).toContain("3 Task records");
    expect(html).toContain("Left out");
    expect(html).toContain("Lost in this format");
    expect(html).toContain("never included");
    expect(html).toContain("EU region");
    expect(html).toContain("2 relations to records outside");
  });

  test("disables confirm while the format has no producer", () => {
    expect(render(preview)).toMatch(DISABLED_EXPORT);
    expect(render(preview)).toContain("not available yet");
    expect(render({ ...preview, formatAvailable: true })).not.toMatch(
      DISABLED_EXPORT,
    );
  });

  test("reports formula escapes and the view snapshot nature for CSV", () => {
    const html = render({
      ...preview,
      escapes: { cells: [{ field: "title", recordId: "w1" }], count: 1 },
      formatAvailable: true,
      view: { kind: "Smart Collection", name: "Needs review" },
    });
    expect(html).toContain("Spreadsheet safety");
    expect(html).toContain("1 cells that start with");
    expect(html).toContain("JSON keeps these values as they are");
    expect(html).toContain("creates no saved view, report or subscription");
  });
});
