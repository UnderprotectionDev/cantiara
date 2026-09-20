import { describe, expect, test } from "vitest";

import {
  createTagInputSchema,
  TAG_RECORD_TYPE_OPTIONS,
  tagNameKey,
} from "./tags";

describe("Tags seam", () => {
  test("keeps one flat Workspace name and treats slash as text", () => {
    expect(TAG_RECORD_TYPE_OPTIONS).toEqual(["Work"]);
    expect(createTagInputSchema.parse({ name: "  roadmap/next  " })).toEqual({
      name: "roadmap/next",
    });
    expect(tagNameKey("Roadmap/Next")).toBe("roadmap/next");
  });

  test("rejects an empty tag name", () => {
    expect(() => createTagInputSchema.parse({ name: "   " })).toThrow();
  });
});
