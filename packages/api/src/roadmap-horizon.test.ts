import { describe, expect, test } from "vitest";

import {
  createMilestoneInputSchema,
  createRoadmapPlacementPreview,
  listUnplannedRoadmapCandidates,
  milestoneSchema,
  milestoneStatusSchema,
  presentRoadmap,
  roadmapViewSchema,
  saveRoadmapViewInputSchema,
  updateMilestoneInputSchema,
  updateMilestoneStatusInputSchema,
  updateWorkHorizonInputSchema,
} from "./roadmap-horizon";
import { updateWorkPlannedDateInputSchema } from "./work-lifecycle";

describe("Roadmap Horizon", () => {
  test("Milestone starts Planned and changes only through explicit Reach or Abandon actions", () => {
    const milestone = {
      description: "A usable first release is available to early users.",
      id: "milestone-1",
      projectId: "project-1",
      revision: 1,
      status: "Planned",
      targetDate: null,
      title: "Private beta",
    };
    expect(milestoneStatusSchema.options).toEqual([
      "Planned",
      "Reached",
      "Abandoned",
    ]);
    expect(milestoneSchema.parse(milestone)).toEqual(milestone);

    const createInput = {
      baseRevision: 0,
      clientIdempotencyKey: "create-milestone-1",
      description: milestone.description,
      id: milestone.id,
      projectId: milestone.projectId,
      targetDate: milestone.targetDate,
      title: milestone.title,
    };
    expect(createMilestoneInputSchema.parse(createInput)).toEqual(createInput);
    expect(
      createMilestoneInputSchema.safeParse({
        ...createInput,
        status: "Reached",
      }).success,
    ).toBe(false);

    const updateInput = {
      baseRevision: 1,
      clientIdempotencyKey: "update-milestone-1",
      description: "Early users can finish the core flow.",
      milestoneId: "milestone-1",
      projectId: "project-1",
      targetDate: "2026-12-01",
      title: "Private beta",
    };
    expect(updateMilestoneInputSchema.parse(updateInput)).toEqual(updateInput);
    expect(
      updateMilestoneInputSchema.safeParse({
        ...updateInput,
        status: "Reached",
      }).success,
    ).toBe(false);

    const action = {
      baseRevision: 1,
      clientIdempotencyKey: "reach-milestone-1",
      milestoneId: "milestone-1",
      projectId: "project-1",
      status: "Reached",
    };
    expect(updateMilestoneStatusInputSchema.parse(action)).toEqual(action);
    for (const status of ["Planned", "Closed", "Canceled"]) {
      expect(
        updateMilestoneStatusInputSchema.safeParse({ ...action, status })
          .success,
      ).toBe(false);
    }
  });

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
      revision: 1,
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

  test("unplanned candidates are the view's matching Work without any plan date or horizon", () => {
    const view = roadmapViewSchema.parse({
      id: "view-1",
      name: "Tasks",
      projectId: "project-1",
      revision: 1,
      types: ["Task"],
      horizons: [],
      groupBy: "Type",
      markBy: "Horizon",
    });
    const works = [
      {
        id: "candidate",
        type: "Task",
        horizon: null,
        plannedStartDate: null,
        targetDate: null,
        originResearchIds: [],
        title: "Candidate",
      },
      {
        id: "planned-start",
        type: "Task",
        horizon: null,
        plannedStartDate: "2026-10-01",
        targetDate: null,
        originResearchIds: [],
        title: "Planned start",
      },
      {
        id: "target",
        type: "Task",
        horizon: null,
        plannedStartDate: null,
        targetDate: "2026-10-02",
        originResearchIds: [],
        title: "Target",
      },
      {
        id: "horizon",
        type: "Task",
        horizon: "Later",
        plannedStartDate: null,
        targetDate: null,
        originResearchIds: [],
        title: "Horizon",
      },
      {
        id: "wrong-type",
        type: "Feature",
        horizon: null,
        plannedStartDate: null,
        targetDate: null,
        originResearchIds: [],
        title: "Wrong type",
      },
    ] as const;

    expect(
      listUnplannedRoadmapCandidates(works, view).map(({ work }) => work.id),
    ).toEqual(["candidate"]);
    expect(
      listUnplannedRoadmapCandidates(works, {
        ...view,
        horizons: ["Next"],
      }),
    ).toEqual([]);
  });

  test("candidate preview names the only value that confirmation will change", () => {
    const work = {
      horizon: null,
      plannedStartDate: null,
      targetDate: null,
    };

    expect(
      createRoadmapPlacementPreview(work, {
        field: "horizon",
        value: "Now",
      }),
    ).toEqual({
      fieldLabel: "Horizon",
      previousValue: "No horizon",
      nextValue: "Now",
    });
    expect(
      createRoadmapPlacementPreview(work, {
        field: "targetDate",
        value: "2026-10-02",
      }),
    ).toEqual({
      fieldLabel: "Target date",
      previousValue: "No date",
      nextValue: "2026-10-02",
    });
  });

  test("planned-date command accepts only one explicit date field", () => {
    const command = {
      baseRevision: 2,
      clientIdempotencyKey: "plan-date-1",
      field: "targetDate",
      value: "2026-10-02",
      workId: "work-1",
    };

    expect(updateWorkPlannedDateInputSchema.parse(command)).toEqual(command);
    expect(
      updateWorkPlannedDateInputSchema.safeParse({
        ...command,
        status: "In Progress",
      }).success,
    ).toBe(false);
    expect(
      updateWorkPlannedDateInputSchema.safeParse({
        ...command,
        field: "horizon",
      }).success,
    ).toBe(false);
    expect(
      updateWorkPlannedDateInputSchema.safeParse({
        ...command,
        value: "October 2",
      }).success,
    ).toBe(false);
  });

  test("saving a named view requires a base revision and idempotency key", () => {
    const input = {
      baseRevision: 0,
      clientIdempotencyKey: "save-view-1",
      groupBy: "Horizon",
      horizons: ["Next"],
      id: "view-1",
      markBy: "Type",
      name: "Delivery",
      projectId: "project-1",
      types: ["Task"],
    };

    expect(saveRoadmapViewInputSchema.parse(input)).toEqual(input);
    expect(
      saveRoadmapViewInputSchema.safeParse({
        ...input,
        baseRevision: undefined,
      }).success,
    ).toBe(false);
    expect(
      saveRoadmapViewInputSchema.safeParse({
        ...input,
        clientIdempotencyKey: undefined,
      }).success,
    ).toBe(false);
  });
});
