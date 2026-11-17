import { describe, expect, test } from "vitest";

import { liveBlockFormSchema } from "../live-block-form";

const addable = new Set(["Document:d1:"]);

describe("liveBlockFormSchema", () => {
  test("accepts an addable source", () => {
    expect(
      liveBlockFormSchema(addable, 1).safeParse({ choice: "Document:d1:" })
        .success,
    ).toBe(true);
  });

  test("refuses an empty or unknown choice", () => {
    expect(
      liveBlockFormSchema(addable, 1).safeParse({ choice: "" }).success,
    ).toBe(false);
    expect(
      liveBlockFormSchema(addable, 1).safeParse({ choice: "Document:x:" })
        .success,
    ).toBe(false);
  });

  test("refuses a fifth live block", () => {
    const parsed = liveBlockFormSchema(addable, 4).safeParse({
      choice: "Document:d1:",
    });
    expect(parsed.success).toBe(false);
  });
});
