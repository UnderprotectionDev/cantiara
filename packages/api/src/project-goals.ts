import { z } from "zod";
import {
  isAllowedRelationEndpoints,
  relationRecordTypeSchema,
} from "./relations";

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
  membership?: ProjectGoalMembershipAccess;
  update: (
    accountId: string,
    input: UpdateProjectGoalInput,
  ) => Promise<ProjectGoalRecord | null>;
}

export const projectGoalRelationInputSchema = z
  .object({
    projectId: id,
    goalId: id,
    memberId: id,
    memberType: relationRecordTypeSchema,
    kind: z.enum(["Contributes to Goal", "Related"]),
    attached: z.boolean(),
    baseRevision: z.number().int().min(0),
    clientIdempotencyKey: id,
  })
  .strict()
  .refine(
    (input) =>
      isAllowedRelationEndpoints(input.kind, input.memberType, "Project Goal"),
    { message: "This record cannot contribute to a Project Goal." },
  );
export type ProjectGoalRelationInput = z.infer<
  typeof projectGoalRelationInputSchema
>;
export interface ProjectGoalSource {
  openPath: string | null;
  recordId: string;
  recordType: z.infer<typeof relationRecordTypeSchema>;
  status: string | null;
  title: string | null;
  unavailable: boolean;
  workType: string | null;
}
export interface ProjectGoalRelation {
  attached: boolean;
  id: string;
  kind: "Contributes to Goal" | "Related";
  revision: number;
  source: ProjectGoalSource;
}
export interface ProjectGoalDetail {
  candidates: ProjectGoalSource[];
  openQuestionsAndRisks: ProjectGoalSource[];
  readOnly: boolean;
  relations: ProjectGoalRelation[];
  statusMix: {
    recordType: "Research" | "Feature" | "Milestone";
    status: string;
    count: number;
  }[];
}
export interface ProjectGoalMembershipAccess {
  detail: (
    accountId: string,
    input: { projectId: string; id: string },
  ) => Promise<ProjectGoalDetail | null>;
  setRelation: (
    accountId: string,
    input: ProjectGoalRelationInput,
  ) => Promise<ProjectGoalRelation | null>;
}
