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
    reappearDate: z.iso.date().nullable(),
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
  members: readonly DailyFocusWork[];
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
    const state =
      states.get(member.id) ??
      dailyFocusCloseStateSchema.parse({
        closureResult: null,
        reappearDate: member.reappearDate,
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
        close.completed.push(member);
      } else {
        close.abandoned.push(member);
      }
      continue;
    }

    if (state.status === "Closed") {
      continue;
    }
    if (state.reappearDate && state.reappearDate > input.focusDate) {
      close.deferred.push(member);
    } else {
      close.stillOpen.push(member);
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
