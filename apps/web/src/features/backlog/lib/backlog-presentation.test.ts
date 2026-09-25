import { partitionDeferredBacklog } from "@cantiara/api/backlog";
import { describe, expect, test, vi } from "vitest";
import { presentBacklog } from "./backlog-presentation";

const works = [
  {
    id: "a",
    title: "Zulu",
    status: "Not Started",
    plannedStartDate: null,
    targetDate: "2026-11-01",
  },
  {
    id: "b",
    title: "Alpha",
    status: "In Progress",
    plannedStartDate: "2026-10-01",
    targetDate: null,
  },
  {
    id: "c",
    title: "Middle",
    status: "Blocked",
    plannedStartDate: null,
    targetDate: null,
  },
] as const;

describe("Backlog presentation", () => {
  test("moves future Reappear date to Deferred and restores its saved position when the date arrives", () => {
    const ordered = [
      { id: "first", reappearDate: null, status: "Not Started" },
      { id: "deferred", reappearDate: "2026-09-26", status: "Blocked" },
      { id: "last", reappearDate: null, status: "In Progress" },
    ];
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date("2026-09-25T12:00:00Z"));
      expect(partitionDeferredBacklog(ordered, "UTC")).toEqual({
        current: [ordered[0], ordered[2]],
        deferred: [ordered[1]],
      });
      vi.setSystemTime(new Date("2026-09-26T00:00:00Z"));
      expect(partitionDeferredBacklog(ordered, "UTC")).toEqual({
        current: ordered,
        deferred: [],
      });
      expect(ordered.map(({ status }) => status)).toEqual([
        "Not Started",
        "Blocked",
        "In Progress",
      ]);
    } finally {
      vi.useRealTimers();
    }
  });

  test("uses the Account time zone to decide when the date arrives", () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date("2026-09-25T22:00:00Z"));
      const ordered = [{ id: "work", reappearDate: "2026-09-26" }];
      expect(
        partitionDeferredBacklog(ordered, "Europe/Istanbul").current,
      ).toEqual(ordered);
      expect(partitionDeferredBacklog(ordered, "UTC").deferred).toEqual(
        ordered,
      );
    } finally {
      vi.useRealTimers();
    }
  });
  test("restores the same manual order after temporary Date and Field sorts", () => {
    expect(presentBacklog(works, "Date").map(({ id }) => id)).toEqual([
      "b",
      "a",
      "c",
    ]);
    expect(presentBacklog(works, "Field").map(({ id }) => id)).toEqual([
      "b",
      "c",
      "a",
    ]);
    expect(presentBacklog(works, "Manual order").map(({ id }) => id)).toEqual([
      "a",
      "b",
      "c",
    ]);
  });

  test("uses a priority criterion without writing the Backlog order", () => {
    const priority = new Map([
      ["b", 4],
      ["a", 1],
    ]);
    expect(
      presentBacklog(works, "Priority", priority).map(({ id }) => id),
    ).toEqual(["b", "a", "c"]);
    expect(works.map(({ id }) => id)).toEqual(["a", "b", "c"]);
  });

  test("lets Field select a named Work field", () => {
    expect(
      presentBacklog(works, "Field", new Map(), "Status").map(({ id }) => id),
    ).toEqual(["c", "b", "a"]);
    expect(works.map(({ id }) => id)).toEqual(["a", "b", "c"]);
  });
});
