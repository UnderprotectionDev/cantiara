import { expect, test } from "vitest";
import { testResultEventFormSchema } from "../test-review-forms";

test("a Redaction or Withdrawal needs only a reason", () => {
  const schema = testResultEventFormSchema({
    needsNote: false,
    needsResult: false,
  });
  expect(schema.safeParse({ note: "", reason: "x", result: "" }).success).toBe(
    true,
  );
  expect(schema.safeParse({ note: "", reason: "  ", result: "" }).success).toBe(
    false,
  );
});

test("a Correction of a Session Test needs a corrected result", () => {
  const schema = testResultEventFormSchema({
    needsNote: false,
    needsResult: true,
  });
  expect(schema.safeParse({ note: "", reason: "x", result: "" }).success).toBe(
    false,
  );
  expect(
    schema.safeParse({ note: "", reason: "x", result: "passed" }).success,
  ).toBe(true);
});

test("a Correction of a Test Session needs a corrected summary", () => {
  const schema = testResultEventFormSchema({
    needsNote: true,
    needsResult: false,
  });
  expect(schema.safeParse({ note: " ", reason: "x", result: "" }).success).toBe(
    false,
  );
  expect(
    schema.safeParse({ note: "ok", reason: "x", result: "" }).success,
  ).toBe(true);
});
