import {
  columnById,
  foldName,
  INDEX_METHODS,
  isValidIdentifier,
  REFERENTIAL_ACTIONS,
  type SchemaColumn,
  type SchemaDefinition,
  type SchemaTable,
  tableById,
} from "./schema-definition";

/** Closed invariant catalog; a model passes only when none is violated. */
export const SCHEMA_INVARIANTS = [
  "Unique table name",
  "Unique column name",
  "Valid identifier",
  "Primary key present",
  "Foreign key end exists",
  "Foreign key type match",
  "Composite column list validity",
  "Index column and method validity",
  "Non-duplicate index definition",
  "Referential action validity",
  "Nullability and default consistency",
  "Enum and domain value validity",
  "Sortable foreign key graph",
] as const;

/** Rejections that are not an invariant: the extension matrix and type catalog. */
export const SCHEMA_MATRIX_CHECKS = [
  "Extension not in matrix",
  "Type not in catalog",
] as const;

export type SchemaInvariantName =
  | (typeof SCHEMA_INVARIANTS)[number]
  | (typeof SCHEMA_MATRIX_CHECKS)[number];

export interface SchemaViolation {
  invariant: SchemaInvariantName;
  /** Exact element path, for example `tables.orders.columns.user_id`. */
  path: string;
  /** Which definition fixes it. */
  requirement: string;
}

/** `pg_trgm` is the only extension the matrix allows. */
export const ALLOWED_EXTENSIONS = ["pg_trgm"] as const;
export const REJECTED_EXTENSIONS = [
  "postgis",
  "vector",
  "citext",
  "hstore",
  "uuid-ossp",
  "pgcrypto",
] as const;

export type TypeCategory =
  | "integer"
  | "float"
  | "numeric"
  | "boolean"
  | "text"
  | "uuid"
  | "temporal"
  | "json"
  | "bytea"
  | "search"
  | "enum"
  | "domain";

export interface ParsedType {
  array: boolean;
  /** Canonical base name without parameters, or the enum/domain id. */
  base: string;
  category: TypeCategory;
  /** Extension the type needs, when it is off-matrix. */
  extension: string | null;
  params: string;
}

const BASE_TYPES: Record<string, [string, TypeCategory]> = {
  bigint: ["bigint", "integer"],
  bool: ["boolean", "boolean"],
  boolean: ["boolean", "boolean"],
  bytea: ["bytea", "bytea"],
  date: ["date", "temporal"],
  "double precision": ["double precision", "float"],
  float4: ["real", "float"],
  float8: ["double precision", "float"],
  int: ["integer", "integer"],
  int2: ["smallint", "integer"],
  int4: ["integer", "integer"],
  int8: ["bigint", "integer"],
  integer: ["integer", "integer"],
  interval: ["interval", "temporal"],
  jsonb: ["jsonb", "json"],
  numeric: ["numeric", "numeric"],
  real: ["real", "float"],
  smallint: ["smallint", "integer"],
  text: ["text", "text"],
  time: ["time", "temporal"],
  timestamptz: ["timestamptz", "temporal"],
  tsquery: ["tsquery", "search"],
  tsvector: ["tsvector", "search"],
  uuid: ["uuid", "uuid"],
  varchar: ["varchar", "text"],
};

const EXTENSION_TYPES: Record<string, string> = {
  citext: "citext",
  geography: "postgis",
  geometry: "postgis",
  hstore: "hstore",
  vector: "vector",
};

/** Resolves a column type string; `null` means it is not in the type catalog. */
export function parseColumnType(
  definition: SchemaDefinition,
  type: string,
): ParsedType | null {
  const array = type.endsWith("[]");
  const bare = (array ? type.slice(0, -2) : type).trim();
  if (bare.startsWith("enum:")) {
    return definition.enums.some(({ id }) => id === bare.slice(5))
      ? {
          array,
          base: bare,
          category: "enum",
          extension: null,
          params: "",
        }
      : null;
  }
  if (bare.startsWith("domain:")) {
    return definition.domains.some(({ id }) => id === bare.slice(7))
      ? {
          array,
          base: bare,
          category: "domain",
          extension: null,
          params: "",
        }
      : null;
  }
  const match = TYPE_PATTERN.exec(bare);
  if (!match?.[1]) {
    return null;
  }
  const name = match[1].toLowerCase();
  const params = (match[2] ?? "").replaceAll(/\s/g, "");
  const extension = EXTENSION_TYPES[name];
  if (extension) {
    return {
      array,
      base: name,
      category: "text",
      extension,
      params,
    };
  }
  const known = BASE_TYPES[name];
  if (!known) {
    return null;
  }
  return {
    array,
    base: known[0],
    category: known[1],
    extension: null,
    params,
  };
}

export function renderColumnType(
  definition: SchemaDefinition,
  type: string,
): string {
  const parsed = parseColumnType(definition, type);
  if (!parsed) {
    return type;
  }
  const suffix = parsed.array ? "[]" : "";
  if (parsed.category === "enum") {
    const found = definition.enums.find(
      ({ id }) => id === parsed.base.slice(5),
    );
    return `${found ? quoted(found.name) : parsed.base}${suffix}`;
  }
  if (parsed.category === "domain") {
    const found = definition.domains.find(
      ({ id }) => id === parsed.base.slice(7),
    );
    return `${found ? quoted(found.name) : parsed.base}${suffix}`;
  }
  return `${parsed.base}${parsed.params}${suffix}`;
}

function quoted(name: string): string {
  return PLAIN_NAME.test(name) ? name : `"${name.replaceAll('"', '""')}"`;
}

type DefaultKind =
  | "number"
  | "string"
  | "boolean"
  | "null"
  | "temporal-function"
  | "uuid-function"
  | "invalid";

const TYPE_PATTERN = /^([a-z0-9_ ]+?)\s*(\(\s*\d+\s*(,\s*\d+\s*)?\))?$/i;
const VECTOR_CLASS = /^(vector|halfvec|sparsevec|bit)_\w+_ops$/;
const POSTGIS_CLASS = /^(gist_|gin_)?(geometry|geography)_\w*ops$/;
const NUMERIC_VALUE = /^-?\d/;
const PLAIN_NAME = /^[a-z_][a-z0-9_$]*$/;
const NUMBER_DEFAULT = /^-?\d+(\.\d+)?$/;
const STRING_DEFAULT = /^'([^']|'')*'$/;
const BOOLEAN_DEFAULT = /^(true|false)$/i;
const NULL_DEFAULT = /^null$/i;
const TEMPORAL_DEFAULT =
  /^(now\(\)|current_timestamp|current_date|current_time)$/i;
const UUID_DEFAULT = /^gen_random_uuid\(\)$/i;
const UUID_VALUE =
  /^'[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'$/i;
const EXTENSION_FUNCTIONS: [RegExp, string][] = [
  [/^uuid_generate_v\d\(\)$/i, "uuid-ossp"],
  [/^(crypt|gen_salt|digest|hmac|pgp_\w+|gen_random_bytes)\(/i, "pgcrypto"],
];

function classifyDefault(expression: string): {
  extension: string | null;
  kind: DefaultKind;
} {
  const text = expression.trim();
  for (const [pattern, extension] of EXTENSION_FUNCTIONS) {
    if (pattern.test(text)) {
      return { extension, kind: "invalid" };
    }
  }
  if (NUMBER_DEFAULT.test(text)) {
    return { extension: null, kind: "number" };
  }
  if (STRING_DEFAULT.test(text)) {
    return { extension: null, kind: "string" };
  }
  if (BOOLEAN_DEFAULT.test(text)) {
    return { extension: null, kind: "boolean" };
  }
  if (NULL_DEFAULT.test(text)) {
    return { extension: null, kind: "null" };
  }
  if (TEMPORAL_DEFAULT.test(text)) {
    return { extension: null, kind: "temporal-function" };
  }
  if (UUID_DEFAULT.test(text)) {
    return { extension: null, kind: "uuid-function" };
  }
  return { extension: null, kind: "invalid" };
}

function defaultFitsType(
  definition: SchemaDefinition,
  parsed: ParsedType,
  expression: string,
): boolean {
  const { kind } = classifyDefault(expression);
  if (kind === "invalid") {
    return false;
  }
  if (kind === "null") {
    return true;
  }
  if (parsed.array) {
    return kind === "string";
  }
  switch (parsed.category) {
    case "integer":
    case "float":
    case "numeric":
      return kind === "number";
    case "boolean":
      return kind === "boolean";
    case "text":
    case "json":
    case "bytea":
    case "search":
      return kind === "string";
    case "uuid":
      return (
        kind === "uuid-function" ||
        (kind === "string" && UUID_VALUE.test(expression.trim()))
      );
    case "temporal":
      return kind === "string" || kind === "temporal-function";
    case "enum": {
      const found = definition.enums.find(
        ({ id }) => id === parsed.base.slice(5),
      );
      const label = expression.trim().slice(1, -1).replaceAll("''", "'");
      return (
        kind === "string" &&
        !!found?.labels.some(({ value }) => value === label)
      );
    }
    case "domain": {
      const domain = definition.domains.find(
        ({ id }) => id === parsed.base.slice(7),
      );
      const base = domain ? parseColumnType(definition, domain.baseType) : null;
      return base ? defaultFitsType(definition, base, expression) : false;
    }
    default:
      return false;
  }
}

const INTEGER_RANK = ["smallint", "integer", "bigint"];

function typesMatch(a: ParsedType, b: ParsedType): boolean {
  if (a.array !== b.array) {
    return false;
  }
  if (a.category === "enum" || a.category === "domain") {
    return a.base === b.base;
  }
  if (b.category === "enum" || b.category === "domain") {
    return false;
  }
  if (a.category === "integer" && b.category === "integer") {
    return INTEGER_RANK.includes(a.base) && INTEGER_RANK.includes(b.base);
  }
  return a.base === b.base && a.params === b.params;
}

const METHOD_TYPES: Record<string, (type: ParsedType) => boolean> = {
  brin: (type) =>
    !(
      type.array ||
      ["boolean", "json", "search", "enum"].includes(type.category)
    ),
  btree: () => true,
  gin: (type) =>
    type.array || type.category === "json" || type.base === "tsvector",
  gist: (type) => type.base === "tsvector",
  hash: () => true,
  spgist: (type) => !type.array && type.category === "text",
};

const TRIGRAM_CLASSES: Record<string, string> = {
  gin_trgm_ops: "gin",
  gist_trgm_ops: "gist",
};

function indexOpclassViolation(
  column: SchemaColumn,
  parsed: ParsedType,
  opclass: string,
  method: string,
): { extension?: string; requirement?: string } {
  if (opclass in TRIGRAM_CLASSES) {
    if (TRIGRAM_CLASSES[opclass] !== method || parsed.category !== "text") {
      return {
        requirement: `Operator class ${opclass} needs a ${TRIGRAM_CLASSES[opclass]} index on a text column; ${column.name} does not fit.`,
      };
    }
    return {};
  }
  if (VECTOR_CLASS.test(opclass)) {
    return { extension: "vector" };
  }
  if (POSTGIS_CLASS.test(opclass)) {
    return { extension: "postgis" };
  }
  return {
    requirement: `Operator class ${opclass} is not in the closed catalog; use the default operator class.`,
  };
}

function nameIssues(
  names: Array<{ name: string; path: string }>,
  invariant: SchemaInvariantName,
  scope: string,
  out: SchemaViolation[],
) {
  const seen = new Map<string, string>();
  for (const { name, path } of names) {
    const key = foldName(name);
    const first = seen.get(key);
    if (first) {
      out.push({
        invariant,
        path,
        requirement: `${scope} name ${name} folds to the same name as ${first}; rename one.`,
      });
    } else {
      seen.set(key, name);
    }
  }
}

function checkListShape(
  table: SchemaTable,
  path: string,
  columnIds: string[],
  label: string,
  out: SchemaViolation[],
) {
  if (columnIds.length === 0) {
    out.push({
      invariant: "Composite column list validity",
      path,
      requirement: `${label} needs at least one column.`,
    });
  }
  if (new Set(columnIds).size !== columnIds.length) {
    out.push({
      invariant: "Composite column list validity",
      path,
      requirement: `${label} lists a column twice; list each column once.`,
    });
  }
  for (const id of columnIds) {
    if (!columnById(table, id)) {
      out.push({
        invariant: "Composite column list validity",
        path,
        requirement: `${label} names column ${id}, which is not in table ${table.name}.`,
      });
    }
  }
}

function checkIdentifiers(
  definition: SchemaDefinition,
  out: SchemaViolation[],
) {
  const check = (name: string, path: string) => {
    if (!isValidIdentifier(name)) {
      out.push({
        invariant: "Valid identifier",
        path,
        requirement:
          "Use a non-empty name without NUL that is at most 63 bytes in UTF-8.",
      });
    }
  };
  for (const entry of definition.enums) {
    check(entry.name, `enums.${entry.name}`);
  }
  for (const domain of definition.domains) {
    check(domain.name, `domains.${domain.name}`);
  }
  for (const table of definition.tables) {
    const base = `tables.${table.name}`;
    check(table.name, base);
    for (const column of table.columns) {
      check(column.name, `${base}.columns.${column.name}`);
    }
    for (const unique of table.uniques) {
      check(unique.name, `${base}.uniques.${unique.name}`);
    }
    for (const entry of table.checks) {
      check(entry.name, `${base}.checks.${entry.name}`);
    }
    for (const index of table.indexes) {
      check(index.name, `${base}.indexes.${index.name}`);
    }
    for (const fk of table.foreignKeys) {
      check(fk.name, `${base}.foreignKeys.${fk.name}`);
    }
  }
}

function checkUniqueNames(
  definition: SchemaDefinition,
  out: SchemaViolation[],
) {
  nameIssues(
    definition.tables.map((table) => ({
      name: table.name,
      path: `tables.${table.name}`,
    })),
    "Unique table name",
    "Table",
    out,
  );
  for (const table of definition.tables) {
    const base = `tables.${table.name}`;
    nameIssues(
      table.columns.map((column) => ({
        name: column.name,
        path: `${base}.columns.${column.name}`,
      })),
      "Unique column name",
      "Column",
      out,
    );
    nameIssues(
      [
        ...table.uniques.map((entry) => ({
          name: entry.name,
          path: `${base}.uniques.${entry.name}`,
        })),
        ...table.checks.map((entry) => ({
          name: entry.name,
          path: `${base}.checks.${entry.name}`,
        })),
        ...table.foreignKeys.map((entry) => ({
          name: entry.name,
          path: `${base}.foreignKeys.${entry.name}`,
        })),
      ],
      "Unique column name",
      "Constraint",
      out,
    );
    nameIssues(
      table.indexes.map((entry) => ({
        name: entry.name,
        path: `${base}.indexes.${entry.name}`,
      })),
      "Unique column name",
      "Index",
      out,
    );
  }
}

function checkPrimaryKey(
  table: SchemaTable,
  base: string,
  out: SchemaViolation[],
) {
  if (!table.primaryKey || table.primaryKey.columnIds.length === 0) {
    out.push({
      invariant: "Primary key present",
      path: base,
      requirement: `Table ${table.name} needs exactly one primary key over existing columns.`,
    });
    return;
  }
  checkListShape(
    table,
    `${base}.primaryKey`,
    table.primaryKey.columnIds,
    "Primary key",
    out,
  );
  for (const id of table.primaryKey.columnIds) {
    const column = columnById(table, id);
    if (column?.nullable) {
      out.push({
        invariant: "Primary key present",
        path: `${base}.columns.${column.name}`,
        requirement: `Primary key column ${column.name} must be NOT NULL.`,
      });
    }
  }
}

function checkReferentialActions(
  table: SchemaTable,
  fk: SchemaTable["foreignKeys"][number],
  path: string,
  out: SchemaViolation[],
) {
  for (const [key, action] of [
    ["onDelete", fk.onDelete],
    ["onUpdate", fk.onUpdate],
  ] as const) {
    if (!(REFERENTIAL_ACTIONS as readonly string[]).includes(action)) {
      out.push({
        invariant: "Referential action validity",
        path: `${path}.${key}`,
        requirement: `Use NO ACTION, RESTRICT, CASCADE, SET NULL or SET DEFAULT, not ${action}.`,
      });
      continue;
    }
    const columns = fk.columnIds
      .map((id) => columnById(table, id))
      .filter((column): column is SchemaColumn => !!column);
    if (action === "SET NULL" && columns.every((column) => !column.nullable)) {
      out.push({
        invariant: "Referential action validity",
        path: `${path}.${key}`,
        requirement: `SET NULL needs a nullable source column; every column of ${fk.name} is NOT NULL.`,
      });
    }
    if (action === "SET DEFAULT") {
      const noDefault = columns.some((column) => column.default === null);
      if (noDefault) {
        out.push({
          invariant: "Referential action validity",
          path: `${path}.${key}`,
          requirement: `SET DEFAULT needs a default on every source column of ${fk.name}.`,
        });
      }
    }
  }
}

function checkForeignKey(
  definition: SchemaDefinition,
  table: SchemaTable,
  fk: SchemaTable["foreignKeys"][number],
  out: SchemaViolation[],
) {
  const path = `tables.${table.name}.foreignKeys.${fk.name}`;
  const target = tableById(definition, fk.refTableId);
  checkListShape(table, path, fk.columnIds, "Foreign key", out);
  checkReferentialActions(table, fk, path, out);
  if (!target) {
    out.push({
      invariant: "Foreign key end exists",
      path,
      requirement: `Foreign key ${fk.name} targets table ${fk.refTableId}, which is not defined.`,
    });
    return;
  }
  checkListShape(target, path, fk.refColumnIds, "Foreign key target", out);
  const missing =
    fk.columnIds.some((id) => !columnById(table, id)) ||
    fk.refColumnIds.some((id) => !columnById(target, id));
  if (missing) {
    out.push({
      invariant: "Foreign key end exists",
      path,
      requirement: `Foreign key ${fk.name} needs source and target columns that exist.`,
    });
    return;
  }
  const covering = [
    target.primaryKey?.columnIds ?? [],
    ...target.uniques.map(({ columnIds }) => columnIds),
  ].some(
    (ids) =>
      ids.length === fk.refColumnIds.length &&
      ids.every((id, position) => id === fk.refColumnIds[position]),
  );
  if (!covering) {
    out.push({
      invariant: "Foreign key end exists",
      path,
      requirement: `Target columns of ${fk.name} must equal the primary key or a unique constraint of ${target.name}, in the same order.`,
    });
  }
  if (fk.columnIds.length !== fk.refColumnIds.length) {
    out.push({
      invariant: "Foreign key type match",
      path,
      requirement: `Foreign key ${fk.name} needs as many source as target columns.`,
    });
    return;
  }
  fk.columnIds.forEach((id, position) => {
    const from = columnById(table, id);
    const to = columnById(target, fk.refColumnIds[position] ?? "");
    const left = from && parseColumnType(definition, from.type);
    const right = to && parseColumnType(definition, to.type);
    if (left && right && !typesMatch(left, right)) {
      out.push({
        invariant: "Foreign key type match",
        path,
        requirement: `Column ${from.name} (${from.type}) cannot reference ${to.name} (${to.type}); use the same type.`,
      });
    }
  });
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: One closed catalog rule per branch; splitting would hide the rule list.
function checkIndexes(
  definition: SchemaDefinition,
  table: SchemaTable,
  out: SchemaViolation[],
) {
  const base = `tables.${table.name}`;
  const seen = new Map<string, string>();
  const implicit = [
    table.primaryKey?.columnIds,
    ...table.uniques.map(({ columnIds }) => columnIds),
  ]
    .filter((ids): ids is string[] => !!ids)
    .map((ids) => ids.join(","));
  for (const index of table.indexes) {
    const path = `${base}.indexes.${index.name}`;
    checkListShape(
      table,
      path,
      index.columns.map(({ columnId }) => columnId),
      "Index",
      out,
    );
    if ((INDEX_METHODS as readonly string[]).includes(index.method)) {
      for (const { columnId, opclass } of index.columns) {
        const column = columnById(table, columnId);
        const parsed = column && parseColumnType(definition, column.type);
        if (!(column && parsed)) {
          continue;
        }
        if (opclass) {
          const issue = indexOpclassViolation(
            column,
            parsed,
            opclass,
            index.method,
          );
          if (issue.extension) {
            out.push({
              invariant: "Extension not in matrix",
              path,
              requirement: `Operator class ${opclass} needs extension ${issue.extension}, which the matrix rejects.`,
            });
          } else if (issue.requirement) {
            out.push({
              invariant: "Index column and method validity",
              path,
              requirement: issue.requirement,
            });
          }
        } else if (!METHOD_TYPES[index.method]?.(parsed)) {
          out.push({
            invariant: "Index column and method validity",
            path,
            requirement: `Method ${index.method} has no operator class for ${column.name} (${column.type}).`,
          });
        }
      }
    } else {
      const extension = ["hnsw", "ivfflat"].includes(index.method)
        ? "vector"
        : null;
      out.push(
        extension
          ? {
              invariant: "Extension not in matrix",
              path,
              requirement: `Index method ${index.method} needs extension ${extension}, which the matrix rejects; use a core method.`,
            }
          : {
              invariant: "Index column and method validity",
              path,
              requirement: `Index method ${index.method} is not in the matrix; use btree, hash, gin, gist, brin or spgist.`,
            },
      );
    }
    if (index.where && !columnById(table, index.where.columnId)) {
      out.push({
        invariant: "Index column and method validity",
        path,
        requirement: `Partial condition of ${index.name} may only use columns of ${table.name}.`,
      });
    }
    const columnKey = index.columns.map(({ columnId }) => columnId).join(",");
    const key = JSON.stringify([
      index.method,
      columnKey,
      index.unique,
      index.where,
    ]);
    const first = seen.get(key);
    if (first) {
      out.push({
        invariant: "Non-duplicate index definition",
        path,
        requirement: `Index ${index.name} repeats ${first}; remove one.`,
      });
    } else {
      seen.set(key, index.name);
    }
    if (
      !index.where &&
      index.method === "btree" &&
      implicit.includes(columnKey)
    ) {
      out.push({
        invariant: "Non-duplicate index definition",
        path,
        requirement: `Index ${index.name} repeats the index a primary key or unique constraint already creates.`,
      });
    }
  }
}

function checkDefaults(
  definition: SchemaDefinition,
  table: SchemaTable,
  out: SchemaViolation[],
) {
  for (const column of table.columns) {
    const path = `tables.${table.name}.columns.${column.name}`;
    const parsed = parseColumnType(definition, column.type);
    if (!parsed) {
      out.push({
        invariant: "Type not in catalog",
        path,
        requirement: `Type ${column.type} is not in the PostgreSQL type catalog or is an undefined enum/domain.`,
      });
      continue;
    }
    if (parsed.extension) {
      out.push({
        invariant: "Extension not in matrix",
        path,
        requirement: `Type ${column.type} needs extension ${parsed.extension}, which the matrix rejects; model a core equivalent.`,
      });
    }
    if (column.default === null) {
      continue;
    }
    const { extension, kind } = classifyDefault(column.default);
    if (extension) {
      out.push({
        invariant: "Extension not in matrix",
        path,
        requirement: `Default ${column.default} needs extension ${extension}, which the matrix rejects.`,
      });
      continue;
    }
    if (column.identity) {
      out.push({
        invariant: "Nullability and default consistency",
        path,
        requirement: "An identity column cannot also carry a default.",
      });
    }
    if (!column.nullable && kind === "null") {
      out.push({
        invariant: "Nullability and default consistency",
        path,
        requirement: `NOT NULL column ${column.name} cannot default to NULL.`,
      });
    } else if (!defaultFitsType(definition, parsed, column.default)) {
      out.push({
        invariant: "Nullability and default consistency",
        path,
        requirement: `Default ${column.default} must be a constant or allowed core function that fits ${column.type}.`,
      });
    }
  }
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: One closed catalog rule per branch; splitting would hide the rule list.
function checkEnumsAndDomains(
  definition: SchemaDefinition,
  out: SchemaViolation[],
) {
  nameIssues(
    [
      ...definition.enums.map((entry) => ({
        name: entry.name,
        path: `enums.${entry.name}`,
      })),
      ...definition.domains.map((entry) => ({
        name: entry.name,
        path: `domains.${entry.name}`,
      })),
    ],
    "Enum and domain value validity",
    "Type",
    out,
  );
  for (const entry of definition.enums) {
    const path = `enums.${entry.name}`;
    if (entry.labels.length === 0) {
      out.push({
        invariant: "Enum and domain value validity",
        path,
        requirement: `Enum ${entry.name} needs at least one label.`,
      });
    }
    const values = entry.labels.map(({ value }) => value);
    if (new Set(values).size !== values.length) {
      out.push({
        invariant: "Enum and domain value validity",
        path,
        requirement: `Enum ${entry.name} repeats a label; labels are unique.`,
      });
    }
    if (values.some((value) => value.length === 0 || value.length > 63)) {
      out.push({
        invariant: "Enum and domain value validity",
        path,
        requirement: `Enum ${entry.name} labels must be 1 to 63 characters.`,
      });
    }
  }
  for (const domain of definition.domains) {
    const path = `domains.${domain.name}`;
    const base = parseColumnType(definition, domain.baseType);
    if (!base || base.category === "enum" || base.category === "domain") {
      out.push({
        invariant: "Enum and domain value validity",
        path,
        requirement: `Domain ${domain.name} needs a core base type, not ${domain.baseType}.`,
      });
      continue;
    }
    if (base.extension) {
      out.push({
        invariant: "Extension not in matrix",
        path,
        requirement: `Base type ${domain.baseType} needs extension ${base.extension}, which the matrix rejects.`,
      });
    }
    if (
      domain.default !== null &&
      !defaultFitsType(definition, base, domain.default)
    ) {
      out.push({
        invariant: "Enum and domain value validity",
        path,
        requirement: `Domain default ${domain.default} must fit ${domain.baseType}.`,
      });
    }
    for (const check of domain.checks) {
      const numeric = NUMERIC_VALUE.test(check.value);
      const numericBase = ["integer", "float", "numeric"].includes(
        base.category,
      );
      if (numeric !== numericBase) {
        out.push({
          invariant: "Enum and domain value validity",
          path: `${path}.checks.${check.name}`,
          requirement: `Constraint value ${check.value} does not fit base type ${domain.baseType}.`,
        });
      }
    }
  }
}

function checkTableChecks(
  definition: SchemaDefinition,
  table: SchemaTable,
  out: SchemaViolation[],
) {
  for (const check of table.checks) {
    const path = `tables.${table.name}.checks.${check.name}`;
    const column = check.columnId ? columnById(table, check.columnId) : null;
    if (!column) {
      out.push({
        invariant: "Composite column list validity",
        path,
        requirement: `Check ${check.name} must name a column of ${table.name}.`,
      });
      continue;
    }
    const parsed = parseColumnType(definition, column.type);
    const numeric = NUMERIC_VALUE.test(check.value);
    const numericType =
      !!parsed && ["integer", "float", "numeric"].includes(parsed.category);
    if (parsed && numeric !== numericType) {
      out.push({
        invariant: "Nullability and default consistency",
        path,
        requirement: `Check value ${check.value} does not fit ${column.type}.`,
      });
    }
  }
  for (const unique of table.uniques) {
    checkListShape(
      table,
      `tables.${table.name}.uniques.${unique.name}`,
      unique.columnIds,
      "Unique constraint",
      out,
    );
  }
}

function checkForeignKeyGraph(
  definition: SchemaDefinition,
  out: SchemaViolation[],
) {
  const edges = new Map<string, Array<{ name: string; to: string }>>();
  for (const table of definition.tables) {
    for (const fk of table.foreignKeys) {
      const required = fk.columnIds.every(
        (id) => columnById(table, id)?.nullable === false,
      );
      if (required && tableById(definition, fk.refTableId)) {
        edges.set(table.id, [
          ...(edges.get(table.id) ?? []),
          { name: fk.name, to: fk.refTableId },
        ]);
      }
    }
  }
  const state = new Map<string, "open" | "done">();
  const reported = new Set<string>();
  const visit = (id: string, trail: string[]) => {
    state.set(id, "open");
    for (const edge of edges.get(id) ?? []) {
      const next = state.get(edge.to);
      if (next === "open") {
        const names = [...trail, id]
          .slice([...trail, id].indexOf(edge.to))
          .map((tableId) => tableById(definition, tableId)?.name ?? tableId);
        const key = [...names].sort().join(",");
        if (!reported.has(key)) {
          reported.add(key);
          const owner = tableById(definition, id);
          out.push({
            invariant: "Sortable foreign key graph",
            path: `tables.${owner?.name ?? id}.foreignKeys.${edge.name}`,
            requirement: `Tables ${names.join(" → ")} → ${names[0]} all require each other (NOT NULL); make one foreign key column nullable.`,
          });
        }
      } else if (!next) {
        visit(edge.to, [...trail, id]);
      }
    }
    state.set(id, "done");
  };
  for (const table of definition.tables) {
    if (!state.has(table.id)) {
      visit(table.id, []);
    }
  }
}

/** Every violation of the closed catalog in one report; `[]` means it passes. */
export function checkSchemaInvariants(
  definition: SchemaDefinition,
): SchemaViolation[] {
  const out: SchemaViolation[] = [];
  checkIdentifiers(definition, out);
  checkUniqueNames(definition, out);
  checkEnumsAndDomains(definition, out);
  for (const table of definition.tables) {
    const base = `tables.${table.name}`;
    checkPrimaryKey(table, base, out);
    checkDefaults(definition, table, out);
    checkTableChecks(definition, table, out);
    checkIndexes(definition, table, out);
    for (const fk of table.foreignKeys) {
      checkForeignKey(definition, table, fk, out);
    }
  }
  checkForeignKeyGraph(definition, out);
  return out;
}

/** Extensions the definition relies on; carried in the warning manifest. */
export function requiredExtensions(definition: SchemaDefinition): string[] {
  const extensions = new Set<string>();
  for (const table of definition.tables) {
    for (const index of table.indexes) {
      for (const { opclass } of index.columns) {
        if (opclass && opclass in TRIGRAM_CLASSES) {
          extensions.add("pg_trgm");
        }
      }
    }
  }
  return [...extensions];
}
