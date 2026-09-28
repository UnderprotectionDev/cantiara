import { z } from "zod";

import { humanMutationEnvelopeSchema } from "./mutation-and-undo";

const identifier = z.string().trim().min(1).max(255);
const text255 = z.string().trim().min(1).max(255);
const optionalText = z.string().trim().max(20_000).nullable();
const revision = z.number().int().nonnegative().safe();
const timestamp = z.iso.datetime({ offset: true });

export const DECISION_LIFE_OPTIONS = [
  "Valid",
  "Superseded",
  "Withdrawn",
] as const;
export const decisionLifeSchema = z.enum(DECISION_LIFE_OPTIONS);

export const MILESTONE_STATUS_OPTIONS = [
  "Planned",
  "Reached",
  "Abandoned",
] as const;
export const milestoneStatusSchema = z.enum(MILESTONE_STATUS_OPTIONS);

export const PROJECT_RELEASE_STATUS_OPTIONS = [
  "Draft",
  "Preparing",
  "Published",
  "Cancelled",
] as const;
export const projectReleaseStatusSchema = z.enum(
  PROJECT_RELEASE_STATUS_OPTIONS,
);

export const PRODUCTION_INCIDENT_STATUS_OPTIONS = [
  "Open",
  "Watching",
  "Resolved",
] as const;
export const productionIncidentStatusSchema = z.enum(
  PRODUCTION_INCIDENT_STATUS_OPTIONS,
);

const sourceRecordIdentity = {
  createdAt: timestamp,
  id: identifier,
  projectId: identifier,
  revision,
  updatedAt: timestamp,
};

export const decisionRecordSchema = z
  .object({
    ...sourceRecordIdentity,
    decision: z.string().trim().min(1).max(20_000),
    life: decisionLifeSchema,
    rationale: optionalText,
    sourceType: z.literal("Decision"),
    title: text255,
  })
  .strict();

export const milestoneRecordSchema = z
  .object({
    ...sourceRecordIdentity,
    description: optionalText,
    sourceType: z.literal("Milestone"),
    status: milestoneStatusSchema,
    targetDate: z.iso.date().nullable(),
    title: text255,
  })
  .strict();

export const projectReleaseRecordSchema = z
  .object({
    ...sourceRecordIdentity,
    description: optionalText,
    name: text255,
    projectId: identifier,
    sourceType: z.literal("Project Release"),
    status: projectReleaseStatusSchema,
    versionLabel: z.string().trim().max(255).nullable(),
  })
  .strict();

export const productionIncidentRecordSchema = z
  .object({
    ...sourceRecordIdentity,
    detectedHow: optionalText,
    impact: optionalText,
    learning: optionalText,
    occurredAt: timestamp,
    resolution: optionalText,
    rootCause: optionalText,
    sourceType: z.literal("Production Incident"),
    status: productionIncidentStatusSchema,
    title: text255,
  })
  .strict();

export const projectSourceRecordSchema = z.discriminatedUnion("sourceType", [
  decisionRecordSchema,
  milestoneRecordSchema,
  projectReleaseRecordSchema,
  productionIncidentRecordSchema,
]);
export type ProjectSourceRecord = z.infer<typeof projectSourceRecordSchema>;
export type ProjectSourceType = ProjectSourceRecord["sourceType"];

const createDecisionInputSchema = humanMutationEnvelopeSchema
  .extend({
    decision: z.string().trim().min(1).max(20_000),
    id: identifier,
    projectId: identifier,
    rationale: optionalText,
    sourceType: z.literal("Decision"),
    title: text255,
  })
  .strict();

const createMilestoneInputSchema = humanMutationEnvelopeSchema
  .extend({
    description: optionalText,
    id: identifier,
    projectId: identifier,
    sourceType: z.literal("Milestone"),
    targetDate: z.iso.date().nullable(),
    title: text255,
  })
  .strict();

const createProjectReleaseInputSchema = humanMutationEnvelopeSchema
  .extend({
    description: optionalText,
    id: identifier,
    name: text255,
    projectId: identifier,
    sourceType: z.literal("Project Release"),
    versionLabel: z.string().trim().max(255).nullable(),
  })
  .strict();

const createProductionIncidentInputSchema = humanMutationEnvelopeSchema
  .extend({
    detectedHow: optionalText,
    id: identifier,
    impact: optionalText,
    learning: optionalText,
    occurredAt: timestamp,
    projectId: identifier,
    resolution: optionalText,
    rootCause: optionalText,
    sourceType: z.literal("Production Incident"),
    title: text255,
  })
  .strict();

const createProjectSourceRecordInputBaseSchema = z.discriminatedUnion(
  "sourceType",
  [
    createDecisionInputSchema,
    createMilestoneInputSchema,
    createProjectReleaseInputSchema,
    createProductionIncidentInputSchema,
  ],
);

export const createProjectSourceRecordInputSchema =
  createProjectSourceRecordInputBaseSchema;

export const updateProjectSourceRecordInputSchema = z.discriminatedUnion(
  "sourceType",
  [
    humanMutationEnvelopeSchema
      .extend({
        decision: z.string().trim().min(1).max(20_000),
        projectId: identifier,
        rationale: optionalText,
        sourceId: identifier,
        sourceType: z.literal("Decision"),
        title: text255,
      })
      .strict(),
    humanMutationEnvelopeSchema
      .extend({
        description: optionalText,
        projectId: identifier,
        sourceId: identifier,
        sourceType: z.literal("Milestone"),
        targetDate: z.iso.date().nullable(),
        title: text255,
      })
      .strict(),
    humanMutationEnvelopeSchema
      .extend({
        description: optionalText,
        name: text255,
        projectId: identifier,
        sourceId: identifier,
        sourceType: z.literal("Project Release"),
        versionLabel: z.string().trim().max(255).nullable(),
      })
      .strict(),
    humanMutationEnvelopeSchema
      .extend({
        detectedHow: optionalText,
        impact: optionalText,
        learning: optionalText,
        occurredAt: timestamp,
        projectId: identifier,
        resolution: optionalText,
        rootCause: optionalText,
        sourceId: identifier,
        sourceType: z.literal("Production Incident"),
        title: text255,
      })
      .strict(),
  ],
);

export const transitionProjectSourceRecordInputSchema = z.discriminatedUnion(
  "sourceType",
  [
    humanMutationEnvelopeSchema
      .extend({
        life: z.enum(["Valid", "Withdrawn"]),
        projectId: identifier,
        sourceId: identifier,
        sourceType: z.literal("Decision"),
      })
      .strict(),
    humanMutationEnvelopeSchema
      .extend({
        projectId: identifier,
        sourceId: identifier,
        sourceType: z.literal("Milestone"),
        status: z.enum(["Reached", "Abandoned"]),
      })
      .strict(),
    humanMutationEnvelopeSchema
      .extend({
        projectId: identifier,
        sourceId: identifier,
        sourceType: z.literal("Project Release"),
        status: projectReleaseStatusSchema,
      })
      .strict(),
    humanMutationEnvelopeSchema
      .extend({
        projectId: identifier,
        sourceId: identifier,
        sourceType: z.literal("Production Incident"),
        status: productionIncidentStatusSchema,
      })
      .strict(),
  ],
);

export const projectSourceRecordInputSchema = z
  .object({
    sourceId: identifier,
    sourceType: z.enum([
      "Decision",
      "Milestone",
      "Project Release",
      "Production Incident",
    ]),
  })
  .strict();

export const projectSourceRecordsProjectInputSchema = z
  .object({ projectId: identifier })
  .strict();

export interface ProjectSourceRecordsAccess {
  create: (
    accountId: string,
    input: z.input<typeof createProjectSourceRecordInputSchema>,
  ) => Promise<ProjectSourceRecord | null>;
  find: (
    accountId: string,
    sourceType: ProjectSourceType,
    sourceId: string,
  ) => Promise<ProjectSourceRecord | null>;
  list: (
    accountId: string,
    projectId: string,
  ) => Promise<ProjectSourceRecord[] | null>;
  transition: (
    accountId: string,
    input: z.input<typeof transitionProjectSourceRecordInputSchema>,
  ) => Promise<ProjectSourceRecord | null>;
  update: (
    accountId: string,
    input: z.input<typeof updateProjectSourceRecordInputSchema>,
  ) => Promise<ProjectSourceRecord | null>;
}

export class ProjectSourceRecordConflictError extends Error {
  readonly code = "CONFLICT" as const;

  constructor(sourceId: string, options?: ErrorOptions) {
    super(
      `Project source record ${sourceId} changed before this write.`,
      options,
    );
    this.name = "ProjectSourceRecordConflictError";
  }
}
