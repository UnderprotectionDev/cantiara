import { describe, expect, test } from "vitest";

import { generateDdl } from "./schema-ddl";
import {
  fromDataModel,
  type SchemaDefinition,
  schemaDefinitionSchema,
  schemaModelHash,
} from "./schema-definition";
import { checkSchemaInvariants } from "./schema-invariants";

const parse = (value: unknown): SchemaDefinition =>
  schemaDefinitionSchema.parse(value);

const col = (
  id: string,
  name: string,
  type: string,
  extra: Record<string, unknown> = {},
) => ({ id, name, nullable: false, type, ...extra });

const blog = (): SchemaDefinition =>
  parse({
    enums: [
      {
        id: "role",
        labels: [
          { id: "r1", value: "author" },
          { id: "r2", value: "editor" },
        ],
        name: "role",
      },
    ],
    tables: [
      {
        columns: [
          col("u-id", "id", "uuid", { default: "gen_random_uuid()" }),
          col("u-email", "email", "varchar(255)"),
          col("u-role", "role", "enum:role", { default: "'author'" }),
        ],
        id: "users",
        indexes: [
          {
            columns: [{ columnId: "u-email", opclass: "gin_trgm_ops" }],
            id: "u-trgm",
            method: "gin",
            name: "users_email_trgm",
          },
        ],
        name: "users",
        primaryKey: { columnIds: ["u-id"] },
        uniques: [
          { columnIds: ["u-email"], id: "u-uq", name: "users_email_key" },
        ],
      },
      {
        checks: [
          {
            columnId: "p-views",
            id: "p-chk",
            name: "posts_views_check",
            operator: ">=",
            value: "0",
          },
        ],
        columns: [
          col("p-id", "id", "bigint", { identity: "always" }),
          col("p-author", "author_id", "uuid"),
          col("p-views", "views", "integer", { default: "0" }),
        ],
        foreignKeys: [
          {
            columnIds: ["p-author"],
            id: "p-fk",
            name: "posts_author_id_fkey",
            onDelete: "CASCADE",
            refColumnIds: ["u-id"],
            refTableId: "users",
          },
        ],
        id: "posts",
        name: "posts",
        primaryKey: { columnIds: ["p-id"] },
      },
    ],
  });

describe("PostgreSQL DDL golden", () => {
  test("emits the full dependency-ordered DDL with no CREATE EXTENSION", async () => {
    const result = await generateDdl(blog());
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.sql).toMatchInlineSnapshot(`
      "CREATE TYPE role AS ENUM ('author', 'editor');

      CREATE TABLE users (
        id uuid NOT NULL DEFAULT gen_random_uuid(),
        email varchar(255) NOT NULL,
        role role NOT NULL DEFAULT 'author',
        CONSTRAINT users_pkey PRIMARY KEY (id),
        CONSTRAINT users_email_key UNIQUE (email)
      );

      CREATE TABLE posts (
        id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
        author_id uuid NOT NULL,
        views integer NOT NULL DEFAULT 0,
        CONSTRAINT posts_pkey PRIMARY KEY (id),
        CONSTRAINT posts_views_check CHECK (views >= 0)
      );

      CREATE INDEX users_email_trgm ON users USING gin (email gin_trgm_ops);

      ALTER TABLE posts ADD CONSTRAINT posts_author_id_fkey FOREIGN KEY (author_id) REFERENCES users (id) ON DELETE CASCADE ON UPDATE NO ACTION;
      "
    `);
    expect(result.sql.toUpperCase()).not.toContain("CREATE EXTENSION");
    expect(result.generatorVersion).toBe("schema-ddl@1");
    expect(result.warnings.map(({ path }) => path)).toEqual([
      "extensions.pg_trgm",
    ]);
  });

  test("quotes reserved words and mixed-case names", async () => {
    const definition = parse({
      tables: [
        {
          columns: [col("c", "Order", "integer")],
          id: "t",
          name: "user",
          primaryKey: { columnIds: ["c"] },
        },
      ],
    });
    const result = await generateDdl(definition);
    expect(result.ok && result.sql).toContain('CREATE TABLE "user" (');
    expect(result.ok && result.sql).toContain('"Order" integer NOT NULL');
  });

  test("a presentation-free hash ignores IDs and input order but not definitions", async () => {
    const base = blog();
    const reordered = parse({
      ...base,
      tables: [...base.tables].reverse(),
    });
    const renamedIds = JSON.parse(
      JSON.stringify(base)
        .replaceAll('"p-fk"', '"other-fk-id"')
        .replaceAll('"u-uq"', '"other-uq-id"'),
    );
    expect(await schemaModelHash(reordered)).toBe(await schemaModelHash(base));
    expect(await schemaModelHash(parse(renamedIds))).toBe(
      await schemaModelHash(base),
    );
    const changed = blog();
    changed.tables[1]?.columns.push({
      default: null,
      id: "p-x",
      identity: null,
      name: "extra",
      nullable: false,
      type: "text",
    });
    expect(await schemaModelHash(changed)).not.toBe(
      await schemaModelHash(base),
    );
  });
});

describe("invariant report", () => {
  test("collects every violation with its element path and blocks all SQL", async () => {
    const definition = parse({
      tables: [
        {
          columns: [col("a", "id", "integer"), col("a2", "ID", "integer")],
          id: "t1",
          name: "Dup",
        },
        {
          columns: [col("b", "x".repeat(64), "integer")],
          foreignKeys: [
            {
              columnIds: ["b"],
              id: "fk",
              name: "t2_fk",
              onDelete: "EXPLODE",
              refColumnIds: ["missing"],
              refTableId: "t1",
            },
          ],
          id: "t2",
          name: "dup",
          primaryKey: { columnIds: ["b"] },
        },
      ],
    });
    const result = await generateDdl(definition);
    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    const names = result.violations.map(({ invariant }) => invariant);
    expect(names).toEqual(
      expect.arrayContaining([
        "Unique table name",
        "Unique column name",
        "Valid identifier",
        "Primary key present",
        "Foreign key end exists",
        "Referential action validity",
      ]),
    );
    expect(result.violations.map(({ path }) => path)).toContain(
      "tables.Dup.columns.ID",
    );
    expect("sql" in result).toBe(false);
  });

  test("names foreign key type, composite list, index and default violations", () => {
    const definition = parse({
      tables: [
        {
          columns: [col("k", "id", "bigint")],
          id: "parent",
          name: "parent",
          primaryKey: { columnIds: ["k"] },
        },
        {
          columns: [
            col("a", "id", "integer"),
            col("p", "parent_id", "text"),
            col("n", "name", "text", { default: "NULL" }),
            col("b", "flag", "boolean", { default: "'yes'" }),
          ],
          foreignKeys: [
            {
              columnIds: ["p"],
              id: "fk",
              name: "child_fk",
              refColumnIds: ["k"],
              refTableId: "parent",
            },
          ],
          id: "child",
          indexes: [
            {
              columns: [
                { columnId: "a", opclass: null },
                { columnId: "a", opclass: null },
              ],
              id: "i1",
              method: "btree",
              name: "i1",
            },
            {
              columns: [{ columnId: "a", opclass: null }],
              id: "i2",
              method: "gin",
              name: "i2",
            },
            {
              columns: [{ columnId: "a", opclass: null }],
              id: "i3",
              method: "gin",
              name: "i3",
            },
          ],
          name: "child",
          primaryKey: { columnIds: ["a"] },
        },
      ],
    });
    const found = checkSchemaInvariants(definition).map(
      ({ invariant }) => invariant,
    );
    expect(found).toEqual(
      expect.arrayContaining([
        "Foreign key type match",
        "Composite column list validity",
        "Index column and method validity",
        "Non-duplicate index definition",
        "Nullability and default consistency",
      ]),
    );
  });

  test("rejects an unsortable required foreign key cycle but allows a nullable one", () => {
    const side = (id: string, other: string, nullable: boolean) => ({
      columns: [
        col(`${id}-id`, "id", "integer"),
        col(`${id}-ref`, "ref_id", "integer", { nullable }),
      ],
      foreignKeys: [
        {
          columnIds: [`${id}-ref`],
          id: `${id}-fk`,
          name: `${id}_fk`,
          onDelete: "NO ACTION",
          refColumnIds: [`${other}-id`],
          refTableId: other,
        },
      ],
      id,
      name: id,
      primaryKey: { columnIds: [`${id}-id`] },
    });
    const required = parse({
      tables: [side("a", "b", false), side("b", "a", false)],
    });
    expect(
      checkSchemaInvariants(required).filter(
        ({ invariant }) => invariant === "Sortable foreign key graph",
      ),
    ).toHaveLength(1);
    const relaxed = parse({
      tables: [side("a", "b", true), side("b", "a", false)],
    });
    expect(checkSchemaInvariants(relaxed)).toEqual([]);
  });
});

describe("extension matrix", () => {
  test.each([
    ["citext", "citext"],
    ["vector(3)", "vector"],
    ["geometry", "postgis"],
    ["hstore", "hstore"],
  ])("rejects type %s by extension name", (type, extension) => {
    const definition = parse({
      tables: [
        {
          columns: [col("c", "id", "integer"), col("v", "v", type)],
          id: "t",
          name: "t",
          primaryKey: { columnIds: ["c"] },
        },
      ],
    });
    const [violation] = checkSchemaInvariants(definition);
    expect(violation?.invariant).toBe("Extension not in matrix");
    expect(violation?.requirement).toContain(extension);
  });

  test("rejects extension functions and vector index methods", () => {
    const definition = parse({
      tables: [
        {
          columns: [
            col("c", "id", "uuid", { default: "uuid_generate_v4()" }),
            col("h", "hash", "text", { default: "crypt('a', gen_salt('bf'))" }),
          ],
          id: "t",
          indexes: [
            {
              columns: [{ columnId: "h", opclass: null }],
              id: "i",
              method: "hnsw",
              name: "t_hnsw",
            },
          ],
          name: "t",
          primaryKey: { columnIds: ["c"] },
        },
      ],
    });
    const requirements = checkSchemaInvariants(definition).map(
      ({ requirement }) => requirement,
    );
    expect(requirements.some((text) => text.includes("uuid-ossp"))).toBe(true);
    expect(requirements.some((text) => text.includes("pgcrypto"))).toBe(true);
    expect(requirements.some((text) => text.includes("vector"))).toBe(true);
  });
});

describe("Data Model Diagram mapping", () => {
  test("maps a spec 59 model without adding an element", async () => {
    const definition = fromDataModel({
      relations: [
        {
          cardinality: "One to many",
          fromColumnId: "o-user",
          fromTableId: "orders",
          id: "rel",
          onDelete: "CASCADE",
          onUpdate: "NO ACTION",
          toColumnId: "u-id",
          toTableId: "users",
        },
      ],
      tables: [
        {
          columns: [
            {
              default: null,
              id: "u-id",
              name: "id",
              nullable: false,
              primaryKey: true,
              type: "uuid",
              unique: false,
            },
          ],
          id: "users",
          indexes: [],
          name: "users",
        },
        {
          columns: [
            {
              default: null,
              id: "o-id",
              name: "id",
              nullable: false,
              primaryKey: true,
              type: "uuid",
              unique: false,
            },
            {
              default: null,
              id: "o-user",
              name: "user_id",
              nullable: false,
              primaryKey: false,
              type: "uuid",
              unique: true,
            },
          ],
          id: "orders",
          indexes: [],
          name: "orders",
        },
      ],
    });
    const result = await generateDdl(definition);
    expect(result.ok).toBe(true);
    expect(result.ok && result.sql).toContain(
      "ALTER TABLE orders ADD CONSTRAINT orders_user_id_fkey FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE",
    );
  });
});
