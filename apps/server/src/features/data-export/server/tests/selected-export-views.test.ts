import {
  EXPORT_PDF_LIMITATION,
  type ExportScope,
  exportFormatSchema,
  exportScopeSchema,
} from "@cantiara/api/data-export";
import { describe, expect, test } from "vitest";

import { csvExportProducer } from "../csv-export-producer";
import { jsonExportProducer } from "../json-export-producer";
import { createPdfExportProducer } from "../pdf-export-producer";
import {
  createSelectedExport,
  type ExportSourceReader,
  type ExportViewVerifier,
} from "../selected-export";

const PDF_MAGIC_FREE_SCRIPT = /<script/i;
const TAGGED = /not a tagged PDF/;
const MARKDOWN = /Markdown/;
const PDF_EXTENSION = /\.pdf$/;

const fields = [
  { key: "key", label: "Key" },
  { key: "title", label: "Title" },
  { key: "status", label: "Status" },
  { key: "linkPassword", label: "Link password" },
];

interface Row {
  id: string;
  project: string;
  status: string;
  title: string;
}

const rows: Row[] = [
  { id: "w1", project: "p1", status: "Ready", title: "One" },
  { id: "w2", project: "p1", status: "Done", title: "Two <b>&</b>" },
  { id: "w3", project: "p2", status: "Ready", title: "Three" },
  { id: "w4", project: "p3", status: "Ready", title: "Four" },
];

const seen: Array<{
  filters: Record<string, string>;
  recordIds?: readonly string[];
  scope: ExportScope;
}> = [];

const reader: ExportSourceReader = {
  fields: () => fields,
  // biome-ignore lint/suspicious/useAwait: in-memory fake of an async reader.
  read: async ({ accountId, filters, recordIds, scope }) => {
    seen.push({ filters, recordIds, scope });
    if (scope.kind !== "project" || scope.projectId === "p3") {
      return null; // p3 is not this account's Project
    }
    const project = scope.projectId;
    return {
      records: rows
        .filter(
          (row) =>
            row.project === project &&
            (!filters.status || row.status === filters.status) &&
            (!recordIds || recordIds.includes(row.id)) &&
            accountId === "a1",
        )
        .map((row) => ({
          id: row.id,
          label: row.title,
          values: {
            key: row.id.toUpperCase(),
            linkPassword: "hunter2",
            status: row.status,
            title: row.title,
          },
        })),
      relations: [],
    };
  },
};

const collection = {
  conditions: { status: "Ready" } as Record<string, string>,
  memberIds: ["w1", "w3"],
  name: "Ready work",
  projectIds: ["p1", "p2"],
  sourceType: "Work",
};

function verifier(
  override: Partial<typeof collection> | null = {},
): ExportViewVerifier {
  return {
    smartCollection: async (_accountId, viewId) =>
      viewId === "sc1" && override ? { ...collection, ...override } : null,
  };
}

function setup(options: { rendered?: string[]; verify?: ExportViewVerifier }) {
  return createSelectedExport({
    now: () => new Date("2026-05-01T10:00:00.000Z"),
    producers: {
      CSV: csvExportProducer,
      JSON: jsonExportProducer,
      PDF: createPdfExportProducer({
        // biome-ignore lint/suspicious/useAwait: in-memory fake renderer.
        render: async (html) => {
          options.rendered?.push(html);
          return Buffer.from("%PDF-fake").toString("base64");
        },
      }),
    },
    sources: { Task: reader },
    viewVerifier: options.verify,
  });
}

const project = { kind: "project", projectId: "p1" } as const;
const cross = {
  kind: "cross-project",
  projectIds: ["p1", "p2"],
} satisfies ExportScope;

async function run(
  selected: ReturnType<typeof setup>,
  request: Record<string, unknown>,
) {
  const base = { filters: {}, format: "CSV", recordType: "Task", ...request };
  const preview = await selected.preview("a1", base as never);
  const artifact = await selected.produce("a1", {
    ...base,
    previewFingerprint: preview.fingerprint,
  } as never);
  return { artifact, preview };
}

describe("Selected Export cross-project scope", () => {
  test("accepts cross-project and rejects duplicates or none", () => {
    expect(exportScopeSchema.safeParse(cross).success).toBe(true);
    expect(
      exportScopeSchema.safeParse({ kind: "cross-project", projectIds: [] })
        .success,
    ).toBe(false);
    expect(
      exportScopeSchema.safeParse({
        kind: "cross-project",
        projectIds: ["p1", "p1"],
      }).success,
    ).toBe(false);
  });

  test("reads every Project and states the scope in the manifest", async () => {
    const { preview, artifact } = await run(setup({}), { scope: cross });
    expect(preview.records.map((record) => record.id)).toEqual([
      "w1",
      "w2",
      "w3",
    ]);
    expect(artifact.manifest.scope).toEqual(cross);
    expect(artifact.bytes).not.toContain("hunter2");
  });

  test("refuses the whole export when one Project is not accessible", async () => {
    const selected = setup({});
    await expect(
      selected.preview("a1", {
        filters: {},
        format: "CSV",
        recordType: "Task",
        scope: { kind: "cross-project", projectIds: ["p1", "p3"] },
      }),
    ).rejects.toMatchObject({ code: "source_unavailable" });
  });
});

describe("Selected Export record selection", () => {
  test("exports only the selected ids and filters across Projects", async () => {
    seen.length = 0;
    const { preview } = await run(setup({}), {
      filters: { status: "Ready" },
      recordIds: ["w1", "w2", "w3"],
      scope: cross,
    });
    expect(preview.records.map((record) => record.id)).toEqual(["w1", "w3"]);
    expect(seen.every((call) => call.filters.status === "Ready")).toBe(true);
    expect(preview.filters).toEqual({ status: "Ready" });
  });
});

describe("Selected Export view verification", () => {
  const view = {
    id: "sc1",
    kind: "Smart Collection",
    name: "Ready work",
  } as const;

  test("exports a verified Smart Collection from its stored definition", async () => {
    const { preview, artifact } = await run(setup({ verify: verifier() }), {
      filters: { status: "Ready" },
      scope: cross,
      view,
    });
    expect(preview.records.map((record) => record.id)).toEqual(["w1", "w3"]);
    expect(artifact.manifest.view).toMatchObject({
      kind: "Smart Collection",
      name: "Ready work",
    });
  });

  test("restricts a verified collection to its members", async () => {
    const { preview } = await run(
      setup({ verify: verifier({ conditions: {}, memberIds: ["w1"] }) }),
      { filters: {}, scope: cross, view },
    );
    expect(preview.records.map((record) => record.id)).toEqual(["w1"]);
  });

  test.each([
    ["an unknown collection", null, view],
    ["no view id", {}, { kind: "Smart Collection", name: "Ready work" }],
    ["another name", {}, { ...view, name: "Done work" }],
    ["another scope", { projectIds: ["p1"] }, view],
    ["other filters", { conditions: { status: "Done" } }, view],
  ])("rejects %s", async (_label, override, sentView) => {
    await expect(
      setup({ verify: verifier(override as never) }).preview("a1", {
        filters: { status: "Ready" },
        format: "CSV",
        recordType: "Task",
        scope: cross,
        view: sentView,
      } as never),
    ).rejects.toMatchObject({ code: "view_unverified" });
  });

  test("rejects a collection of another record type", async () => {
    await expect(
      setup({ verify: verifier({ sourceType: "Decision" }) }).preview("a1", {
        filters: { status: "Ready" },
        format: "CSV",
        recordType: "Task",
        scope: cross,
        view,
      }),
    ).rejects.toMatchObject({ code: "view_unverified" });
  });

  test("ties a view kind to its scope kind", async () => {
    await expect(
      setup({}).preview("a1", {
        filters: {},
        format: "CSV",
        recordType: "Task",
        scope: project,
        view: { kind: "Cross-project list", name: "All" },
      }),
    ).rejects.toMatchObject({ code: "view_unverified" });
    await expect(
      setup({}).preview("a1", {
        filters: {},
        format: "CSV",
        recordType: "Task",
        scope: cross,
        view: { kind: "Work list", name: "Backlog" },
      }),
    ).rejects.toMatchObject({ code: "view_unverified" });
  });
});

describe("Selected Export PDF snapshot", () => {
  const view = {
    kind: "Work list",
    name: "Backlog <main>",
    sort: { direction: "desc", field: "title" },
  } as const;
  const request = {
    filters: { status: "Ready" },
    format: "PDF",
    scope: project,
    view,
    visibleFields: ["title", "status", "linkPassword"],
  };

  test("accepts PDF only as a view format, never as a catalog export", async () => {
    expect(exportFormatSchema.options).toEqual(["JSON", "CSV", "PDF"]);
    for (const format of ["XLS", "XLSX", "Atom", "Word", "DOCX", "Markdown"]) {
      expect(exportFormatSchema.safeParse(format).success).toBe(false);
    }
    await expect(
      setup({}).preview("a1", {
        filters: {},
        format: "PDF",
        recordType: "Task",
        scope: project,
      }),
    ).rejects.toMatchObject({ code: "format_unavailable" });
  });

  test("preview explains the limit and offers an accessible alternative, rendering nothing", async () => {
    const rendered: string[] = [];
    const preview = await setup({ rendered }).preview("a1", {
      ...request,
      recordType: "Task",
    } as never);
    expect(preview.pdfNotice).toEqual({
      alternative: "CSV",
      limitation: EXPORT_PDF_LIMITATION,
    });
    expect(EXPORT_PDF_LIMITATION).toMatch(TAGGED);
    expect(EXPORT_PDF_LIMITATION).toMatch(MARKDOWN);
    expect(preview.formatAvailable).toBe(true);
    expect(rendered).toEqual([]);
  });

  test("produces a dated PDF carrying the exact view", async () => {
    const rendered: string[] = [];
    const { artifact } = await run(setup({ rendered }), request);
    expect(artifact.mediaType).toBe("application/pdf");
    expect(artifact.encoding).toBe("base64");
    expect(artifact.fileName).toMatch(PDF_EXTENSION);
    expect(Buffer.from(artifact.bytes, "base64").toString()).toBe("%PDF-fake");
    expect(artifact.manifest.format).toBe("PDF");
    const html = rendered[0] ?? "";
    expect(html).toContain("Backlog &lt;main&gt;");
    expect(html).toContain("Work list");
    expect(html).toContain("2026-05-01T10:00:00.000Z");
    expect(html).toContain("status");
    expect(html).toContain("Ready");
    expect(html).toContain("title");
    expect(html).toContain("descending");
    expect(html).toContain("p1");
    expect(html).toContain("Secrets");
    expect(html).toContain('lang="en"');
    expect(html).not.toContain("hunter2");
    expect(html).not.toContain("<b>");
    expect(html).not.toMatch(PDF_MAGIC_FREE_SCRIPT);
  });
});
