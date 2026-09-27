import { describe, expect, test } from "vitest";
import {
  type DailyFocusCloseState,
  type DailyFocusStatusChange,
  type DailyFocusWork,
  deriveDailyFocusClose,
} from "./daily-focus";

function work(id: string, status: string): DailyFocusWork {
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

describe("Daily Focus close view", () => {
  test("groups selected-day closure events and end-of-day Work without changing its inputs", () => {
    const members = [
      work("completed", "Closed"),
      work("abandoned", "Closed"),
      work("deferred", "Not Started"),
      work("still-open", "In Progress"),
      work("closed-before-day", "Closed"),
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
      focusDate: "2026-09-27",
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
