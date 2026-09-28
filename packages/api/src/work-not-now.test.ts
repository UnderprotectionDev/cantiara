import { describe, expect, test } from "vitest";

import {
  reconsiderWorkNotNowInputSchema,
  recordWorkNotNowInputSchema,
  workNotNowGroundSchema,
  workNotNowTrailSchema,
} from "./work-not-now";

describe("Roadmap Horizon Not now decision trail", () => {
  test("records a short reason, optional condition, and selected supporting relationships", () => {
    const input = {
      baseRevision: 0,
      clientIdempotencyKey: "not-now-1",
      condition: "After the next customer interview.",
      groundRelationIds: ["relation-decision", "relation-source"],
      reason: "The problem needs more evidence.",
      reviewLaterHandling: "Keep Review later",
      workId: "work-1",
    };

    expect(recordWorkNotNowInputSchema.parse(input)).toEqual(input);
  });

  test("does not allow a Not now trail to write Work planning or lifecycle fields", () => {
    const input = {
      baseRevision: 0,
      clientIdempotencyKey: "not-now-1",
      condition: null,
      groundRelationIds: [],
      reason: "Wait for more evidence.",
      workId: "work-1",
    };

    for (const forbidden of [
      "status",
      "closureResult",
      "priority",
      "backlogOrder",
      "roadmapHorizon",
      "targetDate",
      "plannedStartDate",
      "reminderAction",
    ]) {
      expect(
        recordWorkNotNowInputSchema.safeParse({
          ...input,
          [forbidden]: "changed",
        }).success,
      ).toBe(false);
    }
  });

  test("defaults reminder handling to keeping existing Review Later reminders", () => {
    const input = {
      baseRevision: 0,
      clientIdempotencyKey: "not-now-1",
      condition: null,
      groundRelationIds: [],
      reason: "Wait for more evidence.",
      workId: "work-1",
    };

    expect(recordWorkNotNowInputSchema.parse(input).reviewLaterHandling).toBe(
      "Keep Review later",
    );
    expect(
      reconsiderWorkNotNowInputSchema.parse({
        baseRevision: 1,
        clientIdempotencyKey: "reconsider-1",
        trailId: "trail-1",
        workId: "work-1",
      }).reviewLaterHandling,
    ).toBe("Keep Review later");
  });

  test("limits supporting records to the specified record families", () => {
    const input = {
      baseRevision: 0,
      clientIdempotencyKey: "not-now-1",
      condition: null,
      groundRelationIds: [],
      reason: "Wait for more evidence.",
      workId: "work-1",
    };

    expect(
      recordWorkNotNowInputSchema.safeParse({
        ...input,
        groundRelationIds: ["relation-1", "relation-1"],
      }).success,
    ).toBe(false);
    expect(
      recordWorkNotNowInputSchema.safeParse({
        ...input,
        groundRelationIds: Array.from(
          { length: 26 },
          (_, index) => `r-${index}`,
        ),
      }).success,
    ).toBe(false);
    for (const recordType of [
      "Decision",
      "Risk",
      "Feedback",
      "Source",
      "Document",
    ]) {
      expect(
        workNotNowGroundSchema.safeParse({
          key: null,
          projectId: "project-1",
          recordId: "record-1",
          recordType,
          relationId: "relation-1",
          title: "Supporting record",
        }).success,
      ).toBe(true);
    }
    expect(
      workNotNowGroundSchema.safeParse({
        key: null,
        projectId: "project-1",
        recordId: "record-1",
        recordType: "Work",
        relationId: "relation-1",
        title: "Work",
      }).success,
    ).toBe(false);
  });

  test("normalizes an empty optional re-evaluation condition to no condition", () => {
    expect(
      recordWorkNotNowInputSchema.parse({
        baseRevision: 0,
        clientIdempotencyKey: "not-now-1",
        condition: "  ",
        groundRelationIds: [],
        reason: "Wait for more evidence.",
        workId: "work-1",
      }).condition,
    ).toBeNull();
  });

  test("closes an active trail as Reconsidered without creating a Work status", () => {
    const input = {
      baseRevision: 3,
      clientIdempotencyKey: "reconsider-1",
      reviewLaterHandling: "Keep Review later",
      trailId: "trail-1",
      workId: "work-1",
    };
    expect(reconsiderWorkNotNowInputSchema.parse(input)).toEqual(input);

    expect(
      workNotNowTrailSchema.parse({
        closedAt: "2026-09-27T08:00:00.000Z",
        closedBy: "Reconsidering",
        closedByAccountId: "account-1",
        condition: null,
        createdAt: "2026-09-26T08:00:00.000Z",
        createdByAccountId: "account-1",
        grounds: [],
        id: "trail-1",
        reason: "Wait for more evidence.",
        revision: 4,
        status: "Reconsidered",
        workId: "work-1",
      }).status,
    ).toBe("Reconsidered");
  });
});
