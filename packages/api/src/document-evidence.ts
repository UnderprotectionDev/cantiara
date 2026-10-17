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
    role: z.string(),
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
    role: z.string(),
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
  forTarget: (
    accountId: string,
    input: DocumentEvidenceTarget,
  ) => Promise<DocumentEvidenceForTarget[] | null>;
  list: (
    accountId: string,
    input: DocumentSelection,
  ) => Promise<DocumentEvidenceBinding[] | null>;
  preview: (
    accountId: string,
    input: PreviewDocumentEvidenceInput,
  ) => Promise<DocumentEvidencePlan | null>;
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
