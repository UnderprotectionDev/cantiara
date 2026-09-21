import { describe, expect, test } from "vitest";

import {
  isWorkSurfaceHash,
  navigationSurfaceFromHash,
  workRelationsHash,
} from "./project-shell-navigation";

describe("Project Shell Work navigation", () => {
  test("keeps Work relation anchors on the Work surface", () => {
    const hash = workRelationsHash("work-1");

    expect(isWorkSurfaceHash(hash)).toBe(true);
    expect(navigationSurfaceFromHash(hash, ["Work"], [], [])).toBe("Work");
  });
});
