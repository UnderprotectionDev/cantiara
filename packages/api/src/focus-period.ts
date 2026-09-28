import { differenceInCalendarDays, parseISO } from "date-fns";
import { z } from "zod";

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

export interface FocusPeriodRecord {
  available: FocusPeriodWork[];
  closedAt: string | null;
  closeSnapshot: FocusPeriodWork[] | null;
  endDate: string;
  id: string;
  members: FocusPeriodWork[];
  purpose: string;
  startDate: string;
  startSnapshot: FocusPeriodWork[] | null;
  status: z.infer<typeof focusPeriodStatusSchema>;
}

export class FocusPeriodUnavailableError extends Error {}
export class FocusPeriodConflictError extends Error {}

export interface FocusPeriodAccess {
  add: (accountId: string, periodId: string, workId: string) => Promise<void>;
  cancel: (accountId: string, periodId: string) => Promise<void>;
  close: (accountId: string, periodId: string) => Promise<void>;
  create: (
    accountId: string,
    input: CreateFocusPeriodInput,
  ) => Promise<FocusPeriodRecord>;
  find: (
    accountId: string,
    periodId: string,
  ) => Promise<FocusPeriodRecord | null>;
  list: (accountId: string) => Promise<FocusPeriodRecord[]>;
  remove: (
    accountId: string,
    periodId: string,
    workId: string,
  ) => Promise<void>;
}
