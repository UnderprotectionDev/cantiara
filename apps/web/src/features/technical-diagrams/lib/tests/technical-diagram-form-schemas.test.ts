import { expect, test } from "vitest";
import {
  conversionSchema,
  diagramViewSchema,
  versionNameSchema,
} from "../technical-diagram-form-schemas";

const TOO_LONG = "x".repeat(256);

test("name and title rules come from the API input schemas", () => {
  expect(versionNameSchema.safeParse({ name: TOO_LONG }).success).toBe(false);
  expect(versionNameSchema.safeParse({ name: "v1" }).success).toBe(true);
  expect(
    diagramViewSchema.safeParse({ name: TOO_LONG, selectedNodeIds: ["n"] })
      .success,
  ).toBe(false);
  expect(
    conversionSchema.safeParse({
      revision: "",
      targetMode: "Product-authored Model",
      title: TOO_LONG,
      tool: "",
      url: "",
    }).success,
  ).toBe(false);
});
