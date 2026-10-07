import { describe, expect, test } from "vitest";
import { favoriteSourceSchema } from "./favorites";

describe("Favorites membership contract", () => {
  test("accepts exactly the five supported source types without source writes", () => {
    for (const sourceRecordType of [
      "Project",
      "Document",
      "Work",
      "Decision",
      "Smart Collection",
    ]) {
      expect(
        favoriteSourceSchema.parse({
          sourceRecordId: "source-1",
          sourceRecordType,
        }),
      ).toEqual({ sourceRecordId: "source-1", sourceRecordType });
    }
    expect(
      favoriteSourceSchema.safeParse({
        sourceRecordId: "source-1",
        sourceRecordType: "Risk",
      }).success,
    ).toBe(false);
    expect(
      favoriteSourceSchema.safeParse({
        sourceRecordId: "source-1",
        sourceRecordType: "Work",
        projectId: "other-project",
      }).success,
    ).toBe(false);
  });
});
