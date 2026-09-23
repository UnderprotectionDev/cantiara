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

const copyPriorityMetricDefinitionsFieldsSchema = z
  .object({
    sourceProjectId: identifierSchema,
    targetProjectId: identifierSchema,
  })
  .strict();

export const copyPriorityMetricDefinitionsPayloadSchema =
  copyPriorityMetricDefinitionsFieldsSchema.refine(
    (input) => input.sourceProjectId !== input.targetProjectId,
    {
      message: "Source and target Projects must be different.",
      path: ["targetProjectId"],
    },
  );

export const copyPriorityMetricDefinitionsInputSchema =
  humanMutationEnvelopeSchema
    .extend(copyPriorityMetricDefinitionsFieldsSchema.shape)
    .strict()
    .refine((input) => input.sourceProjectId !== input.targetProjectId, {
      message: "Source and target Projects must be different.",
      path: ["targetProjectId"],
    });

export type CopyPriorityMetricDefinitionsInput = z.input<
  typeof copyPriorityMetricDefinitionsInputSchema
>;

export type ParsedCopyPriorityMetricDefinitionsPayload = z.output<
  typeof copyPriorityMetricDefinitionsPayloadSchema
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

export const restorePriorityMetricInputSchema =
  priorityMetricRevisionInputSchema;

export const restorePriorityMetricMutationInputSchema =
  priorityMetricRevisionMutationInputSchema;

export const deletePriorityMetricInputSchema =
  priorityMetricRevisionInputSchema;

export const deletePriorityMetricMutationInputSchema =
  priorityMetricRevisionMutationInputSchema
    .extend({
      grant: z.string().min(1).max(512),
      projectId: identifierSchema,
      typedProjectName: z.string().trim().min(1).max(200),
    })
    .strict();

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

export const priorityMetricValueRevisionSchema = z
  .object({
    metricId: identifierSchema,
    revision: z.number().int().nonnegative(),
    workId: identifierSchema,
  })
  .strict();

export type PriorityMetricValueRevision = z.infer<
  typeof priorityMetricValueRevisionSchema
>;

export const priorityMetricValueListItemSchema = z
  .object({
    definition: priorityMetricSchema,
    value: priorityMetricValueSchema.nullable(),
    valueRevision: z.number().int().nonnegative(),
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

export const priorityMetricTrashImpactPreviewInputSchema = z
  .object({ metricId: identifierSchema })
  .strict();

export const priorityMetricTrashImpactPreviewSchema = z
  .object({ storedWorkValueCount: z.number().int().nonnegative() })
  .extend({
    attachedExternalSurfaceCount: z.number().int().nonnegative(),
    dependentRuleCount: z.number().int().nonnegative(),
    dependentViewCount: z.number().int().nonnegative(),
  })
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
  valueRevisions: PriorityMetricValueRevision[];
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
  trashImpactPreview: (
    workspaceId: string,
    metricId: string,
  ) => Promise<z.infer<typeof priorityMetricTrashImpactPreviewSchema> | null>;
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
  trashImpactPreview: (
    accountId: string,
    metricId: string,
  ) => Promise<z.infer<typeof priorityMetricTrashImpactPreviewSchema> | null>;
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

export interface PriorityMetricDefinitionsCopyMutationValue {
  definitions: PriorityMetric[];
  sourceProjectId: string;
  targetProjectId: string;
}

export interface PriorityMetricMutationContracts {
  clearValue: (
    accountId: string,
  ) => MutationContract<PriorityMetricValueMutationValue>;
  copyDefinitions: (
    accountId: string,
  ) => MutationContract<PriorityMetricDefinitionsCopyMutationValue>;
  create: (accountId: string) => MutationContract<PriorityMetricMutationValue>;
  delete: (accountId: string) => MutationContract<PriorityMetricMutationValue>;
  restore: (accountId: string) => MutationContract<PriorityMetricMutationValue>;
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
