import { differenceInCalendarDays, parseISO } from "date-fns";
import { z } from "zod";
import type { WorkDependenciesProjection } from "./relations";
import {
  WORK_DEFAULT_TYPE,
  workDescriptionSchema,
  workTitleSchema,
  workTypeSchema,
} from "./work-lifecycle";

const id = z.string().trim().min(1).max(255);

export const createFocusPeriodInputSchema = z
  .object({
    purpose: z.string().trim().min(1).max(1000),
    startDate: z.iso.date(),
    endDate: z.iso.date(),
  })
  .strict()
  .refine(
    ({ startDate, endDate }) => {
      const days =
        differenceInCalendarDays(parseISO(endDate), parseISO(startDate)) + 1;
      return days >= 7 && days <= 56;
    },
    { message: "Focus Period must be 1–8 weeks." },
  );

export type CreateFocusPeriodInput = z.infer<
  typeof createFocusPeriodInputSchema
>;
export const focusPeriodIdInputSchema = z.object({ periodId: id }).strict();
export const focusPeriodMembershipInputSchema = focusPeriodIdInputSchema
  .extend({ workId: id })
  .strict();
export const focusPeriodDecisionInputSchema = focusPeriodIdInputSchema
  .extend({
    workIds: z.array(id).length(1),
    destination: z.enum([
      "Next period",
      "Another period",
      "Backlog",
      "Abandon",
    ]),
    targetPeriodId: id.optional(),
  })
  .strict();
export type FocusPeriodDecisionInput = z.infer<
  typeof focusPeriodDecisionInputSchema
>;
export const focusPeriodLearningSchema = z.enum(["Keep", "Change", "Try next"]);
export type FocusPeriodLearning = z.infer<typeof focusPeriodLearningSchema>;
export const focusPeriodEvaluationInputSchema = focusPeriodIdInputSchema
  .extend({
    evaluation: z
      .object({
        keep: z.string().trim().max(2000),
        change: z.string().trim().max(2000),
        tryNext: z.string().trim().max(2000),
      })
      .strict(),
  })
  .strict();
export type FocusPeriodEvaluationInput = z.infer<
  typeof focusPeriodEvaluationInputSchema
>;
export const focusPeriodFollowUpWorkInputSchema = focusPeriodIdInputSchema
  .extend({
    clientIdempotencyKey: id,
    description: workDescriptionSchema.optional(),
    learning: focusPeriodLearningSchema,
    projectId: id,
    title: workTitleSchema,
    type: workTypeSchema.default(WORK_DEFAULT_TYPE),
  })
  .strict();
export type FocusPeriodFollowUpWorkInput = z.infer<
  typeof focusPeriodFollowUpWorkInputSchema
>;
export type FocusPeriodFollowUpLinkInput = Pick<
  FocusPeriodFollowUpWorkInput,
  "learning" | "periodId"
> & {
  learningText: string;
  workId: string;
};
export interface FocusPeriodLeftoverDecision {
  destination: FocusPeriodDecisionInput["destination"];
  targetPeriodId: string | null;
  workId: string;
}
export const focusPeriodStatusSchema = z.enum([
  "Planned",
  "Active",
  "Closed",
  "Canceled",
]);

export interface FocusPeriodWork {
  id: string;
  key: string;
  projectId: string;
  projectName: string;
  status: string;
  title: string;
}

export interface FocusPeriodSnapshotWork extends FocusPeriodWork {
  closureResult: string | null;
}

export interface FocusPeriodCloseComparison {
  addedLater: FocusPeriodWork[];
  completed: FocusPeriodWork[];
  inStartSnapshot: FocusPeriodWork[];
  removed: FocusPeriodWork[];
  stillOpen: FocusPeriodWork[];
}

export interface FocusPeriodEvaluation {
  change: string | null;
  keep: string | null;
  tryNext: string | null;
}

export interface FocusPeriodFollowUpWork extends FocusPeriodWork {
  learning: FocusPeriodLearning;
  learningText: string;
}

export interface FocusPeriodRecord {
  available: FocusPeriodWork[];
  closeComparison: FocusPeriodCloseComparison | null;
  closedAt: string | null;
  closeSnapshot: FocusPeriodSnapshotWork[] | null;
  dependencies: WorkDependenciesProjection;
  endDate: string;
  evaluation: FocusPeriodEvaluation | null;
  followUpWorks: FocusPeriodFollowUpWork[];
  id: string;
  leftoverDecisions: FocusPeriodLeftoverDecision[];
  members: FocusPeriodWork[];
  purpose: string;
  startDate: string;
  startSnapshot: FocusPeriodSnapshotWork[] | null;
  status: z.infer<typeof focusPeriodStatusSchema>;
}

export class FocusPeriodUnavailableError extends Error {}
export class FocusPeriodConflictError extends Error {}

export const FOCUS_PERIOD_ACTIVE_MEMBERSHIP_CONFLICT_MESSAGE =
  "Work is already in an active Focus Period. Use Move.";
export const FOCUS_PERIOD_OVERLAPPING_MEMBERSHIP_CONFLICT_MESSAGE =
  "Work is already in another Focus Period.";

export interface FocusPeriodAccess {
  add: (accountId: string, periodId: string, workId: string) => Promise<void>;
  cancel: (accountId: string, periodId: string) => Promise<void>;
  close: (accountId: string, periodId: string) => Promise<void>;
  create: (
    accountId: string,
    input: CreateFocusPeriodInput,
  ) => Promise<FocusPeriodRecord>;
  decide: (accountId: string, input: FocusPeriodDecisionInput) => Promise<void>;
  find: (
    accountId: string,
    periodId: string,
  ) => Promise<FocusPeriodRecord | null>;
  linkFollowUpWork: (
    accountId: string,
    input: FocusPeriodFollowUpLinkInput,
  ) => Promise<void>;
  list: (accountId: string) => Promise<FocusPeriodRecord[]>;
  move: (accountId: string, periodId: string, workId: string) => Promise<void>;
  remove: (
    accountId: string,
    periodId: string,
    workId: string,
  ) => Promise<void>;
  saveEvaluation: (
    accountId: string,
    input: FocusPeriodEvaluationInput,
  ) => Promise<void>;
}
