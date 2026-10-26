import type { MigrationArtifact } from "@cantiara/api/schema-migration-artifact";
import type {
  DisposableDatabase,
  DisposableDatabasePort,
} from "@cantiara/api/schema-static-validation";
import type { TechnicalDiagramVersion } from "@cantiara/api/technical-diagram-version";
import { describe, expect, test } from "vitest";
import { createSchemaArtifacts } from "../schema-artifacts";
import type { MigrationArtifactStore } from "../schema-artifacts-database";

const column = (id: string, name: string, extra: object = {}) => ({
  default: null,
  id,
  name,
  nullable: false,
  primaryKey: false,
  type: "integer",
  unique: false,
  ...extra,
});

const version = (overrides: Partial<TechnicalDiagramVersion> = {}) =>
  ({
    authorityMode: "Product-authored Model",
    createdAt: "2026-10-22T08:00:00.000Z",
    diagramId: "diagram-1",
    id: "version-1",
    model: {
      relations: [],
      tables: [
        {
          columns: [column("c", "id", { primaryKey: true })],
          id: "t",
          indexes: [],
          name: "accounts",
        },
      ],
    },
    name: "Founding schema",
    number: 1,
    revision: 4,
    type: "Data Model",
    ...overrides,
  }) as TechnicalDiagramVersion;

function recordingPort(options: { fail?: boolean; destroyed?: boolean } = {}) {
  const events: string[] = [];
  const port: DisposableDatabasePort = {
    run: async (config, work) => {
      events.push(`create:${config.postgresMajor}:${config.extensions.join()}`);
      const database: DisposableDatabase = {
        execute: (sql) => {
          events.push(`apply:${sql.split("\n")[0]}`);
          return options.fail
            ? Promise.reject(new Error('syntax error at or near "BOOM"'))
            : Promise.resolve();
        },
      };
      try {
        const value = await work(database);
        return { destroyed: options.destroyed ?? true, value };
      } finally {
        events.push("destroy");
      }
    },
  };
  return { events, port };
}

const ddlAccess = (
  port: DisposableDatabasePort | undefined,
  model = version(),
) =>
  createSchemaArtifacts({
    validator: port,
    versions: { getVersion: () => Promise.resolve(model) },
  });

const APPLY_SURFACE =
  /apply|run|execute|connect|credential|migrate|applied|introspect/i;

describe("PostgreSQL DDL preview", () => {
  test("is Statically Validated only after a new disposable database applied it and was destroyed", async () => {
    const { events, port } = recordingPort();
    const preview = await ddlAccess(port).previewDdl("a", {
      versionId: "version-1",
    });
    expect(preview?.status).toBe("Ready");
    if (preview?.status !== "Ready") {
      return;
    }
    expect(preview.validation).toMatchObject({
      disposableDestroyed: true,
      extensions: [],
      label: "Statically Validated",
      ok: true,
      postgresMajor: 17,
    });
    expect(events).toEqual([
      "create:17:pg_trgm",
      "apply:CREATE TABLE accounts (",
      "destroy",
    ]);
    expect(preview.export?.filename).toBe("founding-schema-v1-ddl.sql");
    expect(preview.export?.manifest).toMatchObject({
      generatorVersion: "schema-ddl@1",
      kind: "PostgreSQL DDL",
      versions: [{ number: 1, versionId: "version-1" }],
    });
  });

  test("never labels or exports SQL when the disposable apply fails", async () => {
    const preview = await ddlAccess(
      recordingPort({ fail: true }).port,
    ).previewDdl("a", { versionId: "version-1" });
    expect(preview).toMatchObject({
      export: null,
      status: "Ready",
      validation: { ok: false, stage: "Disposable parse and apply" },
    });
  });

  test("is not validated when the database cannot be proven destroyed or is not configured", async () => {
    const previews = await Promise.all(
      [recordingPort({ destroyed: false }).port, undefined].map((port) =>
        ddlAccess(port).previewDdl("a", { versionId: "version-1" }),
      ),
    );
    for (const preview of previews) {
      expect(preview).toMatchObject({
        export: null,
        validation: { ok: false },
      });
    }
  });

  test("blocks all SQL, copy and export when an invariant fails", async () => {
    const { events, port } = recordingPort();
    const broken = version({
      model: {
        relations: [],
        tables: [
          {
            columns: [column("c", "id")],
            id: "t",
            indexes: [],
            name: "orders",
          },
        ],
      },
    } as Partial<TechnicalDiagramVersion>);
    const preview = await ddlAccess(port, broken).previewDdl("a", {
      versionId: "version-1",
    });
    expect(preview).toMatchObject({
      status: "Blocked",
      violations: [{ invariant: "Primary key present", path: "tables.orders" }],
    });
    expect(preview && "sql" in preview).toBe(false);
    expect(preview && "export" in preview).toBe(false);
    expect(events).toEqual([]);
  });

  test("accepts only Data Model versions and exposes no credential or apply surface", async () => {
    const other = version({
      type: "Technical Architecture",
    } as Partial<TechnicalDiagramVersion>);
    expect(
      await ddlAccess(undefined, other).previewDdl("a", {
        versionId: "version-1",
      }),
    ).toBeNull();
    expect(
      Object.keys(ddlAccess(undefined)).filter((name) =>
        APPLY_SURFACE.test(name),
      ),
    ).toEqual([]);
  });
});

const tableModel = (columns: ReturnType<typeof column>[]) =>
  ({
    relations: [],
    tables: [{ columns, id: "t", indexes: [], name: "accounts" }],
  }) as TechnicalDiagramVersion["model"];

const pair = (
  sourceColumns: ReturnType<typeof column>[],
  targetColumns: ReturnType<typeof column>[],
) => {
  const versions = {
    "version-1": version({ model: tableModel(sourceColumns) }),
    "version-2": version({
      id: "version-2",
      model: tableModel(targetColumns),
      name: "Next",
      number: 2,
    }),
  } as Record<string, TechnicalDiagramVersion>;
  return (port: DisposableDatabasePort | undefined) =>
    createSchemaArtifacts({
      validator: port,
      versions: {
        getVersion: (_account, id) => Promise.resolve(versions[id] ?? null),
      },
    });
};

const idColumn = column("c", "id", { primaryKey: true });
const input = (editedUpSql: string | null = null) => ({
  editedUpSql,
  sourceVersionId: "version-1",
  targetVersionId: "version-2",
});

describe("Schema Change Draft preview", () => {
  test("validates source DDL then Up in one disposable database and pins both versions", async () => {
    const { events, port } = recordingPort();
    const preview = await pair(
      [idColumn],
      [idColumn, column("n", "note", { nullable: true, type: "text" })],
    )(port).previewChange("a", input());
    expect(preview).toMatchObject({
      confirmable: true,
      requiresDestructiveConfirmation: false,
      source: { number: 1 },
      status: "Ready",
      target: { number: 2 },
      upSql: "ALTER TABLE accounts ADD COLUMN note text;\n",
    });
    const validation = preview?.status === "Ready" ? preview.validation : null;
    if (!validation?.ok) {
      throw new Error("the draft should validate without extensions");
    }
    expect(validation.extensions).toEqual([]);
    expect(events).toEqual([
      "create:17:pg_trgm",
      "apply:CREATE TABLE accounts (",
      "apply:ALTER TABLE accounts ADD COLUMN note text;",
      "destroy",
    ]);
  });

  test("keeps destructive operations visible and demands extra confirmation", async () => {
    const preview = await pair(
      [idColumn, column("n", "legacy", { type: "text" })],
      [idColumn],
    )(recordingPort().port).previewChange("a", input());
    expect(preview).toMatchObject({
      destructiveOperationIds: ["Drop column:tables.accounts.columns.legacy"],
      requiresDestructiveConfirmation: true,
    });
  });

  test("shows the edit apart from the generator output and re-validates it", async () => {
    const { events, port } = recordingPort();
    const edited = "ALTER TABLE accounts ADD COLUMN note varchar(10);\n";
    const preview = await pair(
      [idColumn],
      [idColumn, column("n", "note", { nullable: true, type: "text" })],
    )(port).previewChange("a", input(edited));
    expect(preview).toMatchObject({
      confirmable: true,
      edit: { diff: { changed: true }, issues: [] },
      generatedUpSql: "ALTER TABLE accounts ADD COLUMN note text;\n",
      upSql: edited,
    });
    expect(events).toContain(
      "apply:ALTER TABLE accounts ADD COLUMN note varchar(10);",
    );
  });

  test("rejects data SQL in an edit before anything reaches the database", async () => {
    const { events, port } = recordingPort();
    const preview = await pair(
      [idColumn],
      [idColumn, column("n", "note", { nullable: true, type: "text" })],
    )(port).previewChange("a", input("UPDATE accounts SET id = 1;"));
    expect(preview).toMatchObject({
      confirmable: false,
      confirmBlockedBy: "The edited Up text leaves the operation catalog.",
      validation: null,
    });
    expect(events).toEqual([]);
  });

  test("an inexpressible difference blocks by named element with no SQL", async () => {
    const preview = await pair(
      [idColumn],
      [column("c", "id", { primaryKey: true, type: "text" })],
    )(recordingPort().port).previewChange("a", input());
    expect(preview).toMatchObject({
      blockers: [
        {
          operation: "Free type conversion",
          path: "tables.accounts.columns.id",
        },
      ],
      status: "Blocked",
    });
    expect(preview && "upSql" in preview).toBe(false);
  });

  test("needs two different versions of one diagram", async () => {
    const drafts = pair([idColumn], [idColumn])(undefined);
    await expect(
      drafts.previewChange("a", { ...input(), targetVersionId: "version-1" }),
    ).rejects.toThrow("two different Diagram Versions");
  });
});

const HEX_DIGEST = /^[0-9a-f]{64}$/;
const STATE_KEY = /appl|status|checked|ran|production/i;
const KEY_A = "11111111-1111-4111-8111-111111111111";
const KEY_B = "22222222-2222-4222-8222-222222222222";
const KEY_C = "33333333-3333-4333-8333-333333333333";

const versionMigrationArtifact = (
  id: string,
  number: number,
  columns: object[],
) =>
  ({
    authorityMode: "Product-authored Model",
    createdAt: "2026-10-22T08:00:00.000Z",
    diagramId: "diagram-1",
    id,
    model: {
      relations: [],
      tables: [{ columns, id: "t", indexes: [], name: "accounts" }],
    },
    name: `V${number}`,
    number,
    revision: number,
    type: "Data Model",
  }) as unknown as TechnicalDiagramVersion;

function memoryStore() {
  const rows: Array<{ artifact: MigrationArtifact; key: string }> = [];
  const store: MigrationArtifactStore = {
    find: (_account, id) =>
      Promise.resolve(
        rows.find(({ artifact }) => artifact.id === id)?.artifact ?? null,
      ),
    findByKey: (_account, key) =>
      Promise.resolve(rows.find((row) => row.key === key)?.artifact ?? null),
    insert: (_account, key, artifact) => {
      rows.push({ artifact, key });
      return Promise.resolve(artifact);
    },
    list: () => Promise.resolve(rows.map(({ artifact }) => artifact)),
  };
  return { rows, store };
}

const okPort: DisposableDatabasePort = {
  run: async (_options, work) => ({
    destroyed: true,
    value: await work({ execute: () => Promise.resolve() }),
  }),
};

function setup(versions: TechnicalDiagramVersion[], port = okPort) {
  const { rows, store } = memoryStore();
  const ids = (function* generate() {
    for (let next = 1; ; next += 1) {
      yield `artifact-${next}`;
    }
  })();
  const access = createSchemaArtifacts({
    newId: () => ids.next().value as string,
    now: () => new Date("2026-10-22T09:00:00.000Z"),
    store,
    validator: port,
    versions: {
      getVersion: (_account, id) =>
        Promise.resolve(versions.find((entry) => entry.id === id) ?? null),
    },
  });
  return { access, rows };
}

const confirm = (key: string, extra: object = {}) => ({
  clientIdempotencyKey: key,
  confirmedDestructiveOperationIds: [],
  editedUpSql: null,
  sourceVersionId: "v1",
  supersedes: null,
  targetVersionId: "v2",
  ...extra,
});

const add = [idColumn, column("n", "note", { nullable: true, type: "text" })];

describe("Migration Artifact", () => {
  test("binds both versions, validation, plan and a digest over exact Up and Down bytes", async () => {
    const { access } = setup([
      versionMigrationArtifact("v1", 1, [idColumn]),
      versionMigrationArtifact("v2", 2, add),
    ]);
    const artifact = await access.confirmArtifact("a", confirm(KEY_A));
    expect(artifact).toMatchObject({
      diagramId: "diagram-1",
      downSql: "ALTER TABLE accounts DROP COLUMN note;\n",
      generatorVersion: "schema-ddl@1",
      source: { number: 1, versionId: "v1" },
      staticValidation: { label: "Statically Validated", ok: true },
      supersedes: null,
      target: { number: 2, versionId: "v2" },
      upSql: "ALTER TABLE accounts ADD COLUMN note text;\n",
    });
    expect(artifact?.digest).toMatch(HEX_DIGEST);
    expect(artifact?.operations).toEqual([
      expect.objectContaining({ operation: "Add column" }),
    ]);
  });

  test("has no applied, status or checkbox state", async () => {
    const { access } = setup([
      versionMigrationArtifact("v1", 1, [idColumn]),
      versionMigrationArtifact("v2", 2, add),
    ]);
    const artifact = await access.confirmArtifact("a", confirm(KEY_A));
    expect(
      Object.keys(artifact ?? {}).filter((key) => STATE_KEY.test(key)),
    ).toEqual([]);
  });

  test("is idempotent by key and never rewritten", async () => {
    const { access, rows } = setup([
      versionMigrationArtifact("v1", 1, [idColumn]),
      versionMigrationArtifact("v2", 2, add),
    ]);
    const first = await access.confirmArtifact("a", confirm(KEY_A));
    const again = await access.confirmArtifact("a", confirm(KEY_A));
    expect(again).toBe(first);
    expect(rows).toHaveLength(1);
  });

  test("a destructive set needs exact extra confirmation and yields no Down", async () => {
    const { access } = setup([
      versionMigrationArtifact("v1", 1, [
        idColumn,
        column("x", "legacy", { type: "text" }),
      ]),
      versionMigrationArtifact("v2", 2, [idColumn]),
    ]);
    await expect(access.confirmArtifact("a", confirm(KEY_A))).rejects.toThrow(
      "Confirm every potentially destructive operation",
    );
    const artifact = await access.confirmArtifact(
      "a",
      confirm(KEY_A, {
        confirmedDestructiveOperationIds: [
          "Drop column:tables.accounts.columns.legacy",
        ],
      }),
    );
    expect(artifact?.downSql).toBeNull();
    expect(artifact?.warningManifest.down).toMatchObject({
      label: "Safe Down could not be produced",
      blockers: [
        { operation: "Drop column", path: "tables.accounts.columns.legacy" },
      ],
    });
  });

  test("an edited Up keeps its diff and drops Down", async () => {
    const { access } = setup([
      versionMigrationArtifact("v1", 1, [idColumn]),
      versionMigrationArtifact("v2", 2, add),
    ]);
    const artifact = await access.confirmArtifact(
      "a",
      confirm(KEY_A, {
        editedUpSql: "ALTER TABLE accounts ADD COLUMN note varchar(5);\n",
      }),
    );
    expect(artifact?.editDiff.changed).toBe(true);
    expect(artifact?.downSql).toBeNull();
    await expect(
      access.confirmArtifact(
        "a",
        confirm(KEY_B, { editedUpSql: "DELETE FROM accounts;" }),
      ),
    ).rejects.toThrow("leaves the operation catalog");
  });

  test("an empty edited Up cannot become an artifact", async () => {
    const { access, rows } = setup([
      versionMigrationArtifact("v1", 1, [idColumn]),
      versionMigrationArtifact("v2", 2, add),
    ]);
    await expect(
      access.confirmArtifact("a", confirm(KEY_A, { editedUpSql: "" })),
    ).rejects.toThrow("The two Diagram Versions have no schema difference.");
    expect(rows).toHaveLength(0);
  });

  test("does not mint without a passing disposable validation", async () => {
    const failing: DisposableDatabasePort = {
      run: () => Promise.reject(new Error("syntax error")),
    };
    const { access, rows } = setup(
      [
        versionMigrationArtifact("v1", 1, [idColumn]),
        versionMigrationArtifact("v2", 2, add),
      ],
      failing,
    );
    await expect(access.confirmArtifact("a", confirm(KEY_A))).rejects.toThrow(
      "Not Statically Validated",
    );
    expect(rows).toHaveLength(0);
  });

  test("a correction supersedes without deleting or rewriting the old artifact", async () => {
    const { access, rows } = setup([
      versionMigrationArtifact("v1", 1, [idColumn]),
      versionMigrationArtifact("v2", 2, add),
    ]);
    const first = await access.confirmArtifact("a", confirm(KEY_A));
    const second = await access.confirmArtifact(
      "a",
      confirm(KEY_B, { supersedes: first?.id }),
    );
    expect(second?.supersedes).toBe(first?.id);
    expect(second?.id).not.toBe(first?.id);
    expect(rows.map(({ artifact }) => artifact.id)).toEqual([
      first?.id,
      second?.id,
    ]);
    expect(rows[0]?.artifact).toBe(first);
    await expect(
      access.confirmArtifact("a", confirm(KEY_C, { supersedes: "missing" })),
    ).rejects.toThrow("Supersedes Migration Artifact");
  });

  test("exports Up and manifest without running anything", async () => {
    const { access } = setup([
      versionMigrationArtifact("v1", 1, [idColumn]),
      versionMigrationArtifact("v2", 2, add),
    ]);
    const artifact = await access.confirmArtifact("a", confirm(KEY_A));
    const exported = await access.exportArtifact("a", artifact?.id ?? "");
    expect(exported?.files.map(({ filename }) => filename)).toEqual([
      "v2-v2-up.sql",
      "v2-v2-down.sql",
    ]);
    expect(exported?.files[0]?.manifest).toMatchObject({
      digest: artifact?.digest,
    });
  });
});
