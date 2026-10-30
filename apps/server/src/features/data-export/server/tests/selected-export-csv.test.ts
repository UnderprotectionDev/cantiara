import {
  EXPORT_CATALOG,
  exportFormatSchema,
  exportViewSchema,
} from "@cantiara/api/data-export";
import Papa from "papaparse";
import { describe, expect, test } from "vitest";

import { csvExportProducer, escapeFormulaCell } from "../csv-export-producer";
import { jsonExportProducer } from "../json-export-producer";
import {
  createSelectedExport,
  type ExportSourceReader,
} from "../selected-export";

const LOSSLESS_CLAIM = /lossless/i;
const scope = { kind: "project", projectId: "p1" } as const;

const fields = [
  { key: "key", label: "Key" },
  { key: "title", label: "Title" },
  { key: "note", label: "Note" },
  { key: "linkPassword", label: "Link password" },
];

const titles = [
  "=SUM(A1)",
  "+1",
  "-2",
  "@cmd",
  "\tTabbed",
  "\rReturned",
  'Plain, with "quotes" and\nnewline',
  " =leading space is data",
];

const reader: ExportSourceReader = {
  fields: () => fields,
  read: async () => ({
    records: titles.map((title, index) => ({
      components: { externalExecutionHandoffs: [{ id: `h${index}` }] },
      customFieldValues: { cf1: "Core" },
      id: `w${index}`,
      keyHistory: [`OLD-${index}`],
      label: `WORK-${index}`,
      values: {
        key: `WORK-${10 - index}`,
        linkPassword: "hunter2",
        note: index === 0 ? ["a", "b"] : null,
        title,
      },
    })),
    relations: [{ fromRecordId: "w0", kind: "blocks", toRecordId: "w1" }],
  }),
};

function setup() {
  return createSelectedExport({
    now: () => new Date("2026-05-01T10:00:00.000Z"),
    producers: { CSV: csvExportProducer, JSON: jsonExportProducer },
    sources: { Task: reader },
  });
}

const request = {
  filters: {},
  format: "CSV",
  recordType: "Task",
  scope,
} as const;

async function produce(extra: Record<string, unknown> = {}) {
  const selected = setup();
  const input = { ...request, ...extra } as typeof request;
  const preview = await selected.preview("a1", input);
  const artifact = await selected.produce("a1", {
    ...input,
    previewFingerprint: preview.fingerprint,
  });
  const parsed = Papa.parse<string[]>(artifact.bytes.trimEnd());
  return { artifact, parsed, preview };
}

describe("formula escaping golden", () => {
  test.each([
    ["=SUM(A1)", "'=SUM(A1)", true],
    ["+1", "'+1", true],
    ["-2", "'-2", true],
    ["@cmd", "'@cmd", true],
    ["\tTabbed", "'\tTabbed", true],
    ["\rReturned", "'\rReturned", true],
    ["plain", "plain", false],
    [" =space", " =space", false],
    ["it's =x", "it's =x", false],
    ["", "", false],
  ])("%j -> %j", (input, text, escaped) => {
    expect(escapeFormulaCell(input)).toEqual({ escaped, text });
  });
});

describe("Selected Export CSV", () => {
  test("escapes formula-like cells as data and round-trips through a CSV parser", async () => {
    const { artifact, parsed } = await produce();
    const rows = parsed.data;

    expect(artifact.mediaType).toBe("text/csv");
    expect(artifact.fileName).toBe("cantiara-task-2026-05-01.csv");
    expect(rows[0]).toEqual(["Key", "Title", "Note"]);
    expect(rows.slice(1).map((row) => row[1])).toEqual([
      "'=SUM(A1)",
      "'+1",
      "'-2",
      "'@cmd",
      "'\tTabbed",
      "'\rReturned",
      'Plain, with "quotes" and\nnewline',
      " =leading space is data",
    ]);
    expect(rows[1]?.[2]).toBe("a; b");
  });

  test("reports the transformation count and cells in preview and manifest", async () => {
    const { artifact, preview } = await produce();
    const expected = {
      cells: [0, 1, 2, 3, 4, 5].map((index) => ({
        field: "title",
        recordId: `w${index}`,
      })),
      count: 6,
    };

    expect(preview.escapes).toEqual(expected);
    expect(artifact.manifest.escapes).toEqual(expected);
  });

  test("reports lost relations, types, identities and structure before download", async () => {
    const preview = await setup().preview("a1", request);

    expect(preview.lost.map((loss) => loss.kind)).toEqual([
      "relations",
      "types",
      "identities",
      "structure",
    ]);
    expect(preview.formatAvailable).toBe(true);
    expect(JSON.stringify(preview.lost)).not.toMatch(LOSSLESS_CLAIM);
  });

  test("keeps the same values raw in JSON and carries no escape report", async () => {
    const selected = setup();
    const json = { ...request, format: "JSON" } as const;
    const preview = await selected.preview("a1", json);
    const artifact = await selected.produce("a1", {
      ...json,
      previewFingerprint: preview.fingerprint,
    });
    const document = JSON.parse(artifact.bytes);

    expect(document.records[0].values.title).toBe("=SUM(A1)");
    expect(document.records[1].values.title).toBe("+1");
    expect(artifact.bytes).not.toContain("'=SUM(A1)");
    expect(preview.escapes).toBeUndefined();
    expect(artifact.manifest.escapes).toBeUndefined();
    expect(JSON.stringify(document)).toContain("keyHistory");
  });

  test("never carries a secret and keeps the closed world", async () => {
    const { artifact, preview } = await produce({ recordIds: ["w0"] });

    expect(artifact.bytes).not.toContain("hunter2");
    expect(artifact.bytes).not.toContain("linkPassword");
    expect(artifact.bytes).not.toContain("Link password");
    expect(preview.secretsExcluded).toEqual(["linkPassword"]);
    expect(preview.relationsOmitted).toBe(1);
    expect(artifact.bytes).not.toContain("+1");
    expect(artifact.manifest.recordCount).toBe(1);
  });

  test("requires the confirmed preview of the same CSV selection", async () => {
    const selected = setup();
    const preview = await selected.preview("a1", request);

    await expect(
      selected.produce("a1", {
        ...request,
        previewFingerprint: preview.fingerprint,
        recordIds: ["w0"],
      }),
    ).rejects.toMatchObject({ code: "preview_required" });
  });
});

describe("Selected Export CSV header", () => {
  test("escapes a formula-like header cell like any other cell", async () => {
    const hostile: ExportSourceReader = {
      fields: () => [{ key: "title", label: "=HYPERLINK(1)" }],
      read: async () => ({
        records: [{ id: "w1", label: "W1", values: { title: "ok" } }],
        relations: [],
      }),
    };
    const selected = createSelectedExport({
      producers: { CSV: csvExportProducer },
      sources: { Task: hostile },
    });
    const preview = await selected.preview("a1", request);
    const artifact = await selected.produce("a1", {
      ...request,
      previewFingerprint: preview.fingerprint,
    });
    const parsed = Papa.parse<string[]>(artifact.bytes.trim());
    expect(parsed.data[0]).toEqual(["'=HYPERLINK(1)"]);
    expect(preview.escapes?.count).toBe(1);
  });
});

describe("Selected Export exact view", () => {
  const view = {
    kind: "Work list",
    name: "Needs review",
    sort: { direction: "asc", field: "key" },
  } as const;

  test("carries view name, filters, column order, sort, scope and production time", async () => {
    const { artifact, parsed, preview } = await produce({
      filters: { status: "Open" },
      view,
      visibleFields: ["title", "key"],
    });

    expect(parsed.data[0]).toEqual(["Title", "Key"]);
    expect(parsed.data[1]?.[1]).toBe("WORK-3");
    expect(parsed.data[8]?.[1]).toBe("WORK-10");
    expect(preview.view).toEqual(view);
    expect(artifact.manifest).toMatchObject({
      filters: { status: "Open" },
      producedAt: "2026-05-01T10:00:00.000Z",
      scope,
      view,
      visibleFields: ["title", "key"],
    });
    expect(artifact.fileName).toBe("cantiara-needs-review-2026-05-01.csv");
  });

  test("describes the view only; it names no view, report or subscription", () => {
    expect(Object.keys(exportViewSchema.shape).sort()).toEqual([
      "id",
      "kind",
      "name",
      "sort",
    ]);
    expect(
      exportViewSchema.safeParse({ ...view, subscribe: true }).success,
    ).toBe(false);
    expect(Object.keys(setup()).sort()).toEqual([
      "catalog",
      "preview",
      "produce",
    ]);
  });
});

describe("Selected Export forbidden formats", () => {
  test("has no XLS, Atom or Word path", async () => {
    const formats = ["XLS", "XLSX", "Atom", "Word", "DOCX"];
    for (const format of formats) {
      expect(exportFormatSchema.safeParse(format).success).toBe(false);
    }
    const attempts = await Promise.allSettled(
      formats.map((format) =>
        setup().preview("a1", { ...request, format } as never),
      ),
    );
    expect(attempts.every((attempt) => attempt.status === "rejected")).toBe(
      true,
    );
    // PDF is accepted only as an exact-view snapshot (see the views test).
    expect(exportFormatSchema.options).toEqual(["JSON", "CSV", "PDF"]);
    expect(
      EXPORT_CATALOG.flatMap((entry) => [...entry.recordTypes]),
    ).not.toContain("Document" as never);
  });
});
