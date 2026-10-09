import { z } from "zod";
import type { DecisionSupersessionAccess } from "./decision-supersession";
import { documentEvidenceSelectionSchema } from "./documents";
import { humanMutationEnvelopeSchema } from "./mutation-and-undo";
import type { AssumptionsContext } from "./uncertainty-records";

const identifier = z.string().trim().min(1).max(255);
const text255 = z.string().trim().min(1).max(255);
const optionalText = z.string().trim().max(20_000).nullable();
const longText = z.string().trim().min(1).max(100_000);
const optionalLongText = z.string().trim().max(100_000).nullable();
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

export const RISK_LIFE_OPTIONS = [
  "Open",
  "Mitigating",
  "Occurred",
  "Resolved",
  "Accepted",
] as const;
export const riskLifeSchema = z.enum(RISK_LIFE_OPTIONS);

export const ASSUMPTION_LIFE_OPTIONS = [
  "Open",
  "Confirmed",
  "Refuted",
  "No longer applicable",
] as const;
export const assumptionLifeSchema = z.enum(ASSUMPTION_LIFE_OPTIONS);

export const OPEN_QUESTION_LIFE_OPTIONS = [
  "Open",
  "Answered",
  "No longer applicable",
] as const;
export const openQuestionLifeSchema = z.enum(OPEN_QUESTION_LIFE_OPTIONS);

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
    life: decisionLifeSchema.default("Valid"),
    withdrawnAt: timestamp.nullable().optional(),
    withdrawalRationale: optionalText.optional(),
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

export const riskRecordSchema = z
  .object({
    ...sourceRecordIdentity,
    description: optionalLongText,
    impact: optionalLongText,
    life: riskLifeSchema,
    probability: optionalLongText,
    rationale: optionalLongText,
    response: optionalLongText,
    sourceType: z.literal("Risk"),
    title: text255,
  })
  .strict();

export const assumptionRecordSchema = z
  .object({
    ...sourceRecordIdentity,
    life: assumptionLifeSchema,
    rationale: optionalLongText,
    sourceType: z.literal("Assumption"),
    statement: longText,
    title: text255,
  })
  .strict();

export const openQuestionRecordSchema = z
  .object({
    ...sourceRecordIdentity,
    answer: optionalLongText,
    rationale: optionalLongText.optional().default(null),
    context: optionalLongText,
    life: openQuestionLifeSchema,
    question: longText,
    sourceType: z.literal("Open Question"),
    title: text255,
  })
  .strict();

export const projectSourceRecordSchema = z.discriminatedUnion("sourceType", [
  assumptionRecordSchema,
  decisionRecordSchema,
  milestoneRecordSchema,
  openQuestionRecordSchema,
  projectReleaseRecordSchema,
  productionIncidentRecordSchema,
  riskRecordSchema,
]);
export type ProjectSourceRecord = z.infer<typeof projectSourceRecordSchema>;
export type ProjectSourceType = ProjectSourceRecord["sourceType"];

const createDecisionInputSchema = humanMutationEnvelopeSchema
  .extend({
    decision: z.string().trim().min(1).max(20_000),
    documentEvidence: documentEvidenceSelectionSchema.optional(),
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

const createRiskInputSchema = humanMutationEnvelopeSchema
  .extend({
    description: optionalLongText,
    documentEvidence: documentEvidenceSelectionSchema.optional(),
    id: identifier,
    impact: optionalLongText,
    projectId: identifier,
    probability: optionalLongText,
    response: optionalLongText,
    sourceType: z.literal("Risk"),
    title: text255,
  })
  .strict();

const createAssumptionInputSchema = humanMutationEnvelopeSchema
  .extend({
    documentEvidence: documentEvidenceSelectionSchema.optional(),
    id: identifier,
    projectId: identifier,
    rationale: optionalLongText,
    sourceType: z.literal("Assumption"),
    statement: longText,
    title: text255,
  })
  .strict();

const createOpenQuestionInputSchema = humanMutationEnvelopeSchema
  .extend({
    context: optionalLongText,
    documentEvidence: documentEvidenceSelectionSchema.optional(),
    id: identifier,
    projectId: identifier,
    question: longText,
    sourceType: z.literal("Open Question"),
    title: text255,
  })
  .strict();

const createProjectSourceRecordInputBaseSchema = z.discriminatedUnion(
  "sourceType",
  [
    createDecisionInputSchema,
    createMilestoneInputSchema,
    createRiskInputSchema,
    createAssumptionInputSchema,
    createOpenQuestionInputSchema,
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
        description: optionalLongText,
        impact: optionalLongText,
        probability: optionalLongText,
        projectId: identifier,
        rationale: optionalLongText,
        response: optionalLongText,
        sourceId: identifier,
        sourceType: z.literal("Risk"),
        title: text255,
      })
      .strict(),
    humanMutationEnvelopeSchema
      .extend({
        projectId: identifier,
        rationale: optionalLongText,
        sourceId: identifier,
        sourceType: z.literal("Assumption"),
        statement: longText,
        title: text255,
      })
      .strict(),
    humanMutationEnvelopeSchema
      .extend({
        answer: optionalLongText,
        context: optionalLongText,
        projectId: identifier,
        question: longText,
        sourceId: identifier,
        sourceType: z.literal("Open Question"),
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
    z.discriminatedUnion("life", [
      humanMutationEnvelopeSchema
        .extend({
          projectId: identifier,
          sourceId: identifier,
          sourceType: z.literal("Open Question"),
          life: z.literal("Answered"),
          answer: longText,
          rationale: optionalLongText.optional(),
          documentEvidence: documentEvidenceSelectionSchema.optional(),
        })
        .strict(),
      humanMutationEnvelopeSchema
        .extend({
          projectId: identifier,
          sourceId: identifier,
          sourceType: z.literal("Open Question"),
          life: z.literal("No longer applicable"),
        })
        .strict(),
    ]),
    humanMutationEnvelopeSchema
      .extend({
        projectId: identifier,
        sourceId: identifier,
        sourceType: z.literal("Assumption"),
        life: assumptionLifeSchema,
        rationale: optionalLongText.optional(),
        documentEvidence: documentEvidenceSelectionSchema.optional(),
      })
      .strict()
      .refine(
        (input) =>
          input.life === "Confirmed" ||
          input.life === "Refuted" ||
          (input.rationale === undefined &&
            input.documentEvidence === undefined),
        {
          message: "New evidence or rationale belongs to Confirmed or Refuted.",
        },
      ),
    humanMutationEnvelopeSchema
      .extend({
        life: z.enum(["Valid", "Withdrawn"]),
        rationale: optionalText.optional(),
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
      "Risk",
      "Assumption",
      "Open Question",
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
  listAssumptions?: (
    accountId: string,
    projectId: string,
  ) => Promise<AssumptionsContext | null>;
  listDecisions: (
    accountId: string,
    projectId: string,
  ) => Promise<{
    records: z.infer<typeof decisionRecordSchema>[];
    readOnly: boolean;
  } | null>;
  listOpenQuestions?: (
    accountId: string,
    projectId: string,
  ) => Promise<{
    records: z.infer<typeof openQuestionRecordSchema>[];
    readOnly: boolean;
  } | null>;
  openQuestionContext?: (
    accountId: string,
    sourceId: string,
  ) => Promise<{
    evidence: z.infer<typeof documentEvidenceSelectionSchema>[];
    readOnly: boolean;
  } | null>;
  supersession?: DecisionSupersessionAccess;
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
  readonly sourceId: string;

  constructor(sourceId: string, options?: ErrorOptions) {
    super(
      `Project source record ${sourceId} changed before this write.`,
      options,
    );
    this.name = "ProjectSourceRecordConflictError";
    this.sourceId = sourceId;
  }
}
