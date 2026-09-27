import { describe, expect, test } from "vitest";
import { buildDailyFocusCandidates } from "./daily-focus";

const focusDate = "2026-09-27";

function work(
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

describe("Daily Focus candidates", () => {
  test("explains date reasons, includes the seven-day boundary, and shows at most five open Work items", () => {
    const candidates = buildDailyFocusCandidates(
      [
        work("today-target", { targetDate: focusDate }),
        work("boundary-target", { targetDate: "2026-10-04" }),
        work("today-reappear", { reappearDate: focusDate }),
        work("past-reappear", { reappearDate: "2026-09-20" }),
        work("both-dates", {
          reappearDate: "2026-09-26",
          targetDate: "2026-10-01",
        }),
        work("sixth-candidate", { reappearDate: "2026-09-25" }),
        work("outside-target", { targetDate: "2026-10-05" }),
        work("future-reappear", { reappearDate: "2026-09-28" }),
        work("closed-target", {
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
