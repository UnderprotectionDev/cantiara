import type {
  DisposableDatabase,
  DisposableDatabasePort,
} from "@cantiara/api/schema-static-validation";
import type { TechnicalDiagramVersion } from "@cantiara/api/technical-diagram-version";
import { describe, expect, test } from "vitest";

import { createSchemaArtifacts } from "../schema-artifacts";

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
