import { describe, expect, test } from "vitest";
import {
  buildDailyFocusCandidates,
  type DailyFocusCloseState,
  type DailyFocusStatusChange,
  type DailyFocusWork,
  deriveDailyFocusClose,
} from "./daily-focus";

const focusDate = "2026-09-27";

function candidateWork(
  id: string,
  {
    reappearDate = null,
    status = "Not Started",
    targetDate = null,
  }: {
    reappearDate?: string | null;
    status?: string;
    targetDate?: string | null;
  } = {},
) {
  return {
    id,
    key: `ALPHA-${id}`,
    projectId: "project-alpha",
    projectName: "Alpha",
    reappearDate,
    status,
    targetDate,
    title: `Work ${id}`,
  };
}

function closeWork(
  id: string,
  status: string,
): DailyFocusWork & { reappearDate: string | null } {
  return {
    id,
    key: `${id}-1`,
    projectId: "project-1",
    projectName: "Cantiara",
    reappearDate: null,
    status,
    title: id,
  };
}

function state(
  workId: string,
  values: Partial<Omit<DailyFocusCloseState, "workId">>,
): DailyFocusCloseState {
  return {
    closureResult: null,
    reappearDate: null,
    status: "In Progress",
    workId,
    ...values,
  };
}

describe("Daily Focus candidates", () => {
  test("explains date reasons, includes the seven-day boundary, and shows at most five open Work items", () => {
    const candidates = buildDailyFocusCandidates(
      [
        candidateWork("today-target", { targetDate: focusDate }),
        candidateWork("boundary-target", { targetDate: "2026-10-04" }),
        candidateWork("today-reappear", { reappearDate: focusDate }),
        candidateWork("past-reappear", { reappearDate: "2026-09-20" }),
        candidateWork("both-dates", {
          reappearDate: "2026-09-26",
          targetDate: "2026-10-01",
        }),
        candidateWork("sixth-candidate", { reappearDate: "2026-09-25" }),
        candidateWork("outside-target", { targetDate: "2026-10-05" }),
        candidateWork("future-reappear", { reappearDate: "2026-09-28" }),
        candidateWork("closed-target", {
          status: "Closed",
          targetDate: "2026-10-01",
        }),
      ],
      focusDate,
    );

    expect(candidates.map(({ id, reasons }) => ({ id, reasons }))).toEqual([
      {
        id: "today-target",
        reasons: [{ date: focusDate, label: "Target date is near" }],
      },
      {
        id: "boundary-target",
        reasons: [{ date: "2026-10-04", label: "Target date is near" }],
      },
      {
        id: "today-reappear",
        reasons: [{ date: focusDate, label: "Reappear date has arrived" }],
      },
      {
        id: "past-reappear",
        reasons: [{ date: "2026-09-20", label: "Reappear date has arrived" }],
      },
      {
        id: "both-dates",
        reasons: [
          { date: "2026-10-01", label: "Target date is near" },
          { date: "2026-09-26", label: "Reappear date has arrived" },
        ],
      },
    ]);
  });
});

describe("Daily Focus close view", () => {
  test("groups selected-day closure events and end-of-day Work without changing its inputs", () => {
    const members = [
      closeWork("completed", "Closed"),
      closeWork("abandoned", "Closed"),
      closeWork("deferred", "Not Started"),
      closeWork("still-open", "In Progress"),
      closeWork("closed-before-day", "Closed"),
    ];
    const endOfDayStates = [
      state("completed", { closureResult: "Completed", status: "Closed" }),
      state("abandoned", { closureResult: "Abandoned", status: "Closed" }),
      state("deferred", {
        reappearDate: "2026-09-29",
        status: "Not Started",
      }),
      state("still-open", { status: "In Progress" }),
      state("closed-before-day", {
        closureResult: "Completed",
        status: "Closed",
      }),
    ];
    const statusChanges: DailyFocusStatusChange[] = [
      { closureResult: "Completed", status: "Closed", workId: "completed" },
      { closureResult: "Abandoned", status: "Closed", workId: "abandoned" },
      { closureResult: null, status: "Not Started", workId: "deferred" },
    ];
    const originalMembers = structuredClone(members);

    const close = deriveDailyFocusClose({
      endOfDayStates,
      focusDate,
      members,
      statusChanges,
    });

    expect(close.completed.map(({ id }) => id)).toEqual(["completed"]);
    expect(close.abandoned.map(({ id }) => id)).toEqual(["abandoned"]);
    expect(close.deferred.map(({ id }) => id)).toEqual(["deferred"]);
    expect(close.stillOpen.map(({ id }) => id)).toEqual(["still-open"]);
    expect(members).toEqual(originalMembers);
  });
});
