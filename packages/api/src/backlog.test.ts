import { describe, expect, test } from "vitest";

import {
  backlogWorkSchema,
  projectBacklogOrderSchema,
  projectBacklogSchema,
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

describe("Backlog prepared membership API contract", () => {
  test("accepts unplanned active Work and excludes terminal Work", () => {
    const unplannedWork = {
      id: "work-1",
      key: "PAY-1",
      number: 1,
      status: "Not Started",
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
});
