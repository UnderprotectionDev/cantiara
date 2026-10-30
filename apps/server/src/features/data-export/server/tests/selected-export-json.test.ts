import {
  EXPORT_CATALOG,
  EXPORT_SCHEMA_VERSION,
  type ExportRecordType,
} from "@cantiara/api/data-export";
import { describe, expect, test } from "vitest";

import { jsonExportProducer } from "../json-export-producer";
import {
  createSelectedExport,
  type ExportSourceRead,
  type ExportSourceReader,
} from "../selected-export";

const LIVE_PLACEMENT = /region|neon|railway|revisions?":/i;
const scope = { kind: "project", projectId: "p1" } as const;

const fields = [
  { key: "key", label: "Key" },
  { key: "title", label: "Title" },
  { key: "linkPassword", label: "Link password" },
];

function reader(read: Partial<ExportSourceRead> = {}): ExportSourceReader {
  return {
    fields: () => fields,
    read: async () => ({
      customFieldDefinitions: [
        {
          id: "cf1",
          name: "Area",
          options: ["Core"],
          recordTypes: ["Task"],
          type: "Single select",
        },
      ],
      records: [
        {
          components: {
            externalExecutionHandoffs: [
              { id: "h1", purpose: "Build it", sessionToken: "tok_secret" },
            ],
          },
          customFieldValues: { cf1: "Core" },
          id: "w1",
          keyHistory: ["OLD-1", "WORK-1"],
          label: "WORK-1",
          origin: { originOwnerRecordId: "doc1" },
          values: {
            key: "WORK-1",
            linkPassword: "hunter2",
            title: '=SUM(A1) "raw", \n+x',
          },
        },
        {
          id: "w2",
          label: "WORK-2",
          values: { key: "WORK-2", title: "Second" },
        },
        {
          id: "w3",
          label: "WORK-3",
          values: { key: "WORK-3", title: "Third" },
        },
      ],
      relations: [
        { fromRecordId: "w1", kind: "blocks", toRecordId: "w2" },
        { fromRecordId: "w1", kind: "blocks", toRecordId: "w3" },
      ],
      ...read,
    }),
  };
}

function setup(source = reader()) {
  return createSelectedExport({
    now: () => new Date("2026-05-01T10:00:00.000Z"),
    producers: { JSON: jsonExportProducer },
    sources: { Task: source },
  });
}

const request = {
  filters: {},
  format: "JSON",
  recordType: "Task",
  scope,
} as const;

async function produce(
  selected = setup(),
  extra: { recordIds?: string[] } = {},
) {
  const preview = await selected.preview("a1", { ...request, ...extra });
  const artifact = await selected.produce("a1", {
    ...request,
    ...extra,
    previewFingerprint: preview.fingerprint,
  });
  return { artifact, document: JSON.parse(artifact.bytes), preview };
}

describe("Selected Export JSON", () => {
  test("carries an explicit schema version and the source manifest", async () => {
    const { artifact, document } = await produce();

    expect(document.schemaVersion).toBe(EXPORT_SCHEMA_VERSION);
    expect(Object.keys(document)[0]).toBe("schemaVersion");
    expect(document.manifest).toEqual(artifact.manifest);
    expect(artifact.mediaType).toBe("application/json");
    expect(artifact.fileName).toBe("cantiara-task-2026-05-01.json");
  });

  test("keeps raw values, identities, key history, origin and custom fields", async () => {
    const { document } = await produce();
    const [first] = document.records;

    expect(first.values.title).toBe('=SUM(A1) "raw", \n+x');
    expect(first.id).toBe("w1");
    expect(first.keyHistory).toEqual(["OLD-1", "WORK-1"]);
    expect(first.origin).toEqual({ originOwnerRecordId: "doc1" });
    expect(first.customFieldValues).toEqual({ cf1: "Core" });
    expect(document.customFieldDefinitions).toEqual([
      expect.objectContaining({ id: "cf1", name: "Area" }),
    ]);
  });

  test("carries a relation only when both ends are selected", async () => {
    const all = await produce();
    expect(all.document.relations).toHaveLength(2);

    const some = await produce(setup(), { recordIds: ["w1", "w2"] });
    expect(some.document.relations).toEqual([
      { fromRecordId: "w1", kind: "blocks", toRecordId: "w2" },
    ]);
    expect(JSON.stringify(some.document)).not.toContain("w3");
  });

  test("keeps owned components inside the owner and never as a type", async () => {
    const { document } = await produce();

    expect(document.records[0].components.externalExecutionHandoffs).toEqual([
      { id: "h1", purpose: "Build it" },
    ]);
    const types: string[] = EXPORT_CATALOG.flatMap((entry) => [
      ...entry.recordTypes,
    ]);
    for (const component of [
      "External Execution Handoff",
      "Access Observation",
      "Outcome Observation",
      "Technical Diagram",
    ]) {
      expect(types).not.toContain(component as ExportRecordType);
    }
  });

  test("never carries a secret, nested or top-level", async () => {
    const { artifact, preview } = await produce();

    for (const text of [artifact.bytes, JSON.stringify(preview)]) {
      expect(text).not.toContain("hunter2");
      expect(text).not.toContain("tok_secret");
    }
    expect(artifact.bytes).not.toContain("linkPassword");
    expect(preview.secretsExcluded).toEqual(["linkPassword", "sessionToken"]);
  });

  test("does not carry the live EU placement or ordinary history", async () => {
    const { artifact } = await produce();

    expect(artifact.bytes).not.toMatch(LIVE_PLACEMENT);
  });

  test("is confirmable: the preview reports the JSON producer available", async () => {
    const preview = await setup().preview("a1", request);

    expect(preview.formatAvailable).toBe(true);
    expect(preview.lost).toEqual([]);
  });
});
