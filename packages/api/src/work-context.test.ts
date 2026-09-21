import { describe, expect, test } from "vitest";

import { STARTER_CONFIGURATION_OPTIONS } from "./project-shell";
import {
  getPreparedWorkContextLayout,
  nextPreparedWorkContextSection,
} from "./work-context";
import { WORK_TYPE_OPTIONS } from "./work-lifecycle";

const EXPECTED_SECTIONS = {
  Bug: [
    "Observed/Expected Behavior",
    "Affected Releases",
    "Evidence",
    "GitHub & Tests",
  ],
  Feature: [
    "Problem/Opportunity",
    "Expected Outcome",
    "Evidence & Decisions",
    "Risks & Open Questions",
    "Included Work",
    "GitHub & Tests",
    "Target Release",
  ],
  Improvement: [
    "Current Situation",
    "Expected Outcome",
    "Evidence",
    "GitHub & Tests",
  ],
  Research: [
    "Research Question",
    "Sources & Evidence",
    "Decisions",
    "Related Work",
  ],
  Task: ["Description", "Dependencies", "GitHub & Tests", "Target Release"],
} as const;

describe("Work Context Card prepared layouts", () => {
  test("uses the closed prepared section set for every Work type", () => {
    for (const type of WORK_TYPE_OPTIONS) {
      expect(getPreparedWorkContextLayout(type).sections).toEqual(
        EXPECTED_SECTIONS[type],
      );
    }
  });

  test("keeps the same type layout across every Starter Configuration", () => {
    for (const type of WORK_TYPE_OPTIONS) {
      const layouts = STARTER_CONFIGURATION_OPTIONS.map(() =>
        getPreparedWorkContextLayout(type),
      );

      expect(layouts).toHaveLength(4);
      expect(layouts.map((layout) => layout.sections)).toEqual(
        STARTER_CONFIGURATION_OPTIONS.map(() => EXPECTED_SECTIONS[type]),
      );
    }
  });

  test("keeps Title, Type, Status, and Planning visible before context", () => {
    expect(getPreparedWorkContextLayout("Feature").initialFields).toEqual([
      "Title",
      "Type",
      "Status",
      "Planning",
    ]);
  });

  test("opens one hidden section at a time through Add Context", () => {
    expect(nextPreparedWorkContextSection("Task", [])).toBe("Description");
    expect(nextPreparedWorkContextSection("Task", ["Description"])).toBe(
      "Dependencies",
    );
    expect(
      nextPreparedWorkContextSection("Task", [
        "Description",
        "Dependencies",
        "GitHub & Tests",
        "Target Release",
      ]),
    ).toBeNull();
  });
});
