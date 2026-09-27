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

export const dailyFocusDaySchema = z
  .object({
    available: z.array(dailyFocusWorkSchema),
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
