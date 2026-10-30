import { z } from "zod";

/**
 * Standard Import seam (spec 80, ticket 01): one file in, a write-free mapping
 * and diff preview out. The preview reads the file and the target scope, stages
 * the encrypted bytes for at most 24 hours and changes no primary record,
 * relation or search entry. `Apply Import` (atomic, idempotent finalize) is a
 * later ticket that extends `DataImportAccess`; nothing here commits.
 */

export const IMPORT_LABEL = "Import";
/** Shown only as a note until the Apply ticket ships the real confirmation. */
export const IMPORT_PREVIEW_NOTE =
  "Preview only. Nothing has been written to your records.";

/** The PRD cap: 10,000 rows or 25 MB, whichever is reached first. */
export const IMPORT_MAX_ROWS = 10_000;
export const IMPORT_MAX_BYTES = 25 * 1024 * 1024;
/** Staged bytes live at most 24 hours. */
export const IMPORT_STAGING_TTL_MS = 24 * 60 * 60 * 1000;
/** The preview lists at most this many rows; counts always cover every row. */
export const IMPORT_PREVIEW_ROW_LIMIT = 50;
export const IMPORT_PREVIEW_INVALID_LIMIT = 100;

/** The closed CSV/JSON catalog: one type per file. */
export const IMPORT_CATALOG_TYPES = [
  "Feature",
  "Bug",
  "Task",
  "Research",
  "Improvement",
  "Project Goal",
  "Milestone",
  "Decision",
  "Risk",
  "Assumption",
  "Open Question",
  "Feedback",
  "Contact",
  "Company",
  "Product Gap",
  "User Research Session",
  "Experiment/Validation",
  "Source metadata only",
  "Project Release",
  "Production Incident",
] as const;
export const importCatalogTypeSchema = z.enum(IMPORT_CATALOG_TYPES);
export type ImportCatalogType = z.infer<typeof importCatalogTypeSchema>;

/** Catalog types that may also target the Workspace scope (they are not Project-owned). */
export const IMPORT_WORKSPACE_TYPES: readonly ImportCatalogType[] = [
  "Contact",
  "Company",
  "Product Gap",
];

export interface ImportFieldSet {
  optional: readonly string[];
  required: readonly string[];
}

const WORK_FIELDS: ImportFieldSet = {
  optional: ["description", "status", "priority", "dueDate", "labels"],
  required: ["title"],
};

/** Product fields a source column can map to, per catalog type. */
export const IMPORT_FIELDS: Record<ImportCatalogType, ImportFieldSet> = {
  Feature: WORK_FIELDS,
  Bug: WORK_FIELDS,
  Task: WORK_FIELDS,
  Research: WORK_FIELDS,
  Improvement: WORK_FIELDS,
  "Project Goal": {
    optional: ["description", "status"],
    required: ["title"],
  },
  Milestone: { optional: ["description", "dueDate"], required: ["title"] },
  Decision: { optional: ["rationale", "status"], required: ["title"] },
  Risk: {
    optional: ["description", "likelihood", "impact", "status"],
    required: ["title"],
  },
  Assumption: { optional: ["status"], required: ["statement"] },
  "Open Question": { optional: ["status"], required: ["question"] },
  Feedback: { optional: ["body", "source"], required: ["title"] },
  Contact: { optional: ["email", "company"], required: ["name"] },
  Company: { optional: ["website"], required: ["name"] },
  "Product Gap": { optional: ["description"], required: ["title"] },
  "User Research Session": {
    optional: ["summary", "date"],
    required: ["title"],
  },
  "Experiment/Validation": {
    optional: ["hypothesis", "outcome"],
    required: ["title"],
  },
  "Source metadata only": { optional: [], required: ["title", "url"] },
  "Project Release": { optional: ["version", "date"], required: ["name"] },
  "Production Incident": {
    optional: ["description", "severity", "status"],
    required: ["title"],
  },
};

/** Document fields (Markdown and first-party Document JSON). */
export const IMPORT_DOCUMENT_FIELDS: ImportFieldSet = {
  optional: [],
  required: ["title", "body"],
};

/** The first-party versioned Document JSON schema id (ADR-0005). */
export const IMPORT_DOCUMENT_JSON_SCHEMA = "cantiara.document";
export const IMPORT_DOCUMENT_JSON_VERSION = 1;

export const IMPORT_FAMILIES = ["Document", "Catalog"] as const;
export type ImportFamily = (typeof IMPORT_FAMILIES)[number];

export const IMPORT_FILE_FORMATS = [
  "Markdown",
  "Document JSON",
  "CSV",
  "JSON",
] as const;
export type ImportFileFormat = (typeof IMPORT_FILE_FORMATS)[number];

const identifier = z.string().trim().min(1).max(255);

export const importScopeSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("project"), projectId: identifier }).strict(),
  z.object({ kind: z.literal("wiki") }).strict(),
  z.object({ kind: z.literal("workspace") }).strict(),
]);
export type ImportScope = z.infer<typeof importScopeSchema>;

export const IMPORT_ROW_CHOICES = [
  "update existing",
  "skip",
  "resolve conflict",
] as const;
export const importRowChoiceSchema = z.enum(IMPORT_ROW_CHOICES);
export type ImportRowChoice = z.infer<typeof importRowChoiceSchema>;

/** `ignore`, a product field name, or `custom:<Project custom field name>`. */
const mappingTarget = z.string().trim().min(1).max(255);

/**
 * One file, one type, one scope. `fileCount` is what the picker was handed so
 * a folder or a multi-file selection is refused instead of silently reduced.
 */
export const previewImportInputSchema = z
  .object({
    catalogType: importCatalogTypeSchema.optional(),
    content: z.string().max(IMPORT_MAX_BYTES * 4),
    fileCount: z.number().int().min(1).max(10_000).default(1),
    fileName: z.string().trim().min(1).max(255),
    mapping: z.record(z.string().max(255), mappingTarget).optional(),
    rowChoices: z.record(z.string().max(12), importRowChoiceSchema).optional(),
    scope: importScopeSchema,
  })
  .strict();
export type PreviewImportInput = z.input<typeof previewImportInputSchema>;

export const reopenImportPreviewInputSchema = z
  .object({ stagingId: identifier })
  .strict();
export type ReopenImportPreviewInput = z.infer<
  typeof reopenImportPreviewInputSchema
>;

export const IMPORT_REFUSAL_CODES = [
  "multi-file",
  "unsupported-package",
  "unsupported-format",
  "too-large",
  "too-many-rows",
  "empty-file",
  "invalid-file",
  "unknown-schema-version",
  "out-of-catalog",
  "test-report-envelope",
  "catalog-type-required",
  "scope-mismatch",
  "invalid-mapping",
] as const;
export type ImportRefusalCode = (typeof IMPORT_REFUSAL_CODES)[number];

/** A refusal writes and stages nothing. */
export class ImportRefusedError extends Error {
  readonly code: ImportRefusalCode;

  constructor(code: ImportRefusalCode, message: string) {
    super(message);
    this.name = "ImportRefusedError";
    this.code = code;
  }
}

export class ImportScopeNotFoundError extends Error {
  constructor() {
    super("The import scope was not found.");
    this.name = "ImportScopeNotFoundError";
  }
}

export class ImportStagingExpiredError extends Error {
  constructor() {
    super("The staged import is gone. Choose the file again.");
    this.name = "ImportStagingExpiredError";
  }
}

export const IMPORT_ROW_ACTIONS = [
  "create",
  "update existing",
  "invalid",
] as const;
export type ImportRowAction = (typeof IMPORT_ROW_ACTIONS)[number];

export interface ImportMappingEntry {
  /** True when this column carries the origin key. */
  origin: boolean;
  source: string;
  /** The product field, `custom:<name>`, or null when the column is not imported. */
  target: string | null;
}

export interface ImportRowPreview {
  action: ImportRowAction;
  /** Update-existing rows offer the three choices; the chosen one is echoed. */
  choice?: ImportRowChoice;
  choices?: readonly ImportRowChoice[];
  /** A permanently deleted or retired origin: a fresh product id is minted. */
  newIdentity?: {
    previousOrigin: string;
    reason: "permanently deleted" | "retired";
  };
  originKey?: string;
  problems: string[];
  rowNumber: number;
  /** Mapped, non-empty values shown to the founder. */
  values: Record<string, string>;
}

export type ImportLossKind =
  | "unmapped column"
  | "nested value flattened"
  | "front matter ignored";

export interface ImportLoss {
  detail: string;
  kind: ImportLossKind;
}

export interface ImportPreview {
  catalogType: ImportCatalogType | null;
  counts: {
    create: number;
    invalid: number;
    skip: number;
    total: number;
    updateExisting: number;
  };
  expiresAt: string;
  family: ImportFamily;
  fileName: string;
  format: ImportFileFormat;
  invalidRows: ImportRowPreview[];
  invalidTotal: number;
  losses: ImportLoss[];
  mapping: ImportMappingEntry[];
  /** Product fields (and Project custom fields) a column may be mapped to. */
  mappingTargets: string[];
  /** What the origin key is, or why none can be used. */
  origin: {
    column: string | null;
    note: string;
    /** Provider/file scope the origin is kept under; never product-id authority. */
    provenance: string | null;
  };
  /** Always `none`: a preview never writes. */
  primaryWrites: "none";
  rows: ImportRowPreview[];
  rowsTruncated: boolean;
  scope: { kind: ImportScope["kind"]; label: string };
  stagingId: string;
}

export interface DataImportAccess {
  preview: (
    accountId: string,
    input: PreviewImportInput,
    now?: Date,
  ) => Promise<ImportPreview>;
  reopen: (
    accountId: string,
    input: ReopenImportPreviewInput,
    now?: Date,
  ) => Promise<ImportPreview>;
}
