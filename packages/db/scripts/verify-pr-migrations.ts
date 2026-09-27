import { execFileSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { Pool } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import { migrate } from "drizzle-orm/neon-serverless/migrator";

import { getBranch, neon } from "../../../scripts/workspace-neon";

interface ProjectConfig {
  productionBranchId: string;
  projectId: string;
}

interface JournalEntry {
  idx: number;
  tag: string;
  when: number;
}

interface Journal {
  entries: JournalEntry[];
}

interface Snapshot {
  tables: Record<
    string,
    {
      columns: Record<string, SnapshotColumn>;
      indexes: Record<string, SnapshotIndex>;
      foreignKeys: Record<string, SnapshotForeignKey>;
      compositePrimaryKeys: Record<string, { columns: string[] }>;
      uniqueConstraints: Record<string, SnapshotUniqueConstraint>;
      checkConstraints: Record<string, SnapshotCheckConstraint>;
    }
  >;
}
interface SnapshotColumn {
  notNull?: boolean;
  primaryKey?: boolean;
  type: string;
}
interface SnapshotIndex {
  columns: Array<{
    expression: string;
    isExpression: boolean;
    asc?: boolean;
    nulls?: "first" | "last";
  }>;
  include?: string[];
  isUnique?: boolean;
  method?: string;
  where?: string;
  with?: Record<string, string | number>;
}
interface SnapshotForeignKey {
  columnsFrom: string[];
  columnsTo: string[];
  onDelete: string;
  onUpdate: string;
  tableFrom: string;
  tableTo: string;
}
interface SnapshotUniqueConstraint {
  columns: string[];
  nullsNotDistinct?: boolean;
}
interface SnapshotCheckConstraint {
  value: string;
}
interface ActualIndex {
  ascending: boolean[];
  expressions: string[];
  index_name: string;
  is_unique: boolean;
  key_count: number;
  method: string;
  nulls_order: Array<"first" | "last">;
  predicate: string | null;
  table_name: string;
  with_options: string[];
}
interface ActualConstraint {
  columns: string[];
  constraint_name: string;
  constraint_type: string;
  definition: string;
  expression: string | null;
  on_delete: string | null;
  on_update: string | null;
  referenced_columns: string[];
  referenced_table: string | null;
  table_name: string;
}
type SnapshotTable = Snapshot["tables"][string];
type CanonicalizeExpression = (
  tableName: string,
  value: string,
) => Promise<string>;

const WHITESPACE = /\s/;
const SQL_WORD = /^[a-zA-Z_][a-zA-Z0-9_$]*/;
const INDEX_ORDERING_SUFFIX =
  /\s+(?:(?:ASC|DESC)(?:\s+NULLS\s+(?:FIRST|LAST))?|NULLS\s+(?:FIRST|LAST))\s*$/i;
const NULLS_NOT_DISTINCT = /\bNULLS NOT DISTINCT\b/i;
const SQL_OPERATORS = ["!~*", "~*", "!~", "::", ">=", "<=", "<>", "!=", "||"];

function quoteIdentifier(value: string) {
  return `"${value.replaceAll('"', '""')}"`;
}

function unqualifySnapshotExpression(expression: string, tableName: string) {
  const prefix = `${quoteIdentifier(tableName)}.`;
  let result = "";
  let inString = false;
  for (let index = 0; index < expression.length; index += 1) {
    const char = expression[index];
    if (char === "'" && inString && expression[index + 1] === "'") {
      result += "''";
      index += 1;
      continue;
    }
    if (char === "'") {
      inString = !inString;
    }
    if (!inString && expression.startsWith(prefix, index)) {
      index += prefix.length - 1;
      continue;
    }
    result += char;
  }
  return result;
}

function readSqlString(expression: string, start: number) {
  let index = start + 1;
  while (index < expression.length) {
    if (expression[index] === "'" && expression[index + 1] === "'") {
      index += 2;
      continue;
    }
    if (expression[index] === "'") {
      index += 1;
      break;
    }
    index += 1;
  }
  return { next: index, token: expression.slice(start, index) };
}

function readSqlIdentifier(expression: string, start: number) {
  let index = start + 1;
  let identifier = "";
  while (index < expression.length) {
    if (expression[index] === '"' && expression[index + 1] === '"') {
      identifier += '"';
      index += 2;
      continue;
    }
    if (expression[index] === '"') {
      index += 1;
      break;
    }
    identifier += expression[index];
    index += 1;
  }
  return { next: index, token: `identifier:${identifier.toLowerCase()}` };
}

function normalizeSqlExpression(expression: string) {
  const tokens: string[] = [];
  let index = 0;
  while (index < expression.length) {
    const char = expression[index];
    if (!char || WHITESPACE.test(char)) {
      index += 1;
      continue;
    }
    if (char === "'") {
      const parsed = readSqlString(expression, index);
      tokens.push(parsed.token);
      index = parsed.next;
      continue;
    }
    if (char === '"') {
      const parsed = readSqlIdentifier(expression, index);
      tokens.push(parsed.token);
      index = parsed.next;
      continue;
    }
    const word = SQL_WORD.exec(expression.slice(index))?.[0];
    if (word) {
      tokens.push(`identifier:${word.toLowerCase()}`);
      index += word.length;
      continue;
    }
    const operator = SQL_OPERATORS.find((candidate) =>
      expression.startsWith(candidate, index),
    );
    if (operator) {
      tokens.push(operator);
      index += operator.length;
      continue;
    }
    tokens.push(char);
    index += 1;
  }
  return JSON.stringify(tokens);
}

function removeIndexOrdering(expression: string) {
  return expression.replace(INDEX_ORDERING_SUFFIX, "");
}

function verifyColumns(
  kind: "primary" | "security",
  tableName: string,
  table: SnapshotTable,
  actual: Map<string, { data_type: string; is_nullable: string }>,
) {
  for (const [columnName, expected] of Object.entries(table.columns)) {
    const column = actual.get(`${tableName}.${columnName}`);
    if (!column) {
      throw new Error(
        `${kind} expected schema column missing: ${tableName}.${columnName}`,
      );
    }
    const expectedType =
      expected.type === "timestamp"
        ? "timestamp without time zone"
        : expected.type;
    if (
      column.data_type !== expectedType ||
      (column.is_nullable === "NO") !==
        Boolean(expected.notNull || expected.primaryKey)
    ) {
      throw new Error(
        `${kind} schema column differs: ${tableName}.${columnName}`,
      );
    }
  }
}

function indexKeyColumnMatches(
  index: ActualIndex,
  actualExpression: string,
  column: SnapshotIndex["columns"][number],
  position: number,
  tableName: string,
) {
  const expectedExpression = unqualifySnapshotExpression(
    column.expression,
    tableName,
  );
  return (
    normalizeSqlExpression(actualExpression) ===
      normalizeSqlExpression(expectedExpression) &&
    index.ascending[position] === (column.asc ?? true) &&
    index.nulls_order[position] ===
      (column.nulls ?? (column.asc === false ? "first" : "last"))
  );
}

function indexKeyColumnsMatch(
  index: ActualIndex,
  expectedColumns: SnapshotIndex["columns"],
  tableName: string,
) {
  if (
    index.key_count !== expectedColumns.length ||
    index.expressions.length < expectedColumns.length
  ) {
    return false;
  }
  return expectedColumns.every((column, position) =>
    indexKeyColumnMatches(
      index,
      removeIndexOrdering(index.expressions[position] ?? ""),
      column,
      position,
      tableName,
    ),
  );
}

function indexIncludedColumnsMatch(
  index: ActualIndex,
  expectedInclude: string[],
) {
  const actualIncluded = index.expressions.slice(index.key_count);
  return (
    actualIncluded.length === expectedInclude.length &&
    expectedInclude.every(
      (column, position) =>
        normalizeSqlExpression(actualIncluded[position] ?? "") ===
        normalizeSqlExpression(column),
    )
  );
}

function requireIndex(
  kind: "primary" | "security",
  tableName: string,
  name: string,
  actualIndexes: Map<string, ActualIndex>,
) {
  const index = actualIndexes.get(`${tableName}.${name}`);
  if (!index) {
    throw new Error(`${kind} expected index missing: ${tableName}.${name}`);
  }
  return index;
}

async function verifyIndex(
  kind: "primary" | "security",
  tableName: string,
  name: string,
  expected: SnapshotIndex,
  actualIndexes: Map<string, ActualIndex>,
  canonicalizeExpression: CanonicalizeExpression,
) {
  const index = requireIndex(kind, tableName, name, actualIndexes);
  const expectedColumns = expected.columns ?? [];
  const expectedOptions = Object.entries(expected.with ?? {})
    .map(([key, value]) => `${key}=${String(value)}`)
    .sort();
  const expectedPredicate = expected.where
    ? await canonicalizeExpression(tableName, expected.where)
    : null;
  const actualPredicate = index.predicate
    ? normalizeSqlExpression(index.predicate)
    : null;
  if (
    !(
      indexKeyColumnsMatch(index, expectedColumns, tableName) &&
      indexIncludedColumnsMatch(index, expected.include ?? [])
    ) ||
    index.is_unique !== Boolean(expected.isUnique) ||
    index.method !== (expected.method ?? "btree") ||
    JSON.stringify([...index.with_options].sort()) !==
      JSON.stringify(expectedOptions) ||
    actualPredicate !== expectedPredicate
  ) {
    throw new Error(`${kind} schema index differs: ${tableName}.${name}`);
  }
}

async function verifyIndexes(
  kind: "primary" | "security",
  tableName: string,
  table: SnapshotTable,
  actualIndexes: Map<string, ActualIndex>,
  canonicalizeExpression: CanonicalizeExpression,
) {
  await Promise.all(
    Object.entries(table.indexes ?? {}).map(([name, expected]) =>
      verifyIndex(
        kind,
        tableName,
        name,
        expected,
        actualIndexes,
        canonicalizeExpression,
      ),
    ),
  );
}

function verifyPrimaryKey(
  kind: "primary" | "security",
  tableName: string,
  table: SnapshotTable,
  primaryKeys: ActualConstraint[],
) {
  const expectedPrimaryKey =
    Object.values(table.compositePrimaryKeys ?? {})[0]?.columns ??
    Object.entries(table.columns)
      .filter(([, column]) => column.primaryKey)
      .map(([name]) => name);
  if (
    primaryKeys.length !== Number(expectedPrimaryKey.length > 0) ||
    (primaryKeys[0]?.columns.join("\0") ?? "") !== expectedPrimaryKey.join("\0")
  ) {
    throw new Error(`${kind} schema primary key differs: ${tableName}`);
  }
}

function requireConstraint(
  kind: "primary" | "security",
  tableName: string,
  name: string,
  type: string,
  actualConstraints: Map<string, ActualConstraint>,
) {
  // PostgreSQL stores identifiers at most 63 bytes; these generated names are ASCII.
  const constraint = actualConstraints.get(`${tableName}.${name.slice(0, 63)}`);
  if (!constraint || constraint.constraint_type !== type) {
    throw new Error(
      `${kind} expected constraint differs: ${tableName}.${name}`,
    );
  }
  return constraint;
}

function verifyForeignKeys(
  kind: "primary" | "security",
  tableName: string,
  table: SnapshotTable,
  actualConstraints: Map<string, ActualConstraint>,
) {
  for (const [name, expected] of Object.entries(table.foreignKeys ?? {})) {
    const constraint = requireConstraint(
      kind,
      tableName,
      name,
      "f",
      actualConstraints,
    );
    if (
      expected.tableFrom.split(".").at(-1) !== tableName ||
      constraint.referenced_table !== expected.tableTo.split(".").at(-1) ||
      constraint.columns.join("\0") !== expected.columnsFrom.join("\0") ||
      constraint.referenced_columns.join("\0") !==
        expected.columnsTo.join("\0") ||
      constraint.on_delete !== expected.onDelete ||
      constraint.on_update !== expected.onUpdate
    ) {
      throw new Error(
        `${kind} schema foreign key differs: ${tableName}.${name}`,
      );
    }
  }
}

function verifyUniqueConstraints(
  kind: "primary" | "security",
  tableName: string,
  table: SnapshotTable,
  actualConstraints: Map<string, ActualConstraint>,
) {
  for (const [name, expected] of Object.entries(
    table.uniqueConstraints ?? {},
  )) {
    const constraint = requireConstraint(
      kind,
      tableName,
      name,
      "u",
      actualConstraints,
    );
    const nullsNotDistinct = NULLS_NOT_DISTINCT.test(constraint.definition);
    if (
      constraint.columns.join("\0") !== expected.columns.join("\0") ||
      nullsNotDistinct !== Boolean(expected.nullsNotDistinct)
    ) {
      throw new Error(
        `${kind} schema unique constraint differs: ${tableName}.${name}`,
      );
    }
  }
}

async function verifyCheckConstraints(
  kind: "primary" | "security",
  tableName: string,
  table: SnapshotTable,
  actualConstraints: Map<string, ActualConstraint>,
  canonicalizeExpression: CanonicalizeExpression,
) {
  await Promise.all(
    Object.entries(table.checkConstraints ?? {}).map(
      async ([name, expected]) => {
        const constraint = requireConstraint(
          kind,
          tableName,
          name,
          "c",
          actualConstraints,
        );
        const expectedExpression = await canonicalizeExpression(
          tableName,
          expected.value,
        );
        if (
          !constraint.expression ||
          normalizeSqlExpression(constraint.expression) !== expectedExpression
        ) {
          throw new Error(
            `${kind} schema check constraint differs: ${tableName}.${name}`,
          );
        }
      },
    ),
  );
}

async function verifyTable(
  kind: "primary" | "security",
  tableName: string,
  table: SnapshotTable,
  actual: Map<string, { data_type: string; is_nullable: string }>,
  actualIndexes: Map<string, ActualIndex>,
  actualConstraints: Map<string, ActualConstraint>,
  primaryKeys: ActualConstraint[],
  canonicalizeExpression: CanonicalizeExpression,
) {
  verifyColumns(kind, tableName, table, actual);
  verifyPrimaryKey(kind, tableName, table, primaryKeys);
  verifyForeignKeys(kind, tableName, table, actualConstraints);
  verifyUniqueConstraints(kind, tableName, table, actualConstraints);
  await Promise.all([
    verifyIndexes(
      kind,
      tableName,
      table,
      actualIndexes,
      canonicalizeExpression,
    ),
    verifyCheckConstraints(
      kind,
      tableName,
      table,
      actualConstraints,
      canonicalizeExpression,
    ),
  ]);
}

const config = JSON.parse(
  readFileSync(
    join(import.meta.dir, "..", "..", "..", ".conductor", "neon.json"),
    "utf8",
  ),
) as { primary: ProjectConfig; security: ProjectConfig };
const workspaceId = process.env.CONDUCTOR_WORKSPACE_ID ?? "";
if (!workspaceId) {
  throw new Error("Conductor workspace identity is required");
}
try {
  execFileSync("git", ["fetch", "--quiet", "origin", "main"], {
    stdio: ["ignore", "pipe", "pipe"],
  });
} catch {
  // biome-ignore lint/style/useErrorCause: Git errors can contain local credential details.
  throw new Error("Could not refresh origin/main for migration verification");
}

function gitShow(path: string) {
  try {
    return execFileSync("git", ["show", `origin/main:${path}`], {
      stdio: ["ignore", "pipe", "ignore"],
    });
  } catch {
    // biome-ignore lint/style/useErrorCause: Git errors can contain repository paths or credentials.
    throw new Error("origin/main migration history is unavailable");
  }
}

function assertMainPrefix(folder: string, repoPath: string) {
  const candidate = JSON.parse(
    readFileSync(join(folder, "meta", "_journal.json"), "utf8"),
  ) as Journal;
  const main = JSON.parse(
    gitShow(`${repoPath}/meta/_journal.json`).toString(),
  ) as Journal;
  if (candidate.entries.length < main.entries.length) {
    throw new Error("Candidate journal omits origin/main migrations");
  }
  for (const [index, entry] of main.entries.entries()) {
    const current = candidate.entries[index];
    if (JSON.stringify(current) !== JSON.stringify(entry)) {
      throw new Error(
        `Candidate journal diverges from origin/main at ${entry.tag}`,
      );
    }
    const path = `${repoPath}/${entry.tag}.sql`;
    const originalHash = createHash("sha256")
      .update(gitShow(path))
      .digest("hex");
    const candidateHash = createHash("sha256")
      .update(readFileSync(join(folder, `${entry.tag}.sql`)))
      .digest("hex");
    if (originalHash !== candidateHash) {
      throw new Error(
        `Applied migration SQL differs from origin/main: ${entry.tag}`,
      );
    }
  }
  return candidate;
}

async function verifySnapshot(
  pool: Pool,
  snapshot: Snapshot,
  kind: "primary" | "security",
) {
  const client = await pool.connect();
  const expressionTables = new Map(
    Object.keys(snapshot.tables).map((tableKey) => [
      tableKey.split(".").at(-1) ?? tableKey,
      `cantiara_verify_${randomUUID().replaceAll("-", "")}`,
    ]),
  );
  let expressionConstraint = 0;
  const canonicalizeExpression = async (tableName: string, value: string) => {
    const parserTable = expressionTables.get(tableName);
    if (!parserTable) {
      throw new Error(
        `Snapshot expression references an unknown table: ${tableName}`,
      );
    }
    const constraintName = `snapshot_expr_${expressionConstraint}`;
    expressionConstraint += 1;
    const table = `pg_temp.${quoteIdentifier(parserTable)}`;
    const expectedSql = unqualifySnapshotExpression(value, tableName);
    await client.query(
      `ALTER TABLE ${table} ADD CONSTRAINT ${quoteIdentifier(constraintName)} CHECK (${expectedSql}) NOT VALID`,
    );
    try {
      const parsed = await client.query(
        "SELECT pg_get_expr(conbin, conrelid, true) AS expression FROM pg_constraint WHERE conrelid = to_regclass($1) AND conname = $2",
        [table, constraintName],
      );
      const parsedExpression = parsed.rows[0]?.expression;
      if (typeof parsedExpression !== "string") {
        throw new Error("PostgreSQL could not normalize a snapshot expression");
      }
      return normalizeSqlExpression(parsedExpression);
    } finally {
      await client.query(
        `ALTER TABLE ${table} DROP CONSTRAINT ${quoteIdentifier(constraintName)}`,
      );
    }
  };

  try {
    await Promise.all(
      [...expressionTables].map(([tableName, parserTable]) =>
        client.query(
          `CREATE TEMP TABLE ${quoteIdentifier(parserTable)} (LIKE public.${quoteIdentifier(tableName)})`,
        ),
      ),
    );
    const columns = await client.query(
      "SELECT table_name, column_name, data_type, is_nullable FROM information_schema.columns WHERE table_schema='public'",
    );
    const actual = new Map(
      columns.rows.map((row) => [`${row.table_name}.${row.column_name}`, row]),
    );
    const indexes = await client.query(`
      SELECT
        table_class.relname AS table_name,
        index_class.relname AS index_name,
        index_data.indisunique AS is_unique,
        access_method.amname AS method,
        pg_get_expr(index_data.indpred, index_data.indrelid, true) AS predicate,
        ARRAY(
          SELECT pg_get_indexdef(index_data.indexrelid, ordinal.number::integer, true)
          FROM generate_series(1, index_data.indnatts) AS ordinal(number)
          ORDER BY ordinal.number
        ) AS expressions,
        ARRAY(
          SELECT (index_data.indoption[ordinal.number - 1]::integer & 1) = 0
          FROM generate_series(1, index_data.indnkeyatts) AS ordinal(number)
          ORDER BY ordinal.number
        ) AS ascending,
        ARRAY(
          SELECT CASE
            WHEN (index_data.indoption[ordinal.number - 1]::integer & 2) = 2
              THEN 'first'
            ELSE 'last'
          END
          FROM generate_series(1, index_data.indnkeyatts) AS ordinal(number)
          ORDER BY ordinal.number
        ) AS nulls_order,
        COALESCE(index_class.reloptions, ARRAY[]::text[]) AS with_options,
        index_data.indnkeyatts AS key_count
      FROM pg_index index_data
      JOIN pg_class index_class ON index_class.oid = index_data.indexrelid
      JOIN pg_class table_class ON table_class.oid = index_data.indrelid
      JOIN pg_namespace table_namespace ON table_namespace.oid = table_class.relnamespace
      JOIN pg_am access_method ON access_method.oid = index_class.relam
      WHERE table_namespace.nspname = 'public'
    `);
    const actualIndexes = new Map<string, ActualIndex>(
      indexes.rows.map((row) => [
        `${row.table_name}.${row.index_name}`,
        row as ActualIndex,
      ]),
    );
    const constraints = await client.query(`
      SELECT
        table_class.relname AS table_name,
        constraint_data.conname AS constraint_name,
        constraint_data.contype AS constraint_type,
        referenced_table.relname AS referenced_table,
        ARRAY(
          SELECT attribute.attname
          FROM unnest(constraint_data.conkey) WITH ORDINALITY AS key_column(attnum, ordinal)
          JOIN pg_attribute attribute
            ON attribute.attrelid = constraint_data.conrelid
            AND attribute.attnum = key_column.attnum
          ORDER BY key_column.ordinal
        ) AS columns,
        ARRAY(
          SELECT attribute.attname
          FROM unnest(constraint_data.confkey) WITH ORDINALITY AS key_column(attnum, ordinal)
          JOIN pg_attribute attribute
            ON attribute.attrelid = constraint_data.confrelid
            AND attribute.attnum = key_column.attnum
          ORDER BY key_column.ordinal
        ) AS referenced_columns,
        CASE constraint_data.confdeltype
          WHEN 'a' THEN 'no action'
          WHEN 'r' THEN 'restrict'
          WHEN 'c' THEN 'cascade'
          WHEN 'n' THEN 'set null'
          WHEN 'd' THEN 'set default'
        END AS on_delete,
        CASE constraint_data.confupdtype
          WHEN 'a' THEN 'no action'
          WHEN 'r' THEN 'restrict'
          WHEN 'c' THEN 'cascade'
          WHEN 'n' THEN 'set null'
          WHEN 'd' THEN 'set default'
        END AS on_update,
        pg_get_expr(constraint_data.conbin, constraint_data.conrelid, true) AS expression,
        pg_get_constraintdef(constraint_data.oid, true) AS definition
      FROM pg_constraint constraint_data
      JOIN pg_class table_class ON table_class.oid = constraint_data.conrelid
      JOIN pg_namespace table_namespace ON table_namespace.oid = table_class.relnamespace
      LEFT JOIN pg_class referenced_table ON referenced_table.oid = constraint_data.confrelid
      WHERE table_namespace.nspname = 'public'
    `);
    const actualConstraints = new Map<string, ActualConstraint>(
      constraints.rows.map((row) => [
        `${row.table_name}.${row.constraint_name}`,
        row as ActualConstraint,
      ]),
    );
    await Promise.all(
      Object.entries(snapshot.tables).map(async ([tableKey, table]) => {
        const tableName = tableKey.split(".").at(-1) ?? tableKey;
        const tableConstraints = [...actualConstraints.values()].filter(
          (constraint) =>
            constraint.table_name === tableName &&
            constraint.constraint_type === "p",
        );
        await verifyTable(
          kind,
          tableName,
          table,
          actual,
          actualIndexes,
          actualConstraints,
          tableConstraints,
          canonicalizeExpression,
        );
      }),
    );
    return actual.size;
  } finally {
    await Promise.all(
      [...expressionTables.values()].map(async (parserTable) => {
        try {
          await client.query(
            `DROP TABLE IF EXISTS pg_temp.${quoteIdentifier(parserTable)}`,
          );
        } catch {
          // The verification branch is disposable and is deleted by the caller.
        }
      }),
    );
    client.release();
  }
}

async function verifyProject(
  kind: "primary" | "security",
  project: ProjectConfig,
  folder: string,
  repoPath: string,
) {
  const journal = assertMainPrefix(folder, repoPath);
  const name = `pr-check-${workspaceId.slice(0, 8)}-${Date.now()}`;
  const created = JSON.parse(
    await neon([
      "branches",
      "create",
      "--project-id",
      project.projectId,
      "--parent",
      project.productionBranchId,
      "--schema-only",
      "--name",
      name,
      "--output",
      "json",
    ]),
  ) as { branch?: { id: string }; id?: string };
  const branchId = created.branch?.id ?? created.id;
  if (!branchId) {
    throw new Error("Neon did not return a verification branch identity");
  }
  const record = {
    projectId: project.projectId,
    parentId: "",
    branchId,
    name,
    endpointId: "",
  };
  try {
    const branch = await getBranch(record);
    if (
      !branch ||
      branch.id !== branchId ||
      branch.project_id !== project.projectId ||
      branch.name !== name ||
      branch.primary ||
      branch.protected
    ) {
      throw new Error("Verification branch identity mismatch");
    }
    const connection = await neon([
      "connection-string",
      branchId,
      "--project-id",
      project.projectId,
    ]);
    const db = drizzle({ client: new Pool({ connectionString: connection }) });
    try {
      await db.$client.query("DROP SCHEMA IF EXISTS pgboss CASCADE");
      await db.$client.query("DROP SCHEMA IF EXISTS drizzle CASCADE");
      await db.$client.query("DROP SCHEMA public CASCADE");
      await db.$client.query("CREATE SCHEMA public");
      await migrate(db, { migrationsFolder: folder });
      const records = await db.$client.query(
        "SELECT created_at, hash FROM drizzle.__drizzle_migrations ORDER BY created_at",
      );
      const expected = journal.entries.map((entry) => ({
        time: String(entry.when),
        hash: createHash("sha256")
          .update(readFileSync(join(folder, `${entry.tag}.sql`)))
          .digest("hex"),
      }));
      if (
        records.rows.length !== expected.length ||
        records.rows.some(
          (row, index) =>
            String(row.created_at) !== expected[index]?.time ||
            row.hash !== expected[index]?.hash,
        )
      ) {
        throw new Error(`${kind} migration records or SQL hashes differ`);
      }

      const last = journal.entries.at(-1);
      if (!last) {
        throw new Error("Migration journal is empty");
      }
      const snapshot = JSON.parse(
        readFileSync(
          join(
            folder,
            "meta",
            `${String(last.idx).padStart(4, "0")}_snapshot.json`,
          ),
          "utf8",
        ),
      ) as Snapshot;
      const count = await verifySnapshot(db.$client, snapshot, kind);
      console.log(
        `${kind}: ${records.rows.length} migration hashes and ${count} columns verified`,
      );
    } finally {
      await db.$client.end();
    }
  } finally {
    const branch = await getBranch(record);
    if (
      branch &&
      branch.id === branchId &&
      branch.name === name &&
      branch.project_id === project.projectId &&
      !branch.primary &&
      !branch.protected
    ) {
      await neon([
        "branches",
        "delete",
        branchId,
        "--project-id",
        project.projectId,
      ]);
    }
  }
}

await verifyProject(
  "primary",
  config.primary,
  join(import.meta.dir, "..", "src", "migrations"),
  "packages/db/src/migrations",
);
await verifyProject(
  "security",
  config.security,
  join(import.meta.dir, "..", "src", "migrations", "security-events"),
  "packages/db/src/migrations/security-events",
);
