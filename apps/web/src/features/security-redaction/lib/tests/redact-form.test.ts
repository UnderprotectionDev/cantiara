import { describe, expect, test } from "vitest";

import { redactFormSchema } from "../redact-form";

describe("redactFormSchema", () => {
  test("accepts the exact typed name and a reason", () => {
    expect(
      redactFormSchema("Atlas").safeParse({
        reason: "Leaked",
        typedName: "Atlas",
      }).success,
    ).toBe(true);
  });

  test("refuses a different typed name", () => {
    expect(
      redactFormSchema("Atlas").safeParse({
        reason: "Leaked",
        typedName: "atlas",
      }).success,
    ).toBe(false);
  });

  test("refuses a blank reason", () => {
    expect(
      redactFormSchema("Atlas").safeParse({
        reason: "   ",
        typedName: "Atlas",
      }).success,
    ).toBe(false);
  });
});
