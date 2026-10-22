import { describe, expect, test } from "vitest";

import {
  buildSchemaChangeDraft,
  destructiveOperations,
  OPERATION_CLASSES,
  type SchemaChangeDraft,
} from "./schema-change-draft";
import {
  type SchemaDefinition,
  schemaDefinitionSchema,
} from "./schema-definition";

const FORBIDDEN_SQL = /INSERT|UPDATE |DELETE|CASCADE|USING/;

const col = (
  id: string,
  name: string,
  type = "integer",
  extra: Record<string, unknown> = {},
) => ({ id, name, nullable: false, type, ...extra });

const table = (
  id: string,
  name: string,
  columns: ReturnType<typeof col>[],
  extra: Record<string, unknown> = {},
) => ({
  columns,
  id,
  name,
  primaryKey: { columnIds: [columns[0]?.id] },
  ...extra,
});

const schema = (value: unknown): SchemaDefinition =>
  schemaDefinitionSchema.parse(value);

const base = () =>
  schema({
    tables: [
      table("users", "users", [
        col("u-id", "id", "uuid"),
        col("u-name", "name", "varchar(50)"),
      ]),
    ],
  });

const operations = (draft: SchemaChangeDraft) =>
  draft.operations.map(({ operation, path }) => `${operation} ${path}`);

describe("Schema Change Draft", () => {
  test("is schema-only: identical versions give an empty draft", () => {
    const draft = buildSchemaChangeDraft(base(), base());
    expect(draft).toMatchObject({ blockers: [], operations: [], upSql: "" });
  });

  test("create table adds FKs and indexes in their own phases", () => {
    const target = schema({
      tables: [
        table("users", "users", [
          col("u-id", "id", "uuid"),
          col("u-name", "name", "varchar(50)"),
        ]),
        table(
          "posts",
          "posts",
          [col("p-id", "id", "bigint"), col("p-user", "user_id", "uuid")],
          {
            foreignKeys: [
              {
                columnIds: ["p-user"],
                id: "fk",
                name: "posts_user_id_fkey",
                onDelete: "CASCADE",
                refColumnIds: ["u-id"],
                refTableId: "users",
              },
            ],
            indexes: [
              {
                columns: [{ columnId: "p-user" }],
                id: "ix",
                method: "btree",
                name: "posts_user_id_idx",
              },
            ],
          },
        ),
      ],
    });
    const draft = buildSchemaChangeDraft(base(), target);
    expect(draft.upSql).toMatchInlineSnapshot(`
      "CREATE TABLE posts (
        id bigint NOT NULL,
        user_id uuid NOT NULL,
        CONSTRAINT posts_pkey PRIMARY KEY (id)
      );
      CREATE INDEX posts_user_id_idx ON posts USING btree (user_id);
      ALTER TABLE posts ADD CONSTRAINT posts_user_id_fkey FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE ON UPDATE NO ACTION;
      "
    `);
    expect(operations(draft)).toEqual([
      "Create table tables.posts",
      "Add index tables.posts.indexes.posts_user_id_idx",
      "Add foreign key tables.posts.foreignKeys.posts_user_id_fkey",
    ]);
    expect(destructiveOperations(draft)).toEqual([]);
  });

  test("detects renames by identity and orders table before column rename", () => {
    const target = schema({
      tables: [
        table("users", "accounts", [
          col("u-id", "id", "uuid"),
          col("u-name", "full_name", "varchar(50)"),
        ]),
      ],
    });
    const draft = buildSchemaChangeDraft(base(), target);
    expect(draft.upSql).toBe(
      "ALTER TABLE users RENAME TO accounts;\nALTER TABLE accounts RENAME COLUMN name TO full_name;\n",
    );
    expect(draft.operations.map(({ class: kind }) => kind)).toEqual([
      "Non-destructive",
      "Non-destructive",
    ]);
  });

  test("a table name swap goes through a deterministic temporary name", () => {
    const source = schema({
      tables: [
        table("a", "alpha", [col("a-id", "id")]),
        table("b", "beta", [col("b-id", "id")]),
      ],
    });
    const target = schema({
      tables: [
        table("a", "beta", [col("a-id", "id")]),
        table("b", "alpha", [col("b-id", "id")]),
      ],
    });
    const sql = buildSchemaChangeDraft(source, target).upSql.split("\n");
    expect(sql).toEqual([
      "ALTER TABLE beta RENAME TO _cantiara_tmp_b;",
      "ALTER TABLE alpha RENAME TO _cantiara_tmp_a;",
      "ALTER TABLE _cantiara_tmp_b RENAME TO alpha;",
      "ALTER TABLE _cantiara_tmp_a RENAME TO beta;",
      "",
    ]);
  });

  test("reusing the name of a dropped table frees it first", () => {
    const source = schema({
      tables: [table("old", "events", [col("o-id", "id")])],
    });
    const target = schema({
      tables: [table("new", "events", [col("n-id", "id")])],
    });
    const draft = buildSchemaChangeDraft(source, target);
    expect(draft.upSql).toBe(
      "ALTER TABLE events RENAME TO _cantiara_tmp_old;\nCREATE TABLE events (\n  id integer NOT NULL,\n  CONSTRAINT events_pkey PRIMARY KEY (id)\n);\nDROP TABLE _cantiara_tmp_old;\n",
    );
    expect(
      destructiveOperations(draft).map(({ operation }) => operation),
    ).toEqual(["Drop table"]);
  });

  test("classifies drops as potentially destructive and keeps them visible", () => {
    const source = schema({
      tables: [
        table("users", "users", [
          col("u-id", "id", "uuid"),
          col("u-name", "name", "varchar(50)"),
          col("u-x", "legacy", "text"),
        ]),
        table("gone", "gone", [col("g-id", "id")]),
      ],
    });
    const draft = buildSchemaChangeDraft(source, base());
    expect(draft.upSql).toBe(
      "ALTER TABLE users DROP COLUMN legacy;\nDROP TABLE gone;\n",
    );
    expect(
      destructiveOperations(draft).map(({ operation }) => operation),
    ).toEqual(["Drop column", "Drop table"]);
    expect(
      draft.warnings.filter(({ code }) => code === "destructive"),
    ).toHaveLength(2);
  });

  test("widens types without USING and treats the reverse as narrowing", () => {
    const wide = schema({
      tables: [
        table("users", "users", [
          col("u-id", "id", "uuid"),
          col("u-name", "name", "text"),
        ]),
      ],
    });
    const widened = buildSchemaChangeDraft(base(), wide);
    expect(widened.upSql).toBe(
      "ALTER TABLE users ALTER COLUMN name TYPE text;\n",
    );
    expect(widened.operations[0]?.operation).toBe("Widen column type");
    expect(widened.warnings).toContainEqual(
      expect.objectContaining({
        code: "reverse-data",
        path: "tables.users.columns.name",
      }),
    );
    const narrowed = buildSchemaChangeDraft(wide, base());
    expect(narrowed.operations[0]?.operation).toBe("Narrow column type");
    expect(narrowed.operations[0]?.class).toBe("Potentially destructive");
    expect(narrowed.upSql).not.toContain("USING");
  });

  test("a free type conversion is a named blocker with no partial SQL", () => {
    const target = schema({
      tables: [
        table("users", "users", [
          col("u-id", "id", "text"),
          col("u-name", "name", "varchar(50)"),
          col("u-new", "extra", "integer"),
        ]),
      ],
    });
    const draft = buildSchemaChangeDraft(base(), target);
    expect(draft.blockers).toEqual([
      expect.objectContaining({
        operation: "Free type conversion",
        path: "tables.users.columns.id",
      }),
    ]);
    expect(draft.upSql).toBe("");
    expect(OPERATION_CLASSES["Free type conversion"]).toBe("Unsupported");
  });

  test("nullability, default and existing-data warnings", () => {
    const source = schema({
      tables: [
        table("t", "t", [
          col("id", "id"),
          col("a", "a", "text", { nullable: true }),
          col("b", "b", "text"),
        ]),
      ],
    });
    const target = schema({
      tables: [
        table("t", "t", [
          col("id", "id"),
          col("a", "a", "text", { default: "'x'" }),
          col("b", "b", "text", { default: "'y'", nullable: true }),
          col("c", "c", "integer"),
        ]),
      ],
    });
    const draft = buildSchemaChangeDraft(source, target);
    expect(draft.upSql).toBe(
      [
        "ALTER TABLE t ADD COLUMN c integer NOT NULL;",
        "ALTER TABLE t ALTER COLUMN a SET NOT NULL;",
        "ALTER TABLE t ALTER COLUMN b DROP NOT NULL;",
        "ALTER TABLE t ALTER COLUMN a SET DEFAULT 'x';",
        "ALTER TABLE t ALTER COLUMN b SET DEFAULT 'y';",
        "",
      ].join("\n"),
    );
    expect(
      draft.warnings
        .filter(({ code }) => code === "existing-data")
        .map(({ path }) => path),
    ).toEqual(["tables.t.columns.c", "tables.t.columns.a"]);
  });

  test("referential action change is one drop in phase 1 and one add in phase 10", () => {
    const fk = (action: string) =>
      schema({
        tables: [
          table("p", "parent", [col("p-id", "id")]),
          table("c", "child", [col("c-id", "id"), col("c-p", "parent_id")], {
            foreignKeys: [
              {
                columnIds: ["c-p"],
                id: "fk",
                name: "child_parent_fkey",
                onDelete: action,
                refColumnIds: ["p-id"],
                refTableId: "p",
              },
            ],
          }),
        ],
      });
    const draft = buildSchemaChangeDraft(fk("NO ACTION"), fk("CASCADE"));
    expect(draft.upSql).toBe(
      "ALTER TABLE child DROP CONSTRAINT child_parent_fkey;\nALTER TABLE child ADD CONSTRAINT child_parent_fkey FOREIGN KEY (parent_id) REFERENCES parent (id) ON DELETE CASCADE ON UPDATE NO ACTION;\n",
    );
    expect(draft.operations).toHaveLength(1);
    expect(draft.operations[0]).toMatchObject({
      class: "Non-destructive",
      operation: "Change referential action",
    });
  });

  test("enum values: positioned add, rename by identity, drop is unsupported", () => {
    const enumOf = (labels: [string, string][]) =>
      schema({
        enums: [
          {
            id: "e",
            labels: labels.map(([id, value]) => ({ id, value })),
            name: "status",
          },
        ],
        tables: [table("t", "t", [col("id", "id")])],
      });
    const draft = buildSchemaChangeDraft(
      enumOf([
        ["1", "open"],
        ["3", "done"],
      ]),
      enumOf([
        ["1", "open"],
        ["2", "doing"],
        ["3", "closed"],
      ]),
    );
    expect(draft.upSql).toBe(
      "ALTER TYPE status ADD VALUE 'doing' AFTER 'open';\nALTER TYPE status RENAME VALUE 'done' TO 'closed';\n",
    );
    const dropped = buildSchemaChangeDraft(
      enumOf([
        ["1", "open"],
        ["3", "done"],
      ]),
      enumOf([["1", "open"]]),
    );
    expect(dropped.blockers[0]).toMatchObject({
      operation: "Drop enum value",
      path: "enums.status.done",
    });
    expect(dropped.upSql).toBe("");
  });

  test("every statement of a mixed change follows the fixed phase order", () => {
    const source = schema({
      enums: [{ id: "e", labels: [{ id: "1", value: "a" }], name: "kind" }],
      tables: [
        table("p", "parent", [col("p-id", "id")]),
        table(
          "c",
          "child",
          [col("c-id", "id"), col("c-p", "parent_id"), col("c-d", "drop_me")],
          {
            foreignKeys: [
              {
                columnIds: ["c-p"],
                id: "fk",
                name: "child_parent_fkey",
                refColumnIds: ["p-id"],
                refTableId: "p",
              },
            ],
            uniques: [
              { columnIds: ["c-d"], id: "uq", name: "child_drop_me_key" },
            ],
          },
        ),
        table("z", "zap", [col("z-id", "id")]),
      ],
    });
    const target = schema({
      enums: [
        {
          id: "e",
          labels: [
            { id: "1", value: "a" },
            { id: "2", value: "b" },
          ],
          name: "kind",
        },
      ],
      tables: [
        table("p", "parents", [col("p-id", "id")]),
        table(
          "c",
          "child",
          [
            col("c-id", "id"),
            col("c-p", "parent_id"),
            col("c-n", "note", "text", { nullable: true }),
          ],
          {
            checks: [
              {
                columnId: "c-id",
                id: "ck",
                name: "child_id_check",
                operator: ">",
                value: "0",
              },
            ],
            foreignKeys: [
              {
                columnIds: ["c-p"],
                id: "fk",
                name: "child_parent_fkey",
                onDelete: "CASCADE",
                refColumnIds: ["p-id"],
                refTableId: "p",
              },
            ],
            indexes: [
              {
                columns: [{ columnId: "c-p" }],
                id: "ix",
                method: "btree",
                name: "child_parent_idx",
              },
            ],
          },
        ),
        table("n", "fresh", [col("n-id", "id")]),
      ],
    });
    const draft = buildSchemaChangeDraft(source, target);
    expect(draft.blockers).toEqual([]);
    expect(draft.violations).toEqual([]);
    const phases = draft.operations
      .flatMap(({ statements }) => statements)
      .sort((a, b) => a.phase - b.phase)
      .map(({ phase }) => phase);
    expect(phases).toEqual([...phases].sort((a, b) => a - b));
    const lines = draft.upSql.trim().split("\n");
    expect(lines).toEqual([
      "ALTER TABLE child DROP CONSTRAINT child_parent_fkey;",
      "ALTER TABLE child DROP CONSTRAINT child_drop_me_key;",
      "ALTER TABLE parent RENAME TO parents;",
      "ALTER TYPE kind ADD VALUE 'b' AFTER 'a';",
      "CREATE TABLE fresh (",
      "  id integer NOT NULL,",
      "  CONSTRAINT fresh_pkey PRIMARY KEY (id)",
      ");",
      "ALTER TABLE child ADD COLUMN note text;",
      "ALTER TABLE child ADD CONSTRAINT child_id_check CHECK (id > 0);",
      "CREATE INDEX child_parent_idx ON child USING btree (parent_id);",
      "ALTER TABLE child ADD CONSTRAINT child_parent_fkey FOREIGN KEY (parent_id) REFERENCES parents (id) ON DELETE CASCADE ON UPDATE NO ACTION;",
      "ALTER TABLE child DROP COLUMN drop_me;",
      "DROP TABLE zap;",
    ]);
  });

  test("reports invariant violations of either version instead of a draft", () => {
    const broken = schema({
      tables: [{ columns: [col("id", "id")], id: "t", name: "t" }],
    });
    const draft = buildSchemaChangeDraft(base(), broken);
    expect(draft.violations[0]).toMatchObject({
      invariant: "Primary key present",
      path: "target.tables.t",
    });
    expect(draft.upSql).toBe("");
  });

  test("never emits data SQL, CASCADE or USING", () => {
    const draft = buildSchemaChangeDraft(
      schema({ tables: [table("a", "a", [col("id", "id"), col("x", "x")])] }),
      schema({ tables: [table("a", "a", [col("id", "id")])] }),
    );
    expect(draft.upSql).not.toMatch(FORBIDDEN_SQL);
  });
});
