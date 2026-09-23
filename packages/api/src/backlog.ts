import { z } from "zod";

import type { MutationContract } from "./mutation-and-undo";
import { humanMutationEnvelopeSchema } from "./mutation-and-undo";

const identifierSchema = z.string().trim().min(1).max(255);

const orderedWorkIdsSchema = z
  .array(identifierSchema)
  .superRefine((workIds, context) => {
    if (new Set(workIds).size !== workIds.length) {
      context.addIssue({
        code: "custom",
        message: "A Work can appear only once in the Backlog order.",
      });
    }
  });

export const projectBacklogOrderSchema = z
  .object({
    projectId: identifierSchema,
    revision: z.number().int().nonnegative(),
    workIds: orderedWorkIdsSchema,
  })
  .strict();

export type ProjectBacklogOrder = z.infer<typeof projectBacklogOrderSchema>;

export const projectBacklogInputSchema = z
  .object({ projectId: identifierSchema })
  .strict();

export const updateBacklogOrderInputSchema = z
  .object({
    projectId: identifierSchema,
    workIds: orderedWorkIdsSchema,
  })
  .strict();

export const updateBacklogOrderMutationInputSchema = humanMutationEnvelopeSchema
  .extend(updateBacklogOrderInputSchema.shape)
  .strict();

export type UpdateBacklogOrderInput = z.input<
  typeof updateBacklogOrderInputSchema
>;

export type ParsedUpdateBacklogOrderInput = z.output<
  typeof updateBacklogOrderInputSchema
>;

export interface BacklogOrderMutationValue {
  order: ProjectBacklogOrder | null;
}

export interface BacklogStore {
  findWorkspaceId: (accountId: string) => Promise<string | null>;
  list: (
    workspaceId: string,
    projectId: string,
  ) => Promise<ProjectBacklogOrder | null>;
}

export interface BacklogAccess {
  list: (
    accountId: string,
    projectId: string,
  ) => Promise<ProjectBacklogOrder | null>;
}

export interface BacklogMutationContracts {
  updateOrder: (
    accountId: string,
  ) => MutationContract<BacklogOrderMutationValue>;
}
