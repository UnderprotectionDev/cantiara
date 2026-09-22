import { describe, expect, test } from "vitest";

import {
  createPriorityMetricInputSchema,
  EVIDENCE_STRENGTH_TEMPLATE,
  getStarterPriorityMetricTemplate,
  PRIORITY_METRIC_RANKS,
  priorityMetricRankSchema,
  priorityMetricValueListItemSchema,
  setPriorityMetricValueInputSchema,
} from "./priority-metrics";

const rankDescriptions = {
  High: "Repeated direct evidence.",
  Low: "Limited evidence.",
  Medium: "Some evidence.",
  "Very high": "Strong validated evidence.",
  "Very low": "No supporting evidence.",
};

describe("Priority metrics API contract", () => {
  test("uses only the five fixed ranks", () => {
    expect(PRIORITY_METRIC_RANKS).toEqual([
      "Very low",
      "Low",
      "Medium",
      "High",
      "Very high",
    ]);
    expect(priorityMetricRankSchema.safeParse("Very high").success).toBe(true);
    expect(priorityMetricRankSchema.safeParse("6").success).toBe(false);
  });

  test("rejects formula fields outside the fixed criterion contract", () => {
    expect(
      createPriorityMetricInputSchema.safeParse({
        name: "Evidence strength",
        projectId: "project-1",
        rankDescriptions,
        shortDescription: "How strongly evidence supports this Work.",
      }).success,
    ).toBe(true);
    expect(
      createPriorityMetricInputSchema.safeParse({
        name: "Evidence strength",
        projectId: "project-1",
        rankDescriptions,
        shortDescription: "How strongly evidence supports this Work.",
        weight: 2,
      }).success,
    ).toBe(false);
  });

  test("keeps Unevaluated outside the five ranks", () => {
    const template = getStarterPriorityMetricTemplate("Solo SaaS");
    expect(template).toMatchObject({
      enabled: false,
      name: "Evidence strength",
    });
    expect(
      priorityMetricValueListItemSchema.safeParse({
        definition: {
          ...template,
          createdAt: "2026-01-01T00:00:00.000Z",
          id: "metric-1",
          projectId: "project-1",
          revision: 0,
          trashedAt: null,
          updatedAt: "2026-01-01T00:00:00.000Z",
        },
        value: null,
      }).success,
    ).toBe(true);
    expect(getStarterPriorityMetricTemplate("Blank Project")).toBeNull();
  });

  test("does not seed Evidence strength with a value or accept evidence counters", () => {
    expect(EVIDENCE_STRENGTH_TEMPLATE).toMatchObject({ enabled: false });
    expect(EVIDENCE_STRENGTH_TEMPLATE).not.toHaveProperty("value");
    expect(
      setPriorityMetricValueInputSchema.safeParse({
        contactCount: 3,
        feedbackCount: 5,
        metricId: "metric-1",
        projectId: "project-1",
        rank: "High",
        sourceCount: 2,
        workId: "work-1",
      }).success,
    ).toBe(false);
  });
});
