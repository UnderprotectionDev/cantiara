import { expect, test } from "vitest";
import type { MigrationSnapshot } from "./migration-repository";
import {
  assertParallelSafeMigrations,
  parallelSafetyViolations,
} from "./parallel-safety";

type Table = MigrationSnapshot["tables"][string];

function table(name: string, overrides: Partial<Table> = {}): Table {
  return {
    name,
    schema: "",
    columns: {
      id: { name: "id", type: "text", primaryKey: true, notNull: true },
      kind: { name: "kind", type: "text", primaryKey: false, notNull: true },
      note: { name: "note", type: "text", primaryKey: false, notNull: false },
    },
    compositePrimaryKeys: {},
    foreignKeys: {},
    uniqueConstraints: {},
    checkConstraints: {
      record_kind_check: {
        name: "record_kind_check",
        value: `"record"."kind" in ('a', 'b')`,
      },
    },
    indexes: {},
    ...overrides,
  };
}

function snapshot(
  tables: Table[],
  enums: MigrationSnapshot["enums"] = {},
): MigrationSnapshot {
  return {
    dialect: "postgresql",
    enums,
    id: crypto.randomUUID(),
    prevId: crypto.randomUUID(),
    tables: Object.fromEntries(tables.map((t) => [`public.${t.name}`, t])),
    version: "7",
  };
}

const before = snapshot([table("record")]);

function changed(overrides: Partial<Table>, extra: Table[] = []) {
  return snapshot([table("record", overrides), ...extra]);
}

function withColumn(
  name: string,
  column: Partial<Table["columns"][string]> = {},
) {
  const base = table("record").columns;
  return {
    columns: {
      ...base,
      [name]: {
        name,
        type: "text",
        primaryKey: false,
        notNull: false,
        ...column,
      },
    },
  };
}

test("accepts expand-only changes that older code can keep writing through", () => {
  const after = changed(
    {
      ...withColumn("parent_id"),
      checkConstraints: {
        record_kind_check: {
          name: "record_kind_check",
          value: `"record"."kind" in ('a', 'b', 'c')`,
        },
      },
      foreignKeys: {
        record_parent_fk: {
          name: "record_parent_fk",
          tableTo: "record",
          columnsFrom: ["parent_id"],
          columnsTo: ["id"],
          onDelete: "set null",
        },
      },
      indexes: {
        record_kind_idx: {
          name: "record_kind_idx",
          isUnique: false,
          method: "btree",
          columns: [{ expression: "kind", asc: true, nulls: "last" }],
        },
      },
    },
    [table("fresh")],
  );
  const sql = [
    `ALTER TABLE "record" ADD COLUMN "parent_id" text;`,
    `ALTER TABLE "record" DROP CONSTRAINT "record_kind_check";`,
    `ALTER TABLE "record" ADD CONSTRAINT "record_kind_check" CHECK ("record"."kind" in ('a', 'b', 'c'));`,
    `CREATE TABLE "fresh" ("id" text PRIMARY KEY NOT NULL);`,
  ];
  expect(parallelSafetyViolations(before, after, sql)).toEqual([]);
  expect(
    parallelSafetyViolations(
      changed({
        checkConstraints: {
          record_kind_check: {
            name: "record_kind_check",
            value: `"record"."kind" = 'a'`,
          },
        },
      }),
      before,
      [],
    ),
  ).toEqual([]);
  expect(
    parallelSafetyViolations(
      before,
      changed(withColumn("status", { notNull: true, default: "'open'" })),
      [],
    ),
  ).toEqual([]);
});

test("rejects changes that break older code sharing the database", () => {
  const cases: [string, MigrationSnapshot][] = [
    ["Drops or renames table public.record", snapshot([table("other")])],
    [
      "Drops or renames column public.record.note",
      changed({
        columns: {
          id: table("record").columns.id,
          kind: table("record").columns.kind,
        },
      } as Partial<Table>),
    ],
    [
      "Changes the type of column public.record.note",
      changed(withColumn("note", { type: "jsonb" })),
    ],
    [
      "Makes column public.record.note required",
      changed(withColumn("note", { notNull: true, default: "''" })),
    ],
    [
      "Adds required column public.record.status without a default",
      changed(withColumn("status", { notNull: true })),
    ],
    [
      "Narrows or adds check constraint record_kind_check on public.record",
      changed({
        checkConstraints: {
          record_kind_check: {
            name: "record_kind_check",
            value: `"record"."kind" in ('a')`,
          },
        },
      }),
    ],
    [
      "Adds or changes foreign key record_note_fk on public.record",
      changed({
        foreignKeys: {
          record_note_fk: {
            name: "record_note_fk",
            tableTo: "other",
            columnsFrom: ["note"],
            columnsTo: ["id"],
          },
        },
      }),
    ],
    [
      "Adds or changes unique constraint record_kind_unique on public.record",
      changed({
        uniqueConstraints: {
          record_kind_unique: { name: "record_kind_unique", columns: ["kind"] },
        },
      }),
    ],
    [
      "Adds or changes unique index record_kind_idx on public.record",
      changed({
        indexes: {
          record_kind_idx: {
            name: "record_kind_idx",
            isUnique: true,
            method: "btree",
            columns: [{ expression: "kind", asc: true, nulls: "last" }],
          },
        },
      }),
    ],
  ];
  for (const [message, after] of cases) {
    expect(parallelSafetyViolations(before, after, [])).toContain(message);
  }

  const keyed = snapshot([
    table("record", {
      uniqueConstraints: {
        record_kind_unique: { name: "record_kind_unique", columns: ["kind"] },
      },
      indexes: {
        record_note_uidx: {
          name: "record_note_uidx",
          isUnique: true,
          method: "btree",
          columns: [{ expression: "note", asc: true, nulls: "last" }],
        },
      },
    }),
  ]);
  expect(parallelSafetyViolations(keyed, before, [])).toEqual([
    "Drops unique constraint record_kind_unique on public.record",
    "Drops unique index record_note_uidx on public.record",
  ]);
  expect(
    parallelSafetyViolations(
      before,
      changed(withColumn("kind", { primaryKey: true, notNull: true })),
      [],
    ),
  ).toContain("Changes the primary key column public.record.kind");
  const restrictingParent = {
    record_parent_fk: {
      name: "record_parent_fk",
      tableTo: "record",
      columnsFrom: ["record_id"],
      columnsTo: ["id"],
    },
  };
  expect(
    parallelSafetyViolations(
      before,
      snapshot([
        table("record"),
        table("child", { foreignKeys: restrictingParent }),
      ]),
      [],
    ),
  ).toEqual([
    "Adds foreign key record_parent_fk restricting deletes from public.record",
  ]);
  expect(
    parallelSafetyViolations(
      before,
      snapshot([
        table("record"),
        table("child", {
          foreignKeys: {
            record_parent_fk: {
              ...restrictingParent.record_parent_fk,
              onDelete: "cascade",
            },
          },
        }),
      ]),
      [],
    ),
  ).toEqual([]);

  const required = snapshot([
    table("record", withColumn("status", { notNull: true, default: "'a'" })),
  ]);
  expect(
    parallelSafetyViolations(
      required,
      snapshot([table("record", withColumn("status", { notNull: true }))]),
      [],
    ),
  ).toContain("Removes the default of required column public.record.status");
  expect(
    parallelSafetyViolations(
      snapshot([], {
        "public.state": { name: "state", schema: "public", values: ["a", "b"] },
      }),
      snapshot([], {
        "public.state": { name: "state", schema: "public", values: ["a"] },
      }),
      [],
    ),
  ).toContain("Removes values from enum public.state");
});

test("rejects SQL-only contract statements that snapshots cannot show", () => {
  expect(
    parallelSafetyViolations(before, before, [
      `-- DROP TABLE in a comment is ignored\nCREATE TRIGGER "guard" BEFORE INSERT ON "record" FOR EACH ROW EXECUTE FUNCTION guard();`,
      `ALTER TABLE "record" RENAME COLUMN "note" TO "body";`,
      `ALTER TABLE "record" ALTER COLUMN "note" SET NOT NULL;`,
    ]),
  ).toEqual([
    "SQL creates a trigger",
    "SQL renames an object",
    "SQL makes a column required",
  ]);
});

test("ignores contract keywords inside string literals", () => {
  expect(
    parallelSafetyViolations(before, before, [
      `ALTER TABLE "record" ALTER COLUMN "note" SET DEFAULT 'rename, set not null, drop column and create trigger guidance';`,
      `UPDATE "record" SET note = 'set not null';`,
    ]),
  ).toEqual([]);
});

function repository(sql: string[][]) {
  const snapshots = [
    snapshot([table("record")]),
    snapshot([table("record")]),
    snapshot([table("record", withColumn("status", { notNull: true }))]),
  ];
  return {
    entries: snapshots.map((_, idx) => ({
      idx,
      tag: `000${idx}_step`,
      when: idx + 1,
    })),
    migrations: sql.map((statements) => ({ sql: statements })),
    snapshots,
  };
}

test("checks only migrations after the baseline and names the offending migration", () => {
  expect(() =>
    assertParallelSafeMigrations(repository([[], [], []]), "0001_step"),
  ).toThrow(
    "0002_step is not safe for the shared development database: Adds required column public.record.status without a default",
  );
  expect(() =>
    assertParallelSafeMigrations(repository([[], [], []]), "0002_step"),
  ).not.toThrow();
  expect(() =>
    assertParallelSafeMigrations(repository([[], [], []]), "0009_missing"),
  ).toThrow("Parallel safety baseline 0009_missing is not in the journal");
});

test("allows an explicitly acknowledged contract migration and reports it", () => {
  const acknowledged = repository([
    [],
    [],
    [
      '-- parallel-safety: contract Every workspace now writes status.\nALTER TABLE "record" ADD COLUMN "status" text NOT NULL;',
    ],
  ]);
  expect(assertParallelSafeMigrations(acknowledged, "0001_step")).toEqual([
    "0002_step",
  ]);
  expect(() =>
    assertParallelSafeMigrations(
      repository([[], [], ["-- parallel-safety: contract\nSELECT 1;"]]),
      "0001_step",
    ),
  ).toThrow("0002_step is not safe");
  expect(() =>
    assertParallelSafeMigrations(
      repository([
        [],
        [],
        ["SELECT 1;\n-- parallel-safety: contract Too late in the file."],
      ]),
      "0001_step",
    ),
  ).toThrow("0002_step is not safe");
});
