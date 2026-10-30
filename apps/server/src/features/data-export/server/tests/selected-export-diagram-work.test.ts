import {
  EXPORT_CATALOG,
  EXPORT_DIAGRAM_TYPE,
  EXPORT_ONLY_CATALOG,
  EXPORT_RECORD_TYPES,
  type ExportScope,
} from "@cantiara/api/data-export";
import type { TechnicalDiagramsAccess } from "@cantiara/api/technical-diagrams";
import { describe, expect, test } from "vitest";

import { csvExportProducer } from "../csv-export-producer";
import { jsonExportProducer } from "../json-export-producer";
import {
  createSelectedExport,
  type ExportSourceReader,
  type ExportViewVerifier,
} from "../selected-export";
import { createDiagramExportSource } from "../selected-export-diagram-source";

const project = { kind: "project", projectId: "p1" } as const;

const diagram = {
  authorityMode: "External Source Link",
  externalSource: {
    lastCheckedAt: "2026-04-01T00:00:00.000Z",
    revision: "r7",
    tool: "Figma",
    url: "https://www.figma.com/file/abc/Board?token=hunter2#frag",
  },
  id: "d1",
  model: { edges: [], nodes: [{ id: "n1", label: "API" }] },
  projectId: "p1",
  revision: 4,
  title: "Platform",
  type: "Technical Architecture",
} as unknown as Awaited<ReturnType<TechnicalDiagramsAccess["list"]>>[number];

const diagrams: Pick<
  TechnicalDiagramsAccess,
  "list" | "listVersions" | "listViews"
> = {
  list: async (_accountId, projectId) => (projectId === "p1" ? [diagram] : []),
  listVersions: async () =>
    [
      {
        authorityMode: "External Source Link",
        createdAt: "2026-04-02T00:00:00.000Z",
        diagramId: "d1",
        id: "v1",
        model: { nodes: [{ id: "secret-model-copy" }] },
        name: "Release 1",
        number: 1,
        revision: 3,
        type: "Technical Architecture",
      },
      {
        authorityMode: "External Source Link",
        createdAt: "2026-04-03T00:00:00.000Z",
        diagramId: "d1",
        id: "v2",
        model: { nodes: [] },
        name: "Release 2",
        number: 2,
        revision: 4,
        type: "Technical Architecture",
      },
    ] as never,
  listViews: async () => [
    {
      id: "view1",
      layout: { n1: { x: 1, y: 2 } },
      name: "Overview",
      selectedNodeIds: ["n1"],
    },
  ],
};

function diagramSelected() {
  return createSelectedExport({
    now: () => new Date("2026-05-01T10:00:00.000Z"),
    producers: { CSV: csvExportProducer, JSON: jsonExportProducer },
    sources: {
      [EXPORT_DIAGRAM_TYPE]: createDiagramExportSource({
        diagrams,
        ownsProject: async (accountId, projectId) =>
          accountId === "a1" && projectId === "p1",
      }),
    },
  });
}

const request = {
  filters: {},
  format: "JSON",
  recordType: EXPORT_DIAGRAM_TYPE,
  scope: project,
} as const;

describe("Technical Diagram export-only kind", () => {
  test("is a separate export-only catalog entry; the 20 round-trip types stay", () => {
    const catalog = diagramSelected().catalog();
    expect(EXPORT_RECORD_TYPES).toHaveLength(20);
    expect(EXPORT_CATALOG.flatMap((entry) => entry.recordTypes)).toHaveLength(
      20,
    );
    expect(EXPORT_ONLY_CATALOG[0].recordTypes).toEqual([EXPORT_DIAGRAM_TYPE]);
    const roundTrip = catalog.filter((entry) => !entry.exportOnly);
    expect(roundTrip).toHaveLength(20);
    expect(catalog.filter((entry) => entry.exportOnly)).toEqual([
      {
        available: true,
        exportOnly: true,
        family: "Technical Diagram",
        recordType: EXPORT_DIAGRAM_TYPE,
      },
    ]);
  });

  test("exports model, authority mode, views, version manifests and the link without content", async () => {
    const selected = diagramSelected();
    const preview = await selected.preview("a1", request);
    expect(preview.exportOnly).toBe(true);
    const artifact = await selected.produce("a1", {
      ...request,
      previewFingerprint: preview.fingerprint,
    });
    const parsed = JSON.parse(artifact.bytes);
    expect(parsed.manifest.exportOnly).toBe(true);
    expect(parsed.manifest.recordType).toBe(EXPORT_DIAGRAM_TYPE);
    expect(parsed.schemaVersion).toBe("cantiara-export/1");
    const [record] = parsed.records;
    expect(record.values.authorityMode).toBe("External Source Link");
    expect(record.values.model).toEqual(diagram.model);
    expect(record.components.diagramViews).toEqual([
      {
        id: "view1",
        layout: { n1: { x: 1, y: 2 } },
        name: "Overview",
        selectedNodeIds: ["n1"],
      },
    ]);
    expect(
      record.components.diagramVersions.map(
        (version: { name: string }) => version.name,
      ),
    ).toEqual(["Release 1", "Release 2"]);
    // A version is a manifest: its model copy never leaves.
    expect(artifact.bytes).not.toContain("secret-model-copy");
    // The link is the exact origin and path with its metadata, nothing more.
    expect(record.values.externalSource).toEqual({
      lastCheckedAt: "2026-04-01T00:00:00.000Z",
      revision: "r7",
      tool: "Figma",
      url: "https://www.figma.com/file/abc/Board",
    });
    expect(artifact.bytes).not.toContain("hunter2");
    expect(artifact.bytes).not.toContain("frag");
  });

  test("a selected Diagram Version limits the manifests", async () => {
    const selected = diagramSelected();
    const filtered = { ...request, filters: { versionId: "v2" } };
    const preview = await selected.preview("a1", filtered);
    const artifact = await selected.produce("a1", {
      ...filtered,
      previewFingerprint: preview.fingerprint,
    });
    const [record] = JSON.parse(artifact.bytes).records;
    expect(
      record.components.diagramVersions.map(
        (version: { id: string }) => version.id,
      ),
    ).toEqual(["v2"]);
  });

  test("refuses CSV and PDF with a visible code", async () => {
    const selected = diagramSelected();
    await Promise.all(
      (["CSV", "PDF"] as const).map((format) =>
        expect(
          selected.preview("a1", { ...request, format }),
        ).rejects.toMatchObject({ code: "format_unavailable" }),
      ),
    );
  });

  test("Diagram View and Diagram Version are not independent record types", async () => {
    const selected = diagramSelected();
    await Promise.all(
      ["Diagram View", "Diagram Version"].map((recordType) =>
        expect(
          selected.preview("a1", { ...request, recordType }),
        ).rejects.toMatchObject({ code: "unlisted_family" }),
      ),
    );
  });

  test("a Project that is not the account's is refused", async () => {
    await expect(
      diagramSelected().preview("a2", request),
    ).rejects.toMatchObject({ code: "source_unavailable" });
  });
});

interface WorkRow {
  id: string;
  title: string;
  type: string;
}

const workRows: WorkRow[] = [
  { id: "w1", title: "One", type: "Bug" },
  { id: "w2", title: "Two", type: "Task" },
  { id: "w3", title: "Three", type: "Feature" },
];

function workReader(seen: { recordTypes: string[] }): ExportSourceReader {
  return {
    fields: () => [
      { key: "title", label: "Title" },
      { key: "type", label: "Type" },
    ],
    // biome-ignore lint/suspicious/useAwait: in-memory fake of an async reader.
    read: async ({ recordIds, recordType }) => {
      seen.recordTypes.push(recordType);
      return {
        records: workRows
          .filter((row) => !recordIds || recordIds.includes(row.id))
          .map((row) => ({
            id: row.id,
            label: row.title,
            values: { title: row.title, type: row.type },
          })),
        relations: [],
      };
    },
  };
}

function workSelected(
  seen: { recordTypes: string[] },
  verifier?: ExportViewVerifier,
) {
  return createSelectedExport({
    now: () => new Date("2026-05-01T10:00:00.000Z"),
    producers: { CSV: csvExportProducer, JSON: jsonExportProducer },
    sources: { Task: workReader(seen), Work: workReader(seen) },
    viewVerifier: verifier,
  });
}

const workList = { kind: "Work list", name: "Work records" } as const;

describe("Mixed Work types in one operation", () => {
  test("one Work export covers every Work type of the list", async () => {
    const seen = { recordTypes: [] as string[] };
    const selected = workSelected(seen);
    const base = {
      filters: {},
      format: "CSV" as const,
      recordIds: ["w1", "w2", "w3"],
      recordType: "Work",
      scope: project,
      view: workList,
    };
    const preview = await selected.preview("a1", base);
    expect(preview.recordCount).toBe(3);
    expect(preview.recordType).toBe("Work");
    const artifact = await selected.produce("a1", {
      ...base,
      previewFingerprint: preview.fingerprint,
    });
    expect(artifact.manifest.recordType).toBe("Work");
    expect(artifact.bytes).toContain("Bug");
    expect(artifact.bytes).toContain("Task");
    expect(artifact.bytes).toContain("Feature");
    expect(seen.recordTypes.every((type) => type === "Work")).toBe(true);
  });

  test("another family still needs its own operation", async () => {
    const selected = workSelected({ recordTypes: [] });
    await expect(
      selected.preview("a1", {
        filters: {},
        format: "JSON",
        recordType: "Everything",
        scope: project,
      }),
    ).rejects.toMatchObject({ code: "unlisted_family" });
  });

  test("a Smart Collection of Work with no type condition exports all its members", async () => {
    const verifier: ExportViewVerifier = {
      smartCollection: async () => ({
        conditions: {},
        memberIds: ["w1", "w2", "w3"],
        name: "Everything",
        projectIds: ["p1"],
        sourceType: "Work",
      }),
    };
    const selected = workSelected({ recordTypes: [] }, verifier);
    const preview = await selected.preview("a1", {
      filters: {},
      format: "CSV",
      recordType: "Work",
      scope: project,
      view: { id: "sc1", kind: "Smart Collection", name: "Everything" },
    });
    expect(preview.recordCount).toBe(3);
  });

  test("a Smart Collection limited to one Work type is not exported as all of Work", async () => {
    const verifier: ExportViewVerifier = {
      smartCollection: async () => ({
        conditions: { type: "Bug" },
        memberIds: ["w1"],
        name: "Bugs",
        projectIds: ["p1"],
        sourceType: "Work",
      }),
    };
    const selected = workSelected({ recordTypes: [] }, verifier);
    await expect(
      selected.preview("a1", {
        filters: { type: "Bug" },
        format: "CSV",
        recordType: "Work",
        scope: project,
        view: { id: "sc1", kind: "Smart Collection", name: "Bugs" },
      }),
    ).rejects.toMatchObject({ code: "view_unverified" });
  });
});

describe("Exported order matches the on-screen order", () => {
  const ids = ["w3", "w1", "w2"];
  const base = {
    filters: {},
    format: "JSON" as const,
    recordIds: ids,
    recordType: "Work",
    scope: project as ExportScope,
  };

  async function exportedIds(
    view: Record<string, unknown> | undefined,
  ): Promise<string[]> {
    const selected = workSelected({ recordTypes: [] });
    const asked = { ...base, ...(view ? { view } : {}) } as never;
    const preview = await selected.preview("a1", asked);
    const artifact = await selected.produce("a1", {
      ...(asked as object),
      previewFingerprint: preview.fingerprint,
    } as never);
    return JSON.parse(artifact.bytes).records.map(
      (record: { id: string }) => record.id,
    );
  }

  test("a manual or priority order is kept as listed", async () => {
    expect(await exportedIds({ ...workList, order: "listed" })).toEqual(ids);
  });

  test("a declared sort column wins over the listed order", async () => {
    expect(
      await exportedIds({
        ...workList,
        order: "listed",
        sort: { direction: "asc", field: "title" },
      }),
    ).toEqual(["w1", "w3", "w2"]);
  });

  test("without a declared order the reader's order stands", async () => {
    expect(await exportedIds(workList)).toEqual(["w1", "w2", "w3"]);
  });
});
