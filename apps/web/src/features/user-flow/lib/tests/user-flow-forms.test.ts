import { describe, expect, test } from "vitest";

import {
  createOutlineNodeFormSchema,
  PROMOTE_CREATE_NEW,
  promoteToScreenFormSchema,
} from "../user-flow-forms";

describe("User Flow forms", () => {
  test("a Screen outline node needs a Screen", () => {
    expect(
      createOutlineNodeFormSchema.safeParse({
        kind: "Screen",
        screenId: "",
        text: "",
      }).success,
    ).toBe(false);
    expect(
      createOutlineNodeFormSchema.safeParse({
        kind: "Action",
        screenId: "",
        text: "Open",
      }).success,
    ).toBe(true);
  });

  test("Promote to Screen links a Screen or creates one with a trimmed title", () => {
    expect(
      promoteToScreenFormSchema.safeParse({ choice: "s1", title: "" }),
    ).toMatchObject({ data: { mode: "link", screenId: "s1" }, success: true });
    expect(
      promoteToScreenFormSchema.safeParse({
        choice: PROMOTE_CREATE_NEW,
        title: "  ",
      }).success,
    ).toBe(false);
    expect(
      promoteToScreenFormSchema.safeParse({
        choice: PROMOTE_CREATE_NEW,
        title: " Pay ",
      }),
    ).toMatchObject({ data: { mode: "create", title: "Pay" }, success: true });
    expect(
      promoteToScreenFormSchema.safeParse({ choice: "", title: "x" }).success,
    ).toBe(false);
  });
});
