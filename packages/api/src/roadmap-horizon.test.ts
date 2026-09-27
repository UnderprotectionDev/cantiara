import { describe, expect, test } from "vitest";

import {
  presentRoadmap,
  roadmapViewSchema,
  updateWorkHorizonInputSchema,
} from "./roadmap-horizon";

describe("Roadmap Horizon", () => {
  test("placing Work accepts only its optional horizon and cannot carry status, priority, dates, or Backlog order", () => {
    const command = {
      baseRevision: 2,
      clientIdempotencyKey: "place-1",
      horizon: "Now",
      workId: "work-1",
    };
    expect(updateWorkHorizonInputSchema.parse(command)).toEqual(command);
    for (const forbidden of [
      "status",
      "priority",
      "targetDate",
      "workIds",
      "showOnRoadmap",
    ]) {
      expect(
        updateWorkHorizonInputSchema.safeParse({
          ...command,
          [forbidden]: true,
        }).success,
      ).toBe(false);
    }
  });

  test("default product direction presents Research first and origin-linked Feature second without changing Work", () => {
    const works = [
      {
        id: "feature",
        type: "Feature",
        horizon: "Now",
        originResearchIds: ["research"],
        title: "Solution",
      },
      {
        id: "research",
        type: "Research",
        horizon: "Now",
        originResearchIds: [],
        title: "Opportunity",
      },
      {
        id: "task",
        type: "Task",
        horizon: "Next",
        originResearchIds: [],
        title: "Delivery",
      },
    ] as const;
    const before = JSON.stringify(works);
    expect(
      presentRoadmap(works, null).map(({ work, secondary }) => [
        work.id,
        secondary,
      ]),
    ).toEqual([
      ["research", false],
      ["feature", true],
    ]);
    expect(JSON.stringify(works)).toBe(before);
  });

  test("named view filters presentation without a second membership or order", () => {
    const view = roadmapViewSchema.parse({
      id: "view-1",
      name: "Delivery",
      projectId: "project-1",
      types: ["Task"],
      horizons: ["Later"],
      groupBy: "Type",
      markBy: "Horizon",
    });
    const works = [
      {
        id: "one",
        type: "Task",
        horizon: "Later",
        originResearchIds: [],
        title: "One",
      },
      {
        id: "two",
        type: "Task",
        horizon: "Now",
        originResearchIds: [],
        title: "Two",
      },
    ] as const;
    expect(presentRoadmap(works, view).map(({ work }) => work.id)).toEqual([
      "one",
    ]);
    expect(
      roadmapViewSchema.safeParse({ ...view, workIds: ["one"] }).success,
    ).toBe(false);
    expect(
      roadmapViewSchema.safeParse({ ...view, markBy: "Type" }).success,
    ).toBe(false);
  });
});
