import { describe, expect, test } from "vitest";

import {
  isWorkSurfaceHash,
  navigationSurfaceFromHash,
  workRecordHash,
  workRecordHref,
  workRelationsHash,
} from "./project-shell-navigation";

describe("Project Shell Work navigation", () => {
  test("keeps Work relation anchors on the Work surface", () => {
    const hash = workRelationsHash("work-1");

    expect(isWorkSurfaceHash(hash)).toBe(true);
    expect(navigationSurfaceFromHash(hash, ["Work"], [], [])).toBe("Work");
  });

  test("builds the Work record link used by copied context", () => {
    expect(workRecordHash("work/2")).toBe("work-work%2F2");
    expect(workRecordHref("project/1", "work/2")).toBe(
      "/projects/project%2F1#work-work%2F2",
    );
  });
});
