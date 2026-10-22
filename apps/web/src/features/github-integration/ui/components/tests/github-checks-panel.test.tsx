// @vitest-environment happy-dom

import type { GitHubChecksOverview } from "@cantiara/api/github-checks";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, expect, test } from "vitest";
import { GitHubChecksPanel } from "../github-checks-panel";

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const data: GitHubChecksOverview = {
  pullRequests: [
    {
      checks: [
        {
          actionNeeded: true,
          checkId: "102",
          detailsUrl: "https://github.com/acme/web/runs/102",
          name: "e2e",
          observedAt: "2026-10-01T09:00:00.000Z",
          outcome: "Failed",
          provider: "github-actions",
          requirement: "Required",
        },
        {
          actionNeeded: false,
          checkId: "ci/legacy",
          detailsUrl: null,
          name: "ci/legacy",
          observedAt: "2026-10-01T09:00:00.000Z",
          outcome: "Passed",
          provider: "commit-status",
          requirement: "Unknown",
        },
      ],
      headSha: "a".repeat(40),
      number: 7,
      recordId: "r1",
      rollup: {
        actionNeeded: 1,
        pending: 0,
        sourceUrl: "https://github.com/acme/web/pull/7/checks",
        total: 2,
      },
      supersededCount: 1,
      title: "Retry checkout",
    },
  ],
  readOnly: false,
};

const NO_RUN_CONTROL = /re-?run|run again|run check|log/i;

let root: Root | undefined;
let container: HTMLDivElement | undefined;

function render(value: GitHubChecksOverview) {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  act(() => root?.render(<GitHubChecksPanel data={value} />));
  return container;
}

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  root = undefined;
  container = undefined;
});

test("lists checks with Required, Unknown and Action needed and opens the source checks", () => {
  const view = render(data);
  const text = view.textContent ?? "";
  expect(text).toContain("Required");
  expect(text).toContain("Unknown");
  expect(text).toContain("Action needed");
  expect(text).toContain("github-actions 102");
  expect(text).toContain("commit-status ci/legacy");
  expect(text).toContain(
    "1 check for an earlier commit is not shown as current.",
  );
  const rollup = view.querySelector(
    'a[href="https://github.com/acme/web/pull/7/checks"]',
  );
  expect(rollup?.textContent).toBe("Open checks for #7 on GitHub");
  expect(
    view.querySelector('a[href="https://github.com/acme/web/runs/102"]')
      ?.textContent,
  ).toBe("e2e");
});

test("is read-only: no button, no run or re-run control", () => {
  const view = render(data);
  expect(view.querySelectorAll("button, input, select, form")).toHaveLength(0);
  expect(view.textContent).not.toMatch(NO_RUN_CONTROL);
  expect(view.querySelector("section[aria-labelledby]")).not.toBeNull();
  expect(view.querySelector("ul[aria-labelledby]")).not.toBeNull();
});

test("renders nothing without an open Pull request", () => {
  const view = render({ pullRequests: [], readOnly: false });
  expect(view.innerHTML).toBe("");
});
