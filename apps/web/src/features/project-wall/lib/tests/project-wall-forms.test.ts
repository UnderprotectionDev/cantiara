import { expect, test } from "vitest";
import {
  createProjectWallFormSchema,
  renameProjectWallFormSchema,
} from "../project-wall-forms";
import { createGroupFormSchema } from "../project-wall-narrative-forms";

test("Project Wall names follow the API title rule", () => {
  const tooLong = { title: "x".repeat(256) };
  expect(createProjectWallFormSchema.safeParse(tooLong).success).toBe(false);
  expect(renameProjectWallFormSchema.safeParse(tooLong).success).toBe(false);
  expect(createGroupFormSchema.safeParse(tooLong).success).toBe(false);
  expect(
    createProjectWallFormSchema.safeParse({ title: "  Wall " }),
  ).toMatchObject({ data: { title: "Wall" }, success: true });
});
