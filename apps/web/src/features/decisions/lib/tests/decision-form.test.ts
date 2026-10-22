import { expect, test } from "vitest";
import {
  decisionFormSchema,
  decisionWithdrawFormSchema,
} from "../decision-form";

test("a Decision needs a Title and Decision text", () => {
  const empty = decisionFormSchema.safeParse({
    decision: " ",
    rationale: "",
    title: "Ship",
  });
  expect(empty.success).toBe(false);
  expect(empty.error?.issues[0]?.message).toBe(
    "Enter a Title and Decision text before saving.",
  );
  expect(
    decisionFormSchema.safeParse({
      decision: "Use Postgres",
      rationale: "",
      title: "Storage",
    }).success,
  ).toBe(true);
});

test("Withdraw only carries a Rationale", () => {
  expect(decisionWithdrawFormSchema.safeParse({ rationale: "" }).success).toBe(
    true,
  );
});
