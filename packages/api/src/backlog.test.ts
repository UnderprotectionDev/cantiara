import { describe, expect, test } from "vitest";

import {
  backlogSavedPresentationSchema,
  backlogWorkSchema,
  projectBacklogOrderSchema,
  projectBacklogPresentationSchema,
  projectBacklogSchema,
  saveBacklogPresentationMutationInputSchema,
  updateBacklogOrderInputSchema,
  updateBacklogOrderMutationInputSchema,
} from "./backlog";

describe("Backlog order API contract", () => {
  test("stores one explicit Project order without accepting session order", () => {
    expect(
      updateBacklogOrderInputSchema.safeParse({
        projectId: "project-1",
        workIds: ["work-3", "work-1", "work-2"],
      }).success,
    ).toBe(true);
    expect(
      updateBacklogOrderInputSchema.safeParse({
        projectId: "project-1",
        sessionId: "session-1",
        workIds: ["work-1"],
      }).success,
    ).toBe(false);
    expect(
      updateBacklogOrderInputSchema.safeParse({
        projectId: "project-1",
        workIds: ["work-1", "work-1"],
      }).success,
    ).toBe(false);
  });

  test("requires revision and idempotency for an explicit reorder", () => {
    expect(
      updateBacklogOrderMutationInputSchema.safeParse({
        baseRevision: 4,
        clientIdempotencyKey: "backlog-order-1",
        projectId: "project-1",
        workIds: ["work-2", "work-1"],
      }).success,
    ).toBe(true);
    expect(
      updateBacklogOrderMutationInputSchema.safeParse({
        projectId: "project-1",
        workIds: ["work-2", "work-1"],
      }).success,
    ).toBe(false);
  });

  test("returns the Backlog order independently from a session rank", () => {
    expect(
      projectBacklogOrderSchema.parse({
        projectId: "project-1",
        revision: 1,
        workIds: ["work-2", "work-1"],
      }),
    ).toEqual({
      projectId: "project-1",
      revision: 1,
      workIds: ["work-2", "work-1"],
    });
  });

  test("allows the complete Backlog to exceed 2,000 Works", () => {
    const workIds = Array.from({ length: 2001 }, (_, index) => `work-${index}`);

    expect(
      projectBacklogOrderSchema.safeParse({
        projectId: "project-1",
        revision: 1,
        workIds,
      }).success,
    ).toBe(true);
  });
});

describe("Backlog saved presentation API contract", () => {
  test("saves one alternative presentation without carrying manual Work IDs", () => {
    const saved = { sort: "Field", field: "Title" };
    expect(backlogSavedPresentationSchema.parse(saved)).toEqual(saved);
    expect(
      projectBacklogPresentationSchema.parse({
        projectId: "project-1",
        revision: 1,
        saved,
      }),
    ).toEqual({ projectId: "project-1", revision: 1, saved });
    expect(
      saveBacklogPresentationMutationInputSchema.safeParse({
        baseRevision: 0,
        clientIdempotencyKey: "save-presentation-1",
        projectId: "project-1",
        saved,
        workIds: ["work-1"],
      }).success,
    ).toBe(false);
    expect(
      backlogSavedPresentationSchema.safeParse({ sort: "Manual order" })
        .success,
    ).toBe(false);
  });

  test("requires a chosen criterion for saved Priority and a field for saved Field", () => {
    expect(
      backlogSavedPresentationSchema.safeParse({ sort: "Priority" }).success,
    ).toBe(false);
    expect(
      backlogSavedPresentationSchema.safeParse({
        sort: "Priority",
        metricId: "metric-1",
      }).success,
    ).toBe(true);
    expect(
      backlogSavedPresentationSchema.safeParse({ sort: "Field" }).success,
    ).toBe(false);
  });
});

describe("Backlog prepared membership API contract", () => {
  test("accepts unplanned active Work and excludes terminal Work", () => {
    const unplannedWork = {
      id: "work-1",
      key: "PAY-1",
      number: 1,
      plannedStartDate: null,
      reappearDate: null,
      revision: 0,
      status: "Not Started",
      targetDate: null,
      title: "Unplanned work",
    };

    expect(backlogWorkSchema.safeParse(unplannedWork).success).toBe(true);
    expect(
      backlogWorkSchema.safeParse({
        ...unplannedWork,
        status: "Closed",
      }).success,
    ).toBe(false);
    expect(projectBacklogSchema.parse([unplannedWork])).toEqual([
      unplannedWork,
    ]);
  });

  test("exposes planning dates for a temporary Date presentation", () => {
    expect(
      backlogWorkSchema.parse({
        id: "work-2",
        key: "PAY-2",
        number: 2,
        plannedStartDate: "2026-10-01",
        reappearDate: "2026-10-02",
        revision: 1,
        status: "Not Started",
        targetDate: null,
        title: "Dated work",
      }),
    ).toMatchObject({
      plannedStartDate: "2026-10-01",
      reappearDate: "2026-10-02",
      targetDate: null,
    });
  });
});
