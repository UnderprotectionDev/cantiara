import {
  IMPORT_CATALOG_TYPES,
  IMPORT_DOCUMENT_FIELDS,
  IMPORT_DOCUMENT_JSON_SCHEMA,
  IMPORT_DOCUMENT_JSON_VERSION,
  IMPORT_FIELDS,
  IMPORT_MAX_BYTES,
  IMPORT_MAX_ROWS,
  IMPORT_WORKSPACE_TYPES,
  type ImportCatalogType,
  type ImportFamily,
  type ImportFileFormat,
  type ImportLoss,
  type ImportMappingEntry,
  ImportRefusedError,
  type ImportScope,
  importCatalogTypeSchema,
} from "@cantiara/api/data-import";
import Papa from "papaparse";
import { z } from "zod";

/** The catalog wrapper `{ schema: "cantiara.records/1", type, records }`. */
export const IMPORT_RECORDS_JSON_SCHEMA = "cantiara.records";

const PACKAGE_EXTENSIONS = new Set([
  "zip",
  "tar",
  "gz",
  "tgz",
  "7z",
  "rar",
  "bz2",
  "xz",
]);
const DIAGRAM_EXTENSIONS = new Set([
  "sql",
  "dbml",
  "drawio",
  "vsdx",
  "vsd",
  "mmd",
]);
const MARKDOWN_EXTENSIONS = new Set(["md", "markdown"]);
/** Families outside the closed catalog; a file that declares one is refused. */
const OUT_OF_CATALOG_FAMILIES = new Set([
  "screen",
  "wireframe",
  "user-flow",
  "project-wall",
  "moodboard",
  "technical-diagram",
  "external-surface",
  "automation",
  "starter-configuration",
  "project",
  "workspace",
  "github",
]);
const ZIP_MAGIC = "PK\u0003\u0004";
const SCHEMA_ID = /^([a-z][a-z0-9.-]*)\/(\d+)$/u;
const TEST_REPORT_SCHEMA = /^test-report\//iu;
const FRONT_MATTER = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/u;
const TEST_REPORT_FRONT_MATTER = /schemaVersion:\s*["']?test-report\//iu;
const H1 = /^#\s+(.+?)\s*#*\s*$/mu;
const NON_ALPHANUMERIC = /[^a-z0-9]/gu;
const FILE_EXTENSION = /\.([A-Za-z0-9]+)$/u;
const CANTIARA_PREFIX = /^cantiara\./u;
const BOM = /^﻿/u;

const ORIGIN_COLUMNS = new Set([
  "originkey",
  "origin",
  "sourceid",
  "externalid",
  "originalid",
  "id",
  "key",
]);
const FIELD_ALIASES: Record<string, string> = {
  due: "dueDate",
  name: "title",
  notes: "description",
  subject: "title",
  summary: "description",
  tags: "labels",
};

export interface ParsedRow {
  cells: Record<string, string>;
  /** Problems found while reading the row (shape errors). */
  problems: string[];
  rowNumber: number;
}

export interface ParsedFile {
  catalogType: ImportCatalogType | null;
  columns: string[];
  family: ImportFamily;
  /** Fixed mapping for a Document family file; null when the founder maps columns. */
  fixedMapping: Record<string, string> | null;
  format: ImportFileFormat;
  losses: ImportLoss[];
  /** Stable origin column for a Document JSON file (its own `id`). */
  originColumn: string | null;
  provider: string;
  rows: ParsedRow[];
}

export interface ParseInput {
  catalogType?: ImportCatalogType;
  content: string;
  fileCount: number;
  fileName: string;
}

function refuse(
  code: ConstructorParameters<typeof ImportRefusedError>[0],
  message: string,
): never {
  throw new ImportRefusedError(code, message);
}

export function normalizeColumn(value: string) {
  return value.toLowerCase().replace(NON_ALPHANUMERIC, "");
}

function extensionOf(fileName: string) {
  return FILE_EXTENSION.exec(fileName)?.[1]?.toLowerCase() ?? "";
}

function checkEnvelope(input: ParseInput) {
  if (input.fileCount > 1) {
    refuse(
      "multi-file",
      "Import takes one file at a time. Folders and multi-file selections are not supported.",
    );
  }
  const extension = extensionOf(input.fileName);
  if (
    input.fileName.endsWith("/") ||
    PACKAGE_EXTENSIONS.has(extension) ||
    input.content.startsWith(ZIP_MAGIC)
  ) {
    refuse(
      "unsupported-package",
      "Folders, ZIP archives and whole-Workspace packages cannot be imported.",
    );
  }
  if (DIAGRAM_EXTENSIONS.has(extension)) {
    refuse(
      "unsupported-format",
      "DDL, DBML, Draw.io, Visio and diagram files are not imported as editable data.",
    );
  }
  if (Buffer.byteLength(input.content, "utf8") > IMPORT_MAX_BYTES) {
    refuse(
      "too-large",
      "The file is larger than 25 MB. Split it into smaller files.",
    );
  }
  if (input.content.trim() === "") {
    refuse("empty-file", "The file is empty.");
  }
  return extension;
}

function parseMarkdown(input: ParseInput): ParsedFile {
  const content = input.content.replace(BOM, "");
  const front = FRONT_MATTER.exec(content);
  if (front?.[1] && TEST_REPORT_FRONT_MATTER.test(front[1])) {
    refuse(
      "test-report-envelope",
      "This is a test report. Use test report acceptance; it is not imported as a Document.",
    );
  }
  const body = front ? content.slice(front[0].length) : content;
  const title =
    H1.exec(body)?.[1]?.trim() ||
    input.fileName.replace(FILE_EXTENSION, "").trim() ||
    "Untitled";
  const losses: ImportLoss[] = front
    ? [
        {
          detail: "The front matter block is not imported.",
          kind: "front matter ignored",
        },
      ]
    : [];
  return {
    catalogType: null,
    columns: ["title", "body"],
    family: "Document",
    fixedMapping: { body: "body", title: "title" },
    format: "Markdown",
    losses,
    originColumn: null,
    provider: `file:${input.fileName}`,
    rows: [{ cells: { body, title }, problems: [], rowNumber: 1 }],
  };
}

function flatten(value: unknown, column: string, nested: Set<string>): string {
  if (value === null || value === undefined) {
    return "";
  }
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  nested.add(column);
  return JSON.stringify(value);
}

function recordsToRows(records: readonly Record<string, unknown>[]): {
  columns: string[];
  losses: ImportLoss[];
  rows: ParsedRow[];
} {
  const columns: string[] = [];
  const nested = new Set<string>();
  const rows = records.map((record, index): ParsedRow => {
    const cells: Record<string, string> = {};
    for (const [key, value] of Object.entries(record)) {
      if (!columns.includes(key)) {
        columns.push(key);
      }
      cells[key] = flatten(value, key, nested);
    }
    return { cells, problems: [], rowNumber: index + 1 };
  });
  const losses = [...nested].map(
    (column): ImportLoss => ({
      detail: `Column "${column}" holds nested values; they are imported as JSON text.`,
      kind: "nested value flattened",
    }),
  );
  return { columns, losses, rows };
}

const documentJsonSchema = z.object({
  body: z.string().optional(),
  id: z.union([z.string(), z.number()]).optional(),
  markdown: z.string().optional(),
  title: z.string().trim().min(1),
});

function schemaOf(value: unknown) {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }
  const record = value as Record<string, unknown>;
  for (const key of ["schema", "schemaVersion"]) {
    const declared = record[key];
    if (typeof declared === "string") {
      return declared;
    }
  }
  return null;
}

function checkDeclaredSchema(declared: string) {
  if (TEST_REPORT_SCHEMA.test(declared)) {
    refuse(
      "test-report-envelope",
      "This is a test report. Use test report acceptance; it is not imported as a Document or Work.",
    );
  }
  const match = SCHEMA_ID.exec(declared);
  const family = match?.[1]?.replace(CANTIARA_PREFIX, "") ?? declared;
  if (OUT_OF_CATALOG_FAMILIES.has(family)) {
    refuse(
      "out-of-catalog",
      `"${declared}" is outside the Import catalog and cannot be created from a file.`,
    );
  }
  return {
    id: match?.[1] ?? declared,
    version: Number(match?.[2] ?? Number.NaN),
  };
}

function parseJson(input: ParseInput): ParsedFile {
  let value: unknown;
  try {
    value = JSON.parse(input.content.replace(BOM, ""));
  } catch {
    refuse("invalid-file", "The file is not valid JSON.");
  }
  const declared = schemaOf(value);
  const schema = declared ? checkDeclaredSchema(declared) : null;
  const record = (
    typeof value === "object" && value !== null && !Array.isArray(value)
      ? value
      : {}
  ) as Record<string, unknown>;

  if (schema?.id === IMPORT_DOCUMENT_JSON_SCHEMA) {
    return parseDocumentJson(input, record, schema.version);
  }
  if (schema && schema.id !== IMPORT_RECORDS_JSON_SCHEMA) {
    refuse(
      "unknown-schema-version",
      `The JSON schema "${declared}" is not known. Nothing was written.`,
    );
  }
  if (schema && schema.version !== 1) {
    refuse(
      "unknown-schema-version",
      `The JSON schema version "${declared}" is newer than this product reads. Nothing was written.`,
    );
  }
  return parseJsonRecords(input, value, record, Boolean(schema));
}

function parseDocumentJson(
  input: ParseInput,
  record: Record<string, unknown>,
  version: number,
): ParsedFile {
  if (version !== IMPORT_DOCUMENT_JSON_VERSION) {
    refuse(
      "unknown-schema-version",
      `Document JSON version ${version} is newer than this product reads. Nothing was written.`,
    );
  }
  const parsed = documentJsonSchema.safeParse(record);
  if (!parsed.success) {
    refuse("invalid-file", "The Document JSON needs a title.");
  }
  const body = parsed.data.body ?? parsed.data.markdown ?? "";
  const cells: Record<string, string> = { body, title: parsed.data.title };
  const columns = ["title", "body"];
  if (parsed.data.id !== undefined) {
    cells.id = String(parsed.data.id);
    columns.push("id");
  }
  return {
    catalogType: null,
    columns,
    family: "Document",
    fixedMapping: {
      body: "body",
      title: "title",
      ...(cells.id ? { id: "origin" } : {}),
    },
    format: "Document JSON",
    losses: [],
    originColumn: cells.id ? "id" : null,
    provider: `${IMPORT_DOCUMENT_JSON_SCHEMA}:${input.fileName}`,
    rows: [{ cells, problems: [], rowNumber: 1 }],
  };
}

function parseJsonRecords(
  input: ParseInput,
  value: unknown,
  record: Record<string, unknown>,
  wrapped: boolean,
): ParsedFile {
  const list = Array.isArray(value) ? value : record.records;
  if (!Array.isArray(list)) {
    refuse(
      "invalid-file",
      "The JSON file must be a list of records or a records wrapper.",
    );
  }
  const provider =
    typeof record.provider === "string" && record.provider.trim() !== ""
      ? record.provider.trim().toLowerCase()
      : "file";
  if (OUT_OF_CATALOG_FAMILIES.has(provider)) {
    refuse(
      "out-of-catalog",
      `A "${provider}" source is not imported as the source of truth.`,
    );
  }
  let wrappedType: ImportCatalogType | undefined;
  if (wrapped && record.type !== undefined) {
    const type = importCatalogTypeSchema.safeParse(record.type);
    if (!type.success) {
      refuse(
        "out-of-catalog",
        `"${String(record.type)}" is not in the Import catalog.`,
      );
    }
    wrappedType = type.data;
  }
  if (list.length > IMPORT_MAX_ROWS) {
    refuse(
      "too-many-rows",
      "The file has more than 10,000 rows. Split it into smaller files.",
    );
  }
  const objects: Record<string, unknown>[] = [];
  for (const entry of list) {
    if (typeof entry !== "object" || entry === null || Array.isArray(entry)) {
      refuse("invalid-file", "Every JSON record must be an object.");
    }
    objects.push(entry as Record<string, unknown>);
  }
  if (objects.length === 0) {
    refuse("empty-file", "The file has no records.");
  }
  const catalogType = resolveCatalogType(input.catalogType, wrappedType);
  const { columns, losses, rows } = recordsToRows(objects);
  return {
    catalogType,
    columns,
    family: "Catalog",
    fixedMapping: null,
    format: "JSON",
    losses,
    originColumn: null,
    provider: `${provider}:${input.fileName}`,
    rows,
  };
}

function resolveCatalogType(
  selected: ImportCatalogType | undefined,
  declared: ImportCatalogType | undefined,
) {
  if (selected && declared && selected !== declared) {
    refuse(
      "invalid-file",
      `The file holds ${declared} records but ${selected} was selected. One type per file.`,
    );
  }
  const type = selected ?? declared;
  if (!type) {
    refuse(
      "catalog-type-required",
      `Choose one record type: ${IMPORT_CATALOG_TYPES.join(", ")}.`,
    );
  }
  return type;
}

function parseCsv(input: ParseInput): ParsedFile {
  const catalogType = resolveCatalogType(input.catalogType, undefined);
  const result = Papa.parse<Record<string, string>>(
    input.content.replace(BOM, ""),
    {
      header: true,
      skipEmptyLines: "greedy",
      transformHeader: (header) => header.trim(),
    },
  );
  const fatal = result.errors.find(
    (error) => error.type === "Quotes" || error.type === "Delimiter",
  );
  if (fatal && fatal.type === "Quotes") {
    refuse("invalid-file", `The CSV is malformed: ${fatal.message}`);
  }
  const columns = result.meta.fields ?? [];
  if (columns.length === 0 || columns.some((column) => column === "")) {
    refuse("invalid-file", "Every CSV column needs a header name.");
  }
  if (result.data.length > IMPORT_MAX_ROWS) {
    refuse(
      "too-many-rows",
      "The file has more than 10,000 rows. Split it into smaller files.",
    );
  }
  if (result.data.length === 0) {
    refuse("empty-file", "The file has no rows.");
  }
  const shapeProblems = new Map<number, string>();
  for (const error of result.errors) {
    if (error.type === "FieldMismatch" && error.row !== undefined) {
      shapeProblems.set(error.row, error.message);
    }
  }
  const rows = result.data.map((cells, index): ParsedRow => {
    const normalized: Record<string, string> = {};
    for (const column of columns) {
      const cell = cells[column];
      normalized[column] = typeof cell === "string" ? cell : "";
    }
    const problem = shapeProblems.get(index);
    return {
      cells: normalized,
      problems: problem ? [`Wrong number of cells: ${problem}`] : [],
      rowNumber: index + 1,
    };
  });
  return {
    catalogType,
    columns,
    family: "Catalog",
    fixedMapping: null,
    format: "CSV",
    losses: [],
    originColumn: null,
    provider: `file:${input.fileName}`,
    rows,
  };
}

/** Classifies and reads one file. Throws `ImportRefusedError`; never writes. */
export function parseImportFile(input: ParseInput): ParsedFile {
  const extension = checkEnvelope(input);
  if (MARKDOWN_EXTENSIONS.has(extension)) {
    return parseMarkdown(input);
  }
  if (extension === "csv") {
    return parseCsv(input);
  }
  if (extension === "json") {
    return parseJson(input);
  }
  return refuse(
    "unsupported-format",
    "Import accepts one Markdown, JSON or CSV file.",
  );
}

export function checkScope(parsed: ParsedFile, scope: ImportScope) {
  if (parsed.family === "Document") {
    if (scope.kind === "workspace") {
      refuse(
        "scope-mismatch",
        "A Document imports into a Project or the Wiki.",
      );
    }
    return;
  }
  if (scope.kind === "wiki") {
    refuse("scope-mismatch", "Only Documents import into the Wiki.");
  }
  const type = parsed.catalogType;
  if (
    scope.kind === "workspace" &&
    !(type && IMPORT_WORKSPACE_TYPES.includes(type))
  ) {
    refuse(
      "scope-mismatch",
      `${type ?? "This type"} imports into a Project, not the Workspace.`,
    );
  }
}

export interface PlannedMapping {
  entries: ImportMappingEntry[];
  targetOptions: string[];
  /** Resolved target by source column: product field, `custom:<name>`, `origin` or null. */
  targets: Map<string, string | null>;
}

function fieldsOf(parsed: ParsedFile) {
  if (parsed.family === "Document") {
    return IMPORT_DOCUMENT_FIELDS;
  }
  return IMPORT_FIELDS[parsed.catalogType as ImportCatalogType];
}

/** Suggests (or applies the founder's) column mapping and reports what is lost. */
export function planMapping(
  parsed: ParsedFile,
  customFieldNames: readonly string[],
  override: Record<string, string> | undefined,
): { losses: ImportLoss[]; mapping: PlannedMapping } {
  const fields = fieldsOf(parsed);
  const productFields = [...fields.required, ...fields.optional];
  const customByKey = new Map(
    customFieldNames.map((name) => [normalizeColumn(name), name]),
  );
  const targetOptions = [
    ...productFields,
    "origin",
    ...customFieldNames.map((name) => `custom:${name}`),
    "ignore",
  ];
  const targets = new Map<string, string | null>();
  const taken = new Set<string>();
  const losses: ImportLoss[] = [];

  const assign = (column: string, target: string | null) => {
    if (target && !target.startsWith("custom:")) {
      if (taken.has(target)) {
        refuse(
          "invalid-mapping",
          `Two columns map to "${target}". Map each field once.`,
        );
      }
      taken.add(target);
    }
    targets.set(column, target);
  };

  for (const [column, target] of Object.entries(override ?? {})) {
    if (!parsed.columns.includes(column)) {
      refuse("invalid-mapping", `The file has no column "${column}".`);
    }
    if (!targetOptions.includes(target)) {
      refuse(
        "invalid-mapping",
        `"${target}" is not a field you can map "${column}" to.`,
      );
    }
    assign(column, target === "ignore" ? null : target);
  }

  const fixed = parsed.fixedMapping;
  for (const column of parsed.columns) {
    if (targets.has(column)) {
      continue;
    }
    const fixedTarget = fixed?.[column];
    if (fixedTarget) {
      assign(column, fixedTarget);
      continue;
    }
    assign(
      column,
      suggestTarget(
        column,
        productFields,
        taken,
        customByKey,
        targets,
        parsed.originColumn,
      ),
    );
  }

  const entries = parsed.columns.map(
    (source): ImportMappingEntry => ({
      origin: targets.get(source) === "origin",
      source,
      target: targets.get(source) ?? null,
    }),
  );
  for (const entry of entries) {
    if (entry.target === null) {
      losses.push({
        detail: `Column "${entry.source}" is not imported.`,
        kind: "unmapped column",
      });
    }
  }
  return { losses, mapping: { entries, targetOptions, targets } };
}

function suggestTarget(
  column: string,
  productFields: readonly string[],
  taken: ReadonlySet<string>,
  customByKey: ReadonlyMap<string, string>,
  targets: ReadonlyMap<string, string | null>,
  originColumn: string | null,
): string | null {
  const key = normalizeColumn(column);
  if (originColumn === column) {
    return "origin";
  }
  const direct = productFields.find(
    (field) => normalizeColumn(field) === key && !taken.has(field),
  );
  if (direct) {
    return direct;
  }
  const originTaken = [...targets.values()].includes("origin");
  if (ORIGIN_COLUMNS.has(key) && !originTaken) {
    return "origin";
  }
  const aliased = FIELD_ALIASES[key];
  if (aliased && productFields.includes(aliased) && !taken.has(aliased)) {
    return aliased;
  }
  const custom = customByKey.get(key);
  return custom ? `custom:${custom}` : null;
}
