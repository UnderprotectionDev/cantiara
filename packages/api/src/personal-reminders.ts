import { z } from "zod";

const identifierSchema = z.string().trim().min(1).max(255);

export const PERSONAL_REMINDER_SOURCE_TYPES = [
  "Project",
  "Document",
  "Work",
  "Decision",
  "Risk",
  "Milestone",
  "Project Release",
  "Production Incident",
] as const;

export const PERSONAL_REMINDER_CONDITIONAL_SOURCE_TYPES = [
  "Project",
  "Work",
  "Risk",
  "Milestone",
  "Production Incident",
] as const satisfies readonly PersonalReminderSourceType[];

export const PERSONAL_REMINDER_ACTIONS = ["Remind me", "Review Later"] as const;

export const PERSONAL_REMINDER_CONDITIONS = [
  "In any case",
  "Only if still open",
] as const;

export const personalReminderSourceTypeSchema = z.enum(
  PERSONAL_REMINDER_SOURCE_TYPES,
);
export type PersonalReminderSourceType = z.infer<
  typeof personalReminderSourceTypeSchema
>;

export const personalReminderConditionalSourceTypeSchema = z.enum(
  PERSONAL_REMINDER_CONDITIONAL_SOURCE_TYPES,
);

export const personalReminderActionSchema = z.enum(PERSONAL_REMINDER_ACTIONS);
export type PersonalReminderAction = z.infer<
  typeof personalReminderActionSchema
>;

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

export const personalRemindersInputSchema = z
  .object({
    sourceRecordId: identifierSchema,
    sourceRecordType: personalReminderSourceTypeSchema,
  })
  .strict();

export const createPersonalReminderInputSchema = z
  .object({
    action: personalReminderActionSchema,
    clientIdempotencyKey: identifierSchema,
    condition: personalReminderConditionSchema.default("In any case"),
    fireAt: z.iso.datetime({ offset: true }),
    sectionId: identifierSchema.optional(),
    sourceRecordId: identifierSchema,
    sourceRecordType: personalReminderSourceTypeSchema,
  })
  .strict()
  .refine(
    (input) =>
      input.action === "Review Later" || input.condition === "In any case",
    {
      message: "Only Review Later can be conditional.",
      path: ["condition"],
    },
  )
  .refine(
    (input) =>
      input.condition !== "Only if still open" ||
      personalReminderConditionalSourceTypeSchema.safeParse(
        input.sourceRecordType,
      ).success,
    {
      message: "This source has no open and resolved life condition.",
      path: ["condition"],
    },
  )
  .refine(
    (input) =>
      input.sectionId === undefined ||
      (input.action === "Review Later" &&
        input.sourceRecordType === "Document"),
    {
      message: "Only Review Later on a Document can target a section.",
      path: ["sectionId"],
    },
  );

export type CreatePersonalReminderInput = z.input<
  typeof createPersonalReminderInputSchema
>;

export const cancelPersonalReminderInputSchema = z
  .object({ reminderId: identifierSchema })
  .strict();

export const personalReminderSignalInputSchema = z
  .object({ signalId: identifierSchema })
  .strict();

export const reschedulePersonalReminderSignalInputSchema = z
  .object({
    signalId: identifierSchema,
    fireAt: z.iso.datetime({ offset: true }),
  })
  .strict();

export type ReschedulePersonalReminderSignalInput = z.infer<
  typeof reschedulePersonalReminderSignalInputSchema
>;

export const personalReminderSchema = z
  .object({
    action: personalReminderActionSchema,
    cancelledAt: z.iso.datetime().nullable(),
    condition: personalReminderConditionSchema,
    createdAt: z.iso.datetime(),
    fireAt: z.iso.datetime(),
    fireNote: z.string().nullable(),
    id: identifierSchema,
    sectionId: identifierSchema.nullable().optional(),
    sourceProjectId: identifierSchema.nullable(),
    sourceRecordId: identifierSchema,
    sourceRecordType: personalReminderSourceTypeSchema,
    status: personalReminderStatusSchema,
    triggeredAt: z.iso.datetime().nullable(),
  })
  .strict();

export type PersonalReminder = z.infer<typeof personalReminderSchema>;

export interface PersonalReminderSignal {
  evaluationNote: string | null;
  occurredAt: string;
  signalId: string;
  signalType: "personal-reminder" | "review-later";
  sourcePath: string;
  sourceProjectId: string | null;
  sourceRecordId: string;
  sourceRecordType: PersonalReminderSourceType;
}

export interface PersonalReminderFireResult {
  processedCount: number;
  signals: PersonalReminderSignal[];
}

export interface PersonalReminderSignalHistory extends PersonalReminderSignal {
  dismissedAt: string | null;
}

export interface PersonalRemindersAccess {
  cancel: (
    accountId: string,
    reminderId: string,
    expected?: {
      action?: PersonalReminderAction;
      sourceRecordType?: PersonalReminderSourceType;
    },
  ) => Promise<PersonalReminder | null>;
  create: (
    accountId: string,
    input: CreatePersonalReminderInput,
  ) => Promise<PersonalReminder | null>;
  dismissSignal: (
    accountId: string,
    signalId: string,
  ) => Promise<PersonalReminderSignalHistory | null>;
  list: (
    accountId: string,
    input: z.infer<typeof personalRemindersInputSchema>,
  ) => Promise<PersonalReminder[] | null>;
  listSignals: (accountId: string) => Promise<PersonalReminderSignalHistory[]>;
  rescheduleSignal: (
    accountId: string,
    input: ReschedulePersonalReminderSignalInput,
  ) => Promise<PersonalReminder | null>;
}

// Work Review Later remains a convenience contract for existing Work surfaces.
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

export const cancelWorkReviewLaterInputSchema =
  cancelPersonalReminderInputSchema;

export const workReviewLaterSchema = personalReminderSchema
  .extend({
    action: z.literal("Review Later"),
    sourceRecordType: z.literal("Work"),
  })
  .strict();

export type WorkReviewLater = z.infer<typeof workReviewLaterSchema>;

export type WorkReviewLaterFireResult = PersonalReminderFireResult;
