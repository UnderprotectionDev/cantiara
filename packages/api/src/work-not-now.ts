import { z } from "zod";

import { humanMutationEnvelopeSchema } from "./mutation-and-undo";

const identifierSchema = z.string().trim().min(1).max(255);

export const WORK_NOT_NOW_GROUND_RECORD_TYPES = [
  "Decision",
  "Feedback",
  "Document",
  "Risk",
  "Source",
] as const;

export const workNotNowGroundRecordTypeSchema = z.enum(
  WORK_NOT_NOW_GROUND_RECORD_TYPES,
);

export const workNotNowGroundSchema = z
  .object({
    key: z.string().nullable(),
    projectId: identifierSchema.nullable(),
    recordId: identifierSchema,
    recordType: workNotNowGroundRecordTypeSchema,
    relationId: identifierSchema,
    title: z.string().trim().min(1).max(500),
  })
  .strict();

export type WorkNotNowGround = z.infer<typeof workNotNowGroundSchema>;

export const workNotNowStatusSchema = z.enum([
  "Active",
  "Reconsidered",
  "Replaced",
]);

export const workNotNowClosedBySchema = z.enum(["Reconsidering", "Replaced"]);

export const workNotNowTrailSchema = z
  .object({
    closedAt: z.iso.datetime().nullable(),
    closedBy: workNotNowClosedBySchema.nullable(),
    closedByAccountId: identifierSchema.nullable(),
    condition: z.string().nullable(),
    createdAt: z.iso.datetime(),
    createdByAccountId: identifierSchema,
    grounds: z.array(workNotNowGroundSchema).max(25),
    id: identifierSchema,
    reason: z.string().trim().min(1).max(500),
    revision: z.number().int().positive().safe(),
    status: workNotNowStatusSchema,
    workId: identifierSchema,
  })
  .strict()
  .refine(
    (trail) =>
      trail.status === "Active"
        ? trail.closedAt === null &&
          trail.closedBy === null &&
          trail.closedByAccountId === null
        : trail.closedAt !== null &&
          trail.closedBy !== null &&
          trail.closedByAccountId !== null,
    { message: "Trail status and closing details must agree." },
  );

export type WorkNotNowTrail = z.infer<typeof workNotNowTrailSchema>;

export const workNotNowSummarySchema = z
  .object({
    activeTrail: workNotNowTrailSchema.nullable(),
    revision: z.number().int().nonnegative().safe(),
  })
  .strict();

export type WorkNotNowSummary = z.infer<typeof workNotNowSummarySchema>;

const reasonSchema = z
  .string()
  .trim()
  .min(1, "A reason is required.")
  .max(500, "Reason must be 500 characters or fewer.");

const conditionSchema = z
  .string()
  .trim()
  .max(2000, "Re-evaluation condition must be 2,000 characters or fewer.")
  .transform((value) => (value.length > 0 ? value : null))
  .nullable();

const groundRelationIdsSchema = z
  .array(identifierSchema)
  .max(25)
  .superRefine((relationIds, context) => {
    if (new Set(relationIds).size !== relationIds.length) {
      context.addIssue({
        code: "custom",
        message: "A supporting relationship can be selected only once.",
      });
    }
  });

export const recordWorkNotNowInputSchema = humanMutationEnvelopeSchema
  .extend({
    condition: conditionSchema,
    groundRelationIds: groundRelationIdsSchema,
    reason: reasonSchema,
    workId: identifierSchema,
  })
  .strict();

export type RecordWorkNotNowInput = z.input<typeof recordWorkNotNowInputSchema>;

export const reconsiderWorkNotNowInputSchema = humanMutationEnvelopeSchema
  .extend({
    trailId: identifierSchema,
    workId: identifierSchema,
  })
  .strict();

export type ReconsiderWorkNotNowInput = z.input<
  typeof reconsiderWorkNotNowInputSchema
>;

export const workNotNowHistoryInputSchema = z
  .object({ workId: identifierSchema })
  .strict();

export interface WorkNotNowAccess {
  history: (
    accountId: string,
    workId: string,
  ) => Promise<WorkNotNowTrail[] | null>;
  reconsider: (
    accountId: string,
    input: ReconsiderWorkNotNowInput,
  ) => Promise<WorkNotNowTrail | null>;
  record: (
    accountId: string,
    input: RecordWorkNotNowInput,
  ) => Promise<WorkNotNowTrail | null>;
}
