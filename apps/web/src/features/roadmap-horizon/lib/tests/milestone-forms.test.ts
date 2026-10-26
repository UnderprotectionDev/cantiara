import { expect, test } from "vitest";
import {
  milestoneFormSchema,
  milestoneWorkRelationFormSchema,
} from "../milestone-forms";

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
