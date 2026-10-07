import { z } from "zod";
import { type Document, documentTypeSchema } from "./documents";
import type { ProjectLifecycleStatus } from "./project-shell";
import {
  assumptionRecordSchema,
  decisionRecordSchema,
  milestoneRecordSchema,
  milestoneStatusSchema,
  openQuestionRecordSchema,
  type ProjectSourceRecord,
  productionIncidentRecordSchema,
  productionIncidentStatusSchema,
  projectReleaseRecordSchema,
  projectReleaseStatusSchema,
  riskRecordSchema,
} from "./project-source-records";
import {
  type WorkProfile,
  workDescriptionSchema,
  workEffortSchema,
  workOpenStatusSchema,
  workTitleSchema,
} from "./work-lifecycle";

export const recordDiscoveryScopeSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("all") }).strict(),
  z.object({ kind: z.literal("wiki") }).strict(),
  z
    .object({
      kind: z.literal("project"),
      projectId: z.string().min(1).max(200),
    })
    .strict(),
]);

export type RecordDiscoveryScope = z.infer<typeof recordDiscoveryScopeSchema>;

export const documentDiscoveryInputSchema = z
  .object({
    query: z.string().trim().max(200).default(""),
    scope: recordDiscoveryScopeSchema.default({ kind: "all" }),
    archived: z.boolean().default(false),
    type: documentTypeSchema.optional(),
    folder: z.string().min(1).max(255).optional(),
    currentProjectId: z.string().min(1).max(200).optional(),
  })
  .strict();

export type DocumentDiscoveryInput = z.infer<
  typeof documentDiscoveryInputSchema
>;

export interface DocumentDiscoveryResult {
  document: Document;
  matchCount: number;
  projectArchivedAt: string | null;
  projectName: string | null;
  projectStatus: ProjectLifecycleStatus | null;
  snippet: string;
}

export interface DocumentDiscoveryAccess {
  discover: (
    accountId: string,
    input: DocumentDiscoveryInput,
  ) => Promise<DocumentDiscoveryResult[]>;
}

export const recordDiscoveryIndexLabels = [
  "All Work",
  "All Documents",
  "All Decisions",
  "All Risks",
  "All Research Sessions",
  "All Tests",
  "All Designs",
  "All Technical Diagrams",
  "All Project Releases",
  "All Sources",
  "All Files",
] as const;

export const recordDiscoveryIndexSchema = z.enum(recordDiscoveryIndexLabels);

export const recordDiscoveryViewSchema = z.enum([
  "Search",
  ...recordDiscoveryIndexLabels,
]);

export type RecordDiscoveryIndex = z.infer<typeof recordDiscoveryIndexSchema>;
export type RecordDiscoveryView = z.infer<typeof recordDiscoveryViewSchema>;

export const universalSearchInputSchema = z
  .object({
    query: z.string().trim().max(200).default(""),
    currentProjectId: z.string().min(1).max(200).optional(),
    archived: z.boolean().default(false),
    index: recordDiscoveryViewSchema.default("Search"),
    scope: recordDiscoveryScopeSchema.default({ kind: "all" }),
    type: z.string().trim().min(1).max(255).optional(),
    folder: z.string().min(1).max(255).optional(),
  })
  .strict();

export type UniversalSearchInput = z.infer<typeof universalSearchInputSchema>;

export const universalSearchRecordTypes = [
  "Project",
  "Work",
  "Decision",
  "Risk",
  "Assumption",
  "Open Question",
  "Milestone",
  "Project Release",
  "Production Incident",
  "Technical Diagram",
  "Document",
  "File Attachment",
] as const;

export type UniversalSearchRecordType =
  (typeof universalSearchRecordTypes)[number];

export interface UniversalSearchResult {
  archived: boolean;
  authorityMode?: string | null;
  category: string | null;
  closureResult: string | null;
  fileMimeType?: string | null;
  fileName?: string | null;
  folder?: string | null;
  id: string;
  key: string | null;
  matchCount: number;
  ownerDocumentId: string | null;
  projectArchivedAt: string | null;
  projectId: string | null;
  projectName: string | null;
  recordType: UniversalSearchRecordType;
  scopeName: string;
  scopeType: "Personal Wiki" | "Project";
  snippet: string;
  status: string;
  title: string;
  updatedAt: string;
}

export interface UniversalSearchAccess {
  search: (
    accountId: string,
    input: UniversalSearchInput,
  ) => Promise<UniversalSearchResult[]>;
}

export const recordTableTypes = [
  "Work",
  "Decision",
  "Risk",
  "Assumption",
  "Open Question",
  "Milestone",
  "Project Release",
  "Production Incident",
] as const;

export const recordTableDecisionLifeSchema = z.enum(["Valid", "Withdrawn"]);

export const recordTableInputSchema = z
  .object({
    projectId: z.string().trim().min(1).max(200).optional(),
    recordType: z.enum(recordTableTypes),
  })
  .strict();

export type RecordTableInput = z.infer<typeof recordTableInputSchema>;
export type RecordTableRecord = WorkProfile | ProjectSourceRecord;

export const recordTableFieldsByType = {
  Work: [
    "title",
    "description",
    "effort",
    "plannedStartDate",
    "targetDate",
    "status",
  ],
  Decision: ["title", "decision", "rationale", "life"],
  Risk: ["title", "description", "impact", "probability", "response"],
  Assumption: ["title", "statement", "rationale"],
  "Open Question": ["title", "question", "context", "answer"],
  Milestone: ["title", "description", "targetDate", "status"],
  "Project Release": ["name", "versionLabel", "description", "status"],
  "Production Incident": [
    "title",
    "detectedHow",
    "impact",
    "occurredAt",
    "resolution",
    "rootCause",
    "learning",
    "status",
  ],
} as const satisfies Record<
  (typeof recordTableTypes)[number],
  readonly string[]
>;

export type RecordTableField =
  (typeof recordTableFieldsByType)[keyof typeof recordTableFieldsByType][number];

export const recordTableFieldValueSchemas = {
  Work: {
    title: workTitleSchema,
    description: workDescriptionSchema,
    effort: workEffortSchema,
    plannedStartDate: z.iso.date().nullable(),
    targetDate: z.iso.date().nullable(),
    status: workOpenStatusSchema,
  },
  Decision: {
    title: decisionRecordSchema.shape.title,
    decision: decisionRecordSchema.shape.decision,
    rationale: decisionRecordSchema.shape.rationale,
    life: recordTableDecisionLifeSchema,
  },
  Risk: {
    title: riskRecordSchema.shape.title,
    description: riskRecordSchema.shape.description,
    impact: riskRecordSchema.shape.impact,
    probability: riskRecordSchema.shape.probability,
    response: riskRecordSchema.shape.response,
  },
  Assumption: {
    title: assumptionRecordSchema.shape.title,
    statement: assumptionRecordSchema.shape.statement,
    rationale: assumptionRecordSchema.shape.rationale,
  },
  "Open Question": {
    title: openQuestionRecordSchema.shape.title,
    question: openQuestionRecordSchema.shape.question,
    context: openQuestionRecordSchema.shape.context,
    answer: openQuestionRecordSchema.shape.answer,
  },
  Milestone: {
    title: milestoneRecordSchema.shape.title,
    description: milestoneRecordSchema.shape.description,
    targetDate: milestoneRecordSchema.shape.targetDate,
    status: milestoneStatusSchema,
  },
  "Project Release": {
    name: projectReleaseRecordSchema.shape.name,
    versionLabel: projectReleaseRecordSchema.shape.versionLabel,
    description: projectReleaseRecordSchema.shape.description,
    status: projectReleaseStatusSchema,
  },
  "Production Incident": {
    title: productionIncidentRecordSchema.shape.title,
    detectedHow: productionIncidentRecordSchema.shape.detectedHow,
    impact: productionIncidentRecordSchema.shape.impact,
    occurredAt: productionIncidentRecordSchema.shape.occurredAt,
    resolution: productionIncidentRecordSchema.shape.resolution,
    rootCause: productionIncidentRecordSchema.shape.rootCause,
    learning: productionIncidentRecordSchema.shape.learning,
    status: productionIncidentStatusSchema,
  },
} satisfies Record<
  (typeof recordTableTypes)[number],
  Partial<Record<RecordTableField, z.ZodType>>
>;

export const recordTableFieldOptionsByType = {
  Work: { status: workOpenStatusSchema.options },
  Decision: { life: recordTableDecisionLifeSchema.options },
  Risk: {},
  Assumption: {},
  "Open Question": {},
  Milestone: { status: milestoneStatusSchema.options },
  "Project Release": { status: projectReleaseStatusSchema.options },
  "Production Incident": { status: productionIncidentStatusSchema.options },
} as const satisfies Record<
  (typeof recordTableTypes)[number],
  Partial<Record<RecordTableField, readonly string[]>>
>;

export function parseRecordTableFieldValue(
  recordType: (typeof recordTableTypes)[number],
  field: string,
  value: unknown,
): z.infer<typeof recordTableCellValueSchema> {
  const schemas = recordTableFieldValueSchemas[recordType] as Record<
    string,
    z.ZodType | undefined
  >;
  const schema = schemas[field];
  if (!schema) {
    throw new Error(`Field ${field} is not editable for ${recordType}.`);
  }
  const normalized =
    value === "" && schema.safeParse(null).success ? null : value;
  return schema.parse(normalized) as z.infer<typeof recordTableCellValueSchema>;
}

const recordTableCreateRequiredFields = {
  Work: ["title"],
  Decision: ["title", "decision"],
  Risk: ["title"],
  Assumption: ["title", "statement"],
  "Open Question": ["title", "question"],
  Milestone: ["title"],
  "Project Release": ["name"],
  "Production Incident": ["title", "occurredAt"],
} as const satisfies Record<
  (typeof recordTableTypes)[number],
  readonly RecordTableField[]
>;

const recordTableCellValueSchema = z
  .unknown()
  .refine((value) => value !== undefined, "A cell value is required.");

function validateRecordTableFields(
  recordType: (typeof recordTableTypes)[number],
  fields: Record<string, unknown>,
  context: z.RefinementCtx,
  path: PropertyKey[],
) {
  if (Object.keys(fields).length === 0) {
    context.addIssue({
      code: "custom",
      message: "At least one field is required.",
      path,
    });
    return;
  }

  for (const [field, value] of Object.entries(fields)) {
    const schemas = recordTableFieldValueSchemas[recordType] as Record<
      string,
      z.ZodType | undefined
    >;
    const schema = schemas[field];
    if (!schema) {
      context.addIssue({
        code: "custom",
        message: `Field ${field} is not editable for ${recordType}.`,
        path: [...path, field],
      });
    } else if (!schema.safeParse(value).success) {
      context.addIssue({
        code: "custom",
        message: `Invalid value for ${field}.`,
        path: [...path, field],
      });
    }
  }
}

export const recordTableCellUpdateInputSchema = z
  .object({
    baseRevision: z.number().int().nonnegative().safe(),
    clientIdempotencyKey: z.string().trim().min(1).max(100),
    field: z.string().trim().min(1).max(100),
    projectId: z.string().trim().min(1).max(200),
    recordId: z.string().trim().min(1).max(200),
    recordType: z.enum(recordTableTypes),
    value: recordTableCellValueSchema,
  })
  .strict()
  .superRefine(({ field, recordType, value }, context) => {
    validateRecordTableFields(recordType, { [field]: value }, context, []);
  });

const recordTablePasteRowSchema = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("update"),
      recordId: z.string().trim().min(1).max(200),
      projectId: z.string().trim().min(1).max(200),
      baseRevision: z.number().int().nonnegative().safe(),
      fields: z.record(z.string(), z.unknown()),
    })
    .strict(),
  z
    .object({
      kind: z.literal("create"),
      projectId: z.string().trim().min(1).max(200),
      recordId: z.string().trim().min(1).max(200).optional(),
      fields: z.record(z.string(), z.unknown()),
    })
    .strict(),
]);

type RecordTablePasteRow = z.infer<typeof recordTablePasteRowSchema>;

function validateRecordTableCreateRow(
  recordType: (typeof recordTableTypes)[number],
  row: RecordTablePasteRow,
  index: number,
  context: z.RefinementCtx,
) {
  if (row.kind !== "create") {
    return;
  }
  for (const field of recordTableCreateRequiredFields[recordType]) {
    if (row.fields[field] === undefined) {
      context.addIssue({
        code: "custom",
        message: `${field} is required to create a ${recordType}.`,
        path: ["rows", index, "fields", field],
      });
    }
  }
  if (recordType !== "Work" && !row.recordId) {
    context.addIssue({
      code: "custom",
      message: "A source record id is required for this type.",
      path: ["rows", index, "recordId"],
    });
  }
}

function validateRecordTableRowIdentity(
  row: RecordTablePasteRow,
  index: number,
  seen: Set<string>,
  context: z.RefinementCtx,
) {
  if (row.kind !== "update" && !row.recordId) {
    return;
  }
  const identity = `${row.projectId}:${row.recordId ?? `new-${index}`}`;
  if (seen.has(identity)) {
    context.addIssue({
      code: "custom",
      message: "A record can appear only once in a paste.",
      path: ["rows", index],
    });
  }
  seen.add(identity);
}

function validateRecordTablePasteRows(
  recordType: (typeof recordTableTypes)[number],
  rows: RecordTablePasteRow[],
  context: z.RefinementCtx,
) {
  const seen = new Set<string>();
  for (const [index, row] of rows.entries()) {
    validateRecordTableFields(recordType, row.fields, context, [
      "rows",
      index,
      "fields",
    ]);
    validateRecordTableCreateRow(recordType, row, index, context);
    validateRecordTableRowIdentity(row, index, seen, context);
  }
}

export const recordTablePasteInputSchema = z
  .object({
    clientIdempotencyKey: z.string().trim().min(1).max(100),
    recordType: z.enum(recordTableTypes),
    rows: z.array(recordTablePasteRowSchema).min(1).max(100),
  })
  .strict()
  .superRefine(({ recordType, rows }, context) =>
    validateRecordTablePasteRows(recordType, rows, context),
  );

export type RecordTableCellUpdateInput = z.infer<
  typeof recordTableCellUpdateInputSchema
>;
export type RecordTablePasteInput = z.infer<typeof recordTablePasteInputSchema>;

export interface RecordTableAccess {
  applyPaste: (
    accountId: string,
    input: RecordTablePasteInput,
  ) => Promise<RecordTableRecord[]>;
  list: (
    accountId: string,
    input: RecordTableInput,
  ) => Promise<RecordTableRecord[]>;
  updateCell: (
    accountId: string,
    input: RecordTableCellUpdateInput,
  ) => Promise<RecordTableRecord>;
}

const wordPattern = /[\p{L}\p{N}_]+/gu;
const wordPartsPattern = /([\p{L}\p{N}_]+)/gu;

export function documentMatchParts(text: string, query: string) {
  const terms = new Set(
    query.toLocaleLowerCase("en-US").match(wordPattern) ?? [],
  );
  let offset = 0;
  return text.split(wordPartsPattern).map((part) => {
    const start = offset;
    offset += part.length;
    return {
      text: part,
      start,
      matched: terms.has(part.toLocaleLowerCase("en-US")),
    };
  });
}

export function documentMatchContext(
  title: string,
  body: string,
  query: string,
) {
  const source = `${title}\n${body}`;
  const matches = documentMatchParts(source, query).filter(
    (part) => part.matched,
  );
  const firstMatch = matches[0]?.start ?? 0;
  const start = Math.max(0, firstMatch - 60);
  return {
    snippet: source.slice(start, start + 200),
    matchCount: matches.length,
  };
}
