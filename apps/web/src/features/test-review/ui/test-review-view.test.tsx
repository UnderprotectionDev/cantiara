// @vitest-environment happy-dom

import type { TestReviewSession } from "@cantiara/api/test-review";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, expect, type Mock, test, vi } from "vitest";
import { type TestReviewActions, TestReviewView } from "./test-review-view";

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const session: TestReviewSession = {
  executorName: "Codex",
  id: "s1",
  items: [
    {
      id: "t1",
      normalizedResult: "Failed",
      position: 0,
      rawResult: "FAIL",
      reviewState: "Unreviewed",
      title: "Login works",
    },
    {
      id: "t2",
      normalizedResult: "Passed",
      position: 1,
      rawResult: "pass",
      reviewState: "Follow-up needed",
      title: "Logout works",
    },
  ],
  projectId: "p1",
  reportedAt: "2026-10-01T09:00:00.000Z",
  reviewState: "Unreviewed",
  summary: "Checkout run",
};

const FORBIDDEN_CONTROL = /archive|trash|delete|release|publish|gate/i;

let root: Root | undefined;
let host: HTMLDivElement | undefined;

afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
});

function actionsMock(overrides: Partial<TestReviewActions> = {}) {
  return {
    commitBulk: vi.fn().mockResolvedValue(undefined),
    previewBulk: vi.fn().mockResolvedValue({
      changes: [
        {
          from: "Unreviewed",
          id: "s1",
          kind: "Test Session",
          label: "Checkout run",
        },
        {
          from: "Unreviewed",
          id: "t1",
          kind: "Session Test",
          label: "Login works",
        },
      ],
      unchanged: [],
    }),
    previewClose: vi.fn().mockResolvedValue({
      remaining: [
        { id: "t1", state: "Unreviewed", title: "Login works" },
        { id: "t2", state: "Follow-up needed", title: "Logout works" },
      ],
      sessionState: "Unreviewed",
    }),
    setItem: vi.fn().mockResolvedValue(undefined),
    setSession: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  } satisfies TestReviewActions;
}

async function mount(
  actions: TestReviewActions,
  props: { readOnly?: boolean } = {},
) {
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  await act(() => {
    root?.render(
      <TestReviewView
        actions={actions}
        events={[]}
        readOnly={props.readOnly ?? false}
        sessions={[session]}
      />,
    );
  });
}

function byLabel(label: string) {
  const found = [...document.querySelectorAll("button, input")].find(
    (element) => element.getAttribute("aria-label") === label,
  );
  if (!found) {
    throw new Error(`No control ${label}`);
  }
  return found as HTMLButtonElement | HTMLInputElement;
}

function byText(text: string) {
  const found = [...document.querySelectorAll("button")].find(
    (button) => button.textContent === text,
  );
  if (!found) {
    throw new Error(`No button ${text}`);
  }
  return found;
}

async function click(element: Element) {
  await act(() => {
    element.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
}

test("shows the four-state vocabulary and each state separately", async () => {
  await mount(actionsMock());
  const text = document.body.textContent ?? "";
  expect(text).toContain("Test Review");
  expect(text).toContain("Session review state: Unreviewed");
  expect(byLabel("Review Login works: Reviewed")).toBeTruthy();
  expect(byLabel("Review Logout works: Follow-up needed")).toBeTruthy();
  expect(
    byLabel("Review Logout works: Follow-up needed").getAttribute(
      "aria-pressed",
    ),
  ).toBe("true");
  expect(text).toContain("Reported: Failed (FAIL)");
});

test("an item review sends only the item and the session is not touched", async () => {
  const actions = actionsMock();
  await mount(actions);
  await click(byLabel("Review Login works: Closed"));
  expect(actions.setItem).toHaveBeenCalledWith("s1", "t1", "Closed");
  expect(actions.setSession).not.toHaveBeenCalled();
});

test("closing previews the remaining records and keeps the optional reason", async () => {
  const actions = actionsMock();
  await mount(actions);
  await click(byLabel("Session review: Closed"));
  expect(actions.previewClose).toHaveBeenCalledWith("s1");
  const list = document.querySelector('[aria-label="Remaining Session Tests"]');
  expect(list?.textContent).toContain("Login works: Unreviewed");
  expect(list?.textContent).toContain("Logout works: Follow-up needed");
  expect(actions.setSession).not.toHaveBeenCalled();
  const reason = document.getElementById(
    "test-review-close-reason",
  ) as HTMLTextAreaElement;
  const setter = Object.getOwnPropertyDescriptor(
    HTMLTextAreaElement.prototype,
    "value",
  )?.set;
  act(() => {
    setter?.call(reason, "Rest next run.");
    reason.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await click(byText("Close Test Session"));
  expect(actions.setSession).toHaveBeenCalledWith(
    "s1",
    "Closed",
    "Rest next run.",
  );
});

test("the bulk action previews first and commits only after Apply review", async () => {
  const actions = actionsMock();
  await mount(actions);
  await click(byLabel("Select Login works"));
  await click(byText("Mark session and selected results as reviewed"));
  expect(actions.previewBulk).toHaveBeenCalledWith("s1", ["t1"]);
  expect(actions.commitBulk).not.toHaveBeenCalled();
  const records = document.querySelector('[aria-label="Records to change"]');
  expect(records?.textContent).toContain("Session Test Login works");
  await click(byText("Apply review"));
  expect(actions.commitBulk).toHaveBeenCalledTimes(1);
  expect((actions.commitBulk as Mock).mock.calls[0]?.slice(0, 2)).toEqual([
    "s1",
    ["t1"],
  ]);
});

test("a failed commit shows an alert and nothing is claimed as saved", async () => {
  const actions = actionsMock({
    commitBulk: vi.fn().mockRejectedValue(new Error("Preview again.")),
  });
  await mount(actions);
  await click(byText("Mark session and selected results as reviewed"));
  await click(byText("Apply review"));
  expect(document.querySelector('[role="alert"]')?.textContent).toBe(
    "Preview again.",
  );
  expect(document.querySelector('[role="status"]')).toBeNull();
});

test("offers no archive, Trash, delete or release control for a Session Test", async () => {
  await mount(actionsMock());
  const labels = [...document.querySelectorAll("button")]
    .map((button) => button.getAttribute("aria-label") ?? button.textContent)
    .join(" ");
  expect(labels).not.toMatch(FORBIDDEN_CONTROL);
});

test("a read-only Project disables every review control", async () => {
  await mount(actionsMock(), { readOnly: true });
  for (const control of document.querySelectorAll("button, input")) {
    expect((control as HTMLButtonElement).disabled).toBe(true);
  }
});
