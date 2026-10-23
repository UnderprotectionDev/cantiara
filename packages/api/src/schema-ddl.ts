import {
  columnById,
  quoteIdent,
  SCHEMA_GENERATOR_VERSION,
  type SchemaCheck,
  type SchemaColumn,
  type SchemaDefinition,
  type SchemaDomain,
  type SchemaEnum,
  type SchemaForeignKey,
  type SchemaIndex,
  type SchemaTable,
  schemaModelHash,
  tableById,
} from "./schema-definition";
import {
  checkSchemaInvariants,
  renderColumnType,
  requiredExtensions,
  type SchemaViolation,
} from "./schema-invariants";

const q = quoteIdent;

export function stringLiteral(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

const list = (names: string[]) => names.map(q).join(", ");

export function columnNames(table: SchemaTable, ids: string[]): string[] {
  return ids.map((id) => columnById(table, id)?.name ?? id);
}

export function checkClause(check: SchemaCheck, table: SchemaTable): string {
  const column = check.columnId ? columnById(table, check.columnId) : null;
  return `${q(column?.name ?? check.columnId ?? "")} ${check.operator} ${check.value}`;
}

export function columnSql(
  definition: SchemaDefinition,
  column: SchemaColumn,
): string {
  const parts = [q(column.name), renderColumnType(definition, column.type)];
  if (column.identity) {
    parts.push(`GENERATED ${column.identity.toUpperCase()} AS IDENTITY`);
  }
  if (!column.nullable) {
    parts.push("NOT NULL");
  }
  if (column.default !== null && !column.identity) {
    parts.push(`DEFAULT ${column.default}`);
  }
  return parts.join(" ");
}

export function createEnumSql(entry: SchemaEnum): string {
  return `CREATE TYPE ${q(entry.name)} AS ENUM (${entry.labels
    .map(({ value }) => stringLiteral(value))
    .join(", ")});`;
}

export function createDomainSql(
  definition: SchemaDefinition,
  domain: SchemaDomain,
): string {
  const parts = [
    `CREATE DOMAIN ${q(domain.name)} AS ${renderColumnType(definition, domain.baseType)}`,
  ];
  if (domain.default !== null) {
    parts.push(`DEFAULT ${domain.default}`);
  }
  if (domain.notNull) {
    parts.push("NOT NULL");
  }
  for (const check of domain.checks) {
    parts.push(
      `CONSTRAINT ${q(check.name)} CHECK (VALUE ${check.operator} ${check.value})`,
    );
  }
  return `${parts.join(" ")};`;
}

/** Table without foreign keys: those join in their own phase. */
export function createTableSql(
  definition: SchemaDefinition,
  table: SchemaTable,
): string {
  const lines = table.columns.map((column) => columnSql(definition, column));
  if (table.primaryKey) {
    lines.push(
      `CONSTRAINT ${q(`${table.name}_pkey`)} PRIMARY KEY (${list(
        columnNames(table, table.primaryKey.columnIds),
      )})`,
    );
  }
  for (const unique of table.uniques) {
    lines.push(
      `CONSTRAINT ${q(unique.name)} UNIQUE (${list(columnNames(table, unique.columnIds))})`,
    );
  }
  for (const check of table.checks) {
    lines.push(
      `CONSTRAINT ${q(check.name)} CHECK (${checkClause(check, table)})`,
    );
  }
  return `CREATE TABLE ${q(table.name)} (\n  ${lines.join(",\n  ")}\n);`;
}

export function createIndexSql(table: SchemaTable, index: SchemaIndex): string {
  const columns = index.columns
    .map(({ columnId, opclass }) => {
      const name = q(columnNames(table, [columnId])[0] ?? columnId);
      return opclass ? `${name} ${opclass}` : name;
    })
    .join(", ");
  const where = index.where
    ? ` WHERE ${q(columnNames(table, [index.where.columnId])[0] ?? "")} ${index.where.predicate}`
    : "";
  return `CREATE ${index.unique ? "UNIQUE " : ""}INDEX ${q(index.name)} ON ${q(table.name)} USING ${index.method} (${columns})${where};`;
}

export function addForeignKeySql(
  definition: SchemaDefinition,
  table: SchemaTable,
  fk: SchemaForeignKey,
): string {
  const target = tableById(definition, fk.refTableId);
  return `ALTER TABLE ${q(table.name)} ADD CONSTRAINT ${q(fk.name)} FOREIGN KEY (${list(
    columnNames(table, fk.columnIds),
  )}) REFERENCES ${q(target?.name ?? fk.refTableId)} (${list(
    target ? columnNames(target, fk.refColumnIds) : fk.refColumnIds,
  )}) ON DELETE ${fk.onDelete} ON UPDATE ${fk.onUpdate};`;
}

/** Deterministic dependency order; ties and nullable cycles fall back to name. */
export function tableCreationOrder(
  definition: SchemaDefinition,
): SchemaTable[] {
  const remaining = [...definition.tables].sort((a, b) =>
    a.name.localeCompare(b.name),
  );
  const ordered: SchemaTable[] = [];
  const placed = new Set<string>();
  while (remaining.length > 0) {
    const ready = remaining.find((table) =>
      table.foreignKeys.every(
        (fk) =>
          fk.refTableId === table.id ||
          placed.has(fk.refTableId) ||
          !tableById(definition, fk.refTableId),
      ),
    );
    const next = ready ?? remaining[0];
    if (!next) {
      break;
    }
    remaining.splice(remaining.indexOf(next), 1);
    ordered.push(next);
    placed.add(next.id);
  }
  return ordered;
}

export interface SchemaWarning {
  code: "extension-required" | "existing-data" | "reverse-data" | "destructive";
  message: string;
  path: string;
}

export type DdlResult =
  | { ok: false; violations: SchemaViolation[] }
  | {
      generatorVersion: string;
      modelHash: string;
      ok: true;
      sql: string;
      warnings: SchemaWarning[];
    };

export function extensionWarnings(
  definition: SchemaDefinition,
): SchemaWarning[] {
  return requiredExtensions(definition).map((extension) => ({
    code: "extension-required",
    message: `The target database needs extension ${extension} installed. CREATE EXTENSION is not generated and the target is not read.`,
    path: `extensions.${extension}`,
  }));
}

/** Full DDL of one exact definition; never partial, never commented. */
export async function generateDdl(
  definition: SchemaDefinition,
): Promise<DdlResult> {
  const violations = checkSchemaInvariants(definition);
  if (violations.length > 0) {
    return { ok: false, violations };
  }
  const statements: string[] = [
    ...[...definition.enums]
      .sort((a, b) => a.name.localeCompare(b.name))
      .map(createEnumSql),
    ...[...definition.domains]
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((domain) => createDomainSql(definition, domain)),
  ];
  const tables = tableCreationOrder(definition);
  for (const table of tables) {
    statements.push(createTableSql(definition, table));
  }
  for (const table of tables) {
    for (const index of table.indexes) {
      statements.push(createIndexSql(table, index));
    }
  }
  for (const table of tables) {
    for (const fk of table.foreignKeys) {
      statements.push(addForeignKeySql(definition, table, fk));
    }
  }
  return {
    generatorVersion: SCHEMA_GENERATOR_VERSION,
    modelHash: await schemaModelHash(definition),
    ok: true,
    sql: `${statements.join("\n\n")}\n`,
    warnings: extensionWarnings(definition),
  };
}
