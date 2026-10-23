// @vitest-environment happy-dom

import type { GitHubPrContextOverview } from "@cantiara/api/github-pr-context";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, expect, test, vi } from "vitest";
import {
  GitHubPrContextCards,
  prContextRecordHref,
} from "../github-pr-context-card";

vi.mock("@/components/app-link", () => ({
  AppLink: ({ href, ...props }: { href: string } & Record<string, unknown>) => (
    <a {...props} href={href} />
  ),
}));

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const work = { id: "w1", key: "CAN-1", title: "Checkout retry" };
const record = (
  recordType: "Decision" | "Feedback" | "Project Release" | "Risk",
  recordId: string,
  title: string,
  state: string | null,
) => ({ recordId, recordType, state, title, viaWorkKeys: ["CAN-1"] });

const data: GitHubPrContextOverview = {
  cards: [
    {
      checks: {
        checks: [],
        headSha: "a".repeat(40),
        number: 7,
        recordId: "r1",
        rollup: {
          actionNeeded: 1,
          pending: 0,
          sourceUrl: "https://github.com/acme/web/pull/7/checks",
          total: 2,
        },
        supersededCount: 0,
        title: "Retry checkout",
      },
      decisions: [record("Decision", "d1", "Retry once", "Valid")],
      expectedOutcomes: [{ text: "A failed payment retries.", work }],
      feedback: [record("Feedback", "f1", "Lost cart", "New")],
      htmlUrl: "https://github.com/acme/web/pull/7",
      number: 7,
      openRisks: [record("Risk", "k1", "Double charge", "Open")],
      problemSources: [{ text: "Checkout drops.", work }],
      recordId: "r1",
      reviewers: [
        { login: "ali", reviewUrl: null, state: "Approved" },
        { login: "dana", reviewUrl: null, state: "Pending" },
      ],
      roles: [{ linkId: "l1", role: "Required for completion", work }],
      sourceState: "open",
      targetReleases: [record("Project Release", "p1", "1.4.0", "Draft")],
      title: "Retry checkout",
    },
  ],
  readOnly: false,
};

const WRITE_CONTROL =
  /^(approve|merge|request changes|close work|complete work|mark ready)/i;

let root: Root | undefined;
let container: HTMLDivElement | undefined;

function render(value: GitHubPrContextOverview) {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  act(() =>
    root?.render(<GitHubPrContextCards data={value} projectId="proj-1" />),
  );
  return container;
}

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  root = undefined;
  container = undefined;
});

test("shows the PR Context Card with every row and opens each source record", () => {
  const view = render(data);
  const text = view.textContent ?? "";
  expect(text).toContain("PR Context Card");
  expect(text).toContain("Required for completion");
  expect(text).toContain("Checkout drops.");
  expect(text).toContain("A failed payment retries.");
  expect(text).toContain("1 Action needed");
  expect(text).toContain("ali: Approved");
  expect(text).toContain("dana: Pending");
  const hrefs = [...view.querySelectorAll("a")].map((a) =>
    a.getAttribute("href"),
  );
  expect(hrefs).toContain("/projects/proj-1#work-w1");
  expect(hrefs).toContain("/projects/proj-1#source-decision-d1");
  expect(hrefs).toContain("/projects/proj-1#source-risk-k1");
  expect(hrefs).toContain("/projects/proj-1#source-project-release-p1");
  expect(hrefs).toContain("/projects/proj-1#project-area-discovery");
  expect(hrefs).toContain("https://github.com/acme/web/pull/7");
  expect(hrefs).toContain("https://github.com/acme/web/pull/7/checks");
});

test("is read-only: no button, form or input, and no review, approve or merge control", () => {
  const view = render(data);
  expect(
    view.querySelectorAll("button, input, select, textarea, form"),
  ).toHaveLength(0);
  for (const link of view.querySelectorAll("a")) {
    expect(link.textContent).not.toMatch(WRITE_CONTROL);
  }
  expect(view.querySelector("section[aria-labelledby]")).not.toBeNull();
});

test("shows no reviewer row when GitHub supplied no reviewer data", () => {
  const [card] = data.cards;
  if (!card) {
    throw new Error("No card");
  }
  const view = render({ cards: [{ ...card, reviewers: [] }], readOnly: false });
  expect(view.textContent).not.toContain("Reviewers");
});

test("renders nothing without a linked Pull request", () => {
  expect(render({ cards: [], readOnly: false }).innerHTML).toBe("");
});

test("a Feedback record opens the Discovery area, others open their owner hash", () => {
  expect(
    prContextRecordHref("p", { recordId: "f", recordType: "Feedback" }),
  ).toBe("/projects/p#project-area-discovery");
  expect(
    prContextRecordHref("p", { recordId: "d", recordType: "Decision" }),
  ).toBe("/projects/p#source-decision-d");
});
