import { z } from "zod";

import type { MutationContract } from "./mutation-and-undo";
import { humanMutationEnvelopeSchema } from "./mutation-and-undo";

const identifierSchema = z.string().trim().min(1).max(255);

export const prioritizationSessionNameSchema = z
  .string()
  .trim()
  .min(1, "Session name is required.")
  .max(200, "Session name must be 200 characters or fewer.");

const orderedWorkIdsSchema = z
  .array(identifierSchema)
  .superRefine((workIds, context) => {
    if (new Set(workIds).size !== workIds.length) {
      context.addIssue({
        code: "custom",
        message: "A Work can appear only once in a Prioritization session.",
      });
    }
  });

const createPrioritizationSessionFieldsSchema = z
  .object({
    name: prioritizationSessionNameSchema,
    projectId: identifierSchema,
    workIds: orderedWorkIdsSchema,
  })
  .strict();

export const createPrioritizationSessionInputSchema =
  createPrioritizationSessionFieldsSchema;

export const createPrioritizationSessionMutationInputSchema =
  humanMutationEnvelopeSchema
    .extend(createPrioritizationSessionFieldsSchema.shape)
    .strict();

export type CreatePrioritizationSessionInput = z.input<
  typeof createPrioritizationSessionInputSchema
>;

export type ParsedCreatePrioritizationSessionInput = z.output<
  typeof createPrioritizationSessionInputSchema
>;

export const prioritizationSessionsProjectInputSchema = z
  .object({ projectId: identifierSchema })
  .strict();

export const updatePrioritizationSessionOrderInputSchema = z
  .object({
    sessionId: identifierSchema,
    workIds: orderedWorkIdsSchema,
  })
  .strict();

export const updatePrioritizationSessionOrderMutationInputSchema =
  humanMutationEnvelopeSchema
    .extend(updatePrioritizationSessionOrderInputSchema.shape)
    .strict();

export const prioritizationSessionRevisionInputSchema = z
  .object({ sessionId: identifierSchema })
  .strict();

export const prioritizationSessionRevisionMutationInputSchema =
  humanMutationEnvelopeSchema.extend(
    prioritizationSessionRevisionInputSchema.shape,
  );

export const closePrioritizationSessionInputSchema =
  prioritizationSessionRevisionInputSchema;

export const closePrioritizationSessionMutationInputSchema =
  prioritizationSessionRevisionMutationInputSchema;

export const trashPrioritizationSessionInputSchema =
  prioritizationSessionRevisionInputSchema;

export const trashPrioritizationSessionMutationInputSchema =
  prioritizationSessionRevisionMutationInputSchema;

export const restorePrioritizationSessionInputSchema =
  prioritizationSessionRevisionInputSchema;

export const restorePrioritizationSessionMutationInputSchema =
  prioritizationSessionRevisionMutationInputSchema;

export const prioritizationSessionSchema = z
  .object({
    closedAt: z.string().datetime().nullable(),
    createdAt: z.string().datetime(),
    id: identifierSchema,
    name: prioritizationSessionNameSchema,
    projectId: identifierSchema,
    revision: z.number().int().nonnegative(),
    trashedAt: z.string().datetime().nullable(),
    updatedAt: z.string().datetime(),
    workIds: orderedWorkIdsSchema,
  })
  .strict();

export type PrioritizationSession = z.infer<typeof prioritizationSessionSchema>;

export interface PrioritizationSessionMutationValue {
  session: PrioritizationSession | null;
}

export interface PrioritizationSessionStore {
  findWorkspaceId: (accountId: string) => Promise<string | null>;
  list: (
    workspaceId: string,
    projectId: string,
  ) => Promise<PrioritizationSession[] | null>;
}

export interface PrioritizationSessionsAccess {
  list: (
    accountId: string,
    projectId: string,
  ) => Promise<PrioritizationSession[] | null>;
}

export interface PrioritizationSessionMutationContracts {
  close: (
    accountId: string,
  ) => MutationContract<PrioritizationSessionMutationValue>;
  create: (
    accountId: string,
  ) => MutationContract<PrioritizationSessionMutationValue>;
  restore: (
    accountId: string,
  ) => MutationContract<PrioritizationSessionMutationValue>;
  trash: (
    accountId: string,
  ) => MutationContract<PrioritizationSessionMutationValue>;
  updateOrder: (
    accountId: string,
  ) => MutationContract<PrioritizationSessionMutationValue>;
}
