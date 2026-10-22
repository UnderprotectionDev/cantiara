import { describe, expect, test } from "vitest";

import { buildSchemaChangeDraft } from "./schema-change-draft";
import {
  type SchemaDefinition,
  schemaDefinitionSchema,
} from "./schema-definition";
import {
  exportMigrationArtifact,
  type MigrationArtifact,
  migrationArtifactDigest,
} from "./schema-migration-artifact";
import { buildSafeDown } from "./schema-safe-down";

const HEX_DIGEST = /^[0-9a-f]{64}$/;
const APPLIED = /appl(y|ied)/i;

const col = (
  id: string,
  name: string,
  extra: Record<string, unknown> = {},
) => ({
  id,
  name,
  nullable: false,
  type: "integer",
  ...extra,
});
const schema = (columns: ReturnType<typeof col>[]): SchemaDefinition =>
  schemaDefinitionSchema.parse({
    tables: [
      {
        columns,
        id: "t",
        name: "t",
        primaryKey: { columnIds: ["id"] },
      },
    ],
  });

const base = [col("id", "id")];

describe("Safe Down", () => {
  test("is the exact reverse of a fully reversible set", () => {
    const draft = buildSchemaChangeDraft(
      schema(base),
      schema([
        ...base,
        col("a", "a", { nullable: true }),
        col("b", "b", { default: "0" }),
      ]),
    );
    const down = buildSafeDown(draft, { edited: false });
    expect(down).toEqual({
      sql: "ALTER TABLE t DROP COLUMN b;\nALTER TABLE t DROP COLUMN a;\n",
      status: "Produced",
    });
  });

  test("one ineligible operation drops the whole inverse and names it", () => {
    const draft = buildSchemaChangeDraft(
      schema([...base, col("x", "x", { nullable: true })]),
      schema([...base, col("a", "a", { nullable: true })]),
    );
    const down = buildSafeDown(draft, { edited: false });
    expect(down.status).toBe("Unavailable");
    if (down.status === "Unavailable") {
      expect(down.label).toBe("Safe Down could not be produced");
      expect(down.blockers).toEqual([
        expect.objectContaining({
          operation: "Drop column",
          path: "tables.t.columns.x",
        }),
      ]);
    }
    expect(JSON.stringify(down)).not.toContain("DROP COLUMN a");
  });

  test("an enum value add and an edited Up text are not provably reversible", () => {
    const withEnum = (labels: string[]) =>
      schemaDefinitionSchema.parse({
        enums: [
          {
            id: "e",
            labels: labels.map((value) => ({ id: value, value })),
            name: "k",
          },
        ],
        tables: [
          {
            columns: [col("id", "id")],
            id: "t",
            name: "t",
            primaryKey: { columnIds: ["id"] },
          },
        ],
      });
    const enumDraft = buildSchemaChangeDraft(
      withEnum(["a"]),
      withEnum(["a", "b"]),
    );
    expect(buildSafeDown(enumDraft, { edited: false }).status).toBe(
      "Unavailable",
    );
    const plain = buildSchemaChangeDraft(
      schema(base),
      schema([...base, col("a", "a", { nullable: true })]),
    );
    const edited = buildSafeDown(plain, { edited: true });
    expect(edited).toMatchObject({
      blockers: [{ operation: "Edited Up SQL" }],
      status: "Unavailable",
    });
  });
});

describe("Migration Artifact Digest", () => {
  const parts = {
    downSql: "DROP TABLE a;\n",
    generatorVersion: "schema-ddl@1",
    operations: [
      {
        class: "Non-destructive" as const,
        id: "o1",
        operation: "Create table" as const,
        path: "tables.a",
      },
    ],
    sourceModelHash: "s",
    targetModelHash: "t",
    upSql: "CREATE TABLE a ();\n",
  };

  test("is stable for equal input and falls on a single byte", async () => {
    const digest = await migrationArtifactDigest(parts);
    expect(digest).toMatch(HEX_DIGEST);
    expect(await migrationArtifactDigest({ ...parts })).toBe(digest);
    expect(
      await migrationArtifactDigest({
        ...parts,
        upSql: "CREATE TABLE a ( );\n",
      }),
    ).not.toBe(digest);
    expect(await migrationArtifactDigest({ ...parts, downSql: null })).not.toBe(
      digest,
    );
  });

  test("falls on an operation difference even with identical SQL", async () => {
    const changed = {
      ...parts,
      operations: [
        {
          class: "Non-destructive" as const,
          id: "o1",
          operation: "Rename table" as const,
          path: "tables.a",
        },
      ],
    };
    expect(await migrationArtifactDigest(changed)).not.toBe(
      await migrationArtifactDigest(parts),
    );
  });
});

describe("artifact export", () => {
  const artifact = {
    createdAt: "2026-10-22T08:00:00.000Z",
    diagramId: "d",
    digest: "a".repeat(64),
    downSql: null,
    editDiff: { changed: false, parts: [] },
    generatorVersion: "schema-ddl@1",
    id: "art",
    operations: [],
    source: {
      diagramId: "d",
      modelHash: "s",
      name: "v1",
      number: 1,
      versionId: "v1",
    },
    staticValidation: {
      checks: [],
      disposableDestroyed: true,
      extensions: ["pg_trgm"],
      label: "Statically Validated",
      ok: true,
      postgresMajor: 17,
    },
    supersedes: "old",
    target: {
      diagramId: "d",
      modelHash: "t",
      name: "v2",
      number: 2,
      versionId: "v2",
    },
    upSql: "SELECT 1;\n",
    warningManifest: { confirmedDestructive: [], down: null, warnings: [] },
  } as unknown as MigrationArtifact;

  test("carries the manifest, has no Down file when absent and no applied state", () => {
    const exported = exportMigrationArtifact(artifact);
    expect(exported.files.map(({ filename }) => filename)).toEqual([
      "v2-v2-up.sql",
    ]);
    const manifest = exported.files[0]?.manifest;
    expect(manifest).toMatchObject({
      digest: artifact.digest,
      kind: "Migration Artifact",
      supersedes: "old",
    });
    expect(JSON.stringify(manifest)).not.toMatch(APPLIED);
  });
});
