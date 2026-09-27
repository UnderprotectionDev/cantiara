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
  const result = new Date(`${date}T00:00:00.000Z`);
  result.setUTCDate(result.getUTCDate() + days);
  return result.toISOString().slice(0, 10);
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

export class DailyFocusWorkUnavailableError extends Error {
  constructor() {
    super("Work is unavailable.");
    this.name = "DailyFocusWorkUnavailableError";
  }
}

export interface DailyFocusAccess {
  add: (accountId: string, focusDate: string, workId: string) => Promise<void>;
  list: (accountId: string, focusDate: string) => Promise<DailyFocusDay>;
  remove: (
    accountId: string,
    focusDate: string,
    workId: string,
  ) => Promise<void>;
}
