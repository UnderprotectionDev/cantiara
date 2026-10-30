import {
  IMPORT_MAX_BYTES,
  IMPORT_MAX_ROWS,
  IMPORT_STAGING_TTL_MS,
  ImportRefusedError,
  ImportScopeNotFoundError,
  ImportStagingExpiredError,
  type PreviewImportInput,
} from "@cantiara/api/data-import";
import { describe, expect, test } from "vitest";

import { createDataImport } from "../data-import";
import { createMemoryDataImport } from "./data-import-memory-store";

const ACCOUNT = "account-1";
const NOW = new Date("2026-10-30T10:00:00.000Z");
const project = { kind: "project", projectId: "project-1" } as const;

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
    fileName: "risks.csv",
    scope: project,
    ...overrides,
  };
}

async function refusal(run: Promise<unknown>) {
  const error = await run.then(
    () => null,
    (caught: unknown) => caught,
  );
  return error instanceof ImportRefusedError ? error.code : "not refused";
}

describe("Standard Import preview", () => {
  test("imports a single Markdown file as a Project Document without writing", async () => {
    const { importer, primaryUnchanged, staged } = setup();

    const preview = await importer.preview(
      ACCOUNT,
      request({
        content: "# Launch notes\n\nBody text.",
        fileName: "notes.md",
      }),
      NOW,
    );

    expect(preview).toMatchObject({
      counts: { create: 1, invalid: 0, total: 1 },
      family: "Document",
      format: "Markdown",
      primaryWrites: "none",
      scope: { kind: "project", label: "Project Atlas" },
    });
    expect(preview.rows[0]?.values).toMatchObject({ title: "Launch notes" });
    expect(preview.origin.column).toBeNull();
    expect(staged.size).toBe(1);
    expect(primaryUnchanged()).toBe(true);
  });

  test("targets the Wiki for Markdown and reports ignored front matter as a loss", async () => {
    const { importer } = setup();

    const preview = await importer.preview(
      ACCOUNT,
      request({
        content: "---\ntags: a\n---\n# Idea\ntext",
        fileName: "idea.md",
        scope: { kind: "wiki" },
      }),
      NOW,
    );

    expect(preview.scope).toEqual({ kind: "wiki", label: "Personal Wiki" });
    expect(preview.losses.map((loss) => loss.kind)).toContain(
      "front matter ignored",
    );
  });

  test("reads first-party Document JSON as the Document family and keeps its id as origin", async () => {
    const { importer } = setup({
      accountId: ACCOUNT,
      origins: { "doc-7": { state: "permanently deleted" } },
    });

    const preview = await importer.preview(
      ACCOUNT,
      request({
        content: JSON.stringify({
          body: "Hello",
          id: "doc-7",
          schema: "cantiara.document/1",
          title: "Brief",
        }),
        fileName: "brief.json",
      }),
      NOW,
    );

    expect(preview.family).toBe("Document");
    expect(preview.format).toBe("Document JSON");
    expect(preview.origin.column).toBe("id");
    expect(preview.rows[0]).toMatchObject({
      action: "create",
      newIdentity: { previousOrigin: "doc-7", reason: "permanently deleted" },
    });
  });

  test("accepts a first-party Document JSON whose body is empty", async () => {
    const { importer } = setup();

    const preview = await importer.preview(
      ACCOUNT,
      request({
        content: JSON.stringify({
          schema: "cantiara.document/1",
          title: "Title only",
        }),
        fileName: "title-only.json",
      }),
      NOW,
    );

    expect(preview.rows[0]).toMatchObject({ action: "create" });
    expect(preview.counts).toMatchObject({ create: 1, invalid: 0 });
    expect(preview.rows[0]?.values).toMatchObject({ title: "Title only" });
  });

  test("refuses an unknown future schema version without staging", async () => {
    const { importer, staged } = setup();

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
  });

  test("maps CSV columns to catalog fields, shows losses and invalid rows", async () => {
    const { importer, primaryUnchanged } = setup();
    const csv = [
      "Name,Description,Owner,ID",
      "Slip risk,Might slip,Mert,ext-1",
      ",No title,Mert,ext-2",
      "Cost risk,Over budget,Mert,ext-3",
    ].join("\n");

    const preview = await importer.preview(
      ACCOUNT,
      request({ catalogType: "Risk", content: csv }),
      NOW,
    );

    expect(preview.mapping).toEqual([
      { origin: false, source: "Name", target: "title" },
      { origin: false, source: "Description", target: "description" },
      { origin: false, source: "Owner", target: null },
      { origin: true, source: "ID", target: "origin" },
    ]);
    expect(preview.losses).toEqual([
      { detail: 'Column "Owner" is not imported.', kind: "unmapped column" },
    ]);
    expect(preview.counts).toMatchObject({ create: 2, invalid: 1, total: 3 });
    expect(preview.invalidRows[0]).toMatchObject({
      problems: ["title is empty."],
      rowNumber: 2,
    });
    expect(preview.origin.provenance).toBe("file:risks.csv");
    expect(primaryUnchanged()).toBe(true);
  });

  test("maps an unmapped column to a Project custom field when one exists", async () => {
    const { importer } = setup({
      accountId: ACCOUNT,
      customFieldNames: ["Owner"],
    });

    const preview = await importer.preview(
      ACCOUNT,
      request({
        catalogType: "Task",
        content: "title,Owner\nA,Mert",
        fileName: "tasks.csv",
      }),
      NOW,
    );

    expect(preview.mapping[1]).toMatchObject({ target: "custom:Owner" });
    expect(preview.losses).toEqual([]);
  });

  test("applies a founder mapping override and refuses an impossible one", async () => {
    const { importer } = setup();
    const content = "Heading,Text\nA,B";

    const preview = await importer.preview(
      ACCOUNT,
      request({
        catalogType: "Decision",
        content,
        fileName: "d.csv",
        mapping: { Heading: "title", Text: "rationale" },
      }),
      NOW,
    );
    expect(preview.counts.invalid).toBe(0);

    const code = await refusal(
      importer.preview(
        ACCOUNT,
        request({
          catalogType: "Decision",
          content,
          fileName: "d.csv",
          mapping: { Heading: "nonsense" },
        }),
        NOW,
      ),
    );
    expect(code).toBe("invalid-mapping");
  });

  test("previews update existing, skip and resolve conflict for an exact living origin match", async () => {
    const { importer } = setup({
      accountId: ACCOUNT,
      origins: {
        "ext-1": { recordId: "r-9", state: "living", title: "Slip risk" },
        "ext-2": { state: "retired" },
      },
    });
    const csv = "title,id\nSlip risk,ext-1\nNew name,ext-2\nPlain,ext-3";

    const preview = await importer.preview(
      ACCOUNT,
      request({
        catalogType: "Risk",
        content: csv,
        rowChoices: { "1": "skip" },
      }),
      NOW,
    );

    expect(preview.rows[0]).toMatchObject({
      action: "update existing",
      choice: "skip",
      choices: ["update existing", "skip", "resolve conflict"],
    });
    expect(preview.rows[1]).toMatchObject({
      action: "create",
      newIdentity: { previousOrigin: "ext-2", reason: "retired" },
    });
    expect(preview.rows[2]?.newIdentity).toBeUndefined();
    expect(preview.counts).toMatchObject({
      create: 2,
      skip: 1,
      updateExisting: 0,
    });
  });

  test("states the limit and guesses no match when the source has no origin key", async () => {
    const { importer } = setup();

    const preview = await importer.preview(
      ACCOUNT,
      request({ catalogType: "Risk", content: "title\nA\nB" }),
      NOW,
    );

    expect(preview.origin.column).toBeNull();
    expect(preview.origin.note).toContain("no stable origin key");
    expect(preview.rows.every((row) => row.action === "create")).toBe(true);
  });

  test("flags a duplicate origin key inside the file as invalid", async () => {
    const { importer } = setup();

    const preview = await importer.preview(
      ACCOUNT,
      request({ catalogType: "Risk", content: "title,id\nA,k\nB,k" }),
      NOW,
    );

    expect(preview.counts).toMatchObject({ create: 1, invalid: 1 });
  });

  test("reads a JSON catalog wrapper and flags nested values as flattened", async () => {
    const { importer } = setup();

    const preview = await importer.preview(
      ACCOUNT,
      request({
        content: JSON.stringify({
          provider: "linear",
          records: [{ labels: ["a", "b"], title: "One" }],
          schema: "cantiara.records/1",
          type: "Bug",
        }),
        fileName: "bugs.json",
      }),
      NOW,
    );

    expect(preview.catalogType).toBe("Bug");
    expect(preview.losses.map((loss) => loss.kind)).toContain(
      "nested value flattened",
    );
  });
});

describe("Standard Import limits and forbidden families", () => {
  test.each([
    [
      "a ZIP archive",
      { content: "PK\u0003\u0004data", fileName: "all.zip" },
      "unsupported-package",
    ],
    ["a folder", { content: "x", fileName: "docs/" }, "unsupported-package"],
    [
      "a multi-file selection",
      { content: "# A", fileCount: 3, fileName: "a.md" },
      "multi-file",
    ],
    [
      "a DDL file",
      { content: "create table a();", fileName: "schema.sql" },
      "unsupported-format",
    ],
    [
      "a DBML file",
      { content: "Table a {}", fileName: "schema.dbml" },
      "unsupported-format",
    ],
    [
      "a Draw.io file",
      { content: "<mxfile/>", fileName: "flow.drawio" },
      "unsupported-format",
    ],
    ["an empty file", { content: "  ", fileName: "a.md" }, "empty-file"],
    [
      "CSV without a type",
      { content: "title\nA", fileName: "a.csv" },
      "catalog-type-required",
    ],
    ["invalid JSON", { content: "{", fileName: "a.json" }, "invalid-file"],
  ] as const)("refuses %s without writing", async (_name, overrides, code) => {
    const { importer, primaryUnchanged, staged } = setup();

    expect(
      await refusal(importer.preview(ACCOUNT, request(overrides), NOW)),
    ).toBe(code);
    expect(staged.size).toBe(0);
    expect(primaryUnchanged()).toBe(true);
  });

  test("refuses more than 10,000 rows and more than 25 MB", async () => {
    const { importer, staged } = setup();
    const rows = Array.from(
      { length: IMPORT_MAX_ROWS + 1 },
      (_, index) => `r${index}`,
    );

    expect(
      await refusal(
        importer.preview(
          ACCOUNT,
          request({
            catalogType: "Task",
            content: `title\n${rows.join("\n")}`,
          }),
          NOW,
        ),
      ),
    ).toBe("too-many-rows");
    expect(
      await refusal(
        importer.preview(
          ACCOUNT,
          request({
            catalogType: "Task",
            content: `title\n${"x".repeat(IMPORT_MAX_BYTES + 1)}`,
          }),
          NOW,
        ),
      ),
    ).toBe("too-large");
    expect(staged.size).toBe(0);
  });

  test("accepts exactly 10,000 rows", async () => {
    const { importer } = setup();
    const rows = Array.from(
      { length: IMPORT_MAX_ROWS },
      (_, index) => `r${index}`,
    );

    const preview = await importer.preview(
      ACCOUNT,
      request({ catalogType: "Task", content: `title\n${rows.join("\n")}` }),
      NOW,
    );

    expect(preview.counts.total).toBe(IMPORT_MAX_ROWS);
    expect(preview.rowsTruncated).toBe(true);
    expect(preview.rows).toHaveLength(50);
  });

  test.each([
    [
      "a Technical Diagram",
      { schema: "cantiara.technical-diagram/1", title: "x" },
      "out-of-catalog",
    ],
    ["a Screen", { schema: "cantiara.screen/1", title: "x" }, "out-of-catalog"],
    [
      "a Moodboard",
      { schema: "cantiara.moodboard/1", title: "x" },
      "out-of-catalog",
    ],
    [
      "a Starter Configuration",
      { schema: "cantiara.starter-configuration/1" },
      "out-of-catalog",
    ],
    [
      "a test-report envelope",
      { results: [], schemaVersion: "test-report/1" },
      "test-report-envelope",
    ],
    [
      "an unknown family",
      { schema: "other.thing/1" },
      "unknown-schema-version",
    ],
  ] as const)(
    "refuses %s as a creation candidate",
    async (_name, body, code) => {
      const { importer, staged } = setup();

      expect(
        await refusal(
          importer.preview(
            ACCOUNT,
            request({ content: JSON.stringify(body), fileName: "x.json" }),
            NOW,
          ),
        ),
      ).toBe(code);
      expect(staged.size).toBe(0);
    },
  );

  test("hands a test-report Markdown file to test report acceptance", async () => {
    const { importer } = setup();

    expect(
      await refusal(
        importer.preview(
          ACCOUNT,
          request({
            content: "---\nschemaVersion: test-report/1\n---\n# Report",
            fileName: "report.md",
          }),
          NOW,
        ),
      ),
    ).toBe("test-report-envelope");
  });

  test("refuses a GitHub source of truth", async () => {
    const { importer } = setup();

    expect(
      await refusal(
        importer.preview(
          ACCOUNT,
          request({
            catalogType: "Task",
            content: JSON.stringify({
              provider: "github",
              records: [{ title: "x" }],
            }),
            fileName: "gh.json",
          }),
          NOW,
        ),
      ),
    ).toBe("out-of-catalog");
  });

  test("refuses scope mismatches", async () => {
    const { importer } = setup();

    expect(
      await refusal(
        importer.preview(
          ACCOUNT,
          request({
            catalogType: "Task",
            content: "title\nA",
            scope: { kind: "wiki" },
          }),
          NOW,
        ),
      ),
    ).toBe("scope-mismatch");
    expect(
      await refusal(
        importer.preview(
          ACCOUNT,
          request({
            catalogType: "Task",
            content: "title\nA",
            scope: { kind: "workspace" },
          }),
          NOW,
        ),
      ),
    ).toBe("scope-mismatch");
    expect(
      await refusal(
        importer.preview(
          ACCOUNT,
          request({
            content: "# A",
            fileName: "a.md",
            scope: { kind: "workspace" },
          }),
          NOW,
        ),
      ),
    ).toBe("scope-mismatch");
  });

  test("allows Contact into the Workspace scope", async () => {
    const { importer } = setup();

    const preview = await importer.preview(
      ACCOUNT,
      request({
        catalogType: "Contact",
        content: "name,email\nAda,a@x.io",
        fileName: "people.csv",
        scope: { kind: "workspace" },
      }),
      NOW,
    );

    expect(preview.scope.kind).toBe("workspace");
  });

  test("rejects a scope the account does not own", async () => {
    const { importer } = setup();

    await expect(
      importer.preview(
        "stranger",
        request({ catalogType: "Task", content: "title\nA" }),
        NOW,
      ),
    ).rejects.toBeInstanceOf(ImportScopeNotFoundError);
  });
});

describe("Standard Import staging", () => {
  test("keeps the file encrypted for at most 24 hours and reopens the same preview", async () => {
    const { importer, staged } = setup();
    const secret = "Confidential rollout plan";

    const preview = await importer.preview(
      ACCOUNT,
      request({ catalogType: "Task", content: `title\n${secret}` }),
      NOW,
    );

    const [row] = [...staged.values()];
    expect(JSON.stringify(row)).not.toContain(secret);
    expect(row?.expiresAt.getTime()).toBe(
      NOW.getTime() + IMPORT_STAGING_TTL_MS,
    );
    expect(preview.expiresAt).toBe(row?.expiresAt.toISOString());

    const reopened = await importer.reopen(
      ACCOUNT,
      { stagingId: preview.stagingId },
      new Date(NOW.getTime() + 60_000),
    );
    expect(reopened).toEqual(preview);
  });

  test("a stranger or an expired staging id is gone and expired rows are purged", async () => {
    const { importer, staged } = setup();
    const preview = await importer.preview(
      ACCOUNT,
      request({ catalogType: "Task", content: "title\nA" }),
      NOW,
    );

    await expect(
      importer.reopen("stranger", { stagingId: preview.stagingId }, NOW),
    ).rejects.toBeInstanceOf(ImportStagingExpiredError);
    await expect(
      importer.reopen(
        ACCOUNT,
        { stagingId: preview.stagingId },
        new Date(NOW.getTime() + IMPORT_STAGING_TTL_MS),
      ),
    ).rejects.toBeInstanceOf(ImportStagingExpiredError);

    await importer.preview(
      ACCOUNT,
      request({ catalogType: "Task", content: "title\nB" }),
      new Date(NOW.getTime() + IMPORT_STAGING_TTL_MS + 1),
    );
    expect(staged.size).toBe(1);
  });
});

describe("Standard Import CSV export escape", () => {
  const csv = (marker: boolean) =>
    `${marker ? "# cantiara-export: csv/1\n" : ""}Title,Description,ID\n'=SUM(A1),'hello,e-1`;

  test("removes the escape only when the file proves it is this product's export", async () => {
    const { importer } = setup({ accountId: ACCOUNT });
    const proven = await importer.preview(
      ACCOUNT,
      request({ catalogType: "Task", content: csv(true) }),
      NOW,
    );
    expect(proven.rows[0]?.values).toMatchObject({
      description: "'hello",
      title: "=SUM(A1)",
    });
    expect(proven.losses.map((loss) => loss.kind)).toContain(
      "spreadsheet escape removed",
    );

    const plain = await importer.preview(
      ACCOUNT,
      request({ catalogType: "Task", content: csv(false) }),
      NOW,
    );
    expect(plain.rows[0]?.values).toMatchObject({
      description: "'hello",
      title: "'=SUM(A1)",
    });
    expect(plain.losses.map((loss) => loss.kind)).not.toContain(
      "spreadsheet escape removed",
    );
  });
});
