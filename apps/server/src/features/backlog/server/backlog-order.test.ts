import { describe, expect, test } from "vitest";

import { isBacklogMember } from "./backlog-membership";
import { applyBacklogOrder, normalizeBacklogOrder } from "./backlog-order";

describe("Backlog prepared membership", () => {
  test("includes open planned and unplanned Work without changing status", () => {
    const works = [
      {
        archivedAt: null,
        id: "work-1",
        plannedStartDate: null,
        status: "Not Started",
        trashedAt: null,
      },
      {
        archivedAt: null,
        id: "work-2",
        plannedStartDate: "2026-10-01",
        status: "In Progress",
        trashedAt: null,
      },
      {
        archivedAt: new Date("2026-01-01T00:00:00.000Z"),
        id: "work-3",
        plannedStartDate: null,
        status: "Blocked",
        trashedAt: null,
      },
      {
        archivedAt: null,
        id: "work-4",
        plannedStartDate: null,
        status: "Closed",
        trashedAt: null,
      },
      {
        archivedAt: null,
        id: "work-5",
        plannedStartDate: null,
        status: "Not Started",
        trashedAt: new Date("2026-01-02T00:00:00.000Z"),
      },
    ] as const;
    const statusesBefore = works.map((work) => work.status);

    expect(works.filter(isBacklogMember).map((work) => work.id)).toEqual([
      "work-1",
      "work-2",
    ]);
    expect(works.map((work) => work.status)).toEqual(statusesBefore);
  });
});

describe("Backlog manual order", () => {
  test("moves only active Work while keeping archived Work in its stored slot", () => {
    expect(
      applyBacklogOrder(
        ["work-1", "work-2", "work-3"],
        ["work-1", "work-2", "work-3"],
        ["work-1", "work-3"],
        ["work-3", "work-1"],
      ),
    ).toEqual(["work-3", "work-2", "work-1"]);
  });

  test("appends new Work to the prior order without creating another rank", () => {
    expect(
      normalizeBacklogOrder(["work-2"], ["work-1", "work-2", "work-3"]),
    ).toEqual(["work-2", "work-1", "work-3"]);
  });

  test("rejects a reorder that omits or repeats active Work", () => {
    expect(() =>
      applyBacklogOrder(
        [],
        ["work-1", "work-2"],
        ["work-1", "work-2"],
        ["work-1"],
      ),
    ).toThrow("Backlog order must include every active Work exactly once.");
    expect(() =>
      applyBacklogOrder(
        [],
        ["work-1", "work-2"],
        ["work-1", "work-2"],
        ["work-1", "work-1"],
      ),
    ).toThrow("Backlog order must include every active Work exactly once.");
  });
});
