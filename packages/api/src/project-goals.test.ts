import { describe, expect, test } from "vitest";
import {
  createProjectGoalInputSchema,
  projectGoalRecordSchema,
  projectGoalRelationInputSchema,
} from "./project-goals";

const draft = {
  baseRevision: 0,
  clientIdempotencyKey: "goal-create",
  id: "goal-1",
  projectId: "project-1",
  title: "Useful first release",
  description: "Help founders keep context.",
};
describe("Project Goals record interface", () => {
  test("keeps outcomes optional free text without manufacturing a result", () => {
    expect(createProjectGoalInputSchema.parse(draft)).toEqual({
      ...draft,
      intendedOutcome: null,
      observedOutcomeLearning: null,
    });
    expect(
      createProjectGoalInputSchema.parse({
        ...draft,
        intendedOutcome: "Learn what helps",
        observedOutcomeLearning: "Small scope helped",
      }),
    ).toMatchObject({
      intendedOutcome: "Learn what helps",
      observedOutcomeLearning: "Small scope helped",
    });
  });
  test("rejects metric maintenance, Key Results, goal hierarchy, and lifecycle fields", () => {
    for (const field of [
      "progress",
      "health",
      "status",
      "life",
      "keyResults",
      "target",
      "actual",
      "parentGoalId",
    ]) {
      expect(
        createProjectGoalInputSchema.safeParse({ ...draft, [field]: 50 })
          .success,
      ).toBe(false);
    }
    expect(
      projectGoalRecordSchema.safeParse({
        id: "goal-1",
        projectId: "project-1",
        title: draft.title,
        description: draft.description,
        intendedOutcome: null,
        observedOutcomeLearning: null,
        revision: 1,
        createdAt: "2026-10-07T10:00:00.000Z",
        updatedAt: "2026-10-07T10:00:00.000Z",
        progress: 50,
      }).success,
    ).toBe(false);
  });
  test("requires a useful title and description", () => {
    expect(
      createProjectGoalInputSchema.safeParse({ ...draft, title: " " }).success,
    ).toBe(false);
    expect(
      createProjectGoalInputSchema.safeParse({ ...draft, description: " " })
        .success,
    ).toBe(false);
  });
});

describe("Project Goals membership interface", () => {
  test("accepts only Work, Milestone, and Project Release contribution without lifecycle fields", () => {
    const relation = {
      projectId: "project-1",
      goalId: "goal-1",
      memberId: "member-1",
      kind: "Contributes to Goal",
      attached: true,
      baseRevision: 0,
      clientIdempotencyKey: "attach",
    };
    for (const memberType of ["Work", "Milestone", "Project Release"]) {
      expect(
        projectGoalRelationInputSchema.safeParse({ ...relation, memberType })
          .success,
      ).toBe(true);
    }
    for (const memberType of [
      "Decision",
      "Evidence",
      "Test",
      "Experiment/Validation",
      "User Research Session",
      "Feature",
    ]) {
      expect(
        projectGoalRelationInputSchema.safeParse({ ...relation, memberType })
          .success,
      ).toBe(false);
    }
    expect(
      projectGoalRelationInputSchema.safeParse({
        ...relation,
        memberType: "Work",
        status: "Done",
      }).success,
    ).toBe(false);
    expect(
      projectGoalRelationInputSchema.safeParse({
        ...relation,
        memberType: "Risk",
        kind: "Related",
      }).success,
    ).toBe(true);
  });
});
