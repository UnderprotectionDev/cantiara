import {
  type ApplyImportInput,
  ImportConflictError,
  type ImportPreview,
  ImportRefusedError,
  type PreviewImportInput,
} from "@cantiara/api/data-import";
import { describe, expect, test } from "vitest";

import { createDataImport } from "../data-import";
import { createMemoryDataImport } from "./data-import-memory-store";

const ACCOUNT = "account-1";
const NOW = new Date("2026-10-30T10:00:00.000Z");
const project = { kind: "project", projectId: "project-1" } as const;
const KEY = "import-key-0001";

function setup(
  options: Parameters<typeof createMemoryDataImport>[0] = {
    accountId: ACCOUNT,
  },
) {
  const harness = createMemoryDataImport(options);
  return { ...harness, importer: createDataImport(harness.ports) };
}

function request(overrides: Partial<PreviewImportInput>): PreviewImportInput {
  return {
    content: "",
    fileName: "tasks.csv",
    scope: project,
    ...overrides,
  };
}

const TASKS_CSV = [
  "Title,Description,ID",
  "Write brief,First,ext-1",
  "Review brief,Second,ext-2",
  "Ship brief,Third,ext-3",
].join("\n");

function confirm(preview: ImportPreview, key = KEY): ApplyImportInput {
  return {
    finalSetFingerprint: preview.finalSetFingerprint,
    idempotencyKey: key,
    stagingId: preview.stagingId,
  };
}

async function refusal(run: Promise<unknown>) {
  const error = await run.then(
    () => null,
    (caught: unknown) => caught,
  );
  return error instanceof ImportRefusedError ? error.code : "not refused";
}

describe("Standard Import Apply Import", () => {
  test("writes every row once as one committed set and returns a durable receipt", async () => {
    const { importer, staged, written } = setup();
    const preview = await importer.preview(
      ACCOUNT,
      request({ catalogType: "Task", content: TASKS_CSV }),
      NOW,
    );
    expect(written.records).toHaveLength(0);

    const result = await importer.apply(ACCOUNT, confirm(preview), NOW);

    expect(result).toMatchObject({
      receipt: {
        counts: { created: 3, excluded: 0, skipped: 0, updated: 0 },
        fileName: "tasks.csv",
        provenance: "file:tasks.csv",
        scopeLabel: "Project Atlas",
        status: "committed",
      },
      replayed: false,
      status: "committed",
    });
    expect(written.records.map((record) => record.values.title)).toEqual([
      "Write brief",
      "Review brief",
      "Ship brief",
    ]);
    expect(
      written.records.every((record) => record.recordType === "Task"),
    ).toBe(true);
    // The staged file is released once the set is committed.
    expect(staged.size).toBe(0);
  });

  test("keeps provider/file scope and origin key for every created record", async () => {
    const { importer, written } = setup();
    const preview = await importer.preview(
      ACCOUNT,
      request({ catalogType: "Task", content: TASKS_CSV }),
      NOW,
    );

    await importer.apply(ACCOUNT, confirm(preview), NOW);

    expect(written.origins.map((origin) => origin.originKey)).toEqual([
      "ext-1",
      "ext-2",
      "ext-3",
    ]);
    expect(
      written.origins.every((origin) => origin.provenance === "file:tasks.csv"),
    ).toBe(true);
    expect(written.origins.map((origin) => origin.recordId)).toEqual(
      written.records.map((record) => record.id),
    );
  });

  test("writes a Markdown file as one Document", async () => {
    const { importer, written } = setup();
    const preview = await importer.preview(
      ACCOUNT,
      request({
        content: "# Launch notes\n\nBody text.",
        fileName: "notes.md",
        scope: { kind: "wiki" },
      }),
      NOW,
    );

    const result = await importer.apply(ACCOUNT, confirm(preview), NOW);

    expect(result.status).toBe("committed");
    expect(written.records).toHaveLength(1);
    expect(written.records[0]).toMatchObject({
      recordType: "Document",
      values: { title: "Launch notes" },
    });
    expect(written.origins).toHaveLength(0);
  });

  test("the same key and the same set returns the earlier receipt without writing again", async () => {
    const { importer, written } = setup();
    const preview = await importer.preview(
      ACCOUNT,
      request({ catalogType: "Task", content: TASKS_CSV }),
      NOW,
    );
    const first = await importer.apply(ACCOUNT, confirm(preview), NOW);

    const retry = await importer.apply(ACCOUNT, confirm(preview), NOW);

    expect(retry).toMatchObject({ replayed: true, status: "committed" });
    expect(retry).toEqual({
      receipt: "receipt" in first ? first.receipt : undefined,
      replayed: true,
      status: "committed",
    });
    expect(written.records).toHaveLength(3);
  });

  test("reopens the receipt by key after a dropped connection", async () => {
    const { importer } = setup();
    const preview = await importer.preview(
      ACCOUNT,
      request({ catalogType: "Task", content: TASKS_CSV }),
      NOW,
    );
    await importer.apply(ACCOUNT, confirm(preview), NOW);

    const reopened = await importer.receipt(ACCOUNT, { idempotencyKey: KEY });

    expect(reopened).toMatchObject({
      counts: { created: 3 },
      idempotencyKey: KEY,
      status: "committed",
    });
    await expect(
      importer.receipt(ACCOUNT, { idempotencyKey: "never-applied-key" }),
    ).rejects.toThrow("No import receipt");
  });

  test("the same key with a different final set is a Conflict and writes nothing more", async () => {
    const { importer, written } = setup();
    const first = await importer.preview(
      ACCOUNT,
      request({ catalogType: "Task", content: TASKS_CSV }),
      NOW,
    );
    await importer.apply(ACCOUNT, confirm(first), NOW);
    const other = await importer.preview(
      ACCOUNT,
      request({ catalogType: "Task", content: "Title\nSomething else" }),
      NOW,
    );

    await expect(
      importer.apply(ACCOUNT, confirm(other), NOW),
    ).rejects.toBeInstanceOf(ImportConflictError);

    expect(written.records).toHaveLength(3);
  });

  test("a different key applies a fresh import", async () => {
    const { importer, written } = setup();
    const first = await importer.preview(
      ACCOUNT,
      request({ catalogType: "Task", content: TASKS_CSV }),
      NOW,
    );
    await importer.apply(ACCOUNT, confirm(first), NOW);
    const second = await importer.preview(
      ACCOUNT,
      request({ catalogType: "Task", content: "Title\nOne more" }),
      NOW,
    );

    const result = await importer.apply(
      ACCOUNT,
      confirm(second, "import-key-0002"),
      NOW,
    );

    expect(result.status).toBe("committed");
    expect(written.records).toHaveLength(4);
  });

  test("refuses Apply while an invalid row is neither corrected nor dropped", async () => {
    const { importer, staged, written } = setup();
    const preview = await importer.preview(
      ACCOUNT,
      request({
        catalogType: "Task",
        content: "Title,Note\nValid row,a\n,b",
        fileName: "tasks.csv",
      }),
      NOW,
    );
    expect(preview.counts.invalid).toBe(1);

    expect(await refusal(importer.apply(ACCOUNT, confirm(preview), NOW))).toBe(
      "invalid-rows-remain",
    );

    expect(written.records).toHaveLength(0);
    // The file stays staged and unclaimed so the founder can fix and retry.
    expect([...staged.values()][0]?.applyingKey).toBeNull();
  });

  test("applies exactly the set left after the founder explicitly drops the invalid row", async () => {
    const { importer, written } = setup();
    const withInvalid = await importer.preview(
      ACCOUNT,
      request({ catalogType: "Task", content: "Title,Note\nValid row,a\n,b" }),
      NOW,
    );
    expect(withInvalid.counts.invalid).toBe(1);
    const droppedRow = withInvalid.invalidRows[0]?.rowNumber ?? 0;

    const dropped = await importer.preview(
      ACCOUNT,
      request({
        catalogType: "Task",
        content: "Title,Note\nValid row,a\n,b",
        excludedRows: [droppedRow],
      }),
      NOW,
    );
    expect(dropped.counts).toMatchObject({
      excluded: 1,
      invalid: 0,
      create: 1,
    });

    const result = await importer.apply(ACCOUNT, confirm(dropped), NOW);

    expect(result).toMatchObject({
      receipt: { counts: { created: 1, excluded: 1 } },
      status: "committed",
    });
    expect(written.records.map((record) => record.values.title)).toEqual([
      "Valid row",
    ]);
  });

  test("refuses Apply for a set other than the one previewed", async () => {
    const { importer, written } = setup();
    const preview = await importer.preview(
      ACCOUNT,
      request({ catalogType: "Task", content: TASKS_CSV }),
      NOW,
    );

    expect(
      await refusal(
        importer.apply(
          ACCOUNT,
          { ...confirm(preview), finalSetFingerprint: "a".repeat(64) },
          NOW,
        ),
      ),
    ).toBe("preview-changed");

    expect(written.records).toHaveLength(0);
  });

  test("refuses Apply while a row still needs Resolve conflict", async () => {
    const { importer, written } = setup({
      accountId: ACCOUNT,
      origins: {
        "ext-1": { recordId: "rec-9", state: "living", title: "Old" },
      },
    });
    const preview = await importer.preview(
      ACCOUNT,
      request({
        catalogType: "Task",
        content: "Title,ID\nWrite brief,ext-1",
        rowChoices: { "1": "resolve conflict" },
      }),
      NOW,
    );

    expect(await refusal(importer.apply(ACCOUNT, confirm(preview), NOW))).toBe(
      "unresolved-conflict",
    );

    expect(written.records).toHaveLength(0);
  });

  test("an empty final set is refused instead of committing nothing", async () => {
    const { importer } = setup({
      accountId: ACCOUNT,
      origins: {
        "ext-1": { recordId: "rec-9", state: "living", title: "Old" },
      },
    });
    const preview = await importer.preview(
      ACCOUNT,
      request({
        catalogType: "Task",
        content: "Title,ID\nWrite brief,ext-1",
        rowChoices: { "1": "skip" },
      }),
      NOW,
    );

    expect(await refusal(importer.apply(ACCOUNT, confirm(preview), NOW))).toBe(
      "empty-final-set",
    );
  });

  test("a store failure on one record rolls back every record, relation and origin", async () => {
    const { importer, staged, written } = setup({
      accountId: ACCOUNT,
      failOnValue: "Review brief",
    });
    const preview = await importer.preview(
      ACCOUNT,
      request({ catalogType: "Task", content: TASKS_CSV }),
      NOW,
    );

    const result = await importer.apply(ACCOUNT, confirm(preview), NOW);

    expect(result).toMatchObject({
      receipt: {
        counts: { created: 0, updated: 0 },
        status: "rolled-back",
        supportReference: expect.any(String),
      },
      status: "rolled-back",
    });
    expect(written.records).toHaveLength(0);
    expect(written.origins).toHaveLength(0);
    expect(written.relations).toHaveLength(0);
    // The rollback is durable too: the same key reopens it, nothing is rewritten.
    const retry = await importer.apply(ACCOUNT, confirm(preview), NOW);
    expect(retry).toMatchObject({ replayed: true, status: "rolled-back" });
    expect([...staged.values()][0]?.applyingKey).toBeNull();
  });

  test("cancel before the commit barrier releases staging and writes nothing", async () => {
    const { importer, staged, written } = setup();
    const preview = await importer.preview(
      ACCOUNT,
      request({ catalogType: "Task", content: TASKS_CSV }),
      NOW,
    );

    const result = await importer.cancel(ACCOUNT, {
      stagingId: preview.stagingId,
    });

    expect(result).toEqual({ status: "cancelled" });
    expect(staged.size).toBe(0);
    expect(written.records).toHaveLength(0);
    await expect(
      importer.apply(ACCOUNT, confirm(preview), NOW),
    ).rejects.toThrow("staged import is gone");
  });

  test("after the commit barrier the status is Finalizing, not a fake Cancel, until the full commit", async () => {
    const { holdBarrier, importer, written } = setup();
    const preview = await importer.preview(
      ACCOUNT,
      request({ catalogType: "Task", content: TASKS_CSV }),
      NOW,
    );
    const release = holdBarrier();
    const applying = importer.apply(ACCOUNT, confirm(preview), NOW);
    await new Promise((resolve) => setTimeout(resolve, 0));

    const cancel = await importer.cancel(ACCOUNT, {
      stagingId: preview.stagingId,
    });
    const retry = await importer.apply(ACCOUNT, confirm(preview), NOW);

    expect(cancel).toEqual({ label: "Finalizing", status: "finalizing" });
    expect(retry).toEqual({ label: "Finalizing", status: "finalizing" });
    expect(written.records).toHaveLength(0);

    release();
    const result = await applying;

    expect(result.status).toBe("committed");
    expect(written.records).toHaveLength(3);
    expect(
      await importer.cancel(ACCOUNT, {
        idempotencyKey: KEY,
        stagingId: preview.stagingId,
      }),
    ).toMatchObject({ status: "committed" });
  });

  test("a second key cannot apply a file another key already holds", async () => {
    const { holdBarrier, importer } = setup();
    const preview = await importer.preview(
      ACCOUNT,
      request({ catalogType: "Task", content: TASKS_CSV }),
      NOW,
    );
    const release = holdBarrier();
    const applying = importer.apply(ACCOUNT, confirm(preview), NOW);
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(
      await refusal(
        importer.apply(ACCOUNT, confirm(preview, "import-key-0002"), NOW),
      ),
    ).toBe("apply-in-progress");

    release();
    await applying;
  });

  test("refuses a set the deployment cannot write, with the reason and no write", async () => {
    const { importer, written } = setup({
      accountId: ACCOUNT,
      unavailable: "Applying Risk is not available yet. Nothing was written.",
    });
    const preview = await importer.preview(
      ACCOUNT,
      request({ catalogType: "Risk", content: "Title\nSlip" }),
      NOW,
    );

    expect(await refusal(importer.apply(ACCOUNT, confirm(preview), NOW))).toBe(
      "apply-unavailable",
    );

    expect(written.records).toHaveLength(0);
  });

  test("an unknown future JSON schema version is refused with no write and no staging", async () => {
    const { importer, staged, written } = setup();

    const code = await refusal(
      importer.preview(
        ACCOUNT,
        request({
          content: JSON.stringify({
            body: "x",
            schema: "cantiara.document/2",
            title: "Brief",
          }),
          fileName: "brief.json",
        }),
        NOW,
      ),
    );

    expect(code).toBe("unknown-schema-version");
    expect(staged.size).toBe(0);
    expect(written.records).toHaveLength(0);
  });

  test("does not apply another account's staged file", async () => {
    const { importer, written } = setup();
    const preview = await importer.preview(
      ACCOUNT,
      request({ catalogType: "Task", content: TASKS_CSV }),
      NOW,
    );

    await expect(
      importer.apply("account-2", confirm(preview), NOW),
    ).rejects.toThrow("staged import is gone");

    expect(written.records).toHaveLength(0);
  });
});
