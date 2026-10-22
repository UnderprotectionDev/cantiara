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

const access = (port: DisposableDatabasePort | undefined, model = version()) =>
  createSchemaArtifacts({
    validator: port,
    versions: { getVersion: () => Promise.resolve(model) },
  });

describe("PostgreSQL DDL preview", () => {
  test("is Statically Validated only after a new disposable database applied it and was destroyed", async () => {
    const { events, port } = recordingPort();
    const preview = await access(port).previewDdl("a", {
      versionId: "version-1",
    });
    expect(preview?.status).toBe("Ready");
    if (preview?.status !== "Ready") {
      return;
    }
    expect(preview.validation).toMatchObject({
      disposableDestroyed: true,
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
    const preview = await access(recordingPort({ fail: true }).port).previewDdl(
      "a",
      { versionId: "version-1" },
    );
    expect(preview).toMatchObject({
      export: null,
      status: "Ready",
      validation: { ok: false, stage: "Disposable parse and apply" },
    });
  });

  test("is not validated when the database cannot be proven destroyed or is not configured", async () => {
    const previews = await Promise.all(
      [recordingPort({ destroyed: false }).port, undefined].map((port) =>
        access(port).previewDdl("a", { versionId: "version-1" }),
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
    const preview = await access(port, broken).previewDdl("a", {
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
      await access(undefined, other).previewDdl("a", {
        versionId: "version-1",
      }),
    ).toBeNull();
    expect(Object.keys(access(undefined))).toEqual(["previewDdl"]);
  });
});
