import { describe, expect, test } from "vitest";
import { createFocusPeriodInputSchema } from "./focus-period";

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
});
