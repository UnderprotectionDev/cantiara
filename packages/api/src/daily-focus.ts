import { addDays, format, parseISO } from "date-fns";
import { z } from "zod";

const identifierSchema = z.string().trim().min(1).max(255);

export const dailyFocusDayInputSchema = z
  .object({ focusDate: z.iso.date() })
  .strict();
export const dailyFocusMembershipInputSchema = dailyFocusDayInputSchema
  .extend({ workId: identifierSchema })
  .strict();

export const dailyFocusWorkSchema = z
  .object({
    id: identifierSchema,
    key: identifierSchema,
    projectId: identifierSchema,
    projectName: identifierSchema,
    status: identifierSchema,
    title: identifierSchema,
  })
  .strict();

export type DailyFocusWork = z.infer<typeof dailyFocusWorkSchema>;

const dailyFocusCandidateReasonSchema = z
  .object({
    date: z.iso.date(),
    label: z.enum(["Target date is near", "Reappear date has arrived"]),
  })
  .strict();

export const dailyFocusCandidateSchema = dailyFocusWorkSchema
  .extend({ reasons: z.array(dailyFocusCandidateReasonSchema).min(1).max(2) })
  .strict();

export type DailyFocusCandidate = z.infer<typeof dailyFocusCandidateSchema>;

export type DailyFocusCandidateSource = DailyFocusWork & {
  reappearDate: string | null;
  targetDate: string | null;
};

const dailyFocusCandidateLimit = 5;

function addCalendarDays(date: string, days: number) {
  return format(addDays(parseISO(date), days), "yyyy-MM-dd");
}

export function buildDailyFocusCandidates(
  works: DailyFocusCandidateSource[],
  focusDate: string,
): DailyFocusCandidate[] {
  const lastNearTargetDate = addCalendarDays(focusDate, 7);
  const candidates: DailyFocusCandidate[] = [];

  for (const { reappearDate, targetDate, ...work } of works) {
    if (work.status === "Closed") {
      continue;
    }

    const reasons: DailyFocusCandidate["reasons"] = [];
    if (
      targetDate &&
      targetDate >= focusDate &&
      targetDate <= lastNearTargetDate
    ) {
      reasons.push({ date: targetDate, label: "Target date is near" });
    }
    if (reappearDate && reappearDate <= focusDate) {
      reasons.push({ date: reappearDate, label: "Reappear date has arrived" });
    }

    if (reasons.length > 0) {
      candidates.push({ ...work, reasons });
    }
  }

  return candidates.slice(0, dailyFocusCandidateLimit);
}

export const dailyFocusDaySchema = z
  .object({
    available: z.array(dailyFocusWorkSchema),
    candidates: z.array(dailyFocusCandidateSchema),
    focusDate: z.iso.date(),
    members: z.array(dailyFocusWorkSchema),
  })
  .strict();

export type DailyFocusDay = z.infer<typeof dailyFocusDaySchema>;

const closureResultSchema = z.enum(["Abandoned", "Completed"]);

export const dailyFocusCloseSchema = z
  .object({
    abandoned: z.array(dailyFocusWorkSchema),
    completed: z.array(dailyFocusWorkSchema),
    deferred: z.array(dailyFocusWorkSchema),
    stillOpen: z.array(dailyFocusWorkSchema),
  })
  .strict();

export type DailyFocusClose = z.infer<typeof dailyFocusCloseSchema>;

export const dailyFocusCloseStateSchema = z
  .object({
    closureResult: closureResultSchema.nullable(),
    reappearDate: z.iso.date().nullable(),
    status: identifierSchema,
    workId: identifierSchema,
  })
  .strict();

export type DailyFocusCloseState = z.infer<typeof dailyFocusCloseStateSchema>;

export const dailyFocusStatusChangeSchema = z
  .object({
    closureResult: closureResultSchema.nullable(),
    status: identifierSchema,
    workId: identifierSchema,
  })
  .strict();

export type DailyFocusStatusChange = z.infer<
  typeof dailyFocusStatusChangeSchema
>;

export function deriveDailyFocusClose(input: {
  endOfDayStates: readonly DailyFocusCloseState[];
  focusDate: string;
  members: readonly (DailyFocusWork & { reappearDate: string | null })[];
  statusChanges: readonly DailyFocusStatusChange[];
}): DailyFocusClose {
  const states = new Map(
    input.endOfDayStates.map((state) => [state.workId, state]),
  );
  const changes = new Map(
    input.statusChanges.map((change) => [change.workId, change]),
  );
  const close: DailyFocusClose = {
    abandoned: [],
    completed: [],
    deferred: [],
    stillOpen: [],
  };

  for (const member of input.members) {
    const { reappearDate, ...visibleMember } = member;
    const state =
      states.get(member.id) ??
      dailyFocusCloseStateSchema.parse({
        closureResult: null,
        reappearDate,
        status: member.status,
        workId: member.id,
      });
    const statusChange = changes.get(member.id);
    if (
      state?.status === "Closed" &&
      statusChange?.status === "Closed" &&
      statusChange.closureResult
    ) {
      if (statusChange.closureResult === "Completed") {
        close.completed.push(visibleMember);
      } else {
        close.abandoned.push(visibleMember);
      }
      continue;
    }

    if (state.status === "Closed") {
      continue;
    }
    if (state.reappearDate && state.reappearDate > input.focusDate) {
      close.deferred.push(visibleMember);
    } else {
      close.stillOpen.push(visibleMember);
    }
  }

  return dailyFocusCloseSchema.parse(close);
}

export class DailyFocusWorkUnavailableError extends Error {
  constructor() {
    super("Work is unavailable.");
    this.name = "DailyFocusWorkUnavailableError";
  }
}

export interface DailyFocusAccess {
  add: (accountId: string, focusDate: string, workId: string) => Promise<void>;
  list: (accountId: string, focusDate: string) => Promise<DailyFocusDay>;
  readClose: (accountId: string, focusDate: string) => Promise<DailyFocusClose>;
  remove: (
    accountId: string,
    focusDate: string,
    workId: string,
  ) => Promise<void>;
}
