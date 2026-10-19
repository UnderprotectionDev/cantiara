import { fileURLToPath } from "node:url";
import type { Pool } from "@neondatabase/serverless";
import { expect, test } from "vitest";
import {
  type MigrationSnapshot,
  readMigrationRepository,
} from "./migration-repository";
import {
  compareDatabaseColumns,
  inspectDatabaseSchema,
} from "./schema-inspection";

test("detects a missing table even when migration history is complete", () => {
  const repository = readMigrationRepository(
    fileURLToPath(
      new URL("../src/migrations/security-events/", import.meta.url),
    ),
  );
  expect(compareDatabaseColumns(repository.snapshot, [])).toContain(
    "Missing table public.security_event",
  );
});

test("detects a standalone unique index missing from the migration snapshot", async () => {
  const snapshot: MigrationSnapshot = {
    dialect: "postgresql",
    enums: {},
    id: "snapshot",
    prevId: "previous",
    tables: {
      "public.item": {
        name: "item",
        schema: "public",
        columns: {
          id: {
            name: "id",
            type: "text",
            primaryKey: true,
            notNull: true,
          },
        },
        compositePrimaryKeys: {},
        foreignKeys: {},
        uniqueConstraints: {},
        checkConstraints: {},
        indexes: {
          item_expected_uidx: {
            name: "item_expected_uidx",
            isUnique: true,
            method: "btree",
            columns: [{ expression: "id", asc: true, nulls: "last" }],
          },
        },
      },
    },
    version: "7",
  };
  const client = {
    query: <Row>(query: string) => {
      if (query.includes("pg_attribute") && query.includes("pg_attrdef")) {
        return {
          rows: [
            {
              column_name: "id",
              data_type: "text",
              default_expression: null,
              not_null: true,
              schema_name: "public",
              table_name: "item",
            },
          ] as Row[],
        };
      }
      if (query.includes("FROM pg_constraint c")) {
        return {
          rows: [
            {
              columns: ["id"],
              definition: "PRIMARY KEY (id)",
              delete_action: "a",
              name: "item_pkey",
              nulls_not_distinct: false,
              reference_columns: [],
              reference_schema: null,
              reference_table: null,
              schema_name: "public",
              table_name: "item",
              type: "p",
              update_action: "a",
              validated: true,
            },
          ] as Row[],
        };
      }
      if (query.includes("FROM pg_index i")) {
        const itemPrimaryIndex = {
          ascending: [true],
          columns: ["id"],
          include_count: 0,
          is_constraint_backed: true,
          is_unique: true,
          method: "btree",
          name: "item_pkey",
          nulls_first: [false],
          predicate: null,
          schema_name: "public",
          table_name: "item",
          valid: true,
        };
        const referencingForeignKeyIndexRow = {
          ...itemPrimaryIndex,
          is_constraint_backed: false,
        };
        const hasScopedConstraintJoin =
          query.includes("c.conrelid = i.indrelid") &&
          query.includes("c.contype IN ('p', 'u')");
        return {
          rows: [
            itemPrimaryIndex,
            ...(hasScopedConstraintJoin ? [] : [referencingForeignKeyIndexRow]),
            {
              ascending: [true],
              columns: ["id"],
              include_count: 0,
              is_constraint_backed: false,
              is_unique: true,
              method: "btree",
              name: "item_expected_uidx",
              nulls_first: [false],
              predicate: null,
              schema_name: "public",
              table_name: "item",
              valid: true,
            },
            {
              ascending: [true],
              columns: ["id"],
              include_count: 0,
              is_constraint_backed: false,
              is_unique: true,
              method: "btree",
              name: "item_unexpected_uidx",
              nulls_first: [false],
              predicate: null,
              schema_name: "public",
              table_name: "item",
              valid: true,
            },
          ] as Row[],
        };
      }
      throw new Error(`Unexpected schema query: ${query}`);
    },
  } as unknown as Pick<Pool, "query">;

  await expect(inspectDatabaseSchema(client, snapshot, true)).resolves.toEqual([
    "Unexpected unique index: item.item_unexpected_uidx",
  ]);
});

test.each<[string | null, boolean]>([
  [null, false],
  ["NULL::text", false],
  ["'{}'::jsonb", true],
  ["'constant'::text", true],
  ["CASE WHEN random() > 0.5 THEN 'value' ELSE NULL END", false],
])(
  "development accepts only proven non-null defaults on added required columns: %s",
  (defaultExpression, compatible) => {
    const { snapshot } = readMigrationRepository(
      fileURLToPath(
        new URL("../src/migrations/security-events/", import.meta.url),
      ),
    );
    const table = snapshot.tables["public.security_event"];
    if (!table) {
      throw new Error("Security event table fixture is required");
    }
    const columns = Object.values(table.columns).map((column) => ({
      column_name: column.name,
      data_type: column.type,
      default_expression:
        column.default === undefined ? null : String(column.default),
      not_null: column.notNull,
      schema_name: "public",
      table_name: table.name,
    }));
    columns.push({
      column_name: "added_required",
      data_type: "text",
      default_expression: defaultExpression,
      not_null: true,
      schema_name: "public",
      table_name: table.name,
    });
    expect(compareDatabaseColumns(snapshot, columns, true).length === 0).toBe(
      compatible,
    );
    expect(compareDatabaseColumns(snapshot, columns)).toContain(
      "Unexpected column public.security_event.added_required",
    );
  },
);

function expressionInspectionFixture(tableCount: number, columnCount = 1) {
  const snapshot: MigrationSnapshot = {
    dialect: "postgresql",
    enums: {},
    id: "expression-snapshot",
    prevId: "previous",
    tables: {},
    version: "7",
  };
  for (let tableIndex = 0; tableIndex < tableCount; tableIndex += 1) {
    const name = `item_${tableIndex}`;
    snapshot.tables[`public.${name}`] = {
      name,
      schema: "public",
      columns: Object.fromEntries(
        Array.from({ length: columnCount }, (_, columnIndex) => [
          `value_${columnIndex}`,
          {
            name: `value_${columnIndex}`,
            type: "integer",
            primaryKey: false,
            notNull: true,
            default: 0,
          },
        ]),
      ),
      compositePrimaryKeys: {},
      foreignKeys: {},
      uniqueConstraints: {},
      checkConstraints: {},
      indexes: {},
    };
  }
  const explainCalls: string[][] = [];
  const client = {
    query(query: string) {
      if (query.includes("FROM pg_class t")) {
        return {
          rows: Object.values(snapshot.tables).flatMap((table) =>
            Object.values(table.columns).map((column) => ({
              column_name: column.name,
              data_type: "integer",
              default_expression: "0::integer",
              not_null: true,
              schema_name: "public",
              table_name: table.name,
            })),
          ),
        };
      }
      if (query.startsWith("EXPLAIN")) {
        const statements = query.split(";\n");
        explainCalls.push(statements);
        const results = statements.map((statement) => {
          const expressions = statement
            .split("SELECT ")[1]
            ?.split(" FROM ")[0]
            ?.split(", ");
          if (!expressions) {
            throw new Error("Missing EXPLAIN expressions");
          }
          return {
            rows: [
              {
                "QUERY PLAN": [
                  {
                    Plan: {
                      Output: expressions.map((_, index) =>
                        statement.includes('"item_34"') && index % 2 === 1
                          ? "1"
                          : "0",
                      ),
                    },
                  },
                ],
              },
            ],
          };
        });
        return results.length === 1 ? results[0] : results;
      }
      return { rows: [] };
    },
  } as unknown as Pick<Pool, "query">;
  return { snapshot, client, explainCalls };
}

test("deep inspection batches table plans to avoid a network round trip per table", async () => {
  const fixture = expressionInspectionFixture(70);
  await expect(
    inspectDatabaseSchema(fixture.client, fixture.snapshot, true),
  ).resolves.toEqual(["Column default differs: item_34.value_0"]);
  expect(fixture.explainCalls.map((statements) => statements.length)).toEqual([
    32, 32, 6,
  ]);
  expect(fixture.explainCalls.flat()).toHaveLength(70);
  expect(
    fixture.explainCalls.flat().every((sql) => !sql.includes("ANALYZE")),
  ).toBe(true);
});

test("batched inspection keeps each table's expression plans bounded", async () => {
  const fixture = expressionInspectionFixture(1, 70);
  await expect(
    inspectDatabaseSchema(fixture.client, fixture.snapshot, true),
  ).resolves.toEqual([]);
  expect(fixture.explainCalls).toHaveLength(1);
  expect(fixture.explainCalls[0]).toHaveLength(3);
});

test("batched inspection fails closed when a plan result is missing", async () => {
  const fixture = expressionInspectionFixture(2);
  const query = fixture.client.query.bind(fixture.client);
  fixture.client.query = ((statement: string) =>
    statement.startsWith("EXPLAIN")
      ? { rows: [] }
      : query(statement)) as typeof fixture.client.query;
  await expect(
    inspectDatabaseSchema(fixture.client, fixture.snapshot, true),
  ).rejects.toThrow("Database expression could not be inspected");
});

test("deep inspection compares a generated column's expression instead of expecting no default", async () => {
  const fixture = expressionInspectionFixture(1);
  const column = fixture.snapshot.tables["public.item_0"]?.columns.value_0;
  if (!column) {
    throw new Error("Missing fixture column");
  }
  column.default = undefined;
  column.generated = { as: "value_0 + 1", type: "stored" };
  await expect(
    inspectDatabaseSchema(fixture.client, fixture.snapshot, true),
  ).resolves.toEqual([]);
  expect(fixture.explainCalls.flat().join("\n")).toContain("(value_0 + 1)");
});
