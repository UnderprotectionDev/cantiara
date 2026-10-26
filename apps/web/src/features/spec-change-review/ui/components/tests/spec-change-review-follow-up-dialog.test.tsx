// @vitest-environment happy-dom
// biome-ignore-all lint/performance/noJsxPropsBind: Test props are inline stubs.

import type { SpecChangeReviewCandidate } from "@cantiara/api/spec-change-review-candidates";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";

import { SpecChangeReviewCandidates } from "../spec-change-review-candidates";
import { SpecFollowUpPreview } from "../spec-change-review-follow-up-dialog";

const candidate = (
  overrides: Partial<SpecChangeReviewCandidate>,
): SpecChangeReviewCandidate => ({
  changedSection: null,
  documentLevel: true,
  followUp: null,
  identity: { recordId: "work-2", recordType: "Work", sectionId: null },
  key: "Work|work-2|",
  nextRevision: 2,
  previousRevision: 1,
  reasons: [{ detail: "Implements", kind: "Explicit relation" }],
  record: {
    broken: null,
    label: "CAN-2",
    projectId: "project-1",
    recordId: "work-2",
    recordType: "Work",
    title: "Wire the queue",
  },
  review: { note: null, revision: 0, state: "Waiting", updatedAt: null },
  ...overrides,
});

const handlers = {
  onConfirmFollowUp: () => Promise.resolve(),
  onPreviewFollowUp: () => Promise.reject(new Error("unused")),
};

test("Create Follow-up Work is offered per accessible candidate, never bulk", () => {
  const html = renderToStaticMarkup(
    <SpecChangeReviewCandidates candidates={[candidate({})]} {...handlers} />,
  );

  expect(html).toContain("Create Follow-up Work</button>");
  expect(html).not.toContain("Create all");
  expect(html).not.toContain("Follow-up Work for all");
});

test("a broken candidate offers no follow-up and no title", () => {
  const html = renderToStaticMarkup(
    <SpecChangeReviewCandidates
      candidates={[
        candidate({
          record: {
            broken: {
              canOpenSourceRecord: false,
              establishedAt: "2026-10-01T09:00:00.000Z",
              reason: "No access",
            },
            label: null,
            projectId: null,
            recordId: "work-2",
            recordType: "Work",
            title: null,
          },
        }),
      ]}
      {...handlers}
    />,
  );

  expect(html).not.toContain("Create Follow-up Work");
  expect(html).not.toContain("Wire the queue");
});

test("a followed-up candidate shows its Work and keeps its review status", () => {
  const html = renderToStaticMarkup(
    <SpecChangeReviewCandidates
      candidates={[
        candidate({
          followUp: {
            candidate: {
              recordId: "work-2",
              recordType: "Work",
              sectionId: null,
            },
            createdAt: "2026-10-02T09:00:00.000Z",
            id: "follow-up-1",
            reviewId: "review-1",
            revision: 1,
            workId: "new-work",
            workKey: "CAN-9",
            workTitle: "Follow up spec change: Wire the queue",
          },
        }),
      ]}
      {...handlers}
    />,
  );

  expect(html).toContain(
    "Follow-up Work: CAN-9 Follow up spec change: Wire the queue",
  );
  expect(html).not.toContain("Create Follow-up Work</button>");
  expect(html).toContain("Status: Waiting");
});

test("the preview shows the one Work, Project, status, versions and source relation", () => {
  const html = renderToStaticMarkup(
    <SpecFollowUpPreview
      preview={{
        fingerprint: "0".repeat(64),
        plan: {
          candidate: {
            recordId: "work-2",
            recordType: "Work",
            sectionId: null,
          },
          candidateSource: {
            changedSection: null,
            documentLevel: true,
            reasons: [{ detail: "Implements", kind: "Explicit relation" }],
            record: { label: "CAN-2", recordType: "Work", title: "Wire it" },
          },
          recordCount: 1,
          relation: "Origin",
          reviewId: "review-1",
          specVersions: {
            documentId: "spec-1",
            documentTitle: "Queue spec",
            nextRevision: 2,
            previousRevision: 1,
          },
          targetProject: { id: "project-1", name: "Cantiara" },
          work: {
            description: "Details",
            startingStatus: "Not Started",
            title: "Follow up spec change: CAN-2 Wire it",
            type: "Task",
          },
        },
      }}
    />,
  );

  expect(html).toContain("exactly one Work");
  expect(html).toContain("Target Project");
  expect(html).toContain("Cantiara");
  expect(html).toContain("Not Started");
  expect(html).toContain("Queue spec: Version 1 → Version 2");
  expect(html).toContain("Document-level candidate. Explicit relation");
  expect(html).toContain("review status of the candidate does not change");
});
