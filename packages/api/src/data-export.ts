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
/**
 * `PDF` is a readable snapshot of an exact-view list only (a Work list, a
 * Smart Collection or a cross-project list). The seam refuses it for a general
 * catalog export, which stays JSON and CSV.
 */
export const EXPORT_FORMATS = ["JSON", "CSV", "PDF"] as const;
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

export const EXPORT_MAX_CROSS_PROJECTS = 50;

/** One Project. */
export const exportProjectScopeSchema = z
  .object({ kind: z.literal("project"), projectId: identifier })
  .strict();
export type ExportProjectScope = z.infer<typeof exportProjectScopeSchema>;

/**
 * A selection of the founder's Projects (a cross-project list). It is still one
 * selected scope per operation; the seam reads and access-checks every Project.
 */
export const exportCrossProjectScopeSchema = z
  .object({
    kind: z.literal("cross-project"),
    projectIds: z
      .array(identifier)
      .min(1)
      .max(EXPORT_MAX_CROSS_PROJECTS)
      .refine((ids) => new Set(ids).size === ids.length, {
        message: "Projects must be listed once each.",
      }),
  })
  .strict();
export type ExportCrossProjectScope = z.infer<
  typeof exportCrossProjectScopeSchema
>;

/** One selected scope per operation. */
export const exportScopeSchema = z.discriminatedUnion("kind", [
  exportProjectScopeSchema,
  exportCrossProjectScopeSchema,
  /** The account's own Workspace; the server derives it, a client never names one. */
  z.object({ kind: z.literal("workspace") }).strict(),
]);
export type ExportScope = z.infer<typeof exportScopeSchema>;

export function exportScopeProjectIds(scope: ExportScope): string[] {
  if (scope.kind === "workspace") {
    return [];
  }
  return scope.kind === "project" ? [scope.projectId] : [...scope.projectIds];
}

/**
 * The exact on-screen view a CSV snapshot captures (a Work list, a Smart
 * Collection or a cross-project list). It is only carried into the preview and
 * manifest; it never creates a named view, a report record or a subscription.
 */
export const EXPORT_VIEW_KINDS = [
  "Work list",
  "Smart Collection",
  "Cross-project list",
] as const;
export const exportViewSchema = z
  .object({
    /** A Smart Collection view id; the server resolves and verifies it. */
    id: identifier.optional(),
    kind: z.enum(EXPORT_VIEW_KINDS),
    name: z.string().trim().min(1).max(200),
    sort: z
      .object({
        direction: z.enum(["asc", "desc"]),
        field: identifier,
      })
      .strict()
      .optional(),
  })
  .strict();
export type ExportView = z.infer<typeof exportViewSchema>;

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
    /** Optional exact-view descriptor; `visibleFields` then orders columns. */
    view: exportViewSchema.optional(),
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

/** A cell whose value looked like a formula and was escaped as data. */
export interface ExportEscapedCell {
  field: string;
  recordId: string;
}

/** The CSV formula-escape transformation report (preview and manifest). */
export interface ExportEscapeReport {
  cells: ExportEscapedCell[];
  /** Total escaped cells; `cells` lists at most `EXPORT_ESCAPE_REPORT_CELLS`. */
  count: number;
}

export const EXPORT_ESCAPE_REPORT_CELLS = 200;

export interface ExportPreview {
  /** CSV only: cells escaped as data; absent for JSON, which stays raw. */
  escapes?: ExportEscapeReport;
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
  /** PDF only: the accessibility limit and the alternative offered instead. */
  pdfNotice?: { alternative: ExportFormat; limitation: string };
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
  view?: ExportView;
}

/** The source manifest every output carries. Not a live sync or second truth. */
export interface ExportManifest {
  /** CSV only: formula-like cells escaped as data. */
  escapes?: ExportEscapeReport;
  filters: Record<string, string>;
  format: ExportFormat;
  producedAt: string;
  recordCount: number;
  recordType: ExportRecordType;
  schemaVersion: typeof EXPORT_SCHEMA_VERSION;
  scope: ExportScope;
  /** Present for an exact-view snapshot: view name, kind and sort. */
  view?: ExportView;
  /** Column order for CSV. */
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
  /** Text, or base64 when `encoding` is `base64` (PDF). */
  bytes: string;
  encoding?: "base64" | "utf8";
  fileName: string;
  manifest: ExportManifest;
  mediaType: string;
}

/**
 * Tickets 02 (JSON) and 03 (CSV) register one producer per format. The seam
 * calls it only after the preview was confirmed and every limit passed.
 */
export interface ExportFormatProducer {
  /**
   * Cheap, synchronous artifact the preview measures. A producer that needs a
   * heavy step (PDF rendering) returns its source here and renders in
   * `finalize`, which runs only after the founder confirmed the preview.
   */
  finalize?: (artifact: ExportArtifact) => Promise<ExportArtifact>;
  format: ExportFormat;
  produce: (dataset: ExportDataset) => ExportArtifact;
}

export const EXPORT_PDF_LIMITATION =
  "This PDF is a visual, static snapshot. It is not a tagged PDF and does not promise WCAG conformance. For an accessible alternative, export the same view as CSV or JSON, or use a Document's Markdown export.";

export const EXPORT_ERROR_CODES = [
  "unlisted_family",
  "limit_exceeded",
  "capacity_exceeded",
  "preview_required",
  "source_unavailable",
  "format_unavailable",
  "view_unverified",
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
  view_unverified:
    "This view does not match the saved Smart Collection, so it was not exported.",
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

/** Record types read for the whole Workspace rather than one Project. */
export const WORKSPACE_SCOPED_RECORD_TYPES: readonly ExportRecordType[] = [
  "Contact",
  "Company",
  "Product Gap",
];

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
