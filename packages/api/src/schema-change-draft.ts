import {
  addForeignKeySql,
  checkClause,
  columnNames,
  columnSql,
  createDomainSql,
  createEnumSql,
  createIndexSql,
  createTableSql,
  extensionWarnings,
  type SchemaWarning,
  stringLiteral,
  tableCreationOrder,
} from "./schema-ddl";
import {
  columnById,
  foldName,
  quoteIdent,
  type SchemaColumn,
  type SchemaDefinition,
  type SchemaForeignKey,
  type SchemaTable,
  tableById,
} from "./schema-definition";
import {
  checkSchemaInvariants,
  type ParsedType,
  parseColumnType,
  renderColumnType,
  type SchemaViolation,
} from "./schema-invariants";

const q = quoteIdent;

/** Closed operation catalog; the class decides warnings, confirmation and Down. */
export const OPERATION_CLASSES = {
  "Add check constraint": "Non-destructive",
  "Add column": "Non-destructive",
  "Add domain constraint": "Non-destructive",
  "Add enum value": "Non-destructive",
  "Add foreign key": "Non-destructive",
  "Add index": "Non-destructive",
  "Add primary key": "Non-destructive",
  "Add unique constraint": "Non-destructive",
  "Catalog-outside schema object": "Unsupported",
  "Change referential action": "Non-destructive",
  "Create domain": "Non-destructive",
  "Create enum type": "Non-destructive",
  "Create table": "Non-destructive",
  "Drop check constraint": "Potentially destructive",
  "Drop column": "Potentially destructive",
  "Drop default": "Non-destructive",
  "Drop domain": "Potentially destructive",
  "Drop domain constraint": "Potentially destructive",
  "Drop enum type": "Potentially destructive",
  "Drop enum value": "Unsupported",
  "Drop foreign key": "Potentially destructive",
  "Drop index": "Non-destructive",
  "Drop primary key": "Potentially destructive",
  "Drop table": "Potentially destructive",
  "Drop unique constraint": "Potentially destructive",
  "Free type conversion": "Unsupported",
  "Narrow column type": "Potentially destructive",
  "Relax nullability": "Non-destructive",
  "Rename column": "Non-destructive",
  "Rename enum value": "Non-destructive",
  "Rename table": "Non-destructive",
  "Schema-outside data operation": "Unsupported",
  "Set or change default": "Non-destructive",
  "Tighten nullability": "Non-destructive",
  "Widen column type": "Non-destructive",
} as const;

export type SchemaOperationName = keyof typeof OPERATION_CLASSES;
export type OperationClass = (typeof OPERATION_CLASSES)[SchemaOperationName];

/** Fixed phase order of the catalog; every statement carries its phase. */
export const SCHEMA_PHASES = [
  "Constraint drop",
  "Index drop",
  "Table then column rename",
  "Enum and domain create, enum add and rename",
  "Table create",
  "Column add",
  "Type, nullability and default change",
  "Primary key, unique and check add",
  "Index add",
  "Foreign key add",
  "Column drop",
  "Table drop",
  "Enum type and domain drop",
] as const;

export interface SchemaStatement {
  /** Inverse statement when the whole operation is reversible, else null. */
  inverse: string | null;
  key: string;
  /** 1 to 13, see `SCHEMA_PHASES`. */
  phase: number;
  sql: string;
  /** Orders statements of one phase, for example FK before check in phase 1. */
  sub: number;
}

export interface SchemaOperation {
  class: OperationClass;
  /** Criterion item that makes the operation ineligible for Safe Down. */
  downCriterion: string | null;
  id: string;
  operation: SchemaOperationName;
  path: string;
  statements: SchemaStatement[];
  warnings: SchemaWarning[];
}

export interface SchemaBlocker {
  operation: SchemaOperationName;
  path: string;
  reason: string;
}

export interface SchemaChangeDraft {
  blockers: SchemaBlocker[];
  operations: SchemaOperation[];
  /** Ordered Up statements; empty while blocked. */
  upSql: string;
  violations: SchemaViolation[];
  warnings: SchemaWarning[];
}

const INELIGIBLE_CRITERION: Partial<Record<SchemaOperationName, string>> = {
  "Add enum value":
    "PostgreSQL cannot remove an enum label, so the inverse is not expressible.",
  "Catalog-outside schema object": "Unsupported differences have no inverse.",
  "Drop check constraint":
    "Dropping a check loses a guarantee that depends on data written later.",
  "Drop column": "Dropping a column loses its data and dependent definitions.",
  "Drop domain": "Dropping a domain loses its definition and constraints.",
  "Drop domain constraint":
    "Dropping a constraint loses a guarantee that depends on data written later.",
  "Drop enum type": "Dropping an enum type loses its labels.",
  "Drop enum value": "PostgreSQL cannot remove an enum label.",
  "Drop foreign key":
    "Dropping a foreign key loses a guarantee that depends on data written later.",
  "Drop primary key":
    "Dropping a primary key loses a guarantee that depends on data written later.",
  "Drop table": "Dropping a table loses all of its rows and its definition.",
  "Drop unique constraint":
    "Dropping a unique constraint loses a guarantee that depends on data written later.",
  "Free type conversion": "A free conversion needs a data expression.",
  "Narrow column type": "Narrowing a type can truncate or overflow data.",
  "Schema-outside data operation": "A data statement has no schema inverse.",
};

function unsupportedBlocker(
  name: SchemaOperationName,
  path: string,
  reason: string,
): SchemaOperation {
  return {
    class: OPERATION_CLASSES[name],
    downCriterion: INELIGIBLE_CRITERION[name] ?? reason,
    id: `${name}:${path}`,
    operation: name,
    path,
    statements: [],
    warnings: [{ code: "destructive", message: reason, path }],
  };
}

function operation(
  name: SchemaOperationName,
  path: string,
  statements: Array<{
    inverse: string | null;
    key?: string;
    phase: number;
    sql: string;
    sub?: number;
  }>,
  warnings: SchemaWarning[] = [],
): SchemaOperation {
  const destructive = OPERATION_CLASSES[name] === "Potentially destructive";
  const downCriterion = INELIGIBLE_CRITERION[name] ?? null;
  return {
    class: OPERATION_CLASSES[name],
    downCriterion,
    id: `${name}:${path}`,
    operation: name,
    path,
    statements: statements.map((statement) => ({
      inverse: downCriterion ? null : statement.inverse,
      key: statement.key ?? path,
      phase: statement.phase,
      sql: statement.sql,
      sub: statement.sub ?? 0,
    })),
    warnings: destructive
      ? [
          ...warnings,
          {
            code: "destructive",
            message: INELIGIBLE_CRITERION[name] ?? "Potentially destructive.",
            path,
          },
        ]
      : warnings,
  };
}

const existingData = (path: string, message: string): SchemaWarning => ({
  code: "existing-data",
  message,
  path,
});
const reverseData = (path: string): SchemaWarning => ({
  code: "reverse-data",
  message:
    "Data written after Up is lost when Down runs; nothing about running Down is promised.",
  path,
});

/** Name used while a rename needs a free slot; deterministic from the ID. */
function tempName(id: string): string {
  return `_cantiara_tmp_${id.toLowerCase().replaceAll(/[^a-z0-9]/g, "_")}`.slice(
    0,
    63,
  );
}

const NUMERIC_PARAMS = /^\((\d+)(?:,(\d+))?\)$/;
const WIDEN_RANK = ["smallint", "integer", "bigint"];

function numericParams(params: string): [number, number] | null {
  const match = NUMERIC_PARAMS.exec(params);
  return match?.[1] ? [Number(match[1]), Number(match[2] ?? 0)] : null;
}

function isWidening(from: ParsedType, to: ParsedType): boolean {
  if (from.array || to.array) {
    return false;
  }
  if (from.category === "integer" && to.category === "integer") {
    return WIDEN_RANK.indexOf(from.base) < WIDEN_RANK.indexOf(to.base);
  }
  if (from.base === "real" && to.base === "double precision") {
    return true;
  }
  if (from.base === "numeric" && to.base === "numeric") {
    const a = numericParams(from.params);
    const b = numericParams(to.params);
    return !!a && !!b && a[1] === b[1] && b[0] > a[0];
  }
  if (from.base === "varchar" && to.base === "varchar") {
    const a = numericParams(from.params);
    const b = numericParams(to.params);
    return !!a && !!b && b[0] > a[0];
  }
  return from.base === "varchar" && to.base === "text" && !!from.params;
}

function columnTypeOperation(
  source: SchemaDefinition,
  target: SchemaDefinition,
  was: SchemaColumn,
  now: SchemaColumn,
  path: string,
  names: { column: string; table: string },
): SchemaOperation | null {
  if (was.type === now.type) {
    return null;
  }
  const from = parseColumnType(source, was.type);
  const to = parseColumnType(target, now.type);
  if (!(from && to)) {
    return unsupportedBlocker(
      "Free type conversion",
      path,
      `Type change ${was.type} → ${now.type} cannot be resolved.`,
    );
  }
  if (
    from.base === to.base &&
    from.params === to.params &&
    from.array === to.array
  ) {
    return null;
  }
  const alter = (type: string) =>
    `ALTER TABLE ${q(names.table)} ALTER COLUMN ${q(names.column)} TYPE ${type};`;
  const fromSql = renderColumnType(source, was.type);
  const toSql = renderColumnType(target, now.type);
  if (isWidening(from, to)) {
    return operation(
      "Widen column type",
      path,
      [{ inverse: alter(fromSql), phase: 7, sql: alter(toSql), sub: 0 }],
      [reverseData(path)],
    );
  }
  const narrowing =
    isWidening(to, from) ||
    (from.base === "numeric" &&
      to.base === "numeric" &&
      !!numericParams(from.params) &&
      !!numericParams(to.params)) ||
    (from.base === "text" && to.base === "varchar" && !!to.params);
  if (narrowing) {
    return operation(
      "Narrow column type",
      path,
      [{ inverse: null, phase: 7, sql: alter(toSql), sub: 0 }],
      [
        {
          code: "destructive",
          message: `Narrowing ${was.type} → ${now.type} can truncate or overflow existing values.`,
          path,
        },
      ],
    );
  }
  return unsupportedBlocker(
    "Free type conversion",
    path,
    `Changing ${was.type} to ${now.type} needs a USING expression, which is data SQL and is not generated.`,
  );
}

interface RenameStep {
  /** Name after the optional free-up step (temporary or final). */
  current: string;
  post: { from: string; to: string } | null;
  pre: { from: string; to: string } | null;
}

/**
 * Renames by stable ID. A name that is swapped, chained or reused by an
 * element created before the old one drops is first moved to a deterministic
 * temporary name, so every step stays valid in PostgreSQL.
 */
function planRenames(
  items: Array<{ id: string; from: string; to: string | null }>,
  targetNames: Map<string, string>,
): Map<string, RenameStep> {
  const plan = new Map<string, RenameStep>();
  for (const item of items) {
    const changes = item.to === null || item.from !== item.to;
    if (!changes) {
      continue;
    }
    const taken = [...targetNames.entries()].some(
      ([id, name]) => id !== item.id && foldName(name) === foldName(item.from),
    );
    const temp = taken ? tempName(item.id) : null;
    plan.set(item.id, {
      current: temp ?? (item.to === null ? item.from : item.to),
      post: item.to === null ? null : { from: temp ?? item.from, to: item.to },
      pre: temp ? { from: item.from, to: temp } : null,
    });
  }
  return plan;
}

function renameStatements(
  step: RenameStep,
  render: (from: string, to: string) => string,
  key: string,
  subs: { post: number; pre: number },
) {
  return [
    ...(step.pre ? [{ ...step.pre, sub: subs.pre }] : []),
    ...(step.post ? [{ ...step.post, sub: subs.post }] : []),
  ].map(({ from, sub, to }) => ({
    inverse: render(to, from),
    key: `${key}:${sub}`,
    phase: 3,
    sql: render(from, to),
    sub,
  }));
}

function enumPlacement(before?: string, after?: string): string {
  if (before !== undefined) {
    return `AFTER ${stringLiteral(before)}`;
  }
  return after === undefined ? "" : `BEFORE ${stringLiteral(after)}`;
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: One catalog rule per branch; splitting would hide the rule list.
function diffEnums(
  source: SchemaDefinition,
  target: SchemaDefinition,
  out: SchemaOperation[],
) {
  for (const entry of target.enums) {
    const was = source.enums.find(({ id }) => id === entry.id);
    const path = `enums.${entry.name}`;
    if (!was) {
      out.push(
        operation("Create enum type", path, [
          {
            inverse: `DROP TYPE ${q(entry.name)};`,
            key: entry.name,
            phase: 4,
            sql: createEnumSql(entry),
          },
        ]),
      );
      continue;
    }
    if (foldName(was.name) !== foldName(entry.name)) {
      out.push(
        unsupportedBlocker(
          "Catalog-outside schema object",
          path,
          `Renaming enum type ${was.name} → ${entry.name} is not in the operation catalog.`,
        ),
      );
    }
    for (const label of entry.labels) {
      const previous = was.labels.find(({ id }) => id === label.id);
      if (!previous) {
        const position = entry.labels.indexOf(label);
        const before = entry.labels[position - 1];
        const after = entry.labels[position + 1];
        const placement = enumPlacement(before?.value, after?.value);
        out.push(
          operation("Add enum value", `${path}.${label.value}`, [
            {
              inverse: null,
              key: `${entry.name}:${position}`,
              phase: 4,
              sql: `ALTER TYPE ${q(entry.name)} ADD VALUE ${stringLiteral(label.value)}${placement ? ` ${placement}` : ""};`,
              sub: 1,
            },
          ]),
        );
      } else if (previous.value !== label.value) {
        out.push(
          operation("Rename enum value", `${path}.${label.value}`, [
            {
              inverse: `ALTER TYPE ${q(entry.name)} RENAME VALUE ${stringLiteral(label.value)} TO ${stringLiteral(previous.value)};`,
              key: `${entry.name}:${label.id}`,
              phase: 4,
              sql: `ALTER TYPE ${q(entry.name)} RENAME VALUE ${stringLiteral(previous.value)} TO ${stringLiteral(label.value)};`,
              sub: 2,
            },
          ]),
        );
      }
    }
    for (const label of was.labels) {
      if (!entry.labels.some(({ id }) => id === label.id)) {
        out.push(
          unsupportedBlocker(
            "Drop enum value",
            `${path}.${label.value}`,
            `PostgreSQL cannot remove label ${label.value} from enum ${entry.name}.`,
          ),
        );
      }
    }
  }
  for (const entry of source.enums) {
    if (!target.enums.some(({ id }) => id === entry.id)) {
      out.push(
        operation("Drop enum type", `enums.${entry.name}`, [
          {
            inverse: null,
            phase: 13,
            sql: `DROP TYPE ${q(entry.name)};`,
            sub: 0,
          },
        ]),
      );
    }
  }
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: One catalog rule per branch; splitting would hide the rule list.
function diffDomains(
  source: SchemaDefinition,
  target: SchemaDefinition,
  out: SchemaOperation[],
) {
  for (const domain of target.domains) {
    const was = source.domains.find(({ id }) => id === domain.id);
    const path = `domains.${domain.name}`;
    if (!was) {
      out.push(
        operation("Create domain", path, [
          {
            inverse: `DROP DOMAIN ${q(domain.name)};`,
            key: domain.name,
            phase: 4,
            sql: createDomainSql(target, domain),
            sub: 3,
          },
        ]),
      );
      continue;
    }
    if (
      foldName(was.name) !== foldName(domain.name) ||
      was.baseType !== domain.baseType ||
      was.default !== domain.default ||
      was.notNull !== domain.notNull
    ) {
      out.push(
        unsupportedBlocker(
          "Catalog-outside schema object",
          path,
          `Domain ${domain.name} changes its name, base type, default or NOT NULL, which the catalog cannot express.`,
        ),
      );
    }
    for (const check of domain.checks) {
      const previous = was.checks.find(({ id }) => id === check.id);
      const same =
        previous &&
        previous.name === check.name &&
        previous.operator === check.operator &&
        previous.value === check.value;
      if (same) {
        continue;
      }
      const checkPath = `${path}.checks.${check.name}`;
      if (previous) {
        out.push(
          operation(
            "Drop domain constraint",
            `${path}.checks.${previous.name}`,
            [
              {
                inverse: null,
                phase: 1,
                sql: `ALTER DOMAIN ${q(domain.name)} DROP CONSTRAINT ${q(previous.name)};`,
                sub: 5,
              },
            ],
          ),
        );
      }
      out.push(
        operation(
          "Add domain constraint",
          checkPath,
          [
            {
              inverse: `ALTER DOMAIN ${q(domain.name)} DROP CONSTRAINT ${q(check.name)};`,
              phase: 8,
              sql: `ALTER DOMAIN ${q(domain.name)} ADD CONSTRAINT ${q(check.name)} CHECK (VALUE ${check.operator} ${check.value});`,
              sub: 4,
            },
          ],
          [
            existingData(
              checkPath,
              "Existing values that violate the constraint make this fail; no data fix is generated.",
            ),
          ],
        ),
      );
    }
    for (const check of was.checks) {
      if (!domain.checks.some(({ id }) => id === check.id)) {
        out.push(
          operation("Drop domain constraint", `${path}.checks.${check.name}`, [
            {
              inverse: null,
              phase: 1,
              sql: `ALTER DOMAIN ${q(domain.name)} DROP CONSTRAINT ${q(check.name)};`,
              sub: 5,
            },
          ]),
        );
      }
    }
  }
  for (const domain of source.domains) {
    if (!target.domains.some(({ id }) => id === domain.id)) {
      out.push(
        operation("Drop domain", `domains.${domain.name}`, [
          {
            inverse: null,
            phase: 13,
            sql: `DROP DOMAIN ${q(domain.name)};`,
            sub: 1,
          },
        ]),
      );
    }
  }
}

function sameForeignKeyShape(
  a: SchemaForeignKey,
  b: SchemaForeignKey,
): boolean {
  return (
    a.name === b.name &&
    a.refTableId === b.refTableId &&
    JSON.stringify(a.columnIds) === JSON.stringify(b.columnIds) &&
    JSON.stringify(a.refColumnIds) === JSON.stringify(b.refColumnIds)
  );
}

interface TableNames {
  column: (tableId: string, columnId: string, phase: "old" | "new") => string;
  table: (tableId: string, phase: "old" | "new") => string;
}

function dropForeignKey(
  tableName: string,
  fk: SchemaForeignKey,
  inverse: string | null,
) {
  return {
    inverse,
    key: `${tableName}:${fk.name}`,
    phase: 1,
    sql: `ALTER TABLE ${q(tableName)} DROP CONSTRAINT ${q(fk.name)};`,
    sub: 0,
  };
}

/** Statements that compare constraints and indexes of one surviving table. */
// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: One catalog rule per branch; splitting would hide the rule list.
function diffTableConstraints(
  source: SchemaDefinition,
  target: SchemaDefinition,
  was: SchemaTable,
  now: SchemaTable,
  names: TableNames,
  out: SchemaOperation[],
) {
  const oldTable = names.table(was.id, "old");
  const newTable = names.table(now.id, "new");
  const base = `tables.${now.name}`;
  const oldCols = (ids: string[]) => columnNames(was, ids);
  const newCols = (ids: string[]) => columnNames(now, ids);

  const oldKey = was.primaryKey?.columnIds.join(",") ?? null;
  const newKey = now.primaryKey?.columnIds.join(",") ?? null;
  if (oldKey !== newKey) {
    if (was.primaryKey) {
      out.push(
        operation("Drop primary key", `${base}.primaryKey`, [
          {
            inverse: null,
            key: oldTable,
            phase: 1,
            sql: `ALTER TABLE ${q(oldTable)} DROP CONSTRAINT ${q(`${was.name}_pkey`)};`,
            sub: 3,
          },
        ]),
      );
    }
    if (now.primaryKey) {
      out.push(
        operation(
          "Add primary key",
          `${base}.primaryKey`,
          [
            {
              inverse: `ALTER TABLE ${q(newTable)} DROP CONSTRAINT ${q(`${now.name}_pkey`)};`,
              key: newTable,
              phase: 8,
              sql: `ALTER TABLE ${q(newTable)} ADD CONSTRAINT ${q(`${now.name}_pkey`)} PRIMARY KEY (${newCols(now.primaryKey.columnIds).map(q).join(", ")});`,
              sub: 0,
            },
          ],
          [
            existingData(
              `${base}.primaryKey`,
              "Existing duplicate or NULL rows make this fail; no data fix is generated.",
            ),
          ],
        ),
      );
    }
  }

  for (const unique of was.uniques) {
    const next = now.uniques.find(({ id }) => id === unique.id);
    if (
      !next ||
      next.name !== unique.name ||
      oldCols(unique.columnIds).join() !== newCols(next.columnIds).join()
    ) {
      out.push(
        operation("Drop unique constraint", `${base}.uniques.${unique.name}`, [
          {
            inverse: null,
            key: `${oldTable}:${unique.name}`,
            phase: 1,
            sql: `ALTER TABLE ${q(oldTable)} DROP CONSTRAINT ${q(unique.name)};`,
            sub: 2,
          },
        ]),
      );
    }
  }
  for (const unique of now.uniques) {
    const previous = was.uniques.find(({ id }) => id === unique.id);
    if (
      !previous ||
      previous.name !== unique.name ||
      oldCols(previous.columnIds).join() !== newCols(unique.columnIds).join()
    ) {
      const path = `${base}.uniques.${unique.name}`;
      out.push(
        operation(
          "Add unique constraint",
          path,
          [
            {
              inverse: `ALTER TABLE ${q(newTable)} DROP CONSTRAINT ${q(unique.name)};`,
              key: `${newTable}:${unique.name}`,
              phase: 8,
              sql: `ALTER TABLE ${q(newTable)} ADD CONSTRAINT ${q(unique.name)} UNIQUE (${newCols(unique.columnIds).map(q).join(", ")});`,
              sub: 1,
            },
          ],
          [
            existingData(
              path,
              "Existing duplicate rows make this fail; no data fix is generated.",
            ),
          ],
        ),
      );
    }
  }

  const sameCheck = (a: SchemaTable["checks"][number], b: typeof a) =>
    a.name === b.name &&
    a.operator === b.operator &&
    a.value === b.value &&
    columnNames(was, a.columnId ? [a.columnId] : []).join() ===
      columnNames(now, b.columnId ? [b.columnId] : []).join();
  for (const check of was.checks) {
    const next = now.checks.find(({ id }) => id === check.id);
    if (!(next && sameCheck(check, next))) {
      out.push(
        operation("Drop check constraint", `${base}.checks.${check.name}`, [
          {
            inverse: null,
            key: `${oldTable}:${check.name}`,
            phase: 1,
            sql: `ALTER TABLE ${q(oldTable)} DROP CONSTRAINT ${q(check.name)};`,
            sub: 1,
          },
        ]),
      );
    }
  }
  for (const check of now.checks) {
    const previous = was.checks.find(({ id }) => id === check.id);
    if (!(previous && sameCheck(previous, check))) {
      const path = `${base}.checks.${check.name}`;
      out.push(
        operation(
          "Add check constraint",
          path,
          [
            {
              inverse: `ALTER TABLE ${q(newTable)} DROP CONSTRAINT ${q(check.name)};`,
              key: `${newTable}:${check.name}`,
              phase: 8,
              sql: `ALTER TABLE ${q(newTable)} ADD CONSTRAINT ${q(check.name)} CHECK (${checkClause(check, now)});`,
              sub: 2,
            },
          ],
          [
            existingData(
              path,
              "Existing rows that violate the check make this fail; no data fix is generated.",
            ),
          ],
        ),
      );
    }
  }

  for (const index of was.indexes) {
    const next = now.indexes.find(({ id }) => id === index.id);
    const changed =
      !next ||
      JSON.stringify(indexShape(was, index)) !==
        JSON.stringify(indexShape(now, next));
    if (changed) {
      out.push(
        operation("Drop index", `${base}.indexes.${index.name}`, [
          {
            inverse: createIndexSql(was, index),
            key: `${oldTable}:${index.name}`,
            phase: 2,
            sql: `DROP INDEX ${q(index.name)};`,
          },
        ]),
      );
    }
  }
  for (const index of now.indexes) {
    const previous = was.indexes.find(({ id }) => id === index.id);
    if (
      !previous ||
      JSON.stringify(indexShape(was, previous)) !==
        JSON.stringify(indexShape(now, index))
    ) {
      out.push(
        operation("Add index", `${base}.indexes.${index.name}`, [
          {
            inverse: `DROP INDEX ${q(index.name)};`,
            key: `${newTable}:${index.name}`,
            phase: 9,
            sql: createIndexSql(now, index),
          },
        ]),
      );
    }
  }

  for (const fk of was.foreignKeys) {
    const next = now.foreignKeys.find(({ id }) => id === fk.id);
    if (!(next && sameForeignKeyShape(fk, next))) {
      out.push(
        operation("Drop foreign key", `${base}.foreignKeys.${fk.name}`, [
          dropForeignKey(oldTable, fk, null),
        ]),
      );
    } else if (next.onDelete !== fk.onDelete || next.onUpdate !== fk.onUpdate) {
      out.push(
        operation(
          "Change referential action",
          `${base}.foreignKeys.${fk.name}`,
          [
            {
              ...dropForeignKey(
                oldTable,
                fk,
                addForeignKeySql(source, was, fk),
              ),
              sub: 0,
            },
            {
              inverse: `ALTER TABLE ${q(newTable)} DROP CONSTRAINT ${q(next.name)};`,
              key: `${newTable}:${next.name}`,
              phase: 10,
              sql: addForeignKeySql(target, now, next),
              sub: 0,
            },
          ],
        ),
      );
    }
  }
  for (const fk of now.foreignKeys) {
    const previous = was.foreignKeys.find(({ id }) => id === fk.id);
    if (!(previous && sameForeignKeyShape(previous, fk))) {
      out.push(addForeignKey(target, now, fk, newTable));
    }
  }
}

function addForeignKey(
  target: SchemaDefinition,
  table: SchemaTable,
  fk: SchemaForeignKey,
  tableName: string,
): SchemaOperation {
  const path = `tables.${table.name}.foreignKeys.${fk.name}`;
  return operation(
    "Add foreign key",
    path,
    [
      {
        inverse: `ALTER TABLE ${q(tableName)} DROP CONSTRAINT ${q(fk.name)};`,
        key: `${tableName}:${fk.name}`,
        phase: 10,
        sql: addForeignKeySql(target, table, fk),
        sub: 0,
      },
    ],
    [
      existingData(
        path,
        "Existing rows without a match make this fail; no data fix is generated.",
      ),
    ],
  );
}

function indexShape(table: SchemaTable, index: SchemaTable["indexes"][number]) {
  return {
    columns: index.columns.map(({ columnId, opclass }) => [
      columnNames(table, [columnId])[0],
      opclass,
    ]),
    method: index.method,
    name: index.name,
    unique: index.unique,
    where: index.where
      ? [columnNames(table, [index.where.columnId])[0], index.where.predicate]
      : null,
  };
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: One catalog rule per branch; splitting would hide the rule list.
function diffColumns(
  source: SchemaDefinition,
  target: SchemaDefinition,
  was: SchemaTable,
  now: SchemaTable,
  names: TableNames,
  out: SchemaOperation[],
) {
  const newTable = names.table(now.id, "new");
  const base = `tables.${now.name}.columns`;

  const renamePlan = planRenames(
    [
      ...now.columns.flatMap((column) => {
        const previous = columnById(was, column.id);
        return previous
          ? [{ from: previous.name, id: column.id, to: column.name }]
          : [];
      }),
      ...was.columns
        .filter(({ id }) => !columnById(now, id))
        .map((column) => ({ from: column.name, id: column.id, to: null })),
    ],
    new Map(now.columns.map((column) => [column.id, column.name])),
  );
  const renameColumn = (from: string, to: string) =>
    `ALTER TABLE ${q(newTable)} RENAME COLUMN ${q(from)} TO ${q(to)};`;
  for (const column of was.columns) {
    const step = renamePlan.get(column.id);
    const next = columnById(now, column.id);
    if (step && (next || step.pre)) {
      out.push(
        operation(
          "Rename column",
          `tables.${now.name}.columns.${next?.name ?? column.name}`,
          renameStatements(step, renameColumn, `${now.name}:${column.id}`, {
            post: 3,
            pre: 2,
          }),
        ),
      );
    }
  }

  for (const column of now.columns) {
    const previous = columnById(was, column.id);
    const path = `${base}.${column.name}`;
    if (!previous) {
      const warnings: SchemaWarning[] = [reverseData(path)];
      if (!column.nullable && column.default === null && !column.identity) {
        warnings.push(
          existingData(
            path,
            "A NOT NULL column without a default fails on tables with rows; no backfill is generated.",
          ),
        );
      }
      out.push(
        operation(
          "Add column",
          path,
          [
            {
              inverse: `ALTER TABLE ${q(newTable)} DROP COLUMN ${q(column.name)};`,
              key: `${newTable}:${String(now.columns.indexOf(column)).padStart(4, "0")}`,
              phase: 6,
              sql: `ALTER TABLE ${q(newTable)} ADD COLUMN ${columnSql(target, column)};`,
            },
          ],
          warnings,
        ),
      );
      continue;
    }
    const current = names.column(now.id, column.id, "new");
    const typeOp = columnTypeOperation(source, target, previous, column, path, {
      column: current,
      table: newTable,
    });
    if (typeOp) {
      out.push(typeOp);
    }
    if (previous.identity !== column.identity) {
      out.push(
        unsupportedBlocker(
          "Catalog-outside schema object",
          path,
          `Identity change on ${column.name} is not in the operation catalog.`,
        ),
      );
    }
    if (previous.nullable !== column.nullable) {
      const alter = (clause: string) =>
        `ALTER TABLE ${q(newTable)} ALTER COLUMN ${q(current)} ${clause};`;
      out.push(
        column.nullable
          ? operation("Relax nullability", path, [
              {
                inverse: alter("SET NOT NULL"),
                key: `${newTable}:${current}`,
                phase: 7,
                sql: alter("DROP NOT NULL"),
                sub: 1,
              },
            ])
          : operation(
              "Tighten nullability",
              path,
              [
                {
                  inverse: alter("DROP NOT NULL"),
                  key: `${newTable}:${current}`,
                  phase: 7,
                  sql: alter("SET NOT NULL"),
                  sub: 1,
                },
              ],
              [
                existingData(
                  path,
                  "Existing NULL rows make SET NOT NULL fail; no backfill is generated.",
                ),
              ],
            ),
      );
    }
    if (previous.default !== column.default) {
      const alter = (value: string | null) =>
        `ALTER TABLE ${q(newTable)} ALTER COLUMN ${q(current)} ${
          value === null ? "DROP DEFAULT" : `SET DEFAULT ${value}`
        };`;
      out.push(
        column.default === null
          ? operation("Drop default", path, [
              {
                inverse: alter(previous.default),
                key: `${newTable}:${current}`,
                phase: 7,
                sql: alter(null),
                sub: 2,
              },
            ])
          : operation("Set or change default", path, [
              {
                inverse: alter(previous.default),
                key: `${newTable}:${current}`,
                phase: 7,
                sql: alter(column.default),
                sub: 2,
              },
            ]),
      );
    }
  }
  for (const column of was.columns) {
    if (!columnById(now, column.id)) {
      const path = `tables.${was.name}.columns.${column.name}`;
      const current = renamePlan.get(column.id)?.current ?? column.name;
      out.push(
        operation("Drop column", path, [
          {
            inverse: null,
            key: `${newTable}:${current}`,
            phase: 11,
            sql: `ALTER TABLE ${q(newTable)} DROP COLUMN ${q(current)};`,
          },
        ]),
      );
    }
  }
}

/** Computes the typed schema-only difference of two exact definitions. */
export function buildSchemaChangeDraft(
  source: SchemaDefinition,
  target: SchemaDefinition,
): SchemaChangeDraft {
  const violations = [
    ...checkSchemaInvariants(source).map((violation) => ({
      ...violation,
      path: `source.${violation.path}`,
    })),
    ...checkSchemaInvariants(target).map((violation) => ({
      ...violation,
      path: `target.${violation.path}`,
    })),
  ];
  if (violations.length > 0) {
    return {
      blockers: [],
      operations: [],
      upSql: "",
      violations,
      warnings: [],
    };
  }

  const out: SchemaOperation[] = [];
  diffEnums(source, target, out);
  diffDomains(source, target, out);

  const tableRenames = planRenames(
    [
      ...target.tables.flatMap((table) => {
        const previous = tableById(source, table.id);
        return previous
          ? [{ from: previous.name, id: table.id, to: table.name }]
          : [];
      }),
      ...source.tables
        .filter(({ id }) => !tableById(target, id))
        .map((table) => ({ from: table.name, id: table.id, to: null })),
    ],
    new Map(target.tables.map((table) => [table.id, table.name])),
  );
  const renameTable = (from: string, to: string) =>
    `ALTER TABLE ${q(from)} RENAME TO ${q(to)};`;
  const names: TableNames = {
    column: (tableId, columnId, phase) => {
      const table = tableById(phase === "old" ? source : target, tableId);
      return table ? (columnById(table, columnId)?.name ?? columnId) : columnId;
    },
    table: (tableId, phase) => {
      if (phase === "old") {
        return tableById(source, tableId)?.name ?? tableId;
      }
      return tableById(target, tableId)?.name ?? tableId;
    },
  };

  for (const table of target.tables) {
    const previous = tableById(source, table.id);
    const path = `tables.${table.name}`;
    if (!previous) {
      out.push(
        operation(
          "Create table",
          path,
          [
            {
              inverse: `DROP TABLE ${q(table.name)};`,
              key: String(tableCreationOrder(target).indexOf(table)).padStart(
                5,
                "0",
              ),
              phase: 5,
              sql: createTableSql(target, table),
            },
          ],
          [reverseData(path)],
        ),
      );
      for (const index of table.indexes) {
        out.push(
          operation("Add index", `${path}.indexes.${index.name}`, [
            {
              inverse: `DROP INDEX ${q(index.name)};`,
              key: `${table.name}:${index.name}`,
              phase: 9,
              sql: createIndexSql(table, index),
            },
          ]),
        );
      }
      for (const fk of table.foreignKeys) {
        out.push(addForeignKey(target, table, fk, table.name));
      }
      continue;
    }
    const step = tableRenames.get(table.id);
    if (step) {
      out.push(
        operation(
          "Rename table",
          path,
          renameStatements(step, renameTable, table.name, { post: 1, pre: 0 }),
        ),
      );
    }
    diffColumns(source, target, previous, table, names, out);
    diffTableConstraints(source, target, previous, table, names, out);
  }

  for (const table of source.tables) {
    if (tableById(target, table.id)) {
      continue;
    }
    const path = `tables.${table.name}`;
    const step = tableRenames.get(table.id);
    const current = step?.current ?? table.name;
    if (step?.pre) {
      out.push(
        operation(
          "Rename table",
          path,
          renameStatements(
            { ...step, post: null },
            renameTable,
            `${table.name}:free`,
            { post: 1, pre: 0 },
          ),
        ),
      );
    }
    const order = [...tableCreationOrder(source)].reverse().indexOf(table);
    out.push(
      operation("Drop table", path, [
        {
          inverse: null,
          key: String(order).padStart(5, "0"),
          phase: 12,
          sql: `DROP TABLE ${q(current)};`,
        },
      ]),
    );
  }

  const blockers: SchemaBlocker[] = out
    .filter(({ class: kind }) => kind === "Unsupported")
    .map(({ operation: name, path, warnings }) => ({
      operation: name,
      path,
      reason: warnings[0]?.message ?? "Not in the operation catalog.",
    }));
  const ordered = orderOperations(out);
  const statements = ordered
    .flatMap(({ statements: list }) => list)
    .sort(compareStatements);
  return {
    blockers,
    operations: ordered,
    upSql: joinUp(blockers.length > 0 ? [] : statements),
    violations: [],
    warnings: [
      ...extensionWarnings(target),
      ...ordered.flatMap(({ warnings }) => warnings),
    ],
  };
}

function joinUp(statements: SchemaStatement[]): string {
  return statements.length > 0
    ? `${statements.map(({ sql }) => sql).join("\n")}\n`
    : "";
}

function compareText(a: string, b: string): number {
  if (a === b) {
    return 0;
  }
  return a < b ? -1 : 1;
}

export function compareStatements(
  a: SchemaStatement,
  b: SchemaStatement,
): number {
  return a.phase - b.phase || a.sub - b.sub || compareText(a.key, b.key);
}

/** Presentation order of operations: by first statement, then name. */
function orderOperations(operations: SchemaOperation[]): SchemaOperation[] {
  const first = (item: SchemaOperation) =>
    [...item.statements].sort(compareStatements)[0];
  return [...operations].sort((a, b) => {
    const left = first(a);
    const right = first(b);
    if (left && right) {
      return compareStatements(left, right) || a.id.localeCompare(b.id);
    }
    if (left || right) {
      return left ? -1 : 1;
    }
    return a.id.localeCompare(b.id);
  });
}

export function destructiveOperations(
  draft: Pick<SchemaChangeDraft, "operations">,
): SchemaOperation[] {
  return draft.operations.filter(
    ({ class: kind }) => kind === "Potentially destructive",
  );
}
