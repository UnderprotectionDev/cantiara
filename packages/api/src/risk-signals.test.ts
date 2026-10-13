import { describe, expect, test } from "vitest";
import { openRiskSignal, riskContextRelationInputSchema } from "./risk-signals";

const source = {
  id: "risk-1",
  projectId: "project-1",
  life: "Open",
  impact: "Release delay",
  probability: "Likely",
  revision: 1,
};
describe("Risks signal production", () => {
  test("entering Open carries its source event, impact and probability", () => {
    expect(
      openRiskSignal(source, { type: "entered-open", id: "risk-1:1" }),
    ).toEqual({
      signalType: "open-risk",
      presentation: "Action Required",
      sourceRiskId: "risk-1",
      projectId: "project-1",
      sourceEvent: { type: "entered-open", id: "risk-1:1" },
      impact: "Release delay",
      probability: "Likely",
      sourcePath: "/projects/project-1#source-risk-risk-1",
    });
  });
});

test.each([
  ["Project Release", "Preparing"],
  ["Focus Period", "Active"],
] as const)("an Open Risk related to %s in %s emits", (targetType, status) => {
  expect(
    openRiskSignal(
      source,
      {
        type: "related-context",
        id: "relation-1",
        targetType,
        targetId: "context-1",
      },
      status,
    ),
  ).toMatchObject({
    sourceEvent: {
      type: "related-context",
      id: "relation-1",
      targetType,
      targetId: "context-1",
    },
    impact: "Release delay",
    probability: "Likely",
  });
});
test.each([
  ["Project Release", "Draft"],
  ["Project Release", "Published"],
  ["Project Release", "Cancelled"],
  ["Focus Period", "Planned"],
  ["Focus Period", "Closed"],
  ["Focus Period", "Canceled"],
  ["Focus Period", undefined],
] as const)("a relation to %s in %s is not an event", (targetType, status) => {
  expect(
    openRiskSignal(
      source,
      {
        type: "related-context",
        id: "relation-1",
        targetType,
        targetId: "context-1",
      },
      status,
    ),
  ).toBeNull();
});
test.each(["Mitigating", "Accepted", "Occurred", "Resolved"])(
  "%s cannot emit, even with high impact and probability",
  (life) => {
    const risk = { ...source, life, impact: "High", probability: "High" };
    expect(
      openRiskSignal(risk, { type: "entered-open", id: "event-1" }),
    ).toBeNull();
    expect(
      openRiskSignal(
        risk,
        {
          type: "related-context",
          id: "relation-1",
          targetType: "Focus Period",
          targetId: "period-1",
        },
        "Active",
      ),
    ).toBeNull();
  },
);
test("context links accept only explicit release and period targets", () => {
  expect(
    riskContextRelationInputSchema.safeParse({
      baseRevision: 0,
      clientIdempotencyKey: "link",
      projectId: "project-1",
      riskId: "risk-1",
      targetType: "Project",
      targetId: "project-1",
    }).success,
  ).toBe(false);
});
