import { PROJECT_ACTIVITY_RECORD_TYPES } from "@cantiara/api/project-activity";
import { STORY_SOURCE_TYPES } from "@cantiara/api/project-history";
import { expect, test } from "vitest";
import {
  navigationHash,
  navigationSurfaceFromHash,
  PROJECT_HISTORY_HASH,
} from "@/features/project-shell/lib/project-shell-navigation";
import { projectRecordHref } from "../project-record-links";

test("every attributed and story source type opens its owner record under the Project", () => {
  for (const recordType of [
    ...PROJECT_ACTIVITY_RECORD_TYPES,
    ...STORY_SOURCE_TYPES,
  ]) {
    const href = projectRecordHref("p 1", { recordId: "r/1", recordType });
    expect(href.startsWith("/projects/p%201#")).toBe(true);
    expect(href.length).toBeGreaterThan("/projects/p%201#".length);
  }
});

test("Work, Decision, Risk, Document and Milestone open their own anchors", () => {
  const href = (
    recordType: Parameters<typeof projectRecordHref>[1]["recordType"],
    recordId: string,
  ) => projectRecordHref("p1", { recordId, recordType });
  expect(href("Work", "w1")).toBe("/projects/p1#work-w1");
  expect(href("Decision", "d1")).toBe("/projects/p1#source-decision-d1");
  expect(href("Risk", "k1")).toBe("/projects/p1#source-risk-k1");
  expect(href("Document", "x1")).toBe("/projects/p1#document-x1");
  expect(href("Milestone", "m1")).toBe("/projects/p1#source-milestone-m1");
});

test("Project Activity is a secondary area, never the default Project landing", () => {
  expect(PROJECT_HISTORY_HASH).toBe("project-history");
  expect(navigationSurfaceFromHash("", ["Work"], [], [])).toBe("Overview");
  expect(
    navigationSurfaceFromHash(PROJECT_HISTORY_HASH, ["Work"], [], []),
  ).toBe("Project History");
  expect(navigationHash("Overview")).not.toBe(PROJECT_HISTORY_HASH);
});
