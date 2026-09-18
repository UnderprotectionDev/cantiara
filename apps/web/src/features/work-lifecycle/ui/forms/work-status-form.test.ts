import type { WorkStatusLabel } from "@cantiara/api/project-shell";
import { describe, expect, test } from "vitest";

import { getWorkStatusLabel } from "./work-status-form";

const labels = [
  { label: "Queued", semantic: "Not Started" },
  { label: "Doing", semantic: "In Progress" },
  { label: "Waiting", semantic: "Blocked" },
  { label: "Done", semantic: "Closed" },
] satisfies readonly WorkStatusLabel[];

describe("Work status labels", () => {
  test("uses the Project-configured visible label for a protected status", () => {
    expect(getWorkStatusLabel("In Progress", labels)).toBe("Doing");
  });
});
