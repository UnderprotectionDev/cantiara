import { expect, test } from "vitest";
import { roadmapPlacementFormSchema } from "../roadmap-placement-form";

test("a placement needs a Horizon or a date for the chosen field", () => {
  expect(
    roadmapPlacementFormSchema.safeParse({ field: "horizon", value: "Now" })
      .success,
  ).toBe(true);
  expect(
    roadmapPlacementFormSchema.safeParse({ field: "horizon", value: "" })
      .success,
  ).toBe(false);
  expect(
    roadmapPlacementFormSchema.safeParse({ field: "targetDate", value: "" })
      .success,
  ).toBe(false);
  expect(
    roadmapPlacementFormSchema.safeParse({
      field: "plannedStartDate",
      value: "2026-11-01",
    }).success,
  ).toBe(true);
});
