import type { DataModelModel } from "@cantiara/db/schema/technical-diagram";
import { z } from "zod";

/**
 * Schema Artifacts (spec 60) read one exact Data Model `Diagram Version` as a
 * `Schema Definition`: the closed physical PostgreSQL shape every invariant,
 * DDL and operation rule works on. Spec 59 models the tables; this type only
 * carries what the generator needs and never edits a diagram.
 */
export const SCHEMA_ARTIFACT_LABELS = {
  artifact: "Migration Artifact",
  draft: "Schema Change Draft",
  noSafeDown: "Safe Down could not be produced",
  supersedes: "Supersedes Migration Artifact",
  validated: "Statically Validated",
} as const;

/** Version of the DDL and operation generator; bound into every manifest. */
export const SCHEMA_GENERATOR_VERSION = "schema-ddl@1";

/** Same PostgreSQL major on the disposable validation database and production. */
export const POSTGRES_MAJOR = 17;

export const REFERENTIAL_ACTIONS = [
  "NO ACTION",
  "RESTRICT",
  "CASCADE",
  "SET NULL",
  "SET DEFAULT",
] as const;
export const INDEX_METHODS = [
  "btree",
  "hash",
  "gin",
  "gist",
  "brin",
  "spgist",
] as const;
export const CHECK_OPERATORS = [">", ">=", "<", "<=", "=", "<>"] as const;
export const INDEX_PREDICATES = [
  "IS NULL",
  "IS NOT NULL",
  "= TRUE",
  "= FALSE",
] as const;

const idSchema = z.string().trim().min(1).max(120);
const nameSchema = z.string().min(1).max(255);
const literalSchema = z
  .string()
  .regex(/^(-?\d+(\.\d+)?|'([^']|'')*')$/, "Use a number or quoted string.");

const checkSchema = z
  .object({
    columnId: idSchema.nullable().default(null),
    id: idSchema,
    name: nameSchema,
    operator: z.enum(CHECK_OPERATORS),
    value: literalSchema,
  })
  .strict();

const columnSchema = z
  .object({
    default: z.string().min(1).max(255).nullable().default(null),
    id: idSchema,
    identity: z.enum(["always", "by default"]).nullable().default(null),
    name: nameSchema,
    nullable: z.boolean(),
    /** Base type, `enum:<id>` or `domain:<id>`, optional `[]` suffix. */
    type: z.string().trim().min(1).max(120),
  })
  .strict();

const indexSchema = z
  .object({
    columns: z
      .array(
        z
          .object({
            columnId: idSchema,
            opclass: z.string().max(80).nullable().default(null),
          })
          .strict(),
      )
      .min(1),
    id: idSchema,
    method: z.string().min(1).max(40),
    name: nameSchema,
    unique: z.boolean().default(false),
    where: z
      .object({
        columnId: idSchema,
        predicate: z.enum(INDEX_PREDICATES),
      })
      .strict()
      .nullable()
      .default(null),
  })
  .strict();

const foreignKeySchema = z
  .object({
    columnIds: z.array(idSchema).min(1),
    id: idSchema,
    name: nameSchema,
    onDelete: z.string().default("NO ACTION"),
    onUpdate: z.string().default("NO ACTION"),
    refColumnIds: z.array(idSchema).min(1),
    refTableId: idSchema,
  })
  .strict();

const tableSchema = z
  .object({
    checks: z.array(checkSchema).default([]),
    columns: z.array(columnSchema),
    foreignKeys: z.array(foreignKeySchema).default([]),
    id: idSchema,
    indexes: z.array(indexSchema).default([]),
    name: nameSchema,
    primaryKey: z
      .object({ columnIds: z.array(idSchema) })
      .strict()
      .nullable()
      .default(null),
    uniques: z
      .array(
        z
          .object({
            columnIds: z.array(idSchema),
            id: idSchema,
            name: nameSchema,
          })
          .strict(),
      )
      .default([]),
  })
  .strict();

const enumSchema = z
  .object({
    id: idSchema,
    labels: z.array(z.object({ id: idSchema, value: z.string() }).strict()),
    name: nameSchema,
  })
  .strict();

const domainSchema = z
  .object({
    baseType: z.string().trim().min(1).max(120),
    checks: z.array(checkSchema.omit({ columnId: true })).default([]),
    default: z.string().min(1).max(255).nullable().default(null),
    id: idSchema,
    name: nameSchema,
    notNull: z.boolean().default(false),
  })
  .strict();

export const schemaDefinitionSchema = z
  .object({
    domains: z.array(domainSchema).default([]),
    enums: z.array(enumSchema).default([]),
    tables: z.array(tableSchema),
  })
  .strict();

export type SchemaDefinition = z.infer<typeof schemaDefinitionSchema>;
export type SchemaTable = SchemaDefinition["tables"][number];
export type SchemaColumn = SchemaTable["columns"][number];
export type SchemaIndex = SchemaTable["indexes"][number];
export type SchemaForeignKey = SchemaTable["foreignKeys"][number];
export type SchemaCheck = SchemaTable["checks"][number];
export type SchemaEnum = SchemaDefinition["enums"][number];
export type SchemaDomain = SchemaDefinition["domains"][number];

const QUOTED_NAME = /^"(.*)"$/;
const PLAIN_IDENTIFIER = /^[a-z_][a-z0-9_$]*$/;

/** PostgreSQL folds unquoted names to lower case; this is the collision key. */
export function foldName(name: string): string {
  return name.replace(QUOTED_NAME, "$1").toLowerCase();
}

const RESERVED_WORDS = new Set(
  (
    "all analyse analyze and any array as asc asymmetric both case cast check collate column " +
    "constraint create current_catalog current_date current_role current_time current_timestamp " +
    "current_user default deferrable desc distinct do else end except false fetch for foreign from " +
    "grant group having in initially intersect into lateral leading limit localtime localtimestamp " +
    "not null offset on only or order placing primary references returning select session_user " +
    "some symmetric system_user table then to trailing true union unique user using variadic when " +
    "where window with authorization binary collation concurrently cross current_schema freeze " +
    "full ilike inner is isnull join left like natural notnull outer overlaps right similar " +
    "tablesample verbose"
  ).split(" "),
);

/** Double-quotes only what PostgreSQL would otherwise fold or reject. */
export function quoteIdent(name: string): string {
  if (PLAIN_IDENTIFIER.test(name) && !RESERVED_WORDS.has(name)) {
    return name;
  }
  return `"${name.replaceAll('"', '""')}"`;
}

export function isValidIdentifier(name: string): boolean {
  return (
    name.length > 0 &&
    !name.includes("\u0000") &&
    new TextEncoder().encode(name).length <= 63
  );
}

export function tableById(definition: SchemaDefinition, id: string) {
  return definition.tables.find((table) => table.id === id);
}

export function columnById(table: SchemaTable, id: string) {
  return table.columns.find((column) => column.id === id);
}

/** Maps a spec 59 Data Model onto the Schema Definition; adds no new element. */
export function fromDataModel(model: DataModelModel): SchemaDefinition {
  return {
    domains: [],
    enums: [],
    tables: model.tables.map((table) => {
      const keyColumns = table.columns.filter(({ primaryKey }) => primaryKey);
      return {
        checks: [],
        columns: table.columns.map((column) => ({
          default: column.default,
          id: column.id,
          identity: null,
          name: column.name,
          nullable: column.nullable,
          type: column.type,
        })),
        foreignKeys: model.relations
          .filter(({ fromTableId }) => fromTableId === table.id)
          .map((relation) => ({
            columnIds: [relation.fromColumnId],
            id: relation.id,
            name: `${table.name}_${
              table.columns.find(({ id }) => id === relation.fromColumnId)
                ?.name ?? relation.fromColumnId
            }_fkey`,
            onDelete: relation.onDelete,
            onUpdate: relation.onUpdate,
            refColumnIds: [relation.toColumnId],
            refTableId: relation.toTableId,
          })),
        id: table.id,
        indexes: table.indexes.map((index) => ({
          columns: index.columnIds.map((columnId) => ({
            columnId,
            opclass: null,
          })),
          id: index.id,
          method: "btree",
          name: index.name,
          unique: index.unique,
          where: null,
        })),
        name: table.name,
        primaryKey:
          keyColumns.length > 0
            ? { columnIds: keyColumns.map(({ id }) => id) }
            : null,
        uniques: table.columns
          .filter(({ unique, primaryKey }) => unique && !primaryKey)
          .map((column) => ({
            columnIds: [column.id],
            id: `${table.id}:${column.id}:unique`,
            name: `${table.name}_${column.name}_key`,
          })),
      };
    }),
  };
}

function nameOfType(definition: SchemaDefinition, type: string): string {
  const array = type.endsWith("[]") ? "[]" : "";
  const bare = array ? type.slice(0, -2) : type;
  if (bare.startsWith("enum:")) {
    const found = definition.enums.find(({ id }) => id === bare.slice(5));
    return `enum:${found ? foldName(found.name) : bare}${array}`;
  }
  if (bare.startsWith("domain:")) {
    const found = definition.domains.find(({ id }) => id === bare.slice(7));
    return `domain:${found ? foldName(found.name) : bare}${array}`;
  }
  return type.toLowerCase();
}

/**
 * Closed hash scope: the schema definition by names and definition order,
 * never element IDs, coordinates, view selections or generator metadata.
 */
export function canonicalSchemaDefinition(
  definition: SchemaDefinition,
): string {
  const byName = <T extends { name: string }>(items: T[]) =>
    [...items].sort((a, b) => foldName(a.name).localeCompare(foldName(b.name)));
  return JSON.stringify({
    domains: byName(definition.domains).map((domain) => ({
      baseType: nameOfType(definition, domain.baseType),
      checks: byName(domain.checks).map(({ name, operator, value }) => ({
        name,
        operator,
        value,
      })),
      default: domain.default,
      name: domain.name,
      notNull: domain.notNull,
    })),
    enums: byName(definition.enums).map((entry) => ({
      labels: entry.labels.map(({ value }) => value),
      name: entry.name,
    })),
    tables: byName(definition.tables).map((table) => {
      const columnName = (id: string) =>
        columnById(table, id)?.name ?? `?${id}`;
      return {
        checks: byName(table.checks).map((check) => ({
          column: check.columnId ? columnName(check.columnId) : null,
          name: check.name,
          operator: check.operator,
          value: check.value,
        })),
        columns: table.columns.map((column) => ({
          default: column.default,
          identity: column.identity,
          name: column.name,
          nullable: column.nullable,
          type: nameOfType(definition, column.type),
        })),
        foreignKeys: byName(table.foreignKeys).map((fk) => {
          const target = tableById(definition, fk.refTableId);
          return {
            columns: fk.columnIds.map(columnName),
            name: fk.name,
            onDelete: fk.onDelete,
            onUpdate: fk.onUpdate,
            refColumns: fk.refColumnIds.map(
              (id) => (target && columnById(target, id)?.name) ?? `?${id}`,
            ),
            refTable: target?.name ?? `?${fk.refTableId}`,
          };
        }),
        indexes: byName(table.indexes).map((index) => ({
          columns: index.columns.map(({ columnId, opclass }) => ({
            column: columnName(columnId),
            opclass,
          })),
          method: index.method,
          name: index.name,
          unique: index.unique,
          where: index.where
            ? {
                column: columnName(index.where.columnId),
                predicate: index.where.predicate,
              }
            : null,
        })),
        name: table.name,
        primaryKey: table.primaryKey
          ? table.primaryKey.columnIds.map(columnName)
          : null,
        uniques: byName(table.uniques).map((unique) => ({
          columns: unique.columnIds.map(columnName),
          name: unique.name,
        })),
      };
    }),
  });
}

export async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export function schemaModelHash(definition: SchemaDefinition): Promise<string> {
  return sha256Hex(canonicalSchemaDefinition(definition));
}
