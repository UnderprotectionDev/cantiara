// @vitest-environment happy-dom
// biome-ignore-all lint/performance/noJsxPropsBind: Handlers bind to this surface's state.
import type {
  ExportCatalogEntry,
  ExportPreview,
} from "@cantiara/api/data-export";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import {
  type ExportHandoff,
  groupRecordIdsByType,
  scopeForProjects,
  setExportHandoff,
  takeExportHandoff,
} from "../../../lib/export-handoff";
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

describe("Export from a list screen", () => {
  const handoff: ExportHandoff = {
    filters: { status: "Ready" },
    recordIdsByType: { Task: ["w1", "w2"] },
    scope: scopeForProjects(["p1", "p2"]),
    view: { kind: "Cross-project list", name: "Ready work" },
    visibleFields: ["key", "title"],
  };

  test("offers PDF only for an exact view and shows the exact scope", () => {
    const html = renderToStaticMarkup(
      <ExportView
        catalog={catalog}
        handoff={{ ...handoff, recordIdsByType: { Task: ["w1", "w2"] } }}
        onPreview={() => Promise.reject(new Error("unused"))}
        onProduce={() => Promise.reject(new Error("unused"))}
        projects={[{ id: "p1", name: "Alpha" }]}
      />,
    );
    expect(html).toContain("PDF");
    expect(html).toContain("Cross-project list");
    expect(html).toContain("2 Task records");
    expect(html).toContain("status = Ready");
    expect(html).toContain("Columns: key, title");
    expect(html).not.toContain("export-ids");
  });

  test("a general export has record ids and a status filter, no PDF", () => {
    const html = renderToStaticMarkup(
      <ExportView
        catalog={catalog}
        onPreview={() => Promise.reject(new Error("unused"))}
        onProduce={() => Promise.reject(new Error("unused"))}
        projects={[{ id: "p1", name: "Alpha" }]}
      />,
    );
    expect(html).toContain("Record ids (optional)");
    expect(html).toContain("Status filter (optional)");
    expect(html).not.toContain("PDF");
  });

  test("hands the view over once", () => {
    setExportHandoff({ ...handoff, recordIdsByType: { Task: ["w1"] } });
    expect(takeExportHandoff()?.view.name).toBe("Ready work");
    expect(takeExportHandoff()).toBeNull();
  });

  test("groups ids by type and picks the scope kind", () => {
    expect(
      groupRecordIdsByType([
        { id: "a", type: "Task" },
        { id: "b", type: "Bug" },
        { id: "c", type: "Task" },
      ]),
    ).toEqual({ Bug: ["b"], Task: ["a", "c"] });
    expect(scopeForProjects(["p1"])).toEqual({
      kind: "project",
      projectId: "p1",
    });
    expect(scopeForProjects(["p1", "p2"]).kind).toBe("cross-project");
  });

  test("the PDF preview explains the limit and offers CSV", () => {
    const html = renderToStaticMarkup(
      <ExportPreviewPanel
        disabled={false}
        onCancel={() => undefined}
        onConfirm={() => undefined}
        onUseAlternative={() => undefined}
        preview={{
          ...preview,
          format: "PDF",
          formatAvailable: true,
          pdfNotice: {
            alternative: "CSV",
            limitation: "This PDF is not a tagged PDF.",
          },
          scope: { kind: "cross-project", projectIds: ["p1", "p2"] },
        }}
        produced={null}
      />,
    );
    expect(html).toContain("PDF accessibility");
    expect(html).toContain("not a tagged PDF");
    expect(html).toContain("Use CSV instead");
    expect(html).toContain("2 Projects");
  });
});
