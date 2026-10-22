import type { SpecChangeReviewCandidate } from "@cantiara/api/spec-change-review-candidates";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";

import SpecCandidateReviewForm from "../spec-candidate-review-form";

const SUBMIT_DISABLED =
  /<button(?=[^>]*disabled)(?=[^>]*type="submit")[^>]*>(Add Work|Save note)/;

describe("Spec candidate review form", () => {
  test("renders status buttons, the saved note and a disabled Save note", () => {
    const candidate = {
      review: { note: "Check", revision: 1, state: "Pending" },
    } as unknown as SpecChangeReviewCandidate;
    const html = renderToStaticMarkup(
      createElement(SpecCandidateReviewForm, {
        candidate,
        name: "Spec A",
        onMark: () => undefined,
      }),
    );
    expect(html).toContain("Review status of Spec A");
    expect(html).toContain("Note for Spec A");
    expect(html).toContain("Check");
    expect(html).toMatch(SUBMIT_DISABLED);
  });
});
