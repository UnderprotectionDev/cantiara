import { z } from "zod";
import { versionPinnedEvidenceSchema } from "./evidence";
import { humanMutationEnvelopeSchema } from "./mutation-and-undo";
import { brokenReferenceReasonSchema } from "./relations";

const id = z.string().trim().min(1).max(255);
const offset = z.number().int().nonnegative().safe();

/** Closed catalog for Document-sourced `Bind as evidence to existing record` and `Convert to new record and bind`. */
export const DOCUMENT_EVIDENCE_TARGET_TYPES = [
  "Work",
  "Decision",
  "Risk",
  "Assumption",
  "Open Question",
] as const;
export const documentEvidenceTargetTypeSchema = z.enum(
  DOCUMENT_EVIDENCE_TARGET_TYPES,
);
export const documentEvidenceTargetSchema = z
  .object({
    projectId: id,
    recordId: id,
    type: documentEvidenceTargetTypeSchema,
  })
  .strict();
export type DocumentEvidenceTarget = z.infer<
  typeof documentEvidenceTargetSchema
>;
export const documentEvidenceNewRecordSchema = z
  .object({
    projectId: id,
    type: documentEvidenceTargetTypeSchema,
    title: z.string().trim().min(1).max(255),
    workType: z.enum(["Task", "Bug", "Research", "Improvement"]).optional(),
  })
  .strict()
  .refine(
    (record) => (record.type === "Work" ? !!record.workType : !record.workType),
    "Choose Work type only for Work.",
  );
export type DocumentEvidenceNewRecord = z.infer<
  typeof documentEvidenceNewRecordSchema
>;

/** Closed Evidence Role catalog; `Unspecified` is the empty role and never blocks a bind. */
export const EVIDENCE_ROLES = [
  "Supporting",
  "Contradicting",
  "Provides context",
  "Inconclusive",
  "Unspecified",
] as const;
export const evidenceRoleSchema = z.enum(EVIDENCE_ROLES);
export type EvidenceRole = z.infer<typeof evidenceRoleSchema>;
export const founderInterpretationSchema = z
  .string()
  .trim()
  .max(5000)
  .transform((value) => (value.length ? value : null))
  .nullable();

export const documentSelectionSchema = z
  .object({ documentId: id, projectId: id })
  .strict();
export type DocumentSelection = z.infer<typeof documentSelectionSchema>;

export const previewDocumentEvidenceInputSchema = documentSelectionSchema
  .extend({
    versionRevision: z.number().int().positive(),
    start: offset,
    end: z.number().int().positive().safe(),
    bindingId: id.optional(),
    target: documentEvidenceTargetSchema.optional(),
    newRecord: documentEvidenceNewRecordSchema.optional(),
  })
  .strict()
  .refine(
    (value) =>
      [value.bindingId, value.target, value.newRecord].filter(Boolean)
        .length === 1,
    "Choose one existing bind, target or new record.",
  );
export type PreviewDocumentEvidenceInput = z.infer<
  typeof previewDocumentEvidenceInputSchema
>;

export const documentEvidencePlanSchema = z
  .object({
    pin: versionPinnedEvidenceSchema,
    mode: z.enum(["bind", "create", "rebind"]),
    target: documentEvidenceTargetSchema.nullable(),
    newRecord: documentEvidenceNewRecordSchema.nullable(),
    targetTitle: id,
    /** Fields the new record would receive; empty for bind. Derived only from the pinned text. */
    fields: z.record(z.string(), z.string().nullable()),
    bindingId: id.nullable(),
    bindingRevision: z.number().int().nonnegative(),
    currentRevision: z.number().int().positive(),
  })
  .strict();
export type DocumentEvidencePlan = z.infer<typeof documentEvidencePlanSchema>;

export const confirmDocumentEvidenceInputSchema = humanMutationEnvelopeSchema
  .extend({
    ...documentSelectionSchema.shape,
    id,
    /** Required for `create`: the identity of the single new record. */
    recordId: id.optional(),
    plan: documentEvidencePlanSchema,
  })
  .strict();
export type ConfirmDocumentEvidenceInput = z.infer<
  typeof confirmDocumentEvidenceInputSchema
>;

export const documentEvidenceBindingSchema = z
  .object({
    id,
    revision: z.number().int().positive(),
    pin: versionPinnedEvidenceSchema,
    role: evidenceRoleSchema,
    interpretation: z.string().nullable(),
    target: z
      .object({
        type: documentEvidenceTargetTypeSchema,
        recordId: id,
        projectId: id.nullable(),
        label: id.nullable(),
        brokenReason: brokenReferenceReasonSchema.nullable(),
        canOpenSourceRecord: z.boolean(),
      })
      .strict(),
    /** True when the target was created from this selection (Origin Location). */
    origin: z.boolean(),
    newerVersionExists: z.boolean(),
    currentRevision: z.number().int().positive(),
    readOnly: z.boolean(),
    createdAt: z.iso.datetime({ offset: true }),
    actorId: id,
  })
  .strict();
export type DocumentEvidenceBinding = z.infer<
  typeof documentEvidenceBindingSchema
>;

/** Target-side row: the original Document stays openable only while its content is accessible. */
export const documentEvidenceForTargetSchema = z
  .object({
    id,
    pin: versionPinnedEvidenceSchema.nullable(),
    /** Withheld (null) with the interpretation while the source content is inaccessible. */
    role: evidenceRoleSchema.nullable(),
    interpretation: z.string().nullable(),
    source: z
      .object({
        documentId: id,
        projectId: id.nullable(),
        title: id.nullable(),
        brokenReason: brokenReferenceReasonSchema.nullable(),
        canOpenSourceRecord: z.boolean(),
      })
      .strict(),
    newerVersionExists: z.boolean(),
    createdAt: z.iso.datetime({ offset: true }),
  })
  .strict();
export type DocumentEvidenceForTarget = z.infer<
  typeof documentEvidenceForTargetSchema
>;

/** Source types that can currently pin a version; the flow filter offers only these. */
export const EVIDENCE_FLOW_SOURCE_TYPES = [
  "Document",
  "Source",
  "Research Session",
] as const;
export const evidenceFlowSourceTypeSchema = z.enum(EVIDENCE_FLOW_SOURCE_TYPES);
export type EvidenceFlowSourceType = z.infer<
  typeof evidenceFlowSourceTypeSchema
>;

/** Flow lives on Work, Decision and Assumption detail; observation targets never reach it. */
export const evidenceFlowInputSchema = documentEvidenceTargetSchema
  .extend({
    type: z.enum(["Work", "Decision", "Assumption"]),
    sourceType: evidenceFlowSourceTypeSchema.optional(),
  })
  .strict();
export type EvidenceFlowInput = z.infer<typeof evidenceFlowInputSchema>;

/** One explicit `Kanıtı` relation. Relation time is kept apart from role, interpretation and source life. */
export const evidenceFlowRowSchema = z
  .object({
    id,
    sourceType: evidenceFlowSourceTypeSchema,
    pin: versionPinnedEvidenceSchema.nullable(),
    role: evidenceRoleSchema.nullable(),
    interpretation: z.string().nullable(),
    source: z
      .object({
        recordId: id,
        projectId: id.nullable(),
        title: id.nullable(),
        brokenReason: brokenReferenceReasonSchema.nullable(),
        canOpenSourceRecord: z.boolean(),
      })
      .strict(),
    /** Owned component gone: `Source element no longer exists`; text and role stay withheld. */
    elementMissing: z.boolean(),
    newerVersionExists: z.boolean(),
    relatedAt: z.iso.datetime({ offset: true }),
  })
  .strict();
export type EvidenceFlowRow = z.infer<typeof evidenceFlowRowSchema>;

/** A user choice only: no text inference, no reinterpretation on a new Source version. */
export const setDocumentEvidenceRoleInputSchema = humanMutationEnvelopeSchema
  .extend({
    ...documentSelectionSchema.shape,
    id,
    role: evidenceRoleSchema,
    interpretation: founderInterpretationSchema,
  })
  .strict();
export type SetDocumentEvidenceRoleInput = z.infer<
  typeof setDocumentEvidenceRoleInputSchema
>;

export const documentEvidenceHistoryInputSchema = documentSelectionSchema
  .extend({ id })
  .strict();
export type DocumentEvidenceHistoryInput = z.infer<
  typeof documentEvidenceHistoryInputSchema
>;
export const documentEvidenceHistoryEntrySchema = z
  .object({
    revision: z.number().int().positive(),
    previousRole: evidenceRoleSchema,
    previousInterpretation: z.string().nullable(),
    role: evidenceRoleSchema,
    interpretation: z.string().nullable(),
    actorId: id,
    changedAt: z.iso.datetime({ offset: true }),
  })
  .strict();
export type DocumentEvidenceHistoryEntry = z.infer<
  typeof documentEvidenceHistoryEntrySchema
>;

export interface EvidenceRoleGroup<Item> {
  /** The exact accessible relation set the count opens. */
  items: Item[];
  role: EvidenceRole;
}

/** Groups by the stored role in catalog order; no score, majority or suggested decision. */
export function groupEvidenceByRole<Item extends { role: EvidenceRole | null }>(
  items: Item[],
): { groups: EvidenceRoleGroup<Item>[]; withheld: number } {
  const groups = EVIDENCE_ROLES.map((role) => ({
    role,
    items: items.filter((item) => item.role === role),
  })).filter((group) => group.items.length > 0);
  return { groups, withheld: items.filter((item) => !item.role).length };
}

export const documentEvidenceTargetOptionSchema =
  documentEvidenceTargetSchema.extend({ title: id });
export type DocumentEvidenceTargetOption = z.infer<
  typeof documentEvidenceTargetOptionSchema
>;

export interface DocumentEvidenceAccess {
  confirm: (
    accountId: string,
    input: ConfirmDocumentEvidenceInput,
  ) => Promise<DocumentEvidenceBinding | null>;
  flow: (
    accountId: string,
    input: EvidenceFlowInput,
  ) => Promise<EvidenceFlowRow[] | null>;
  forTarget: (
    accountId: string,
    input: DocumentEvidenceTarget,
  ) => Promise<DocumentEvidenceForTarget[] | null>;
  history: (
    accountId: string,
    input: DocumentEvidenceHistoryInput,
  ) => Promise<DocumentEvidenceHistoryEntry[] | null>;
  list: (
    accountId: string,
    input: DocumentSelection,
  ) => Promise<DocumentEvidenceBinding[] | null>;
  preview: (
    accountId: string,
    input: PreviewDocumentEvidenceInput,
  ) => Promise<DocumentEvidencePlan | null>;
  setRole: (
    accountId: string,
    input: SetDocumentEvidenceRoleInput,
  ) => Promise<DocumentEvidenceBinding | null>;
  targets: (
    accountId: string,
    input: DocumentSelection,
  ) => Promise<DocumentEvidenceTargetOption[] | null>;
}

/** Field a new record receives from the pinned text; no AI, no multi-create. */
export function documentEvidenceRecordFields(
  record: DocumentEvidenceNewRecord,
  excerpt: string,
): Record<string, string | null> {
  const field = {
    Work: "description",
    Decision: "decision",
    Risk: "description",
    Assumption: "statement",
    "Open Question": "question",
  }[record.type];
  return {
    title: record.title,
    [field]: excerpt,
    ...(record.type === "Work" ? { workType: record.workType ?? null } : {}),
  };
}
