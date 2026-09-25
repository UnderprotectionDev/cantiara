import { z } from "zod";

import {
  captureAttachmentSchema,
  captureFieldsSchema,
  captureOriginSchema,
  captureTemplateSchema,
  captureUrlSchema,
} from "./capture-triage";
import { fileAttachmentLocationSchema } from "./file-attachments";
import {
  humanMutationEnvelopeSchema,
  type MutationContract,
} from "./mutation-and-undo";
import type { BlockingRelationStatus } from "./relations";

export const WORK_TYPE_OPTIONS = [
  "Feature",
  "Bug",
  "Task",
  "Research",
  "Improvement",
] as const;

export type WorkType = (typeof WORK_TYPE_OPTIONS)[number];

export const workTypeSchema = z.enum(WORK_TYPE_OPTIONS);

export const WORK_DEFAULT_TYPE: WorkType = "Task";

export const WORK_STATUS_OPTIONS = [
  "Not Started",
  "In Progress",
  "Blocked",
  "Closed",
] as const;

export type WorkStatus = (typeof WORK_STATUS_OPTIONS)[number];

export const workStatusSchema = z.enum(WORK_STATUS_OPTIONS);

export const WORK_OPEN_STATUS_OPTIONS = [
  "Not Started",
  "In Progress",
  "Blocked",
] as const;

export type WorkOpenStatus = (typeof WORK_OPEN_STATUS_OPTIONS)[number];

export const workOpenStatusSchema = z.enum(WORK_OPEN_STATUS_OPTIONS);

export const WORK_CLOSURE_RESULT_OPTIONS = ["Completed", "Abandoned"] as const;

export type WorkClosureResult = (typeof WORK_CLOSURE_RESULT_OPTIONS)[number];

export const workClosureResultSchema = z.enum(WORK_CLOSURE_RESULT_OPTIONS);

export const FEATURE_HEALTH_OPTIONS = [
  "On Track",
  "At Risk",
  "Off Track",
] as const;

export type FeatureHealth = (typeof FEATURE_HEALTH_OPTIONS)[number];

export const featureHealthSchema = z.enum(FEATURE_HEALTH_OPTIONS);

export const workClosureReasonSchema = z
  .string()
  .trim()
  .max(2000, "Reason must be 2,000 characters or fewer.")
  .transform((value) => (value.length > 0 ? value : null))
  .nullable();

const identifierSchema = z.string().trim().min(1).max(255);

export const workOriginPositionSchema = z
  .object({
    componentId: identifierSchema,
    location: fileAttachmentLocationSchema.optional(),
    ownerRecordId: identifierSchema,
    sourceVersion: identifierSchema.nullable(),
  })
  .strict();

export type WorkOriginPosition = z.infer<typeof workOriginPositionSchema>;

export const workTitleSchema = z
  .string()
  .trim()
  .min(1, "Work title is required.")
  .max(255, "Work title must be 255 characters or fewer.");

export const workDescriptionSchema = z
  .string()
  .trim()
  .max(100_000, "Work description must be 100,000 characters or fewer.")
  .nullable();

export const workTargetDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Target date must use YYYY-MM-DD.")
  .nullable()
  .optional();

export const workPlannedStartDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Planned start date must use YYYY-MM-DD.")
  .nullable()
  .optional();

export const workReappearDateSchema = z.iso.date().nullable();

export const updateWorkReappearDateInputSchema = humanMutationEnvelopeSchema
  .extend({
    reappearDate: workReappearDateSchema,
    workId: identifierSchema,
  })
  .strict();

export type UpdateWorkReappearDateInput = z.input<
  typeof updateWorkReappearDateInputSchema
>;

export const workEffortSchema = z
  .string()
  .trim()
  .min(1, "Effort must not be empty.")
  .max(255, "Effort must be 255 characters or fewer.")
  .nullable()
  .optional();

export const workChecklistItemSchema = z
  .object({
    completed: z.boolean(),
    id: identifierSchema,
    text: z.string().trim().min(1).max(1000),
    convertedWork: z
      .object({
        id: identifierSchema,
        key: identifierSchema,
        title: workTitleSchema,
      })
      .strict()
      .optional(),
  })
  .strict();

export const workChecklistSchema = z.array(workChecklistItemSchema).max(500);

const workChecklistItemInputSchema = workChecklistItemSchema.omit({
  convertedWork: true,
});

export const workChecklistInputSchema = z
  .array(workChecklistItemInputSchema)
  .max(500);

export type WorkChecklistItem = z.infer<typeof workChecklistItemSchema>;

export const updateWorkChecklistInputSchema = humanMutationEnvelopeSchema
  .extend({
    checklist: workChecklistSchema,
    workId: identifierSchema,
  })
  .strict();

export type UpdateWorkChecklistInput = z.input<
  typeof updateWorkChecklistInputSchema
>;

export const workChecklistConversionPreviewInputSchema = z
  .object({
    itemId: identifierSchema,
    workId: identifierSchema,
  })
  .strict();

export type WorkChecklistConversionPreviewInput = z.input<
  typeof workChecklistConversionPreviewInputSchema
>;

export const convertWorkChecklistItemInputSchema = humanMutationEnvelopeSchema
  .extend({
    itemId: identifierSchema,
    previewId: identifierSchema,
    workId: identifierSchema,
  })
  .strict();

export type ConvertWorkChecklistItemInput = z.input<
  typeof convertWorkChecklistItemInputSchema
>;

export const workCaptureProvenanceSchema = z
  .object({
    attachment: captureAttachmentSchema.nullable(),
    captureId: identifierSchema,
    capturedAt: z.string().datetime({ offset: true }),
    content: z.string().max(100_000),
    fields: captureFieldsSchema,
    link: captureUrlSchema.nullable(),
    origin: captureOriginSchema.nullable(),
    template: captureTemplateSchema.nullable(),
  })
  .strict();

export type WorkCaptureProvenance = z.infer<typeof workCaptureProvenanceSchema>;

const createWorkInputObjectSchema = z
  .object({
    captureProvenance: workCaptureProvenanceSchema.nullable().optional(),
    checklist: workChecklistSchema.optional(),
    description: workDescriptionSchema.optional(),
    originPosition: workOriginPositionSchema.optional(),
    effort: workEffortSchema,
    plannedStartDate: workPlannedStartDateSchema,
    projectId: identifierSchema,
    targetDate: workTargetDateSchema,
    title: workTitleSchema,
    type: workTypeSchema.default(WORK_DEFAULT_TYPE),
  })
  .strict();

export const createWorkInputSchema = createWorkInputObjectSchema;

export const createWorkMutationInputSchema = humanMutationEnvelopeSchema.extend(
  createWorkInputObjectSchema.shape,
);

export const createWorkRpcMutationInputSchema =
  createWorkMutationInputSchema.omit({ originPosition: true });

const workTypeChangePreviewInputObjectSchema = z
  .object({
    type: workTypeSchema,
    workId: identifierSchema,
  })
  .strict();

export const workTypeChangePreviewInputSchema =
  workTypeChangePreviewInputObjectSchema;

export const updateWorkTypeInputSchema = workTypeChangePreviewInputObjectSchema
  .extend({
    ...humanMutationEnvelopeSchema.shape,
    impactPreviewId: identifierSchema.optional(),
  })
  .strict();

export const includeWorkInputSchema = humanMutationEnvelopeSchema
  .extend({
    featureId: identifierSchema,
    workId: identifierSchema,
  })
  .strict();

const workStatusMutationInputObjectSchema = z
  .object({
    status: workStatusSchema,
    workId: identifierSchema,
  })
  .strict();

export const detachIncludedWorkInputSchema = includeWorkInputSchema;

export const recordFeatureHealthInputSchema = humanMutationEnvelopeSchema
  .extend({
    featureId: identifierSchema,
    health: featureHealthSchema,
    reason: z.string().trim().min(1).max(1000),
  })
  .strict();

export const detachFeatureHealthHistoryInputSchema =
  humanMutationEnvelopeSchema.extend({
    featureId: identifierSchema,
  });

export const updateFeaturePrimarySpecInputSchema = humanMutationEnvelopeSchema
  .extend({
    featureId: identifierSchema,
    primarySpecId: identifierSchema.nullable(),
  })
  .strict();

export const updateWorkStatusInputSchema =
  workStatusMutationInputObjectSchema.extend({
    baseRevision: z.number().int().nonnegative().safe(),
    clientIdempotencyKey: identifierSchema,
  });

export const workClosePreviewInputSchema = z
  .object({ workId: identifierSchema })
  .strict();

export const closeWorkInputSchema = z
  .object({
    baseRevision: z.number().int().nonnegative().safe(),
    clientIdempotencyKey: identifierSchema,
    closureCheck: z.literal("Close anyway").optional(),
    closureResult: workClosureResultSchema,
    reason: workClosureReasonSchema.optional(),
    workId: identifierSchema,
  })
  .strict();

export const reopenWorkInputSchema = z
  .object({
    baseRevision: z.number().int().nonnegative().safe(),
    clientIdempotencyKey: identifierSchema,
    confirmed: z.literal(true),
    status: workOpenStatusSchema,
    workId: identifierSchema,
  })
  .strict();

export type CreateWorkInput = z.input<typeof createWorkInputSchema>;
export type ParsedCreateWorkInput = z.output<typeof createWorkInputSchema>;
export type CreateWorkMutationInput = z.input<
  typeof createWorkMutationInputSchema
>;
export type WorkTypeChangePreviewInput = z.input<
  typeof workTypeChangePreviewInputSchema
>;
export type UpdateWorkTypeInput = z.input<typeof updateWorkTypeInputSchema>;

export const bindWorkOriginPositionInputSchema = humanMutationEnvelopeSchema
  .extend({
    originPosition: workOriginPositionSchema,
    workId: identifierSchema,
  })
  .strict();

export type BindWorkOriginPositionInput = z.input<
  typeof bindWorkOriginPositionInputSchema
>;

export const WORK_RECREATE_FIELD_OPTIONS = [
  "title",
  "type",
  "description",
  "checklist",
] as const;

export type WorkRecreateField = (typeof WORK_RECREATE_FIELD_OPTIONS)[number];

export const WORK_RECREATE_RELATION_KIND_OPTIONS = [
  "Related",
  "Origin",
  "Evidence",
  "Contributes to Goal",
  "Blocks",
  "Includes",
  "Contributes to Milestone",
  "Primary spec",
  "Supersedes",
  "Implements",
  "Belongs to Company",
  "Participant",
  "Required for completion",
] as const;

export type WorkRecreateRelationKind =
  (typeof WORK_RECREATE_RELATION_KIND_OPTIONS)[number];

export const workRecreateRelationKindSchema = z.enum(
  WORK_RECREATE_RELATION_KIND_OPTIONS,
);

export const SCOPE_TREE_RELATION_KIND_OPTIONS = [
  "Blocks",
  "Contributes to Milestone",
] as const;

export type ScopeTreeRelationKind =
  (typeof SCOPE_TREE_RELATION_KIND_OPTIONS)[number];

export const scopeTreeRelationKindSchema = z.enum(
  SCOPE_TREE_RELATION_KIND_OPTIONS,
);

export const workRecreateRelationSchema = z
  .object({
    id: identifierSchema,
    kind: workRecreateRelationKindSchema,
    label: z.string().trim().min(1).max(255),
    nonPortableReason: z.string().trim().min(1).max(1000).optional(),
    portable: z.boolean(),
    targetLabel: z.string().trim().min(1).max(1000),
    targetProjectName: z.string().trim().min(1).max(255),
    targetRecordId: identifierSchema,
  })
  .strict();

export type WorkRecreateRelation = z.infer<typeof workRecreateRelationSchema>;

export const workRecreatePreviewInputSchema = z
  .object({
    sourceWorkId: identifierSchema,
    targetProjectId: identifierSchema,
  })
  .strict();

export const recreateWorkInputSchema = workRecreatePreviewInputSchema
  .extend({
    baseRevision: z.literal(0),
    clientIdempotencyKey: identifierSchema,
    previewId: identifierSchema,
    selectedFields: z.array(z.enum(WORK_RECREATE_FIELD_OPTIONS)),
    selectedRelationIds: z.array(identifierSchema),
  })
  .strict();

export type WorkRecreatePreviewInput = z.input<
  typeof workRecreatePreviewInputSchema
>;
export type RecreateWorkInput = z.input<typeof recreateWorkInputSchema>;

export const WORK_MERGE_FIELD_OPTIONS = [
  "title",
  "type",
  "description",
  "checklist",
  "effort",
  "featureHealthHistory",
  "status",
  "targetDate",
  "closureResult",
  "closureReason",
  "archivedAt",
  "captureProvenance",
  "primaryFeatureId",
  "primarySpecId",
] as const;

export type WorkMergeField = (typeof WORK_MERGE_FIELD_OPTIONS)[number];

export const workMergeFieldSchema = z.enum(WORK_MERGE_FIELD_OPTIONS);

export const WORK_MERGE_RESOLUTION_OPTIONS = [
  "surviving",
  "duplicate",
] as const;

export type WorkMergeResolution =
  (typeof WORK_MERGE_RESOLUTION_OPTIONS)[number];

export const workMergeResolutionSchema = z.enum(WORK_MERGE_RESOLUTION_OPTIONS);

export const workMergePreviewInputSchema = z
  .object({
    duplicateWorkId: identifierSchema,
    survivingWorkId: identifierSchema,
  })
  .strict();

export const mergeWorkInputSchema = workMergePreviewInputSchema
  .extend({
    baseRevision: z.number().int().nonnegative().safe(),
    clientIdempotencyKey: identifierSchema,
    duplicateRevision: z.number().int().nonnegative().safe(),
    fieldResolutions: z.partialRecord(
      workMergeFieldSchema,
      workMergeResolutionSchema,
    ),
    previewId: identifierSchema,
  })
  .strict();

export const undoWorkMergeInputSchema = z
  .object({
    baseRevision: z.number().int().nonnegative().safe(),
    clientIdempotencyKey: identifierSchema,
    mergeId: identifierSchema,
    survivingWorkId: identifierSchema,
  })
  .strict();

export const undoWorkStatusInputSchema = z
  .object({
    baseRevision: z.number().int().nonnegative().safe(),
    clientIdempotencyKey: identifierSchema,
    receiptId: identifierSchema,
    workId: identifierSchema,
  })
  .strict();

export const workIdentityInputSchema = z.union([
  z.object({ workId: identifierSchema }).strict(),
  z
    .object({
      key: identifierSchema,
      projectId: identifierSchema,
    })
    .strict(),
]);

export type WorkMergePreviewInput = z.input<typeof workMergePreviewInputSchema>;
export type MergeWorkInput = z.input<typeof mergeWorkInputSchema>;
export type UndoWorkMergeInput = z.input<typeof undoWorkMergeInputSchema>;
export type UndoWorkStatusInput = z.input<typeof undoWorkStatusInputSchema>;
export type WorkIdentityInput = z.input<typeof workIdentityInputSchema>;

export interface WorkRecreateFieldPreview {
  key: WorkRecreateField;
  label: "Title" | "Type" | "Description" | "Checklist";
  selectedByDefault: boolean;
  value: WorkChecklistItem[] | WorkType | string | null;
}

export interface WorkRecreatePreview {
  fields: WorkRecreateFieldPreview[];
  previewId: string;
  relations: WorkRecreateRelation[];
  sourceWork: Pick<WorkProfile, "id" | "key" | "revision" | "title">;
  targetProject: { id: string; name: string };
}

export interface WorkMergeFieldPreview {
  conflict: boolean;
  duplicateValue: unknown;
  key: WorkMergeField;
  label:
    | "Title"
    | "Type"
    | "Description"
    | "Checklist"
    | "Effort"
    | "Status"
    | "Target date"
    | "Closure result"
    | "Closure reason"
    | "Archive"
    | "Capture provenance"
    | "Feature health"
    | "Included in"
    | "Primary spec";
  survivingValue: unknown;
}

export interface WorkMergeRelationSnapshot {
  blockingStatus?: BlockingRelationStatus | null;
  createdAt: string;
  id: string;
  kind: WorkRecreateRelationKind;
  removedByMerge?: boolean;
  sourceWorkId: string;
  targetLabel: string;
  targetProjectId: string;
  targetRecordId: string;
}

export interface WorkMergeRelationPreview extends WorkMergeRelationSnapshot {
  action: "Rewrite source" | "Rewrite target" | "Remove self relation";
}

export interface WorkMergeInclusionSnapshot {
  childWorkId: string;
  childWorkKey: string;
  childWorkRevision: number;
  childWorkTitle: string;
  duplicateFeatureId: string;
}

export interface WorkMergeInclusionPreview extends WorkMergeInclusionSnapshot {
  action: "Rewrite Included in";
}

export interface WorkMergePreview {
  duplicateWork: Pick<WorkProfile, "id" | "key" | "revision" | "title">;
  fields: WorkMergeFieldPreview[];
  inclusions: WorkMergeInclusionPreview[];
  previewId: string;
  relations: WorkMergeRelationPreview[];
  survivingWork: Pick<WorkProfile, "id" | "key" | "revision" | "title">;
}

export interface WorkRetiredIdentity {
  id: string;
  key: string;
  kind: "Retired identity";
  origin: { id: string; key: string };
  projectId: string;
  retiredAt: string;
  survivingWork: Pick<WorkProfile, "id" | "key" | "title">;
}

export type WorkIdentityResolution =
  | { kind: "Active"; work: WorkProfile }
  | { identity: WorkRetiredIdentity; kind: "Retired" };

export interface WorkMergeResult {
  mergeId: string;
  receiptId: string;
  retiredIdentity: WorkRetiredIdentity;
  work: WorkProfile;
}

export type IncludeWorkInput = z.input<typeof includeWorkInputSchema>;
export type DetachIncludedWorkInput = z.input<
  typeof detachIncludedWorkInputSchema
>;
export type RecordFeatureHealthInput = z.input<
  typeof recordFeatureHealthInputSchema
>;
export type DetachFeatureHealthHistoryInput = z.input<
  typeof detachFeatureHealthHistoryInputSchema
>;
export type UpdateFeaturePrimarySpecInput = z.input<
  typeof updateFeaturePrimarySpecInputSchema
>;

export const featureHealthUpdateSchema = z
  .object({
    health: featureHealthSchema,
    id: identifierSchema,
    reason: z.string().trim().min(1).max(1000),
    recordedAt: z.string().datetime({ offset: true }),
    recordedByAccountId: identifierSchema,
  })
  .strict();

export type FeatureHealthUpdate = z.infer<typeof featureHealthUpdateSchema>;

export type UpdateWorkStatusInput = z.input<typeof updateWorkStatusInputSchema>;
export type WorkClosePreviewInput = z.input<typeof workClosePreviewInputSchema>;
export type CloseWorkInput = z.input<typeof closeWorkInputSchema>;
export type ReopenWorkInput = z.input<typeof reopenWorkInputSchema>;

export interface WorkClosureContextItem {
  id: string;
  label: string;
}

export interface WorkClosureCheck {
  activeBlockers: WorkClosureContextItem[];
  incompleteChecklistItems: WorkClosureContextItem[];
}

export interface WorkLastingContextCommandPreview {
  generatedText: null;
  target: "Decision" | "Personal Wiki";
}

export interface WorkClosePreview {
  closureCheck: WorkClosureCheck;
  lastingContext: {
    commands: WorkLastingContextCommandPreview[];
    sources: WorkClosureContextItem[];
  } | null;
  workId: string;
}

export interface WorkVisibleUserInitiator {
  kind: "Visible user";
}

export const workArchiveMutationInputSchema = z
  .object({
    baseRevision: z.number().int().nonnegative().safe(),
    clientIdempotencyKey: identifierSchema,
    workId: identifierSchema,
  })
  .strict();

export type WorkArchiveMutationInput = z.input<
  typeof workArchiveMutationInputSchema
>;

export interface WorkListOptions {
  archived?: boolean | "all";
}

export interface WorkProfile {
  archivedAt: string | null;
  captureProvenance: WorkCaptureProvenance | null;
  checklist: WorkChecklistItem[];
  closureReason: string | null;
  closureResult: WorkClosureResult | null;
  createdAt: string;
  description: string | null;
  effort: string | null;
  featureHealthHistory: FeatureHealthUpdate[];
  id: string;
  key: string;
  number: number;
  originPosition?: WorkOriginPosition;
  plannedStartDate?: string | null;
  primaryFeatureId: string | null;
  primarySpecId: string | null;
  projectId: string;
  reappearDate?: string | null;
  recreatedFrom: { id: string; key: string } | null;
  revision: number;
  status: WorkStatus;
  targetDate: string | null;
  title: string;
  type: WorkType;
  updatedAt: string;
}

export interface WorkStatusMutationResult extends WorkProfile {
  receiptId: string | null;
}

export interface WorkChecklistConversionPreview {
  item: Pick<WorkChecklistItem, "id" | "text">;
  newWork: {
    projectId: string;
    status: "Not Started";
    title: string;
    type: "Task";
  };
  originPosition: WorkOriginPosition;
  previewId: string;
  sourceWork: Pick<WorkProfile, "id" | "key" | "revision" | "title">;
  targetProject: { id: string; name: string };
}

export interface WorkChecklistConversionMutation {
  itemId: string;
  newWork: WorkProfile;
  operation: "convert-checklist-item";
  sourceWorkId: string;
  sourceWorkRevision: number;
}

export interface WorkChecklistConversionResult {
  sourceWork: WorkProfile;
  work: WorkProfile;
}

export interface WorkMergeMutation {
  attributedRelationIds: string[];
  attributedValueKeys: WorkMergeField[];
  duplicateWork: WorkProfile;
  duplicateWorkId: string;
  duplicateWorkRevision: number;
  inclusions: WorkMergeInclusionSnapshot[];
  mergeId: string;
  operation: "merge" | "undo";
  relations: WorkMergeRelationSnapshot[];
  retiredRedirectIds: string[];
}

export interface WorkLifecycleMutationValue {
  checklistConversion?: WorkChecklistConversionMutation;
  merge?: WorkMergeMutation;
  recreate?: {
    selectedRelationIds: string[];
    sourceWorkId: string;
    sourceWorkRevision: number;
  };
  work: WorkProfile | null;
}

export type WorkLifecycleMutationContract =
  MutationContract<WorkLifecycleMutationValue>;

export interface WorkLifecycleMutationContracts {
  create: (accountId: string) => WorkLifecycleMutationContract;
  update: (accountId: string) => WorkLifecycleMutationContract;
}

export interface WorkTypeChangePreview {
  currentType: WorkType;
  featureExitBlockers: FeatureExitBlockers | null;
  nextType: WorkType;
  previewId: string;
  requiresImpactPreview: boolean;
  workId: string;
}

export interface FeatureExitBlockers {
  featureHealthUpdateCount: number;
  hasPrimarySpec: boolean;
  includedWorkCount: number;
}

export interface FeatureProgress {
  includedWorkCount: number;
  statusCounts: Record<WorkStatus, number>;
}

export type ScopeTreeWork = Pick<
  WorkProfile,
  "id" | "key" | "status" | "title" | "type"
>;

export interface ScopeTreeReference {
  id: string;
  key: string | null;
  label: string;
  projectId?: string;
}

export interface ScopeTreeNode {
  blockers: ScopeTreeReference[];
  milestones: ScopeTreeReference[];
  work: ScopeTreeWork;
}

export interface ScopeTreeFeatureNode extends ScopeTreeNode {
  includedWork: ScopeTreeNode[];
  progress: FeatureProgress;
}

export interface ScopeTree {
  features: ScopeTreeFeatureNode[];
  project: { id: string; name: string };
}

export interface WorkLifecycleAccess {
  archive: (
    accountId: string,
    input: WorkArchiveMutationInput,
  ) => Promise<WorkProfile>;
  bindOriginPosition: (
    accountId: string,
    input: BindWorkOriginPositionInput,
  ) => Promise<WorkProfile>;
  close: (
    accountId: string,
    input: CloseWorkInput,
    initiator: WorkVisibleUserInitiator,
  ) => Promise<WorkStatusMutationResult>;
  convertChecklistItem: (
    accountId: string,
    input: ConvertWorkChecklistItemInput,
  ) => Promise<WorkChecklistConversionResult>;
  create: (
    accountId: string,
    input: CreateWorkMutationInput,
  ) => Promise<WorkProfile>;
  detachFeatureHealthHistory: (
    accountId: string,
    input: DetachFeatureHealthHistoryInput,
  ) => Promise<WorkProfile>;
  detachIncludedWork: (
    accountId: string,
    input: DetachIncludedWorkInput,
  ) => Promise<WorkProfile>;
  featureProgress: (
    accountId: string,
    featureId: string,
  ) => Promise<FeatureProgress>;
  find: (accountId: string, workId: string) => Promise<WorkProfile | null>;
  includeWork: (
    accountId: string,
    input: IncludeWorkInput,
  ) => Promise<WorkProfile>;
  list: (
    accountId: string,
    projectId: string,
    options?: WorkListOptions,
  ) => Promise<WorkProfile[]>;
  merge: (accountId: string, input: MergeWorkInput) => Promise<WorkMergeResult>;
  previewChecklistConversion: (
    accountId: string,
    input: WorkChecklistConversionPreviewInput,
  ) => Promise<WorkChecklistConversionPreview | null>;
  previewClose: (
    accountId: string,
    input: WorkClosePreviewInput,
  ) => Promise<WorkClosePreview | null>;
  previewMerge: (
    accountId: string,
    input: WorkMergePreviewInput,
  ) => Promise<WorkMergePreview | null>;
  previewRecreate: (
    accountId: string,
    input: WorkRecreatePreviewInput,
  ) => Promise<WorkRecreatePreview | null>;
  previewTypeChange: (
    accountId: string,
    input: WorkTypeChangePreviewInput,
  ) => Promise<WorkTypeChangePreview | null>;
  recordFeatureHealth: (
    accountId: string,
    input: RecordFeatureHealthInput,
  ) => Promise<WorkProfile>;
  recreate: (
    accountId: string,
    input: RecreateWorkInput,
  ) => Promise<WorkProfile>;
  reopen: (
    accountId: string,
    input: ReopenWorkInput,
    initiator: WorkVisibleUserInitiator,
  ) => Promise<WorkStatusMutationResult>;
  replayBindOriginPosition: (
    accountId: string,
    input: BindWorkOriginPositionInput,
  ) => Promise<WorkProfile | null>;
  resolve: (
    accountId: string,
    input: WorkIdentityInput,
  ) => Promise<WorkIdentityResolution | null>;
  scopeTree: (accountId: string, projectId: string) => Promise<ScopeTree>;
  unarchive: (
    accountId: string,
    input: WorkArchiveMutationInput,
  ) => Promise<WorkProfile>;
  undoMerge: (
    accountId: string,
    input: UndoWorkMergeInput,
  ) => Promise<WorkProfile>;
  undoStatus: (
    accountId: string,
    input: UndoWorkStatusInput,
  ) => Promise<WorkProfile>;
  updateChecklist: (
    accountId: string,
    input: UpdateWorkChecklistInput,
  ) => Promise<WorkProfile>;
  updateFeaturePrimarySpec: (
    accountId: string,
    input: UpdateFeaturePrimarySpecInput,
  ) => Promise<WorkProfile>;
  updateReappearDate: (
    accountId: string,
    input: UpdateWorkReappearDateInput,
  ) => Promise<WorkProfile>;
  updateStatus: (
    accountId: string,
    input: UpdateWorkStatusInput,
    initiator: WorkVisibleUserInitiator,
  ) => Promise<WorkStatusMutationResult>;
  updateType: (
    accountId: string,
    input: UpdateWorkTypeInput,
  ) => Promise<WorkProfile>;
}
