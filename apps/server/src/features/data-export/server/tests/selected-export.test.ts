import {
  EXPORT_CATALOG,
  EXPORT_MAX_ROWS,
  EXPORT_RESIDENCY_NOTE,
  EXPORT_SCHEMA_VERSION,
  type ExportDataset,
  ExportError,
  type ExportFormatProducer,
  type ExportRecordType,
  exportFormatSchema,
} from "@cantiara/api/data-export";
import { describe, expect, test } from "vitest";
import {
  createExportCapacity,
  createSelectedExport,
  type ExportSourceRead,
  type ExportSourceReader,
} from "../selected-export";

const scope = { kind: "project", projectId: "p1" } as const;
const fields = [
  { key: "key", label: "Key" },
  { key: "title", label: "Title" },
  { key: "status", label: "Status" },
  { key: "shareToken", label: "Share token" },
];

function reader(
  read: Partial<ExportSourceRead> = {},
  onRead?: () => Promise<void>,
): ExportSourceReader & { reads: number } {
  const state = {
    reads: 0,
    fields: () => fields,
    async read() {
      state.reads += 1;
      await onRead?.();
      return {
        records: [
          {
            id: "w1",
            label: "WORK-1",
            values: {
              key: "WORK-1",
              shareToken: "tok_live_123",
              status: "Not Started",
              title: "First",
            },
          },
          {
            id: "w2",
            label: "WORK-2",
            values: {
              key: "WORK-2",
              status: "Done",
              title: "Second",
            },
          },
        ],
        relations: [
          { fromRecordId: "w1", kind: "blocks", toRecordId: "w2" },
          { fromRecordId: "w1", kind: "blocks", toRecordId: "outside" },
        ],
        ...read,
      };
    },
  };
  return state;
}

const jsonProducer: ExportFormatProducer = {
  format: "JSON",
  produce: (dataset: ExportDataset) => ({
    bytes: JSON.stringify({
      manifest: dataset.manifest,
      records: dataset.records,
    }),
    fileName: "export.json",
    manifest: dataset.manifest,
    mediaType: "application/json",
  }),
};

function setup(
  source: ExportSourceReader = reader(),
  options: Parameters<typeof createSelectedExport>[0] extends infer T
    ? Partial<T>
    : never = {},
) {
  return createSelectedExport({
    now: () => new Date("2026-05-01T10:00:00.000Z"),
    producers: { JSON: jsonProducer },
    sources: { Task: source },
    ...options,
  });
}

const request = {
  filters: { status: "any" },
  format: "JSON",
  recordType: "Task",
  scope,
} as const;

describe("Selected Export closed-world preview", () => {
  test("lists type, scope, fields, records, closed relations, hidden fields and the residency note", async () => {
    const preview = await setup().preview("a1", {
      ...request,
      visibleFields: ["key", "title"],
    });

    expect(preview.recordType).toBe("Task");
    expect(preview.scope).toEqual(scope);
    expect(preview.fields.map((field) => field.key)).toEqual(["key", "title"]);
    expect(preview.hiddenFields.map((field) => field.key)).toEqual(["status"]);
    expect(preview.records.map((record) => record.id)).toEqual(["w1", "w2"]);
    expect(preview.relations).toHaveLength(1);
    expect(preview.relationsOmitted).toBe(1);
    expect(preview.residency).toBe(EXPORT_RESIDENCY_NOTE);
    expect(preview.limits).toEqual({
      maxBytes: 25 * 1024 * 1024,
      maxRows: 10_000,
    });
  });

  test("does not take unselected records, relations or fields into the scope", async () => {
    const preview = await setup().preview("a1", {
      ...request,
      recordIds: ["w1"],
    });

    expect(preview.records.map((record) => record.id)).toEqual(["w1"]);
    expect(preview.relations).toEqual([]);
    expect(preview.relationsOmitted).toBe(2);
  });

  test("reports CSV loss before download and none for JSON", async () => {
    const csv = await setup().preview("a1", { ...request, format: "CSV" });
    const json = await setup().preview("a1", request);

    expect(csv.lost.map((loss) => loss.kind)).toEqual([
      "relations",
      "types",
      "identities",
    ]);
    expect(json.lost).toEqual([]);
  });

  test("omits inaccessible fields silently", async () => {
    const preview = await setup(
      reader({ accessibleFields: ["key", "title"] }),
    ).preview("a1", request);

    expect(preview.fields.map((field) => field.key)).toEqual(["key", "title"]);
    expect(preview.hiddenFields).toEqual([]);
    expect(JSON.stringify(preview)).not.toContain("Status");
  });

  test("refuses an inaccessible scope instead of exposing it", async () => {
    const source = reader();
    source.read = async () => null;
    await expect(setup(source).preview("a1", request)).rejects.toMatchObject({
      code: "source_unavailable",
    });
  });
});

describe("Selected Export secrets", () => {
  test("never carries a share token in the preview or the produced artifact", async () => {
    const selected = setup();
    const preview = await selected.preview("a1", request);
    const artifact = await selected.produce("a1", {
      ...request,
      previewFingerprint: preview.fingerprint,
    });

    expect(preview.secretsExcluded).toEqual(["shareToken"]);
    for (const text of [JSON.stringify(preview), artifact.bytes]) {
      expect(text).not.toContain("tok_live_123");
    }
    expect(artifact.bytes).not.toContain("shareToken");
  });

  test("strips a secret nested inside a value", async () => {
    const source = reader();
    source.read = async () => ({
      records: [
        {
          id: "w1",
          label: "WORK-1",
          values: {
            key: "WORK-1",
            title: { text: "x", linkPassword: "hunter2" } as never,
          },
        },
      ],
      relations: [],
    });
    const selected = setup(source);
    const preview = await selected.preview("a1", request);
    const artifact = await selected.produce("a1", {
      ...request,
      previewFingerprint: preview.fingerprint,
    });

    expect(artifact.bytes).not.toContain("hunter2");
    expect(preview.secretsExcluded).toContain("linkPassword");
  });
});

describe("Selected Export manifest", () => {
  test("carries schema version, scope, filters, visible fields and production time", async () => {
    const selected = setup();
    const preview = await selected.preview("a1", {
      ...request,
      visibleFields: ["title"],
    });
    const artifact = await selected.produce("a1", {
      ...request,
      previewFingerprint: preview.fingerprint,
      visibleFields: ["title"],
    });

    expect(artifact.manifest).toEqual({
      filters: { status: "any" },
      format: "JSON",
      producedAt: "2026-05-01T10:00:00.000Z",
      recordCount: 2,
      recordType: "Task",
      schemaVersion: EXPORT_SCHEMA_VERSION,
      scope,
      visibleFields: ["title"],
    });
  });
});

describe("Selected Export confirmation", () => {
  test("produces no artifact without a matching preview", async () => {
    const selected = setup();
    await expect(
      selected.produce("a1", { ...request, previewFingerprint: "nope" }),
    ).rejects.toMatchObject({ code: "preview_required" });
  });

  test("requires a new preview when the selection changed after it", async () => {
    const selected = setup();
    const preview = await selected.preview("a1", request);
    await expect(
      selected.produce("a1", {
        ...request,
        previewFingerprint: preview.fingerprint,
        recordIds: ["w1"],
      }),
    ).rejects.toMatchObject({ code: "preview_required" });
  });

  test("states that a format whose producer has not shipped is unavailable", async () => {
    const selected = setup(reader(), { producers: {} });
    const preview = await selected.preview("a1", request);
    expect(preview.formatAvailable).toBe(false);
    await expect(
      selected.produce("a1", {
        ...request,
        previewFingerprint: preview.fingerprint,
      }),
    ).rejects.toMatchObject({ code: "format_unavailable" });
  });
});

describe("Selected Export closed catalog", () => {
  test("refuses Document and unlisted types", async () => {
    const selected = setup();
    const attempts = [
      "Document",
      "Screen",
      "Project",
      "Workspace Exit Package",
    ].map((recordType) => selected.preview("a1", { ...request, recordType }));
    const results = await Promise.allSettled(attempts);
    expect(
      results.map((result) =>
        result.status === "rejected"
          ? (result.reason as ExportError).code
          : "ok",
      ),
    ).toEqual([
      "unlisted_family",
      "unlisted_family",
      "unlisted_family",
      "unlisted_family",
    ]);
  });

  test("lists exactly the PRD 13 types, no Document", () => {
    const types = setup()
      .catalog()
      .map((entry) => entry.recordType);
    expect(types).toEqual(
      EXPORT_CATALOG.flatMap((entry) => [...entry.recordTypes]),
    );
    expect(types).not.toContain("Document" as ExportRecordType);
    expect(types).toHaveLength(20);
  });

  test("offers only JSON and CSV", () => {
    for (const format of ["Markdown", "PDF", "XLS", "Atom", "Word"]) {
      expect(exportFormatSchema.safeParse(format).success).toBe(false);
    }
  });

  test("marks a type without a source reader unavailable", () => {
    const catalog = setup().catalog();
    expect(
      catalog.find((entry) => entry.recordType === "Task")?.available,
    ).toBe(true);
    expect(
      catalog.find((entry) => entry.recordType === "Risk")?.available,
    ).toBe(false);
  });
});

describe("Selected Export limits", () => {
  function many(count: number, size = 1): ExportSourceReader {
    const source = reader();
    source.read = async ({ limit }) => ({
      records: Array.from({ length: Math.min(count, limit) }, (_, index) => ({
        id: `w${index}`,
        label: `W${index}`,
        values: { title: "x".repeat(size) },
      })),
      relations: [],
    });
    return source;
  }

  test("allows exactly 10,000 rows", async () => {
    const preview = await setup(many(EXPORT_MAX_ROWS)).preview("a1", request);
    expect(preview.recordCount).toBe(EXPORT_MAX_ROWS);
  });

  test("refuses 10,001 rows visibly, without truncating", async () => {
    await expect(
      setup(many(EXPORT_MAX_ROWS + 1)).preview("a1", request),
    ).rejects.toMatchObject({ code: "limit_exceeded" });
  });

  test("refuses over 25 MB even under 10,000 rows", async () => {
    await expect(
      setup(many(30, 1_000_000)).preview("a1", request),
    ).rejects.toMatchObject({ code: "limit_exceeded" });
  });

  test("refuses a finished artifact over 25 MB", async () => {
    const big: ExportFormatProducer = {
      format: "JSON",
      produce: (dataset) => ({
        bytes: "x".repeat(26 * 1024 * 1024),
        fileName: "big.json",
        manifest: dataset.manifest,
        mediaType: "application/json",
      }),
    };
    const selected = setup(reader(), { producers: { JSON: big } });
    const preview = await selected.preview("a1", request);
    await expect(
      selected.produce("a1", {
        ...request,
        previewFingerprint: preview.fingerprint,
      }),
    ).rejects.toMatchObject({ code: "limit_exceeded" });
  });

  test("refuses concurrent capacity overflow visibly and recovers after", async () => {
    let unblock: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      unblock = resolve;
    });
    const selected = setup(
      reader({}, () => gate),
      {
        capacity: createExportCapacity(1),
      },
    );
    const first = selected.preview("a1", request);
    await expect(selected.preview("a1", request)).rejects.toMatchObject({
      code: "capacity_exceeded",
    });
    unblock();
    await first;
    await expect(selected.preview("a1", request)).resolves.toBeDefined();
  });

  test("releases capacity when a read fails", async () => {
    const failing = reader();
    failing.read = () => Promise.reject(new Error("boom"));
    const selected = setup(failing, { capacity: createExportCapacity(1) });
    await expect(selected.preview("a1", request)).rejects.toThrow("boom");
    await expect(selected.preview("a1", request)).rejects.toThrow("boom");
  });
});

describe("Selected Export does not write", () => {
  test("a preview only reads", async () => {
    const source = reader();
    const selected = setup(source);
    await selected.preview("a1", request);
    expect(source.reads).toBe(1);
    expect(Object.keys(source).sort()).toEqual(["fields", "read", "reads"]);
  });

  test("ExportError carries a stable code", () => {
    expect(new ExportError("capacity_exceeded").code).toBe("capacity_exceeded");
  });
});
