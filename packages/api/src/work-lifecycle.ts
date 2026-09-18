import { z } from "zod";

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

const createWorkInputObjectSchema = z
  .object({
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

export type CreateWorkInput = z.input<typeof createWorkInputSchema>;
export type ParsedCreateWorkInput = z.output<typeof createWorkInputSchema>;
export type CreateWorkMutationInput = z.input<
  typeof createWorkMutationInputSchema
>;

export interface WorkProfile {
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
}

export interface WorkLifecycleAccess {
  create: (
    accountId: string,
    input: CreateWorkMutationInput,
  ) => Promise<WorkProfile>;
  find: (accountId: string, workId: string) => Promise<WorkProfile | null>;
  list: (accountId: string, projectId: string) => Promise<WorkProfile[]>;
}
