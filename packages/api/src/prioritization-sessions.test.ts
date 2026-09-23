import { describe, expect, test } from "vitest";

import {
  createPrioritizationSessionInputSchema,
  createPrioritizationSessionMutationInputSchema,
  prioritizationSessionSchema,
  updatePrioritizationSessionOrderInputSchema,
} from "./prioritization-sessions";

describe("Prioritization session API contract", () => {
  test("creates a named session only from an explicit Project and Work scope", () => {
    expect(
      createPrioritizationSessionInputSchema.parse({
        name: "  Launch review  ",
        projectId: "project-1",
        workIds: ["work-2", "work-1"],
      }),
    ).toEqual({
      name: "Launch review",
      projectId: "project-1",
      workIds: ["work-2", "work-1"],
    });

    expect(
      createPrioritizationSessionInputSchema.safeParse({
        name: "Launch review",
        projectId: "project-1",
        workIds: ["work-1", "work-1"],
      }).success,
    ).toBe(false);
  });

  test("allows an explicit Work scope to exceed 2,000 Works", () => {
    const workIds = Array.from({ length: 2001 }, (_, index) => `work-${index}`);

    expect(
      createPrioritizationSessionInputSchema.safeParse({
        name: "Launch review",
        projectId: "project-1",
        workIds,
      }).success,
    ).toBe(true);
  });

  test("requires an idempotent human mutation envelope when creating", () => {
    expect(
      createPrioritizationSessionMutationInputSchema.safeParse({
        baseRevision: 0,
        clientIdempotencyKey: "create-session-1",
        name: "Launch review",
        projectId: "project-1",
        workIds: ["work-1"],
      }).success,
    ).toBe(true);
    expect(
      createPrioritizationSessionMutationInputSchema.safeParse({
        name: "Launch review",
        projectId: "project-1",
        workIds: ["work-1"],
      }).success,
    ).toBe(false);
  });

  test("accepts only a view-local ordered Work scope for reordering", () => {
    expect(
      updatePrioritizationSessionOrderInputSchema.safeParse({
        sessionId: "session-1",
        workIds: ["work-3", "work-1", "work-2"],
      }).success,
    ).toBe(true);
    expect(
      updatePrioritizationSessionOrderInputSchema.safeParse({
        sessionId: "session-1",
        workIds: ["work-1", "work-1"],
      }).success,
    ).toBe(false);
    expect(
      updatePrioritizationSessionOrderInputSchema.safeParse({
        backlogOrder: ["work-1"],
        sessionId: "session-1",
        workIds: ["work-1"],
      }).success,
    ).toBe(false);
  });

  test("keeps a closed session's last ordered scope in its public record", () => {
    expect(
      prioritizationSessionSchema.parse({
        closedAt: "2026-09-23T09:00:00.000Z",
        createdAt: "2026-09-23T08:00:00.000Z",
        id: "session-1",
        name: "Launch review",
        projectId: "project-1",
        revision: 2,
        trashedAt: null,
        updatedAt: "2026-09-23T09:00:00.000Z",
        workIds: ["work-3", "work-1"],
      }),
    ).toMatchObject({
      closedAt: "2026-09-23T09:00:00.000Z",
      workIds: ["work-3", "work-1"],
    });
  });
});
