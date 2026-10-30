import { z } from "zod";

/**
 * Selected Export seam (spec 79): the product-facing contract for exporting one
 * record type of one selected scope as JSON or CSV. This module owns the closed
 * catalog, the closed-world preview, the source manifest, the limits and the
 * secret rule. Producing the JSON bytes (ticket 02) and the spreadsheet-safe
 * CSV bytes (ticket 03) extend `ExportFormatProducer`; they never fork the
 * catalog, preview, manifest or limit rules. It is not a single Document
 * Markdown/PDF export (workflow 31) and not a Workspace exit package (82).
 */

export const EXPORT_LABEL = "Export";
export const EXPORT_FORMATS = ["JSON", "CSV"] as const;
export const exportFormatSchema = z.enum(EXPORT_FORMATS);
export type ExportFormat = z.infer<typeof exportFormatSchema>;

/** The explicit schema version every output carries (ADR-0005). */
export const EXPORT_SCHEMA_VERSION = "cantiara-export/1";

export const EXPORT_MAX_ROWS = 10_000;
export const EXPORT_MAX_BYTES = 25 * 1024 * 1024;
/** Concurrent previews and productions allowed in one server process. */
export const EXPORT_MAX_CONCURRENT = 2;

export const EXPORT_RESIDENCY_NOTE =
  "Your live Workspace data stays in the EU region. This file is your own copy; downloading it does not move your data.";
export const EXPORT_NATURE_NOTE =
  "This file holds only the records and fields listed here, as of the time it is produced. It is not a live link and does not stay in sync.";

/** The PRD 13 closed catalog. Document is deliberately absent (workflow 31). */
export const EXPORT_CATALOG = [
  {
    family: "Work",
    recordTypes: ["Feature", "Bug", "Task", "Research", "Improvement"],
  },
  { family: "Planning", recordTypes: ["Project Goal", "Milestone"] },
  {
    family: "Decisions and uncertainty",
    recordTypes: ["Decision", "Risk", "Assumption", "Open Question"],
  },
  {
    family: "Intake and people",
    recordTypes: ["Feedback", "Contact", "Company"],
  },
  {
    family: "Product learning",
    recordTypes: ["Product Gap", "Research Session", "Validation Record"],
  },
  { family: "External knowledge", recordTypes: ["Source"] },
  {
    family: "Release and operations",
    recordTypes: ["Project Release", "Production Incident"],
  },
] as const;

export const EXPORT_RECORD_TYPES = EXPORT_CATALOG.flatMap(
  (entry) => entry.recordTypes,
) as unknown as readonly ExportRecordType[];
export type ExportRecordType =
  (typeof EXPORT_CATALOG)[number]["recordTypes"][number];

export function isExportRecordType(value: unknown): value is ExportRecordType {
  return (
    typeof value === "string" &&
    (EXPORT_RECORD_TYPES as readonly string[]).includes(value)
  );
}

export function exportFamilyOf(recordType: ExportRecordType): string {
  const entry = EXPORT_CATALOG.find((candidate) =>
    (candidate.recordTypes as readonly string[]).includes(recordType),
  );
  return entry?.family ?? "";
}

const identifier = z.string().trim().min(1).max(255);

/** One selected scope per operation. */
export const exportScopeSchema = z
  .object({ kind: z.literal("project"), projectId: identifier })
  .strict();
export type ExportScope = z.infer<typeof exportScopeSchema>;

/**
 * The record type is validated against the catalog by the server so that an
 * unlisted type is refused with a stable code, not a schema error.
 */
export const exportRequestSchema = z
  .object({
    filters: z.record(z.string().max(100), z.string().max(500)).default({}),
    format: exportFormatSchema,
    recordIds: z.array(identifier).max(EXPORT_MAX_ROWS).optional(),
    recordType: z.string().trim().min(1).max(100),
    scope: exportScopeSchema,
    /** Subset of the type's fields to export; omitted means every field. */
    visibleFields: z.array(identifier).max(200).optional(),
  })
  .strict();
export type ExportRequest = z.input<typeof exportRequestSchema>;

export const exportProduceInputSchema = exportRequestSchema.extend({
  previewFingerprint: z.string().min(1).max(200),
});
export type ExportProduceInput = z.input<typeof exportProduceInputSchema>;

export const exportCatalogInputSchema = z.object({}).strict();

export interface ExportField {
  key: string;
  label: string;
}

export interface ExportRelationPreview {
  fromRecordId: string;
  kind: string;
  toRecordId: string;
}

/** A loss reported before download (relations, types, identities). */
export interface ExportLoss {
  detail: string;
  kind: "relations" | "types" | "identities" | "structure";
}

export interface ExportPreview {
  estimatedBytes: number;
  fields: ExportField[];
  filters: Record<string, string>;
  fingerprint: string;
  format: ExportFormat;
  /** False until the format's producer ships; the UI then disables confirm. */
  formatAvailable: boolean;
  /** Fields known to the type that the selection leaves out. */
  hiddenFields: ExportField[];
  limits: { maxBytes: number; maxRows: number };
  lost: ExportLoss[];
  nature: string;
  recordCount: number;
  records: Array<{ id: string; label: string }>;
  recordType: ExportRecordType;
  /** Relations whose both ends are in the selection. */
  relations: ExportRelationPreview[];
  /** Relations dropped because one end is not selected: a count only. */
  relationsOmitted: number;
  residency: string;
  scope: ExportScope;
  /** Secret classes removed from the output; names only, never values. */
  secretsExcluded: string[];
}

/** The source manifest every output carries. Not a live sync or second truth. */
export interface ExportManifest {
  filters: Record<string, string>;
  format: ExportFormat;
  producedAt: string;
  recordCount: number;
  recordType: ExportRecordType;
  schemaVersion: typeof EXPORT_SCHEMA_VERSION;
  scope: ExportScope;
  visibleFields: string[];
}

/** Where a record came from (capture provenance); raw, as stored. */
export type ExportOrigin = Record<string, unknown>;

/** A selected-scope custom field definition carried by JSON. */
export interface ExportCustomFieldDefinition {
  id: string;
  name: string;
  options: string[];
  recordTypes: string[];
  type: string;
}

/**
 * Extras only the structured JSON format carries. Components are owned by the
 * record (Work `externalExecutionHandoffs`, Project Release `accessObservation`
 * and `outcomeObservation`); they never export as a standalone type.
 */
export interface ExportRecordExtras {
  components?: Record<string, unknown[]>;
  customFieldValues?: Record<string, unknown>;
  /** Every key this record has held, current key included, oldest first. */
  keyHistory?: string[];
  origin?: ExportOrigin | null;
}

export interface ExportDatasetRecord extends ExportRecordExtras {
  id: string;
  values: Record<string, unknown>;
}

/** The closed-world data a format producer may serialize. Secret-free. */
export interface ExportDataset {
  customFieldDefinitions: ExportCustomFieldDefinition[];
  fields: ExportField[];
  manifest: ExportManifest;
  records: ExportDatasetRecord[];
  relations: ExportRelationPreview[];
}

export interface ExportArtifact {
  bytes: string;
  fileName: string;
  manifest: ExportManifest;
  mediaType: string;
}

/**
 * Tickets 02 (JSON) and 03 (CSV) register one producer per format. The seam
 * calls it only after the preview was confirmed and every limit passed.
 */
export interface ExportFormatProducer {
  format: ExportFormat;
  produce: (dataset: ExportDataset) => ExportArtifact;
}

export const EXPORT_ERROR_CODES = [
  "unlisted_family",
  "limit_exceeded",
  "capacity_exceeded",
  "preview_required",
  "source_unavailable",
  "format_unavailable",
] as const;
export type ExportErrorCode = (typeof EXPORT_ERROR_CODES)[number];

export const EXPORT_ERROR_MESSAGES: Record<ExportErrorCode, string> = {
  capacity_exceeded:
    "Too many exports are running right now. Try again in a moment.",
  format_unavailable: "This format is not available yet.",
  limit_exceeded: "This export is over the limit of 10,000 rows or 25 MB.",
  preview_required:
    "Review the preview first. The selection changed or was never previewed.",
  source_unavailable: "Exporting this record type is not available yet.",
  unlisted_family: "This record type is not part of Export.",
};

export class ExportError extends Error {
  readonly code: ExportErrorCode;
  readonly detail?: string;

  constructor(code: ExportErrorCode, detail?: string) {
    super(detail ?? EXPORT_ERROR_MESSAGES[code]);
    this.code = code;
    this.detail = detail;
  }
}

export interface ExportCatalogEntry {
  available: boolean;
  family: string;
  recordType: ExportRecordType;
}

export interface SelectedExportAccess {
  catalog: () => ExportCatalogEntry[];
  preview: (
    accountId: string,
    request: ExportRequest,
  ) => Promise<ExportPreview>;
  produce: (
    accountId: string,
    input: ExportProduceInput,
  ) => Promise<ExportArtifact>;
}

/** Key names that mark Secret class data; matched case-insensitively. */
const SECRET_KEY_PATTERN =
  /(password|passphrase|secret|token|apikey|api_key|credential|cookie|authorization|privatekey|private_key|hash|digest|salt)/i;

export function isSecretKey(key: string): boolean {
  return SECRET_KEY_PATTERN.test(key);
}

/**
 * Removes Secret class values wherever they sit, by key name, and returns the
 * removed key names (never values). Applied centrally by the seam so no source
 * reader or format producer can bypass it.
 */
export function stripSecrets<T>(value: T, removed: Set<string>): T {
  if (Array.isArray(value)) {
    return value.map((item) => stripSecrets(item, removed)) as T;
  }
  if (value && typeof value === "object" && !(value instanceof Date)) {
    const output: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) {
      if (isSecretKey(key)) {
        removed.add(key);
        continue;
      }
      output[key] = stripSecrets(item, removed);
    }
    return output as T;
  }
  return value;
}
