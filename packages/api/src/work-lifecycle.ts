import { z } from "zod";

import {
  captureAttachmentSchema,
  captureFieldsSchema,
  captureOriginSchema,
  captureTemplateSchema,
  captureUrlSchema,
} from "./capture-triage";
import type { MutationContract } from "./mutation-and-undo";

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

const identifierSchema = z.string().trim().min(1).max(255);

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

export const workChecklistItemSchema = z
  .object({
    completed: z.boolean(),
    id: identifierSchema,
    text: z.string().trim().min(1).max(1000),
  })
  .strict();

export const workChecklistSchema = z.array(workChecklistItemSchema).max(500);

export type WorkChecklistItem = z.infer<typeof workChecklistItemSchema>;

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
    projectId: identifierSchema,
    title: workTitleSchema,
    type: workTypeSchema.default("Task"),
  })
  .strict();

export const createWorkInputSchema = createWorkInputObjectSchema;

export const createWorkMutationInputSchema = createWorkInputObjectSchema
  .extend({
    baseRevision: z.number().int().nonnegative().safe(),
    clientIdempotencyKey: identifierSchema,
  })
  .strict();

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
    baseRevision: z.number().int().nonnegative().safe(),
    clientIdempotencyKey: identifierSchema,
    impactPreviewId: identifierSchema.optional(),
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

export interface WorkProfile {
  captureProvenance: WorkCaptureProvenance | null;
  checklist: WorkChecklistItem[];
  closureResult: WorkClosureResult | null;
  createdAt: string;
  description: string | null;
  id: string;
  key: string;
  number: number;
  projectId: string;
  recreatedFrom: { id: string; key: string } | null;
  revision: number;
  status: WorkStatus;
  title: string;
  type: WorkType;
  updatedAt: string;
}

export interface WorkLifecycleMutationValue {
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
  nextType: WorkType;
  previewId: string;
  requiresImpactPreview: boolean;
  workId: string;
}

export interface WorkLifecycleAccess {
  create: (
    accountId: string,
    input: CreateWorkMutationInput,
  ) => Promise<WorkProfile>;
  find: (accountId: string, workId: string) => Promise<WorkProfile | null>;
  list: (accountId: string, projectId: string) => Promise<WorkProfile[]>;
  previewRecreate: (
    accountId: string,
    input: WorkRecreatePreviewInput,
  ) => Promise<WorkRecreatePreview | null>;
  previewTypeChange: (
    accountId: string,
    input: WorkTypeChangePreviewInput,
  ) => Promise<WorkTypeChangePreview | null>;
  recreate: (
    accountId: string,
    input: RecreateWorkInput,
  ) => Promise<WorkProfile>;
  updateType: (
    accountId: string,
    input: UpdateWorkTypeInput,
  ) => Promise<WorkProfile>;
}
