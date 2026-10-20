// @vitest-environment happy-dom
// biome-ignore-all lint/performance/noJsxPropsBind: Test props are inline stubs.

import {
  diffSpecVersions,
  type SpecChangeReviewDetail,
  type SpecChangeReviewSummary,
} from "@cantiara/api/spec-change-review";
import type { SpecChangeReviewCandidate } from "@cantiara/api/spec-change-review-candidates";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";

import { SpecChangeReviewView } from "./spec-change-review-view";

const review: SpecChangeReviewSummary = {
  createdAt: "2026-10-01T09:00:00.000Z",
  documentId: "spec-1",
  documentTitle: "Queue spec",
  featureId: "feature-1",
  featureKey: "CAN-1",
  featureTitle: "Queue",
  id: "review-1",
  nextRevision: 2,
  previousRevision: 1,
  projectId: "project-1",
  projectName: "Cantiara",
};

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

const detail: SpecChangeReviewDetail = {
  candidates: [],
  diff: diffSpecVersions(
    { body: "## Goals {#goals}\nShip it.\n", title: "Spec", type: "Spec" },
    { body: "## Goals {#goals}\nShip it well.\n", title: "Spec", type: "Spec" },
  ),
  next: { revision: 2, title: "Spec", type: "Spec" },
  previous: { revision: 1, title: "Spec", type: "Spec" },
  review,
};

function render(props: Partial<Parameters<typeof SpecChangeReviewView>[0]>) {
  return renderToStaticMarkup(
    <SpecChangeReviewView
      onSelect={() => undefined}
      reviews={[review]}
      {...props}
    />,
  );
}

test("labels the queue and the Primary spec version pair", () => {
  const html = render({});

  expect(html).toContain("Spec Change Review");
  expect(html).toContain("Primary spec");
  expect(html).toContain("Version 1 → Version 2");
});

test("explains the empty queue without offering any write", () => {
  const html = render({ reviews: [] });

  expect(html).toContain("No Spec Change Reviews yet.");
  expect(html).not.toContain("Create Follow-up Work");
});

test("the diff walk is keyboard operable and screen-reader labelled", () => {
  const html = render({ detail, selectedId: review.id });

  expect(html).toContain("Previous change");
  expect(html).toContain("Next change");
  expect(html).toContain('aria-label="Changed sections"');
  expect(html).toContain('tabindex="-1"');
  expect(html).toContain('role="status"');
  expect(html).toContain("Goals (Changed)");
  expect(html).toContain("Removed: ");
  expect(html).toContain("Added: ");
});

test("each candidate offers exactly the three states, marked one at a time", () => {
  const html = render({
    detail: {
      ...detail,
      candidates: [
        candidate({}),
        candidate({
          changedSection: {
            change: "Changed",
            heading: "Goals",
            sectionId: "goals",
          },
          documentLevel: false,
          identity: {
            recordId: "doc-1",
            recordType: "Document",
            sectionId: "goals",
          },
          key: "Document|doc-1|goals",
          review: {
            note: "Wording only.",
            revision: 1,
            state: "Not affected",
            updatedAt: "2026-10-02T09:00:00.000Z",
          },
        }),
      ],
    },
    onMark: () => undefined,
    selectedId: review.id,
  });

  expect(html).toContain('aria-label="Review candidates"');
  expect(html).toContain("Document-level candidate");
  expect(html).toContain("Changed section: Goals (Changed)");
  expect(html).toContain("Version 1 → Version 2");
  expect(html).toContain("Why: Explicit relation (Implements)");
  for (const state of ["Waiting", "Reviewed", "Not affected"]) {
    expect(html).toContain(`${state}</button>`);
  }
  expect(html).toContain('aria-pressed="true"');
  expect(html).toContain("<fieldset");
  expect(html).toContain("Review status of CAN-2 Wire the queue");
  expect(html).toContain("Status: Not affected");
  expect(html).not.toContain("All affected");
  expect(html).not.toContain("Mark all");
});

test("an inaccessible candidate shows the broken reference and no title", () => {
  const html = render({
    detail: {
      ...detail,
      candidates: [
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
      ],
    },
    selectedId: review.id,
  });

  expect(html).toContain("Work unavailable (No access)");
  expect(html).not.toContain("Wire the queue");
});

test("explains an empty candidate set", () => {
  expect(render({ detail, selectedId: review.id })).toContain(
    "No recorded links point to this Primary spec.",
  );
});
