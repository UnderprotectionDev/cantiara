import { PROJECT_ACTIVITY_RECORD_TYPES } from "@cantiara/api/project-activity";
import { expect, test } from "vitest";
import {
  navigationHash,
  navigationSurfaceFromHash,
  PROJECT_HISTORY_HASH,
} from "@/features/project-shell/lib/project-shell-navigation";
import { projectActivitySourceHref } from "../project-activity-links";

test("every attributed record type opens its owner record under the Project", () => {
  for (const recordType of PROJECT_ACTIVITY_RECORD_TYPES) {
    const href = projectActivitySourceHref("p 1", {
      recordId: "r/1",
      recordType,
    });
    expect(href.startsWith("/projects/p%201#")).toBe(true);
    expect(href.length).toBeGreaterThan("/projects/p%201#".length);
  }
  expect(
    projectActivitySourceHref("p1", { recordId: "w1", recordType: "Work" }),
  ).toBe("/projects/p1#work-w1");
  expect(
    projectActivitySourceHref("p1", { recordId: "d1", recordType: "Decision" }),
  ).toBe("/projects/p1#source-decision-d1");
  expect(
    projectActivitySourceHref("p1", { recordId: "k1", recordType: "Risk" }),
  ).toBe("/projects/p1#source-risk-k1");
  expect(
    projectActivitySourceHref("p1", { recordId: "x1", recordType: "Document" }),
  ).toBe("/projects/p1#document-x1");
});

test("Project Activity is a secondary area, never the default Project landing", () => {
  expect(PROJECT_HISTORY_HASH).toBe("project-history");
  expect(navigationSurfaceFromHash("", ["Work"], [], [])).toBe("Overview");
  expect(
    navigationSurfaceFromHash(PROJECT_HISTORY_HASH, ["Work"], [], []),
  ).toBe("Overview");
  expect(navigationHash("Overview")).not.toBe(PROJECT_HISTORY_HASH);
});
