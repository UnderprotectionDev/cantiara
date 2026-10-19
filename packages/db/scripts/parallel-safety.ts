import type { MigrationSnapshot } from "./migration-repository";

// Every Conductor workspace shares one development database while running
// different Git branches. A migration applied from one branch must keep the
// older code of every other branch writable, so new migrations stay
// expand-only. Earlier migrations predate this rule and are not rechecked.
export const parallelSafetyBaselines = {
  primary: "0119_feedback_evidence_quality",
  securityEvents: "0003_repair_missing_security_event",
} as const;

const expandOnlyGuidance =
  'Rewrite it expand-only: add new columns as nullable or with a default; keep old columns and write both shapes instead of renaming or dropping; keep database checks wide and enforce narrower values in application validation; add keys or restrictions on existing columns later. Only after every branch using the old shape is merged may a separate migration start with "-- parallel-safety: contract <reason>".';

const contractAcknowledgement =
  /^\s*--[ \t]*parallel-safety:[ \t]*contract[ \t]+\S/;

type Table = MigrationSnapshot["tables"][string];

const sqlContractPatterns: [RegExp, string][] = [
  [
    /\bcreate\s+(?:or\s+replace\s+)?(?:constraint\s+)?trigger\b/i,
    "SQL creates a trigger",
  ],
  [/\bcreate\s+(?:or\s+replace\s+)?rule\b/i, "SQL creates a rule"],
  [
    /\bcreate\s+policy\b|\benable\s+row\s+level\s+security\b/i,
    "SQL adds row level security",
  ],
  [/\bdrop\s+(?:table|column)\b/i, "SQL drops a table or column"],
  [/\bdrop\s+type\b/i, "SQL drops a type"],
  [/\brename\b/i, "SQL renames an object"],
  [/\bset\s+not\s+null\b/i, "SQL makes a column required"],
  [
    /\balter\s+column\s+(?:"[^"]+"|\w+)\s+(?:set\s+data\s+)?type\b/i,
    "SQL changes a column type",
  ],
];

// Contract statements are matched on their keyword syntax only: comments and
// single-quoted literals are stripped first so a default like
// `DEFAULT 'rename helper'` cannot falsely report "SQL renames an object".
function withoutComments(sql: string) {
  return sql
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/--[^\n]*/g, " ")
    .replace(/'(?:[^']|'')*'/g, " ");
}

const textMembership =
  /^\s*\(?\s*(?:"[^"]+"\.)?"([^"]+)"\s+(?:in\s+\(((?:\s*'(?:[^']|'')*'\s*,?)+)\)|=\s*('(?:[^']|'')*'))\s*\)?\s*$/i;

function textCheckValues(value: string) {
  const match = textMembership.exec(value);
  if (!match) {
    return null;
  }
  return {
    column: match[1],
    values: [...(match[2] ?? match[3] ?? "").matchAll(/'((?:[^']|'')*)'/g)].map(
      (literal) => literal[1],
    ),
  };
}

function isCheckExpansion(
  previous: string | undefined,
  next: string,
  addedColumns: Set<string>,
) {
  const after = textCheckValues(next);
  if (!after?.column) {
    return false;
  }
  if (previous === undefined) {
    return addedColumns.has(after.column);
  }
  const before = textCheckValues(previous);
  return (
    before !== null &&
    before.column === after.column &&
    before.values.every((value) => after.values.includes(value))
  );
}

function sameDefinition(previous: unknown, next: unknown) {
  return JSON.stringify(previous) === JSON.stringify(next);
}

function touchesExistingColumns(columns: string[], addedColumns: Set<string>) {
  return columns.some((column) => !addedColumns.has(column));
}

function columnViolations(
  name: string,
  previous: Table,
  next: Table,
  addedColumns: Set<string>,
) {
  const violations: string[] = [];
  for (const [key, column] of Object.entries(previous.columns)) {
    const found = next.columns[key];
    if (!found) {
      violations.push(`Drops or renames column ${name}.${column.name}`);
      continue;
    }
    if (found.type !== column.type) {
      violations.push(`Changes the type of column ${name}.${column.name}`);
    }
    if (found.primaryKey !== column.primaryKey) {
      violations.push(`Changes the primary key column ${name}.${column.name}`);
    }
    if (found.notNull && !column.notNull) {
      violations.push(`Makes column ${name}.${column.name} required`);
    }
    if (
      found.notNull &&
      column.default !== undefined &&
      found.default === undefined
    ) {
      violations.push(
        `Removes the default of required column ${name}.${column.name}`,
      );
    }
  }
  for (const [key, column] of Object.entries(next.columns)) {
    if (previous.columns[key]) {
      continue;
    }
    addedColumns.add(column.name);
    if (column.notNull && column.default === undefined) {
      violations.push(
        `Adds required column ${name}.${column.name} without a default`,
      );
    }
  }
  return violations;
}

function constraintViolations(
  name: string,
  previous: Table,
  next: Table,
  addedColumns: Set<string>,
) {
  const violations: string[] = [];
  for (const [key, check] of Object.entries(next.checkConstraints)) {
    const previousValue = previous.checkConstraints[key]?.value;
    if (
      previousValue !== check.value &&
      !isCheckExpansion(previousValue, check.value, addedColumns)
    ) {
      violations.push(
        `Narrows or adds check constraint ${check.name} on ${name}`,
      );
    }
  }
  for (const [key, foreignKey] of Object.entries(next.foreignKeys)) {
    if (
      !sameDefinition(previous.foreignKeys[key], foreignKey) &&
      touchesExistingColumns(foreignKey.columnsFrom, addedColumns)
    ) {
      violations.push(
        `Adds or changes foreign key ${foreignKey.name} on ${name}`,
      );
    }
  }
  for (const [key, unique] of Object.entries(next.uniqueConstraints)) {
    if (
      !sameDefinition(previous.uniqueConstraints[key], unique) &&
      touchesExistingColumns(unique.columns, addedColumns)
    ) {
      violations.push(
        `Adds or changes unique constraint ${unique.name} on ${name}`,
      );
    }
  }
  for (const [key, index] of Object.entries(next.indexes)) {
    if (
      index.isUnique &&
      !sameDefinition(previous.indexes[key], index) &&
      touchesExistingColumns(
        index.columns.map((column) => column.expression),
        addedColumns,
      )
    ) {
      violations.push(`Adds or changes unique index ${index.name} on ${name}`);
    }
  }
  return violations;
}

// Older upserts name these keys as ON CONFLICT targets.
function droppedKeyViolations(name: string, previous: Table, next: Table) {
  const violations: string[] = [];
  for (const [key, unique] of Object.entries(previous.uniqueConstraints)) {
    if (!next.uniqueConstraints[key]) {
      violations.push(`Drops unique constraint ${unique.name} on ${name}`);
    }
  }
  for (const [key, index] of Object.entries(previous.indexes)) {
    if (index.isUnique && !next.indexes[key]) {
      violations.push(`Drops unique index ${index.name} on ${name}`);
    }
  }
  for (const [key, primaryKey] of Object.entries(
    previous.compositePrimaryKeys,
  )) {
    if (!next.compositePrimaryKeys[key]) {
      violations.push(`Drops primary key ${primaryKey.name} on ${name}`);
    }
  }
  return violations;
}

function primaryKeyViolations(name: string, previous: Table, next: Table) {
  const violations: string[] = [];
  for (const [key, primaryKey] of Object.entries(next.compositePrimaryKeys)) {
    if (!sameDefinition(previous.compositePrimaryKeys[key], primaryKey)) {
      violations.push(
        `Adds or changes primary key ${primaryKey.name} on ${name}`,
      );
    }
  }
  return violations;
}

function tableViolations(name: string, previous: Table, next: Table) {
  const addedColumns = new Set<string>();
  return [
    ...columnViolations(name, previous, next, addedColumns),
    ...constraintViolations(name, previous, next, addedColumns),
    ...droppedKeyViolations(name, previous, next),
    ...primaryKeyViolations(name, previous, next),
  ];
}

const nonRestrictingDeletes = new Set(["cascade", "set null", "set default"]);

// A new reference from any table makes older code's deletes of the
// referenced rows fail unless the reference follows the delete.
function restrictingReferenceViolations(
  previous: MigrationSnapshot,
  next: MigrationSnapshot,
) {
  const violations: string[] = [];
  const existingTables = new Set(
    Object.values(previous.tables).map((table) => table.name),
  );
  for (const [key, table] of Object.entries(next.tables)) {
    for (const [name, foreignKey] of Object.entries(table.foreignKeys)) {
      if (
        existingTables.has(foreignKey.tableTo) &&
        !nonRestrictingDeletes.has(foreignKey.onDelete ?? "no action") &&
        !sameDefinition(previous.tables[key]?.foreignKeys[name], foreignKey)
      ) {
        violations.push(
          `Adds foreign key ${foreignKey.name} restricting deletes from ${foreignKey.schemaTo || "public"}.${foreignKey.tableTo}`,
        );
      }
    }
  }
  return violations;
}

export function parallelSafetyViolations(
  previous: MigrationSnapshot,
  next: MigrationSnapshot,
  sql: string[],
) {
  const violations: string[] = [];
  for (const [key, table] of Object.entries(previous.tables)) {
    const name = `${table.schema || "public"}.${table.name}`;
    const found = next.tables[key];
    if (found) {
      violations.push(...tableViolations(name, table, found));
    } else {
      violations.push(`Drops or renames table ${name}`);
    }
  }
  violations.push(...restrictingReferenceViolations(previous, next));
  for (const [key, enumType] of Object.entries(previous.enums)) {
    const values = next.enums[key]?.values ?? [];
    if (!enumType.values.every((value) => values.includes(value))) {
      violations.push(
        `Removes values from enum ${enumType.schema}.${enumType.name}`,
      );
    }
  }
  for (const statement of sql) {
    const code = withoutComments(statement);
    for (const [pattern, message] of sqlContractPatterns) {
      if (pattern.test(code)) {
        violations.push(message);
      }
    }
  }
  return [...new Set(violations)];
}

const emptySnapshot: MigrationSnapshot = {
  dialect: "postgresql",
  enums: {},
  id: "00000000-0000-0000-0000-000000000000",
  prevId: "",
  tables: {},
  version: "7",
};

export function assertParallelSafeMigrations(
  repository: {
    entries: { tag: string }[];
    migrations: { sql: string[] }[];
    snapshots: MigrationSnapshot[];
  },
  baselineTag: string,
) {
  const baseline = repository.entries.findIndex(
    (entry) => entry.tag === baselineTag,
  );
  if (baseline < 0) {
    throw new Error(
      `Parallel safety baseline ${baselineTag} is not in the journal`,
    );
  }
  const acknowledged: string[] = [];
  for (const [index, entry] of repository.entries.entries()) {
    if (index <= baseline) {
      continue;
    }
    const sql = repository.migrations[index]?.sql ?? [];
    const violations = parallelSafetyViolations(
      repository.snapshots[index - 1] ?? emptySnapshot,
      repository.snapshots[index] ?? emptySnapshot,
      sql,
    );
    if (violations.length === 0) {
      continue;
    }
    if (contractAcknowledgement.test(sql[0] ?? "")) {
      acknowledged.push(entry.tag);
      continue;
    }
    throw new Error(
      `${entry.tag} is not safe for the shared development database: ${violations.join("; ")}. ${expandOnlyGuidance}`,
    );
  }
  return acknowledged;
}
