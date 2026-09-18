import { z } from "zod";

export const CAPTURE_TEMPLATES = [
  "Bug Capture",
  "Feedback Capture",
  "Research Fragment",
] as const;

export type CaptureTemplate = (typeof CAPTURE_TEMPLATES)[number];

export const CAPTURE_TRIAGE_EXITS = ["convert", "attach", "delete"] as const;

export type CaptureTriageExit = (typeof CAPTURE_TRIAGE_EXITS)[number];

export const CAPTURE_CONVERSION_TARGETS = ["Work", "Document"] as const;

export type CaptureConversionTarget =
  (typeof CAPTURE_CONVERSION_TARGETS)[number];

export const CAPTURE_BIND_RELATIONS = ["Origin", "Evidence"] as const;

export type CaptureBindRelation = (typeof CAPTURE_BIND_RELATIONS)[number];

export const CAPTURE_TEMPLATE_FIELD_LABELS = {
  "Bug Capture": [
    "Observed Behavior",
    "Expected Behavior",
    "Reproduction Context",
  ],
  "Feedback Capture": ["Feedback", "Channel", "Contact"],
  "Research Fragment": ["Note or Excerpt", "Source Context"],
} as const satisfies Record<CaptureTemplate, readonly string[]>;

export const captureTemplateSchema = z.enum(CAPTURE_TEMPLATES);
const identifierSchema = z.string().trim().min(1).max(255);
const captureStagingObjectIdSchema = identifierSchema.regex(
  /^[A-Za-z0-9_-]+$/u,
  {
    message: "Capture attachment ids must be opaque staging identifiers.",
  },
);
const captureTextSchema = z.string().max(100_000);
export const captureUrlSchema = z
  .string()
  .trim()
  .min(1)
  .max(2048)
  .url()
  .refine(
    (value) => {
      const { protocol } = new URL(value);
      return protocol === "http:" || protocol === "https:";
    },
    { message: "Capture links must use HTTP or HTTPS." },
  );

export const captureAttachmentSchema = z
  .object({
    id: captureStagingObjectIdSchema,
    mimeType: z.string().trim().min(1).max(255).optional(),
    name: z.string().trim().min(1).max(255).optional(),
    size: z.number().int().nonnegative().safe().optional(),
  })
  .strict();

export type CaptureAttachment = z.infer<typeof captureAttachmentSchema>;

export const captureOriginSchema = z.union([
  identifierSchema,
  z
    .object({
      kind: identifierSchema,
      label: z.string().trim().min(1).max(255).optional(),
      url: captureUrlSchema.nullable().optional(),
    })
    .catchall(z.json()),
]);

export type CaptureOrigin = z.infer<typeof captureOriginSchema>;

const captureProvenanceFields = {
  attachment: captureAttachmentSchema.nullable().optional(),
  link: captureUrlSchema.nullable().optional(),
  origin: captureOriginSchema.nullable().optional(),
} as const;

export const captureFieldsSchema = z.record(z.string(), captureTextSchema);

export const captureInputSchema = z
  .object({
    ...captureProvenanceFields,
    clientIdempotencyKey: identifierSchema.optional(),
    content: captureTextSchema.default(""),
    fields: captureFieldsSchema.default({}),
    projectId: identifierSchema.nullable().default(null),
    template: captureTemplateSchema.nullable().default(null),
  })
  .strict();

export type CaptureInput = z.input<typeof captureInputSchema>;
export type NormalizedCaptureInput = z.output<typeof captureInputSchema>;

export const captureInboxItemSchema = z
  .object({
    ...captureProvenanceFields,
    content: captureTextSchema,
    createdAt: z.string().datetime({ offset: true }),
    fields: captureFieldsSchema,
    id: identifierSchema,
    projectId: identifierSchema.nullable(),
    template: captureTemplateSchema.nullable(),
  })
  .strict();

export type CaptureInboxItem = z.infer<typeof captureInboxItemSchema>;

export const captureInboxGroupSchema = z
  .object({
    itemIds: z.array(identifierSchema),
    items: z.array(captureInboxItemSchema),
    kind: z.enum(["workspace", "project"]),
    label: z.enum(["Workspace Capture Inbox", "Project Capture Inbox"]),
    projectId: identifierSchema.optional(),
  })
  .strict();

export type CaptureInboxGroup = z.infer<typeof captureInboxGroupSchema>;

const captureBulkPositionSchema = z.number().int().nonnegative().max(1_000_000);

export const captureBulkClusterSchema = z
  .object({
    id: identifierSchema,
    name: z.string().trim().min(1).max(255),
    position: captureBulkPositionSchema,
  })
  .strict();

export type CaptureBulkCluster = z.infer<typeof captureBulkClusterSchema>;

export const captureBulkPlacementSchema = z
  .object({
    clusterId: identifierSchema.nullable(),
    itemId: identifierSchema,
    position: captureBulkPositionSchema,
  })
  .strict();

export type CaptureBulkPlacement = z.infer<typeof captureBulkPlacementSchema>;

export const captureBulkSenseMakingValueSchema = z
  .object({
    clusters: z.array(captureBulkClusterSchema),
    placements: z.array(captureBulkPlacementSchema),
  })
  .strict();

export type CaptureBulkSenseMakingValue = z.infer<
  typeof captureBulkSenseMakingValueSchema
>;

export const captureBulkSenseMakingSchema = z
  .object({
    ...captureBulkSenseMakingValueSchema.shape,
    revision: z.number().int().nonnegative(),
  })
  .strict();

export type CaptureBulkSenseMaking = z.infer<
  typeof captureBulkSenseMakingSchema
>;

export const captureBulkSenseMakingInputSchema = z
  .object({
    ...captureBulkSenseMakingValueSchema.shape,
    baseRevision: z.number().int().nonnegative(),
    clientIdempotencyKey: identifierSchema,
  })
  .strict();

export type CaptureBulkSenseMakingInput = z.infer<
  typeof captureBulkSenseMakingInputSchema
>;

export const captureInboxSnapshotSchema = z
  .object({
    bulkSenseMaking: captureBulkSenseMakingSchema,
    groups: z.array(captureInboxGroupSchema),
    items: z.array(captureInboxItemSchema),
    triageAvailable: z.boolean(),
  })
  .strict();

export type CaptureInboxSnapshot = z.infer<typeof captureInboxSnapshotSchema>;

export interface CaptureInboxAccess {
  create: (accountId: string, input: CaptureInput) => Promise<CaptureInboxItem>;
  createBug: (
    accountId: string,
    input: CaptureInput,
  ) => Promise<DirectBugCreateReceipt>;
  list: (accountId: string) => Promise<CaptureInboxSnapshot>;
  updateBulkSenseMaking: (
    accountId: string,
    input: CaptureBulkSenseMakingInput,
  ) => Promise<CaptureBulkSenseMaking>;
}

export const captureConversionTargetSchema = z.enum(CAPTURE_CONVERSION_TARGETS);
export const captureBindRelationSchema = z.enum(CAPTURE_BIND_RELATIONS);

export const captureConvertPreviewInputSchema = z
  .object({
    itemId: identifierSchema,
    projectId: identifierSchema.optional(),
    recordType: captureConversionTargetSchema,
    title: z.string().trim().min(1).max(255).optional(),
  })
  .strict();

export type CaptureConvertPreviewInput = z.infer<
  typeof captureConvertPreviewInputSchema
>;

export const captureConvertInputSchema = z
  .object({
    clientIdempotencyKey: identifierSchema,
    itemId: identifierSchema,
    previewId: identifierSchema.optional(),
  })
  .strict();

export type CaptureConvertInput = z.infer<typeof captureConvertInputSchema>;

export interface CaptureFieldMapping {
  sourceField: string;
  targetField: string;
  value: string;
}

export interface CaptureTargetScope {
  kind: "project" | "workspace";
  label: "Project" | "Workspace";
  projectId: string | null;
}

export type FileAttachmentScope =
  | {
      kind: "project";
      projectId: string;
    }
  | {
      kind: "personalWiki";
      personalWikiId: string;
    };

export interface CaptureProposedRecord {
  fields: Record<string, string>;
  projectId: string | null;
  recordType: CaptureConversionTarget;
  title: string;
}

export interface CaptureProposedRelation {
  relation: "Origin";
  target: "Proposed record";
}

export interface CaptureConversionPreview {
  fieldMappings: CaptureFieldMapping[];
  itemId: string;
  previewId: string;
  proposedRecord: CaptureProposedRecord;
  proposedRelations: CaptureProposedRelation[];
  source: CaptureInboxItem;
  targetScope: CaptureTargetScope;
}

export interface CaptureAttachmentPromotionInput<TReceipt> {
  accountId: string;
  attachment: CaptureAttachment;
  clientIdempotencyKey: string;
  finalize: () => Promise<TReceipt>;
  item: CaptureInboxItem;
  operation: "convert";
  targetScope: FileAttachmentScope;
}

export interface CaptureRecordCreateInput {
  accountId: string;
  clientIdempotencyKey: string;
  fields: Record<string, string>;
  item: CaptureInboxItem;
  projectId: string | null;
  recordType: CaptureConversionTarget;
  title: string;
}

export interface CaptureRecordCreateReceipt {
  id: string;
  recordType?: string;
}

export interface CaptureRecordTarget {
  fields: Record<string, string>;
  id: string;
  projectId: string | null;
  projectName?: string;
  recordType: string;
  revision: number;
  title: string;
}

export interface CaptureBindInput {
  accountId: string;
  clientIdempotencyKey: string;
  item: CaptureInboxItem;
  mergeId: string;
  relation: CaptureBindRelation;
  target: CaptureRecordTarget;
}

export interface CaptureBindReceipt {
  attributedRelationIds: string[];
  attributedValueKeys: string[];
  mergeId: string;
}

export interface CaptureSuggestion {
  basis: string[];
  id: string;
  projectId: string | null;
  projectName?: string;
  recordType: string;
  title: string;
}

export interface CaptureSuggestionGroup {
  items: CaptureSuggestion[];
  label: "Same Project" | "Other Projects";
}

export interface CaptureSuggestions {
  otherProjects: CaptureSuggestionGroup[];
  sameProject: CaptureSuggestionGroup;
}

export const captureAttachPreviewInputSchema = z
  .object({
    itemId: identifierSchema,
    relation: captureBindRelationSchema,
    targetId: identifierSchema,
  })
  .strict();

export type CaptureAttachPreviewInput = z.infer<
  typeof captureAttachPreviewInputSchema
>;

export const captureAttachInputSchema = z
  .object({
    clientIdempotencyKey: identifierSchema,
    itemId: identifierSchema,
    previewId: identifierSchema.optional(),
    relation: captureBindRelationSchema,
    targetId: identifierSchema,
  })
  .strict();

export type CaptureAttachInput = z.infer<typeof captureAttachInputSchema>;

export interface CaptureRelationPreview {
  relation: CaptureBindRelation;
  targetId: string;
}

export interface CaptureAttachPreview {
  crossProject: boolean;
  itemId: string;
  previewId: string;
  relationPreview: CaptureRelationPreview;
  source: CaptureInboxItem;
  target: CaptureRecordTarget;
  targetProject?: { id: string; name: string };
}

export interface CaptureTriageReceipt {
  consumed: true;
  exit: Exclude<CaptureTriageExit, "delete">;
  itemId: string;
}

export interface CaptureConvertReceipt extends CaptureTriageReceipt {
  exit: "convert";
  recordId: string;
  recordType: string;
}

export interface CaptureAttachReceipt extends CaptureTriageReceipt {
  exit: "attach";
  mergeId: string;
  relation: CaptureBindRelation;
  targetId: string;
}

export const captureDeleteInputSchema = z
  .object({
    clientIdempotencyKey: identifierSchema,
    itemId: identifierSchema,
  })
  .strict();

export type CaptureDeleteInput = z.infer<typeof captureDeleteInputSchema>;

export interface CaptureDeleteReceipt {
  consumed: true;
  exit: "delete";
  itemId: string;
}

export const captureSuggestionsInputSchema = z
  .object({ itemId: identifierSchema })
  .strict();

export type CaptureSuggestionsInput = z.infer<
  typeof captureSuggestionsInputSchema
>;

export const captureUndoMergePreviewInputSchema = z
  .object({ mergeId: identifierSchema })
  .strict();

export type CaptureUndoMergePreviewInput = z.infer<
  typeof captureUndoMergePreviewInputSchema
>;

export const captureUndoMergeInputSchema = z
  .object({
    clientIdempotencyKey: identifierSchema,
    mergeId: identifierSchema,
    previewId: identifierSchema,
  })
  .strict();

export type CaptureUndoMergeInput = z.infer<typeof captureUndoMergeInputSchema>;

export interface CaptureUndoMergePreview {
  itemId: string;
  mergeId: string;
  previewId: string;
  removeFromTarget: Pick<
    CaptureBindReceipt,
    "attributedRelationIds" | "attributedValueKeys"
  >;
  restore: CaptureInboxItem;
}

export interface CaptureUndoMergeReceipt {
  mergeId: string;
  removedRelationIds: string[];
  removedValueKeys: string[];
  restoredItem: CaptureInboxItem;
}

export interface CaptureUndoMergeInputForAdapter extends CaptureUndoMergeInput {
  attributedRelationIds: string[];
  attributedValueKeys: string[];
  currentTarget: CaptureRecordTarget | null;
}

export interface CaptureInboxTriageAdapter {
  attachToExisting: (input: CaptureBindInput) => Promise<CaptureBindReceipt>;
  createRecord: (
    input: CaptureRecordCreateInput,
  ) => Promise<CaptureRecordCreateReceipt>;
  findRecord: (
    accountId: string,
    targetId: string,
  ) => Promise<CaptureRecordTarget | null>;
  findSimilar?: (
    accountId: string,
    item: CaptureInboxItem,
  ) => Promise<CaptureSuggestion[]>;
  undoMerge: (input: CaptureUndoMergeInputForAdapter) => Promise<void>;
}

export interface CaptureInboxTriageAccess extends CaptureInboxAccess {
  attachToExisting: (
    accountId: string,
    input: CaptureAttachInput,
  ) => Promise<CaptureAttachReceipt>;
  convert: (
    accountId: string,
    input: CaptureConvertInput,
  ) => Promise<CaptureConvertReceipt>;
  delete: (
    accountId: string,
    input: CaptureDeleteInput,
  ) => Promise<CaptureDeleteReceipt>;
  previewAttachToExisting: (
    accountId: string,
    input: CaptureAttachPreviewInput,
  ) => Promise<CaptureAttachPreview>;
  previewConvert: (
    accountId: string,
    input: CaptureConvertPreviewInput,
  ) => Promise<CaptureConversionPreview>;
  previewUndoMerge: (
    accountId: string,
    input: CaptureUndoMergePreviewInput,
  ) => Promise<CaptureUndoMergePreview>;
  suggestions: (
    accountId: string,
    itemId: string,
  ) => Promise<CaptureSuggestions>;
  undoMerge: (
    accountId: string,
    input: CaptureUndoMergeInput,
  ) => Promise<CaptureUndoMergeReceipt>;
}

export interface DirectBugCreateInput extends NormalizedCaptureInput {
  accountId: string;
}

export interface DirectBugCreateReceipt {
  workId: string;
}
