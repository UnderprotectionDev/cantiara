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

export const workClosureReasonSchema = z
  .string()
  .trim()
  .max(2000, "Reason must be 2,000 characters or fewer.")
  .transform((value) => (value.length > 0 ? value : null))
  .nullable();

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

const workStatusMutationInputObjectSchema = z
  .object({
    status: workStatusSchema,
    workId: identifierSchema,
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
  archived?: boolean;
}

export interface WorkProfile {
  archivedAt: string | null;
  captureProvenance: WorkCaptureProvenance | null;
  closureReason: string | null;
  closureResult: WorkClosureResult | null;
  createdAt: string;
  id: string;
  key: string;
  number: number;
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
  nextType: WorkType;
  previewId: string;
  requiresImpactPreview: boolean;
  workId: string;
}

export interface WorkLifecycleAccess {
  archive: (
    accountId: string,
    input: WorkArchiveMutationInput,
  ) => Promise<WorkProfile>;
  close: (
    accountId: string,
    input: CloseWorkInput,
    initiator: WorkVisibleUserInitiator,
  ) => Promise<WorkProfile>;
  create: (
    accountId: string,
    input: CreateWorkMutationInput,
  ) => Promise<WorkProfile>;
  find: (accountId: string, workId: string) => Promise<WorkProfile | null>;
  list: (
    accountId: string,
    projectId: string,
    options?: WorkListOptions,
  ) => Promise<WorkProfile[]>;
  previewClose: (
    accountId: string,
    input: WorkClosePreviewInput,
  ) => Promise<WorkClosePreview | null>;
  previewTypeChange: (
    accountId: string,
    input: WorkTypeChangePreviewInput,
  ) => Promise<WorkTypeChangePreview | null>;
  reopen: (
    accountId: string,
    input: ReopenWorkInput,
    initiator: WorkVisibleUserInitiator,
  ) => Promise<WorkProfile>;
  unarchive: (
    accountId: string,
    input: WorkArchiveMutationInput,
  ) => Promise<WorkProfile>;
  updateStatus: (
    accountId: string,
    input: UpdateWorkStatusInput,
    initiator: WorkVisibleUserInitiator,
  ) => Promise<WorkProfile>;
  updateType: (
    accountId: string,
    input: UpdateWorkTypeInput,
  ) => Promise<WorkProfile>;
}
