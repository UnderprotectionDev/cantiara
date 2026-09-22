import { z } from "zod";

import type { MutationContract } from "./mutation-and-undo";
import { humanMutationEnvelopeSchema } from "./mutation-and-undo";

const identifierSchema = z.string().trim().min(1).max(255);

export const PRIORITY_METRIC_RANKS = [
  "Very low",
  "Low",
  "Medium",
  "High",
  "Very high",
] as const;

export type PriorityMetricRank = (typeof PRIORITY_METRIC_RANKS)[number];

export const priorityMetricRankSchema = z.enum(PRIORITY_METRIC_RANKS);

const rankDescriptionSchema = z.string().trim().max(500);

export const priorityMetricRankDescriptionsSchema = z
  .object({
    High: rankDescriptionSchema,
    Low: rankDescriptionSchema,
    Medium: rankDescriptionSchema,
    "Very high": rankDescriptionSchema,
    "Very low": rankDescriptionSchema,
  })
  .strict();

export type PriorityMetricRankDescriptions = z.infer<
  typeof priorityMetricRankDescriptionsSchema
>;

export const priorityMetricNameSchema = z
  .string()
  .trim()
  .min(1, "Priority metric name is required.")
  .max(200, "Priority metric name must be 200 characters or fewer.");

export const priorityMetricShortDescriptionSchema = z
  .string()
  .trim()
  .min(1, "Short description is required.")
  .max(500, "Short description must be 500 characters or fewer.");

export function priorityMetricNameKey(name: string) {
  return name.trim().toLocaleLowerCase("en-US");
}

const createPriorityMetricFieldsSchema = z
  .object({
    name: priorityMetricNameSchema,
    projectId: identifierSchema,
    rankDescriptions: priorityMetricRankDescriptionsSchema,
    shortDescription: priorityMetricShortDescriptionSchema,
  })
  .strict();

export const createPriorityMetricInputSchema = createPriorityMetricFieldsSchema;

export const createPriorityMetricMutationInputSchema =
  humanMutationEnvelopeSchema.extend(createPriorityMetricFieldsSchema.shape);

export type CreatePriorityMetricInput = z.input<
  typeof createPriorityMetricInputSchema
>;
export type ParsedCreatePriorityMetricInput = z.output<
  typeof createPriorityMetricInputSchema
>;

export const priorityMetricSchema = z
  .object({
    createdAt: z.string().datetime(),
    enabled: z.boolean(),
    id: identifierSchema,
    name: priorityMetricNameSchema,
    projectId: identifierSchema,
    rankDescriptions: priorityMetricRankDescriptionsSchema,
    revision: z.number().int().nonnegative(),
    shortDescription: priorityMetricShortDescriptionSchema,
    trashedAt: z.string().datetime().nullable(),
    updatedAt: z.string().datetime(),
  })
  .strict();

export type PriorityMetric = z.infer<typeof priorityMetricSchema>;

export const updatePriorityMetricInputSchema = z
  .object({
    enabled: z.boolean(),
    name: priorityMetricNameSchema,
    rankDescriptions: priorityMetricRankDescriptionsSchema,
    shortDescription: priorityMetricShortDescriptionSchema,
  })
  .strict();

export const updatePriorityMetricMutationInputSchema =
  humanMutationEnvelopeSchema
    .extend({
      metricId: identifierSchema,
      ...updatePriorityMetricInputSchema.shape,
    })
    .strict();

export type UpdatePriorityMetricInput = z.input<
  typeof updatePriorityMetricInputSchema
>;

export const priorityMetricRevisionInputSchema = z
  .object({
    metricId: identifierSchema,
  })
  .strict();

export const priorityMetricRevisionMutationInputSchema =
  humanMutationEnvelopeSchema.extend(priorityMetricRevisionInputSchema.shape);

export const trashPriorityMetricInputSchema = priorityMetricRevisionInputSchema;

export const trashPriorityMetricMutationInputSchema =
  priorityMetricRevisionMutationInputSchema;

export const priorityMetricValueSchema = z
  .object({
    createdAt: z.string().datetime(),
    id: identifierSchema,
    metricId: identifierSchema,
    projectId: identifierSchema,
    rank: priorityMetricRankSchema,
    revision: z.number().int().nonnegative(),
    updatedAt: z.string().datetime(),
    workId: identifierSchema,
  })
  .strict();

export type PriorityMetricValue = z.infer<typeof priorityMetricValueSchema>;

export const priorityMetricValueListItemSchema = z
  .object({
    definition: priorityMetricSchema,
    value: priorityMetricValueSchema.nullable(),
  })
  .strict();

export type PriorityMetricValueListItem = z.infer<
  typeof priorityMetricValueListItemSchema
>;

export const priorityMetricProjectValuesInputSchema = z
  .object({ projectId: identifierSchema })
  .strict();

export const priorityMetricValuesInputSchema = z
  .object({ workId: identifierSchema })
  .strict();

export const setPriorityMetricValueInputSchema = z
  .object({
    metricId: identifierSchema,
    rank: priorityMetricRankSchema,
    projectId: identifierSchema,
    workId: identifierSchema,
  })
  .strict();

export const setPriorityMetricValueMutationInputSchema =
  humanMutationEnvelopeSchema.extend(setPriorityMetricValueInputSchema.shape);

export type SetPriorityMetricValueInput = z.input<
  typeof setPriorityMetricValueInputSchema
>;

export const clearPriorityMetricValueInputSchema = z
  .object({
    metricId: identifierSchema,
    projectId: identifierSchema,
    workId: identifierSchema,
  })
  .strict();

export const clearPriorityMetricValueMutationInputSchema =
  humanMutationEnvelopeSchema.extend(clearPriorityMetricValueInputSchema.shape);

export interface PriorityMetricProjectValues {
  definitions: PriorityMetric[];
  values: PriorityMetricValue[];
}

export interface PriorityMetricStore {
  findWorkspaceId: (accountId: string) => Promise<string | null>;
  list: (
    workspaceId: string,
    projectId: string,
  ) => Promise<PriorityMetric[] | null>;
  projectValues: (
    workspaceId: string,
    projectId: string,
  ) => Promise<PriorityMetricProjectValues | null>;
  values: (
    workspaceId: string,
    workId: string,
  ) => Promise<PriorityMetricValueListItem[] | null>;
}

export interface PriorityMetricsAccess {
  list: (
    accountId: string,
    projectId: string,
  ) => Promise<PriorityMetric[] | null>;
  projectValues: (
    accountId: string,
    projectId: string,
  ) => Promise<PriorityMetricProjectValues | null>;
  values: (
    accountId: string,
    workId: string,
  ) => Promise<PriorityMetricValueListItem[] | null>;
}

export interface PriorityMetricMutationValue {
  metric: PriorityMetric | null;
}

export interface PriorityMetricValueMutationValue {
  value: PriorityMetricValue | null;
}

export interface PriorityMetricMutationContracts {
  clearValue: (
    accountId: string,
  ) => MutationContract<PriorityMetricValueMutationValue>;
  create: (accountId: string) => MutationContract<PriorityMetricMutationValue>;
  setValue: (
    accountId: string,
  ) => MutationContract<PriorityMetricValueMutationValue>;
  trash: (accountId: string) => MutationContract<PriorityMetricMutationValue>;
  update: (accountId: string) => MutationContract<PriorityMetricMutationValue>;
}

export const EVIDENCE_STRENGTH_TEMPLATE = {
  enabled: false,
  name: "Evidence strength",
  rankDescriptions: {
    High: "",
    Low: "",
    Medium: "",
    "Very high": "",
    "Very low": "",
  },
  shortDescription: "How strongly available evidence supports this Work.",
} satisfies Omit<ParsedCreatePriorityMetricInput, "projectId"> & {
  enabled: boolean;
};

const PRIORITY_METRIC_STARTER_CONFIGURATIONS = [
  "Mobile Application",
  "Open Source Library",
  "Solo SaaS",
] as const;

export function getStarterPriorityMetricTemplate(starterConfiguration: string) {
  if (
    !PRIORITY_METRIC_STARTER_CONFIGURATIONS.includes(
      starterConfiguration as (typeof PRIORITY_METRIC_STARTER_CONFIGURATIONS)[number],
    )
  ) {
    return null;
  }
  return {
    ...EVIDENCE_STRENGTH_TEMPLATE,
    rankDescriptions: { ...EVIDENCE_STRENGTH_TEMPLATE.rankDescriptions },
  };
}
