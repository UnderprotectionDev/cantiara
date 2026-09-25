import { describe, expect, test } from "vitest";

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
