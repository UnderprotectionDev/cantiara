import { STORY_SOURCE_TYPES } from "@cantiara/api/project-history";
import { expect, test } from "vitest";
import { storySourceHref } from "../project-history-links";

test("every source type opens its owner record under the Project, never a timeline copy", () => {
  for (const recordType of STORY_SOURCE_TYPES) {
    const href = storySourceHref("p 1", { recordId: "r/1", recordType });
    expect(href.startsWith("/projects/p%201#")).toBe(true);
    expect(href.length).toBeGreaterThan("/projects/p%201#".length);
  }
});

test("Work, Decision, Document and Milestone events open their own anchors", () => {
  expect(storySourceHref("p1", { recordId: "w1", recordType: "Work" })).toBe(
    "/projects/p1#work-w1",
  );
  expect(
    storySourceHref("p1", { recordId: "d1", recordType: "Decision" }),
  ).toBe("/projects/p1#source-decision-d1");
  expect(
    storySourceHref("p1", { recordId: "m1", recordType: "Milestone" }),
  ).toBe("/projects/p1#source-milestone-m1");
  expect(
    storySourceHref("p1", { recordId: "doc1", recordType: "Document" }),
  ).toBe("/projects/p1#document-doc1");
});
