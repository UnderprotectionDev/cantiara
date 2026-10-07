import { z } from "zod";

const id = z.string().trim().min(1).max(255);
const outcome = z
  .string()
  .trim()
  .max(10_000)
  .transform((value) => value || null)
  .nullable()
  .default(null);
export const projectGoalFieldsSchema = z
  .object({
    title: z.string().trim().min(1).max(255),
    description: z.string().trim().min(1).max(10_000),
    intendedOutcome: outcome,
    observedOutcomeLearning: outcome,
  })
  .strict();
export const projectGoalsProjectInputSchema = z
  .object({ projectId: id })
  .strict();
export const projectGoalInputSchema = projectGoalsProjectInputSchema
  .extend({ id })
  .strict();
export const createProjectGoalInputSchema = projectGoalFieldsSchema
  .extend({
    id,
    projectId: id,
    baseRevision: z.literal(0),
    clientIdempotencyKey: id,
  })
  .strict();
export const updateProjectGoalInputSchema = projectGoalFieldsSchema
  .extend({
    id,
    projectId: id,
    baseRevision: z.number().int().min(1),
    clientIdempotencyKey: id,
  })
  .strict();
export const projectGoalRecordSchema = projectGoalFieldsSchema
  .extend({
    id,
    projectId: id,
    revision: z.number().int().min(1),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  })
  .strict();
export type ProjectGoalRecord = z.infer<typeof projectGoalRecordSchema>;
export type CreateProjectGoalInput = z.infer<
  typeof createProjectGoalInputSchema
>;
export type UpdateProjectGoalInput = z.infer<
  typeof updateProjectGoalInputSchema
>;
export class ProjectGoalConflictError extends Error {}
export interface ProjectGoalsAccess {
  create: (
    accountId: string,
    input: CreateProjectGoalInput,
  ) => Promise<ProjectGoalRecord | null>;
  find: (
    accountId: string,
    input: { projectId: string; id: string },
  ) => Promise<ProjectGoalRecord | null>;
  list: (
    accountId: string,
    projectId: string,
  ) => Promise<{ records: ProjectGoalRecord[]; readOnly: boolean } | null>;
  update: (
    accountId: string,
    input: UpdateProjectGoalInput,
  ) => Promise<ProjectGoalRecord | null>;
}
