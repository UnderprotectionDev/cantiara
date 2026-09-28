import { z } from "zod";

const identifierSchema = z.string().trim().min(1).max(255);

export const PERSONAL_REMINDER_CONDITIONS = [
  "In any case",
  "Only if still open",
] as const;

export const personalReminderConditionSchema = z.enum(
  PERSONAL_REMINDER_CONDITIONS,
);
export type PersonalReminderCondition = z.infer<
  typeof personalReminderConditionSchema
>;

export const personalReminderStatusSchema = z.enum([
  "Planned",
  "Triggered",
  "Cancelled",
]);

export const workReviewLaterInputSchema = z
  .object({ workId: identifierSchema })
  .strict();

export const createWorkReviewLaterInputSchema = z
  .object({
    clientIdempotencyKey: identifierSchema,
    condition: personalReminderConditionSchema.default("In any case"),
    fireAt: z.iso.datetime({ offset: true }),
    workId: identifierSchema,
  })
  .strict();

export type CreateWorkReviewLaterInput = z.input<
  typeof createWorkReviewLaterInputSchema
>;

export const cancelWorkReviewLaterInputSchema = z
  .object({ reminderId: identifierSchema })
  .strict();

export const workReviewLaterSchema = z
  .object({
    action: z.literal("Review Later"),
    cancelledAt: z.iso.datetime().nullable(),
    condition: personalReminderConditionSchema,
    createdAt: z.iso.datetime(),
    fireAt: z.iso.datetime(),
    fireNote: z.string().nullable(),
    id: identifierSchema,
    sourceProjectId: identifierSchema.nullable(),
    sourceRecordId: identifierSchema,
    sourceRecordType: z.literal("Work"),
    status: personalReminderStatusSchema,
    triggeredAt: z.iso.datetime().nullable(),
  })
  .strict();

export type WorkReviewLater = z.infer<typeof workReviewLaterSchema>;

export interface WorkReviewLaterSignal {
  evaluationNote: string | null;
  occurredAt: string;
  signalId: string;
  signalType: "review-later";
  sourcePath: string;
  sourceProjectId: string | null;
  sourceRecordId: string;
  sourceRecordType: "Work";
}

export interface WorkReviewLaterFireResult {
  processedCount: number;
  signals: WorkReviewLaterSignal[];
}

export interface PersonalRemindersAccess {
  cancelWorkReviewLater: (
    accountId: string,
    reminderId: string,
  ) => Promise<WorkReviewLater | null>;
  createWorkReviewLater: (
    accountId: string,
    input: CreateWorkReviewLaterInput,
  ) => Promise<WorkReviewLater | null>;
  listWorkReviewLater: (
    accountId: string,
    workId: string,
  ) => Promise<WorkReviewLater[] | null>;
}
