import { expect, test } from "vitest";
import {
  createScreenFromTemplateFormSchema,
  saveAsTemplateFormSchema,
} from "../screen-forms";

test("template forms keep the spec messages and the API length bounds", () => {
  expect(
    saveAsTemplateFormSchema.safeParse({ name: " ", version: 1 }).error
      ?.issues[0]?.message,
  ).toBe("Template name is required.");
  expect(
    saveAsTemplateFormSchema.safeParse({ name: "x".repeat(121), version: 1 })
      .success,
  ).toBe(false);
  expect(
    createScreenFromTemplateFormSchema.safeParse({
      templateId: "t",
      title: "x".repeat(256),
    }).success,
  ).toBe(false);
});
