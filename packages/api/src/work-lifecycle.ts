import { z } from "zod";

import {
  captureAttachmentSchema,
  captureFieldsSchema,
  captureOriginSchema,
  captureTemplateSchema,
  captureUrlSchema,
} from "./capture-triage";
import {
  humanMutationEnvelopeSchema,
  type MutationContract,
} from "./mutation-and-undo";

export const WORK_TYPE_OPTIONS = [
  "Feature",
  "Bug",
  "Task",
  "Research",
  "Improvement",
] as const;

export type WorkType = (typeof WORK_TYPE_OPTIONS)[number];

export const workTypeSchema = z.enum(WORK_TYPE_OPTIONS);

export const WORK_STATUS_OPTIONS = [
  "Not Started",
  "In Progress",
  "Blocked",
  "Closed",
] as const;

export type WorkStatus = (typeof WORK_STATUS_OPTIONS)[number];

export const workStatusSchema = z.enum(WORK_STATUS_OPTIONS);

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

const identifierSchema = z.string().trim().min(1).max(255);

export const workTitleSchema = z
  .string()
  .trim()
  .min(1, "Work title is required.")
  .max(255, "Work title must be 255 characters or fewer.");

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
    projectId: identifierSchema,
    title: workTitleSchema,
    type: workTypeSchema.default("Task"),
  })
  .strict();

export const createWorkInputSchema = createWorkInputObjectSchema;

export const createWorkMutationInputSchema = humanMutationEnvelopeSchema.extend(
  createWorkInputObjectSchema.shape,
);

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

export type CreateWorkInput = z.input<typeof createWorkInputSchema>;
export type ParsedCreateWorkInput = z.output<typeof createWorkInputSchema>;
export type CreateWorkMutationInput = z.input<
  typeof createWorkMutationInputSchema
>;
export type WorkTypeChangePreviewInput = z.input<
  typeof workTypeChangePreviewInputSchema
>;
export type UpdateWorkTypeInput = z.input<typeof updateWorkTypeInputSchema>;
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

export interface WorkProfile {
  captureProvenance: WorkCaptureProvenance | null;
  closureResult: WorkClosureResult | null;
  createdAt: string;
  featureHealthHistory: FeatureHealthUpdate[];
  id: string;
  key: string;
  number: number;
  primaryFeatureId: string | null;
  primarySpecId: string | null;
  projectId: string;
  revision: number;
  status: WorkStatus;
  title: string;
  type: WorkType;
  updatedAt: string;
}

export interface WorkLifecycleMutationValue {
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

export interface WorkLifecycleAccess {
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
  list: (accountId: string, projectId: string) => Promise<WorkProfile[]>;
  previewTypeChange: (
    accountId: string,
    input: WorkTypeChangePreviewInput,
  ) => Promise<WorkTypeChangePreview | null>;
  recordFeatureHealth: (
    accountId: string,
    input: RecordFeatureHealthInput,
  ) => Promise<WorkProfile>;
  updateFeaturePrimarySpec: (
    accountId: string,
    input: UpdateFeaturePrimarySpecInput,
  ) => Promise<WorkProfile>;
  updateType: (
    accountId: string,
    input: UpdateWorkTypeInput,
  ) => Promise<WorkProfile>;
}
