// @vitest-environment happy-dom

import type { TestSummary } from "@cantiara/api/test-review-summary";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, expect, test } from "vitest";
import { summaryRecordHref, TestSummaryView } from "./test-summary-view";

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const failed = {
  detail: "Unreviewed · Failed",
  id: "t1",
  kind: "Session Test",
  label: "Refund",
  provenance: {
    context: { branch: "feature/refund" },
    currentResult: "failed",
    executorName: "Codex",
    normalizedResult: "failed",
    rawResult: "FAIL 500",
    reportedAt: "2026-10-02T09:00:00.000Z",
    reporter: "User",
    reviewState: "Unreviewed",
    sessionId: "s1",
  },
} as const;

const summary: TestSummary = {
  attention: [
    {
      filters: [{ label: "Current result", value: "Failed" }],
      key: "failed-results",
      label: "Failed results",
      records: [failed],
    },
  ],
  scope: { id: "f1", kind: "Feature", label: "Checkout" },
  sections: [
    {
      filters: [{ label: "Scope", value: "Feature: Checkout" }],
      key: "session-tests",
      label: "Session Tests",
      records: [failed],
    },
    {
      filters: [{ label: "Scope", value: "Feature: Checkout" }],
      key: "handoffs",
      label: "Test Handoffs",
      records: [],
    },
  ],
};

const PERCENT = /\b\d+\s?%/;

let root: Root | null = null;
let host: HTMLElement | null = null;

afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
  root = null;
  host = null;
});

function render(value: TestSummary) {
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  act(() => root?.render(<TestSummaryView projectId="p1" summary={value} />));
  return host;
}

function press(container: HTMLElement, name: string) {
  const button = [...container.querySelectorAll("button")].find((entry) =>
    (entry.textContent ?? "").includes(name),
  );
  if (!button) {
    throw new Error(`No button ${name}`);
  }
  act(() => button.click());
  return button;
}

test("each count is a keyboard-reachable button that opens exactly its records", () => {
  const view = render(summary);
  const button = [...view.querySelectorAll("button")].find((entry) =>
    (entry.textContent ?? "").includes("Session Tests"),
  );
  expect(button?.textContent).toContain("1");
  expect(button?.getAttribute("aria-expanded")).toBe("false");
  expect(view.textContent).not.toContain("FAIL 500");
  press(view, "Session Tests");
  expect(button?.getAttribute("aria-expanded")).toBe("true");
  const region = view.querySelector("section[aria-label$='records']");
  expect(region?.getAttribute("aria-label")).toBe("Session Tests records");
  expect(region?.textContent).toContain("Filters: Scope: Feature: Checkout");
  expect(region?.querySelectorAll("li")).toHaveLength(1);
  expect(region?.querySelector("a")?.getAttribute("href")).toBe(
    "/projects/p1#test-session-s1",
  );
});

test("keeps raw and normalized results, source session, executor, reporter, time and context", () => {
  const view = render(summary);
  press(view, "Session Tests");
  const text = view.textContent ?? "";
  for (const expected of [
    "FAIL 500",
    "Codex",
    "User",
    "2026-10-02T09:00:00.000Z",
    "branch: feature/refund",
    "Open Test Session",
  ]) {
    expect(text).toContain(expected);
  }
});

test("a count of zero opens an empty set instead of inventing records", () => {
  const view = render(summary);
  press(view, "Test Handoffs");
  expect(view.textContent).toContain("No records.");
});

test("shows neutral attention with no score, verdict, coverage or gate", () => {
  const view = render(summary);
  const text = view.textContent ?? "";
  expect(text).toContain("Attention");
  expect(text).toContain("Failed results");
  expect(text).toContain(
    "GitHub checks are external facts. They are not Test Sessions",
  );
  expect(text).not.toMatch(PERCENT);
  expect(view.querySelector("[role=progressbar], meter, progress")).toBeNull();
  expect(text).toContain("not a score");
});

test("opens owner records by kind", () => {
  expect(summaryRecordHref("p1", { id: "g1", kind: "Test Gap" })).toBe(
    "/projects/p1#source-test-gap-g1",
  );
  expect(summaryRecordHref("p1", { id: "w1", kind: "Follow-up Work" })).toBe(
    "/projects/p1#work-w1",
  );
  expect(summaryRecordHref("p1", { id: "a1", kind: "Test Assessment" })).toBe(
    "/projects/p1#test-assessment-a1",
  );
  expect(summaryRecordHref("p1", { id: "r1", kind: "Project Release" })).toBe(
    "/projects/p1#source-project-release-r1",
  );
});

test("the Tests overview names its sections and is not a phase or CI dashboard", () => {
  const view = render({
    attention: [],
    scope: { id: null, kind: "Project", label: "Project One" },
    sections: [
      {
        filters: [{ label: "Review state", value: "Unreviewed" }],
        key: "unreviewed-reports",
        label: "Unreviewed reports",
        records: [],
      },
    ],
  });
  expect(view.querySelector("h3")?.textContent).toBe("Tests overview");
  expect(view.textContent).toContain("not a phase or a CI dashboard");
  expect(view.textContent).not.toContain("Attention");
});

test("drill-down is keyboard and screen-reader operable with native controls", () => {
  const view = render(summary);
  const controls = [...view.querySelectorAll("button")];
  expect(controls.length).toBe(
    summary.sections.length + summary.attention.length,
  );
  for (const control of controls) {
    expect(control.getAttribute("type")).toBe("button");
    expect(control.hasAttribute("tabindex")).toBe(false);
    expect(control.getAttribute("aria-controls")).toBeTruthy();
    expect(control.getAttribute("aria-expanded")).toBe("false");
  }
  const lists = [...view.querySelectorAll("ul[aria-label]")].map((list) =>
    list.getAttribute("aria-label"),
  );
  expect(lists).toEqual(["Test Summary", "Attention"]);
  expect(view.querySelector("section")?.getAttribute("aria-labelledby")).toBe(
    view.querySelector("h3")?.id,
  );
});
