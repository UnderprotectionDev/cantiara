import type { WorkProfile } from "@cantiara/api/work-lifecycle";
import { describe, expect, test } from "vitest";
import {
  filterReappearingWorks,
  formatTimeInStatus,
  sortKanbanWorks,
} from "./kanban-view";

const work = (overrides: Partial<WorkProfile>): WorkProfile => ({
  archivedAt: null,
  captureProvenance: null,
  checklist: [],
  closureReason: null,
  closureResult: null,
  createdAt: "2026-09-20T09:00:00.000Z",
  description: null,
  effort: null,
  featureHealthHistory: [],
  id: "work-1",
  key: "CAN-1",
  number: 1,
  primaryFeatureId: null,
  primarySpecId: null,
  projectId: "project-1",
  reappearDate: null,
  recreatedFrom: null,
  revision: 1,
  status: "Not Started",
  statusChangedAt: "2026-09-20T09:00:00.000Z",
  targetDate: null,
  title: "Work",
  type: "Task",
  updatedAt: "2026-09-20T09:00:00.000Z",
  ...overrides,
});

describe("Kanban saved Work view", () => {
  test("uses the saved explicit sort, with stable Work number tie-breaking", () => {
    const works = [
      work({ id: "work-2", number: 2, title: "Alpha" }),
      work({ id: "work-3", number: 3, title: "Alpha" }),
      work({ id: "work-1", number: 1, title: "Zulu" }),
    ];

    expect(
      sortKanbanWorks(works, { direction: "ascending", field: "title" }).map(
        (item) => item.id,
      ),
    ).toEqual(["work-2", "work-3", "work-1"]);
    expect(
      sortKanbanWorks(works, {
        direction: "descending",
        field: "title",
      }).map((item) => item.id),
    ).toEqual(["work-1", "work-2", "work-3"]);
  });

  test("backgrounds future reappearing Work until its date", () => {
    const works = [
      work({ id: "work-today", reappearDate: "2026-09-25" }),
      work({ id: "work-future", reappearDate: "2026-09-26" }),
      work({ id: "work-unscheduled", reappearDate: undefined }),
    ];

    expect(
      filterReappearingWorks(works, "2026-09-25").map((item) => item.id),
    ).toEqual(["work-today", "work-unscheduled"]);
  });

  test("formats elapsed time from the current status start", () => {
    expect(
      formatTimeInStatus(
        "2026-09-24T08:00:00.000Z",
        new Date("2026-09-25T10:05:00.000Z").getTime(),
      ),
    ).toBe("1 day, 2 hours");
  });
});
