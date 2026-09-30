import { describe, expect, test } from "vitest";
import {
  createFocusPeriodInputSchema,
  focusPeriodDecisionInputSchema,
  focusPeriodEvaluationInputSchema,
  focusPeriodFollowUpWorkInputSchema,
} from "./focus-period";

describe("Focus Period", () => {
  test("accepts inclusive windows of one through eight weeks with a purpose", () => {
    const period = { purpose: "Ship the first beta", startDate: "2026-10-01" };
    expect(
      createFocusPeriodInputSchema.safeParse({
        ...period,
        endDate: "2026-10-07",
      }).success,
    ).toBe(true);
    expect(
      createFocusPeriodInputSchema.safeParse({
        ...period,
        endDate: "2026-11-25",
      }).success,
    ).toBe(true);
    expect(
      createFocusPeriodInputSchema.safeParse({
        ...period,
        endDate: "2026-10-06",
      }).success,
    ).toBe(false);
    expect(
      createFocusPeriodInputSchema.safeParse({
        ...period,
        endDate: "2026-11-26",
      }).success,
    ).toBe(false);
    expect(
      createFocusPeriodInputSchema.safeParse({
        ...period,
        endDate: "2026-10-07",
        purpose: " ",
      }).success,
    ).toBe(false);
  });

  test("accepts optional evaluation text and a follow-up Work draft", () => {
    expect(
      focusPeriodEvaluationInputSchema.safeParse({
        periodId: "period-1",
        evaluation: {
          keep: "Keep pairing",
          change: "",
          tryNext: "Ship smaller",
        },
      }).success,
    ).toBe(true);
    expect(
      focusPeriodFollowUpWorkInputSchema.safeParse({
        periodId: "period-1",
        learning: "Try next",
        projectId: "project-1",
        title: "Ship the smaller beta",
        type: "Task",
        clientIdempotencyKey: "follow-up-key",
      }).success,
    ).toBe(true);
    expect(
      focusPeriodFollowUpWorkInputSchema.safeParse({
        periodId: "period-1",
        learning: "Try next",
        projectId: "project-1",
        title: " ",
        type: "Task",
        clientIdempotencyKey: "follow-up-key",
      }).success,
    ).toBe(false);
  });

  test("accepts a bulk leftover decision for selected Work", () => {
    expect(
      focusPeriodDecisionInputSchema.safeParse({
        periodId: "period-1",
        workIds: ["work-1", "work-2"],
        destination: "Backlog",
      }).success,
    ).toBe(true);
    expect(
      focusPeriodDecisionInputSchema.safeParse({
        periodId: "period-1",
        workIds: ["work-1", "work-1"],
        destination: "Backlog",
      }).success,
    ).toBe(false);
  });
});
