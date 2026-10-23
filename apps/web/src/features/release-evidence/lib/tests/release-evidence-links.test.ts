import { RELEASE_EVIDENCE_SOURCE_TYPES } from "@cantiara/api/release-evidence";
import { expect, test } from "vitest";
import { releaseEvidenceSourceHref } from "../release-evidence-links";

test("every source type opens its owner record under the Project, never a pack copy", () => {
  for (const recordType of RELEASE_EVIDENCE_SOURCE_TYPES) {
    const href = releaseEvidenceSourceHref("p 1", {
      recordId: "r/1",
      recordType,
    });
    expect(href.startsWith("/projects/p%201#")).toBe(true);
    expect(href.length).toBeGreaterThan("/projects/p%201#".length);
  }
});

test("Work, Risk and Test Gap rows open their own anchors", () => {
  expect(
    releaseEvidenceSourceHref("p1", { recordId: "w1", recordType: "Work" }),
  ).toBe("/projects/p1#work-w1");
  expect(
    releaseEvidenceSourceHref("p1", { recordId: "k1", recordType: "Risk" }),
  ).toBe("/projects/p1#source-risk-k1");
  expect(
    releaseEvidenceSourceHref("p1", { recordId: "g1", recordType: "Test Gap" }),
  ).toBe("/projects/p1#source-test-gap-g1");
});
