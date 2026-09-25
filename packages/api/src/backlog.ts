import { z } from "zod";

import type { MutationContract } from "./mutation-and-undo";
import { humanMutationEnvelopeSchema } from "./mutation-and-undo";
import { workOpenStatusSchema } from "./work-lifecycle";

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

export const backlogSavedPresentationSchema = z.discriminatedUnion("sort", [
  z
    .object({ sort: z.literal("Priority"), metricId: identifierSchema })
    .strict(),
  z.object({ sort: z.literal("Date") }).strict(),
  z
    .object({ sort: z.literal("Field"), field: z.enum(["Title", "Status"]) })
    .strict(),
]);

export type BacklogSavedPresentation = z.infer<
  typeof backlogSavedPresentationSchema
>;

export const projectBacklogPresentationSchema = z
  .object({
    projectId: identifierSchema,
    revision: z.number().int().nonnegative(),
    saved: backlogSavedPresentationSchema.nullable(),
  })
  .strict();

export type ProjectBacklogPresentation = z.infer<
  typeof projectBacklogPresentationSchema
>;

export const saveBacklogPresentationInputSchema = z
  .object({
    projectId: identifierSchema,
    saved: backlogSavedPresentationSchema,
  })
  .strict();

export const saveBacklogPresentationMutationInputSchema =
  humanMutationEnvelopeSchema
    .extend(saveBacklogPresentationInputSchema.shape)
    .strict();

export const projectBacklogInputSchema = z
  .object({ projectId: identifierSchema })
  .strict();

export const backlogWorkSchema = z
  .object({
    id: identifierSchema,
    key: identifierSchema,
    number: z.number().int().positive(),
    plannedStartDate: z.iso.date().nullable(),
    reappearDate: z.iso.date().nullable(),
    revision: z.number().int().nonnegative(),
    status: workOpenStatusSchema,
    targetDate: z.iso.date().nullable(),
    title: identifierSchema,
  })
  .strict();

export const projectBacklogSchema = z.array(backlogWorkSchema);

export type BacklogWork = z.infer<typeof backlogWorkSchema>;

export function partitionDeferredBacklog<
  T extends { reappearDate: string | null },
>(
  works: readonly T[],
  timeZone: string,
  now = new Date(),
): { current: T[]; deferred: T[] } {
  const today = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone,
    year: "numeric",
  }).formatToParts(now);
  const part = (name: string) =>
    today.find((item) => item.type === name)?.value ?? "";
  const date = `${part("year")}-${part("month")}-${part("day")}`;
  const current: T[] = [];
  const deferred: T[] = [];
  for (const work of works) {
    (work.reappearDate && work.reappearDate > date ? deferred : current).push(
      work,
    );
  }
  return { current, deferred };
}

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
  listPrepared: (
    workspaceId: string,
    projectId: string,
  ) => Promise<BacklogWork[] | null>;
  listPresentation: (
    workspaceId: string,
    projectId: string,
  ) => Promise<ProjectBacklogPresentation | null>;
}

export interface BacklogAccess {
  list: (
    accountId: string,
    projectId: string,
  ) => Promise<ProjectBacklogOrder | null>;
  listPrepared: (
    accountId: string,
    projectId: string,
  ) => Promise<BacklogWork[] | null>;
  listPresentation: (
    accountId: string,
    projectId: string,
  ) => Promise<ProjectBacklogPresentation | null>;
}

export interface BacklogMutationContracts {
  savePresentation: (
    accountId: string,
  ) => MutationContract<ProjectBacklogPresentation>;
  updateOrder: (
    accountId: string,
  ) => MutationContract<BacklogOrderMutationValue>;
}
