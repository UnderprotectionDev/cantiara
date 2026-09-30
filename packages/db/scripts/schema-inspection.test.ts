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
