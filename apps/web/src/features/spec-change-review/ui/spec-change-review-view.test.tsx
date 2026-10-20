// @vitest-environment happy-dom
// biome-ignore-all lint/performance/noJsxPropsBind: Test props are inline stubs.

import {
  diffSpecVersions,
  type SpecChangeReviewDetail,
  type SpecChangeReviewSummary,
} from "@cantiara/api/spec-change-review";
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
};

const detail: SpecChangeReviewDetail = {
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
