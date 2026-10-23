import type { MigrationArtifact } from "@cantiara/api/schema-migration-artifact";
import type { DisposableDatabasePort } from "@cantiara/api/schema-static-validation";
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
const idColumn = column("c", "id", { primaryKey: true });
const HEX_DIGEST = /^[0-9a-f]{64}$/;
const STATE_KEY = /appl|status|checked|ran|production/i;
const KEY_A = "11111111-1111-4111-8111-111111111111";
const KEY_B = "22222222-2222-4222-8222-222222222222";
const KEY_C = "33333333-3333-4333-8333-333333333333";

const version = (id: string, number: number, columns: object[]) =>
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
      version("v1", 1, [idColumn]),
      version("v2", 2, add),
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
      version("v1", 1, [idColumn]),
      version("v2", 2, add),
    ]);
    const artifact = await access.confirmArtifact("a", confirm(KEY_A));
    expect(
      Object.keys(artifact ?? {}).filter((key) => STATE_KEY.test(key)),
    ).toEqual([]);
  });

  test("is idempotent by key and never rewritten", async () => {
    const { access, rows } = setup([
      version("v1", 1, [idColumn]),
      version("v2", 2, add),
    ]);
    const first = await access.confirmArtifact("a", confirm(KEY_A));
    const again = await access.confirmArtifact("a", confirm(KEY_A));
    expect(again).toBe(first);
    expect(rows).toHaveLength(1);
  });

  test("a destructive set needs exact extra confirmation and yields no Down", async () => {
    const { access } = setup([
      version("v1", 1, [idColumn, column("x", "legacy", { type: "text" })]),
      version("v2", 2, [idColumn]),
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
      version("v1", 1, [idColumn]),
      version("v2", 2, add),
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
      version("v1", 1, [idColumn]),
      version("v2", 2, add),
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
      [version("v1", 1, [idColumn]), version("v2", 2, add)],
      failing,
    );
    await expect(access.confirmArtifact("a", confirm(KEY_A))).rejects.toThrow(
      "Not Statically Validated",
    );
    expect(rows).toHaveLength(0);
  });

  test("a correction supersedes without deleting or rewriting the old artifact", async () => {
    const { access, rows } = setup([
      version("v1", 1, [idColumn]),
      version("v2", 2, add),
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
      version("v1", 1, [idColumn]),
      version("v2", 2, add),
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
