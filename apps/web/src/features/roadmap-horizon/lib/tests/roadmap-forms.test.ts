import { expect, test } from "vitest";
import {
  milestoneFormSchema,
  milestoneWorkRelationFormSchema,
} from "../milestone-forms";
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

test("a Milestone needs a Title; the calendar date may be empty", () => {
  const base = { description: "", targetDate: "", title: "Beta" };
  expect(milestoneFormSchema.safeParse(base).success).toBe(true);
  expect(milestoneFormSchema.safeParse({ ...base, title: "  " }).success).toBe(
    false,
  );
  expect(
    milestoneFormSchema.safeParse({ ...base, targetDate: "not-a-date" })
      .success,
  ).toBe(false);
  expect(
    milestoneWorkRelationFormSchema.safeParse({ workId: "" }).success,
  ).toBe(false);
});
