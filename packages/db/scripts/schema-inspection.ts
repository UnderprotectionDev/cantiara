import type { Pool } from "@neondatabase/serverless";
import type { MigrationSnapshot } from "./migration-repository";

interface DatabaseColumn {
  column_name: string;
  data_type: string;
  default_expression: string | null;
  not_null: boolean;
  schema_name: string;
  table_name: string;
}

const publicSchemaPrefix = /^public\./;
const checkPrefix = /^CHECK\s*/;
type MigrationTable = MigrationSnapshot["tables"][string];

interface ExpressionComparison {
  actual: string | null;
  allowTextCheckExpansion?: boolean;
  expected: string | undefined;
}

function normalizedType(value: string) {
  return value
    .replaceAll('"', "")
    .replace(publicSchemaPrefix, "")
    .replace("timestamp without time zone", "timestamp")
    .replace("timestamp with time zone", "timestamptz")
    .replace("character varying", "varchar");
}

function postgresName(value: string) {
  let name = "";
  for (const character of value) {
    if (Buffer.byteLength(name + character) > 63) {
      break;
    }
    name += character;
  }
  return name;
}

async function compareExpressions(
  client: Pick<Pool, "query">,
  schema: string,
  table: string,
  comparisons: ExpressionComparison[],
) {
  const matches = comparisons.map(({ expected, actual }) =>
    expected === undefined ? actual === null : expected === actual,
  );
  const pending = comparisons.flatMap((comparison, index) =>
    matches[index] ||
    comparison.expected === undefined ||
    comparison.actual === null
      ? []
      : [
          {
            index,
            expected: comparison.expected,
            actual: comparison.actual,
            allowTextCheckExpansion:
              comparison.allowTextCheckExpansion ?? false,
          },
        ],
  );
  if (pending.length === 0) {
    return matches;
  }

  const identifier = (value: string) => `"${value.replaceAll('"', '""')}"`;
  const comparisonBatchSize = 32;
  for (let offset = 0; offset < pending.length; offset += comparisonBatchSize) {
    const batch = pending.slice(offset, offset + comparisonBatchSize);
    const expressions = batch.flatMap(({ expected, actual }) => [
      `(${expected})`,
      `(${actual})`,
    ]);
    // biome-ignore lint/performance/noAwaitInLoops: Compare bounded batches on the same database inspection connection.
    const plan = await client.query<{
      "QUERY PLAN": { Plan: { Output: string[] } }[];
    }>(
      `EXPLAIN (VERBOSE, COSTS OFF, FORMAT JSON) SELECT ${expressions.join(", ")} FROM ${identifier(schema)}.${identifier(table)}`,
    );
    const output = plan.rows[0]?.["QUERY PLAN"][0]?.Plan.Output;
    if (!output || output.length !== expressions.length) {
      throw new Error("Database expression could not be inspected");
    }
    for (const [batchIndex, comparison] of batch.entries()) {
      const expectedOutput = output[batchIndex * 2];
      const actualOutput = output[batchIndex * 2 + 1];
      if (expectedOutput === undefined || actualOutput === undefined) {
        throw new Error("Database expression could not be inspected");
      }
      const expectedPlan = [expectedOutput];
      const actualPlan = [actualOutput];
      matches[comparison.index] =
        JSON.stringify(expectedPlan) === JSON.stringify(actualPlan) ||
        (comparison.allowTextCheckExpansion &&
          textCheckExpansion(expectedPlan, actualPlan));
    }
  }
  return matches;
}

// Only accept planner-normalized single-column text equality/membership.
// More complex expressions remain strict; no constraint is executed on product rows.
const textMembership =
  /^\(([a-z_][a-z0-9_]*) = (?:'([A-Za-z0-9 _-]+)'::text|ANY \('\{([A-Za-z0-9 _",-]+)\}'::text\[\]\))\)$/;
const simpleArrayLabel = /^(?:[A-Za-z0-9_-]+|"[A-Za-z0-9 _-]+")$/;

function textCheckValues(output: string[] | undefined) {
  if (output?.length !== 1) {
    return null;
  }
  const match = textMembership.exec(output[0] ?? "");
  if (!match) {
    return null;
  }
  const values =
    match[2] === undefined ? (match[3] ?? "").split(",") : [match[2]];
  if (
    match[2] === undefined &&
    !values.every((value) => simpleArrayLabel.test(value))
  ) {
    return null;
  }
  return {
    column: match[1],
    values: values.map((value) => value.replaceAll('"', "")),
  };
}

function textCheckExpansion(
  expected: string[] | undefined,
  actual: string[] | undefined,
) {
  const before = textCheckValues(expected);
  const after = textCheckValues(actual);
  return (
    before !== null &&
    after !== null &&
    before.column === after.column &&
    before.values.every((value) => after.values.includes(value))
  );
}

const nonNullLiteralDefault =
  /^(?:'(?:[^']|'')*'|[-+]?[0-9]+(?:\.[0-9]+)?|true|false)(?:::(?:text|jsonb?|boolean|integer|bigint|smallint|numeric|uuid|date|timestamp(?: with(?:out)? time zone)?))?$/;

function compatibleAddedColumn(column: DatabaseColumn) {
  return (
    !column.not_null ||
    (column.default_expression !== null &&
      nonNullLiteralDefault.test(column.default_expression))
  );
}

export function compareDatabaseColumns(
  snapshot: MigrationSnapshot,
  actual: DatabaseColumn[],
  development = false,
) {
  const issues: string[] = [];
  for (const table of Object.values(snapshot.tables)) {
    const schema = table.schema || "public";
    const name = `${schema}.${table.name}`;
    const columns = actual.filter(
      (column) =>
        column.schema_name === schema && column.table_name === table.name,
    );
    if (columns.length === 0) {
      issues.push(`Missing table ${name}`);
      continue;
    }
    for (const column of Object.values(table.columns)) {
      const found = columns.find(
        (candidate) => candidate.column_name === column.name,
      );
      if (!found) {
        issues.push(`Missing column ${name}.${column.name}`);
      } else if (
        normalizedType(found.data_type) !== normalizedType(column.type) ||
        found.not_null !== column.notNull
      ) {
        issues.push(`Column type/nullability differs: ${name}.${column.name}`);
      }
    }
    for (const column of columns) {
      if (
        !(
          table.columns[column.column_name] ||
          (development && compatibleAddedColumn(column))
        )
      ) {
        issues.push(`Unexpected column ${name}.${column.column_name}`);
      }
    }
  }
  return issues;
}

interface DatabaseConstraint {
  columns: string[];
  definition: string;
  delete_action: string;
  name: string;
  nulls_not_distinct: boolean;
  reference_columns: string[];
  reference_schema: string | null;
  reference_table: string | null;
  schema_name: string;
  table_name: string;
  type: string;
  update_action: string;
  validated: boolean;
}

interface DatabaseIndex {
  ascending: boolean[];
  columns: string[];
  include_count: number;
  is_constraint_backed: boolean;
  is_unique: boolean;
  method: string;
  name: string;
  nulls_first: boolean[];
  predicate: string | null;
  schema_name: string;
  table_name: string;
  valid: boolean;
}

const actions: Record<string, string> = {
  a: "no action",
  r: "restrict",
  c: "cascade",
  n: "set null",
  d: "set default",
};

export async function inspectDatabaseSchema(
  client: Pick<Pool, "query">,
  snapshot: MigrationSnapshot,
  deep = false,
  development = false,
) {
  const columns = await client.query<DatabaseColumn>(`
    SELECT n.nspname AS schema_name, t.relname AS table_name, a.attname AS column_name,
      format_type(a.atttypid, a.atttypmod) AS data_type, a.attnotnull AS not_null,
      pg_get_expr(d.adbin, d.adrelid) AS default_expression
    FROM pg_class t JOIN pg_namespace n ON n.oid = t.relnamespace
    JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum > 0 AND NOT a.attisdropped
    LEFT JOIN pg_attrdef d ON d.adrelid = t.oid AND d.adnum = a.attnum
    WHERE n.nspname = 'public' AND t.relkind IN ('r', 'p')
  `);
  const issues = compareDatabaseColumns(snapshot, columns.rows, development);
  if (!deep || issues.length > 0) {
    return issues;
  }
  const constraints = await client.query<DatabaseConstraint>(`
    SELECT c.conname AS name, t.relname AS table_name, c.contype AS type,
      c.convalidated AS validated, c.confdeltype AS delete_action, c.confupdtype AS update_action,
      pg_get_constraintdef(c.oid) AS definition, rt.relname AS reference_table,
      rn.nspname AS reference_schema, n.nspname AS schema_name,
      COALESCE(ci.indnullsnotdistinct, false) AS nulls_not_distinct,
      ARRAY(SELECT a.attname::text FROM unnest(c.conkey) WITH ORDINALITY k(num, ord)
        JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = k.num ORDER BY k.ord) AS columns,
      ARRAY(SELECT a.attname::text FROM unnest(c.confkey) WITH ORDINALITY k(num, ord)
        JOIN pg_attribute a ON a.attrelid = c.confrelid AND a.attnum = k.num ORDER BY k.ord) AS reference_columns
    FROM pg_constraint c JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace LEFT JOIN pg_class rt ON rt.oid = c.confrelid
    LEFT JOIN pg_namespace rn ON rn.oid = rt.relnamespace
    LEFT JOIN pg_index ci ON ci.indexrelid = c.conindid
    WHERE n.nspname = 'public'
  `);
  const indexes = await client.query<DatabaseIndex>(`
    SELECT n.nspname AS schema_name, t.relname AS table_name, ic.relname AS name, i.indisunique AS is_unique,
      COALESCE(c.contype IN ('p', 'u'), false) AS is_constraint_backed,
      i.indisvalid AS valid, am.amname AS method, i.indnatts - i.indnkeyatts AS include_count,
      pg_get_expr(i.indpred, i.indrelid) AS predicate,
      ARRAY(SELECT pg_get_indexdef(i.indexrelid, pos, true) FROM generate_series(1, i.indnkeyatts) pos) AS columns,
      ARRAY(SELECT (i.indoption[pos] & 1) = 0 FROM generate_series(0, i.indnkeyatts - 1) pos) AS ascending,
      ARRAY(SELECT (i.indoption[pos] & 2) = 2 FROM generate_series(0, i.indnkeyatts - 1) pos) AS nulls_first
    FROM pg_index i JOIN pg_class t ON t.oid = i.indrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace JOIN pg_class ic ON ic.oid = i.indexrelid
    JOIN pg_am am ON am.oid = ic.relam
    LEFT JOIN pg_constraint c
      ON c.conindid = i.indexrelid
      AND c.conrelid = i.indrelid
      AND c.contype IN ('p', 'u')
    WHERE n.nspname = 'public'
  `);
  const tableIssues = await Promise.all(
    Object.values(snapshot.tables).map(async (table) => {
      const actualConstraints = constraints.rows.filter(
        (constraint) =>
          constraint.schema_name === (table.schema || "public") &&
          constraint.table_name === table.name,
      );
      const actualIndexes = indexes.rows.filter(
        (index) =>
          index.schema_name === (table.schema || "public") &&
          index.table_name === table.name,
      );
      const detailIssues = await compareTableExpressions(
        client,
        table,
        columns.rows,
        actualConstraints,
        actualIndexes,
        development,
      );
      return [
        ...compareKeys(table, actualConstraints),
        ...compareUniqueConstraints(table, actualConstraints),
        ...detailIssues,
      ];
    }),
  );
  issues.push(...tableIssues.flat());
  const enumIssues = await Promise.all(
    Object.values(snapshot.enums).map(async (enumeration) => {
      const labels = await client.query<{ label: string }>(
        `
      SELECT e.enumlabel AS label FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
      JOIN pg_namespace n ON n.oid = t.typnamespace
      WHERE n.nspname = $1 AND t.typname = $2 ORDER BY e.enumsortorder
    `,
        [enumeration.schema, enumeration.name],
      );
      return JSON.stringify(labels.rows.map((row) => row.label)) ===
        JSON.stringify(enumeration.values)
        ? []
        : [`Enum differs: ${enumeration.schema}.${enumeration.name}`];
    }),
  );
  issues.push(...enumIssues.flat());
  return issues;
}

function compareKeys(table: MigrationTable, constraints: DatabaseConstraint[]) {
  const issues: string[] = [];
  const primaryKeys = Object.values(table.compositePrimaryKeys).map(
    (key) => key.columns,
  );
  const columnPrimary = Object.values(table.columns)
    .filter((column) => column.primaryKey)
    .map((column) => column.name);
  if (columnPrimary.length > 0) {
    primaryKeys.push(columnPrimary);
  }
  for (const primary of primaryKeys) {
    if (
      !constraints.some(
        (constraint) =>
          constraint.type === "p" &&
          JSON.stringify(constraint.columns) === JSON.stringify(primary),
      )
    ) {
      issues.push(`Primary key differs: ${table.name}`);
    }
  }
  for (const foreign of Object.values(table.foreignKeys)) {
    const found = constraints.find(
      (constraint) =>
        constraint.name === postgresName(foreign.name) &&
        constraint.type === "f",
    );
    if (
      !found?.validated ||
      found.reference_table !== foreign.tableTo ||
      found.reference_schema !== (foreign.schemaTo || "public") ||
      JSON.stringify(found.columns) !== JSON.stringify(foreign.columnsFrom) ||
      JSON.stringify(found.reference_columns) !==
        JSON.stringify(foreign.columnsTo) ||
      actions[found.delete_action] !== (foreign.onDelete ?? "no action") ||
      actions[found.update_action] !== (foreign.onUpdate ?? "no action")
    ) {
      issues.push(`Foreign key differs: ${table.name}.${foreign.name}`);
    }
  }
  return issues;
}

function compareUniqueConstraints(
  table: MigrationTable,
  constraints: DatabaseConstraint[],
) {
  const issues: string[] = [];
  for (const unique of Object.values(table.uniqueConstraints)) {
    const found = constraints.find(
      (constraint) =>
        constraint.name === postgresName(unique.name) &&
        constraint.type === "u",
    );
    if (
      !found ||
      JSON.stringify(found.columns) !== JSON.stringify(unique.columns) ||
      found.nulls_not_distinct !== (unique.nullsNotDistinct ?? false)
    ) {
      issues.push(`Unique constraint differs: ${table.name}.${unique.name}`);
    }
  }
  const expectedNames = new Set(
    [
      ...Object.values(table.foreignKeys),
      ...Object.values(table.uniqueConstraints),
      ...Object.values(table.checkConstraints),
    ].map((constraint) => postgresName(constraint.name)),
  );
  for (const constraint of constraints) {
    if (
      ["f", "u", "c"].includes(constraint.type) &&
      !expectedNames.has(constraint.name)
    ) {
      issues.push(`Unexpected constraint: ${table.name}.${constraint.name}`);
    }
  }
  return issues;
}

async function compareTableExpressions(
  client: Pick<Pool, "query">,
  table: MigrationTable,
  columns: DatabaseColumn[],
  constraints: DatabaseConstraint[],
  indexes: DatabaseIndex[],
  development: boolean,
) {
  const comparisons: ExpressionComparison[] = [];
  const addComparison = (
    expected: string | undefined,
    actual: string | null,
    allowTextCheckExpansion = false,
  ) => {
    const index = comparisons.length;
    comparisons.push({ expected, actual, allowTextCheckExpansion });
    return index;
  };
  const defaultChecks: Array<{ comparisonIndex: number; issue: string }> = [];
  for (const column of Object.values(table.columns)) {
    const found = columns.find(
      (candidate) =>
        candidate.schema_name === (table.schema || "public") &&
        candidate.table_name === table.name &&
        candidate.column_name === column.name,
    );
    if (found) {
      defaultChecks.push({
        comparisonIndex: addComparison(
          column.default === undefined ? undefined : String(column.default),
          found.default_expression,
        ),
        issue: `Column default differs: ${table.name}.${column.name}`,
      });
    }
  }

  const checkChecks: Array<{
    comparisonIndex?: number;
    issue: string;
  }> = [];
  for (const check of Object.values(table.checkConstraints)) {
    const found = constraints.find(
      (constraint) =>
        constraint.name === postgresName(check.name) && constraint.type === "c",
    );
    const issue = `Check constraint differs: ${table.name}.${check.name}`;
    if (!found?.validated) {
      checkChecks.push({ issue });
      continue;
    }
    checkChecks.push({
      comparisonIndex: addComparison(
        check.value,
        found.definition.replace(checkPrefix, ""),
        development,
      ),
      issue,
    });
  }

  const expectedNames = new Set(
    Object.values(table.indexes).map((index) => postgresName(index.name)),
  );
  const indexChecks: Array<{
    comparisonIndexes: number[];
    metadataMatches: boolean;
    issue: string;
  }> = [];
  for (const index of Object.values(table.indexes)) {
    const found = indexes.find(
      (candidate) => candidate.name === postgresName(index.name),
    );
    const issue = `Index differs: ${table.name}.${index.name}`;
    if (
      !found?.valid ||
      found.is_unique !== index.isUnique ||
      found.method !== index.method ||
      found.include_count !== 0 ||
      found.columns.length !== index.columns.length
    ) {
      indexChecks.push({
        comparisonIndexes: [],
        metadataMatches: false,
        issue,
      });
      continue;
    }
    const comparisonIndexes = [
      addComparison(index.where, found.predicate),
      ...index.columns.map((column, position) =>
        addComparison(column.expression, found.columns[position] ?? null),
      ),
    ];
    indexChecks.push({
      comparisonIndexes,
      metadataMatches: index.columns.every(
        (column, position) =>
          found.ascending[position] === column.asc &&
          found.nulls_first[position] === (column.nulls === "first"),
      ),
      issue,
    });
  }

  const expressionMatches = await compareExpressions(
    client,
    table.schema || "public",
    table.name,
    comparisons,
  );
  const defaultIssues = defaultChecks
    .filter(({ comparisonIndex }) => !expressionMatches[comparisonIndex])
    .map(({ issue }) => issue);
  const checkIssues = checkChecks
    .filter(
      ({ comparisonIndex }) =>
        comparisonIndex === undefined || !expressionMatches[comparisonIndex],
    )
    .map(({ issue }) => issue);
  const indexIssues = indexChecks
    .filter(
      ({ comparisonIndexes, metadataMatches }) =>
        !metadataMatches ||
        comparisonIndexes.some((index) => !expressionMatches[index]),
    )
    .map(({ issue }) => issue);
  const unexpectedUniqueIndexes = indexes
    .filter(
      (index) =>
        index.is_unique &&
        !index.is_constraint_backed &&
        !expectedNames.has(index.name),
    )
    .map((index) => `Unexpected unique index: ${table.name}.${index.name}`);
  return [
    ...defaultIssues,
    ...checkIssues,
    ...indexIssues,
    ...unexpectedUniqueIndexes,
  ];
}
