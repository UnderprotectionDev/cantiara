// @vitest-environment happy-dom

import type {
  TestResultEvent,
  TestReviewSession,
} from "@cantiara/api/test-review";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, expect, type Mock, test, vi } from "vitest";
import { type TestReviewActions, TestReviewView } from "../test-review-view";

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const session: TestReviewSession = {
  executorName: "Codex",
  id: "s1",
  items: [
    {
      current: {
        eventId: null,
        result: "Failed",
        source: "Reported",
        usable: true,
      },
      id: "t1",
      newContextAfterClose: false,
      normalizedResult: "Failed",
      position: 0,
      rawResult: "FAIL",
      rawResultRedacted: false,
      reviewState: "Unreviewed",
      boundSpecs: [],
      scenarioId: null,
      scenarioVersion: null,
      title: "Login works",
    },
    {
      current: {
        eventId: null,
        result: "Passed",
        source: "Reported",
        usable: true,
      },
      id: "t2",
      newContextAfterClose: false,
      normalizedResult: "Passed",
      position: 1,
      rawResult: "pass",
      rawResultRedacted: false,
      reviewState: "Follow-up needed",
      boundSpecs: [],
      scenarioId: null,
      scenarioVersion: null,
      title: "Logout works",
    },
  ],
  context: null,
  targetContext: null,
  currentSummary: null,
  newContextAfterClose: false,
  projectId: "p1",
  reportedAt: "2026-10-01T09:00:00.000Z",
  reporter: null,
  reviewState: "Unreviewed",
  summary: "Checkout run",
  summaryRedacted: false,
  withdrawn: false,
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
    recordEvent: vi.fn().mockResolvedValue(undefined),
    setItem: vi.fn().mockResolvedValue(undefined),
    setSession: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  } satisfies TestReviewActions;
}

async function mount(
  actions: TestReviewActions,
  props: {
    readOnly?: boolean;
    resultEvents?: TestResultEvent[];
    session?: TestReviewSession;
  } = {},
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
        resultEvents={props.resultEvents ?? []}
        sessions={[props.session ?? session]}
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

function typeInto(element: HTMLElement | null, value: string) {
  const setter = Object.getOwnPropertyDescriptor(
    element instanceof HTMLSelectElement
      ? HTMLSelectElement.prototype
      : HTMLTextAreaElement.prototype,
    "value",
  )?.set;
  act(() => {
    setter?.call(element, value);
    element?.dispatchEvent(
      new Event(element instanceof HTMLSelectElement ? "change" : "input", {
        bubbles: true,
      }),
    );
  });
}

test("a Correction needs a result and a reason and sends only the new event", async () => {
  const actions = actionsMock();
  await mount(actions);
  await click(byLabel("Correction for Login works"));
  expect(document.body.textContent).toContain(
    "The original report is not edited or deleted.",
  );
  const record = byText("Record Correction");
  expect(record.disabled).toBe(true);
  typeInto(document.getElementById("test-review-event-result"), "passed");
  expect(byText("Record Correction").disabled).toBe(true);
  typeInto(document.getElementById("test-review-event-reason"), "Wrong build.");
  expect(byText("Record Correction").disabled).toBe(false);
  await click(byText("Record Correction"));
  expect(actions.recordEvent).toHaveBeenCalledWith(
    "s1",
    expect.objectContaining({
      correctedResult: "passed",
      kind: "Correction",
      reason: "Wrong build.",
      sessionTestId: "t1",
    }),
  );
  expect(actions.setItem).not.toHaveBeenCalled();
  expect(actions.setSession).not.toHaveBeenCalled();
});

test("shows the current Correction, the chain and the New context after close signal", async () => {
  const corrected: TestReviewSession = {
    ...session,
    items: [
      {
        ...(session.items[0] as TestReviewSession["items"][number]),
        current: {
          eventId: "e1",
          result: "passed",
          source: "Correction",
          usable: true,
        },
        newContextAfterClose: true,
        reviewState: "Closed",
      },
    ],
    newContextAfterClose: true,
    reviewState: "Closed",
  };
  const event: TestResultEvent = {
    actorAccountId: "account-1",
    correctedResult: "passed",
    id: "e1",
    kind: "Correction",
    note: null,
    previousEventId: null,
    reason: "Wrong build.",
    recordedAt: "2026-10-02T09:00:00.000Z",
    redacted: false,
    redactedEventId: null,
    redactedField: null,
    sessionId: "s1",
    sessionTestId: "t1",
  };
  await mount(actionsMock(), { resultEvents: [event], session: corrected });
  const text = document.body.textContent ?? "";
  expect(text).toContain("Current result: Passed (Correction)");
  expect(text).toContain("Reported: Failed (FAIL)");
  expect(text).toContain("Reason: Wrong build.");
  expect(text.split("New context after close")).toHaveLength(3);
  expect(text).toContain("Session review state: Closed");
});

test("a redacted value shows the mark and is not usable evidence", async () => {
  const redacted: TestReviewSession = {
    ...session,
    items: [
      {
        ...(session.items[0] as TestReviewSession["items"][number]),
        current: {
          eventId: null,
          result: "Failed",
          source: "Reported",
          usable: false,
        },
        rawResult: null,
        rawResultRedacted: true,
      },
    ],
  };
  const mark: TestResultEvent = {
    actorAccountId: "account-1",
    correctedResult: null,
    id: "r1",
    kind: "Redaction",
    note: null,
    previousEventId: null,
    reason: "Token pasted.",
    recordedAt: "2026-10-02T09:00:00.000Z",
    redacted: false,
    redactedEventId: null,
    redactedField: "Reported result",
    sessionId: "s1",
    sessionTestId: "t1",
  };
  await mount(actionsMock(), { resultEvents: [mark], session: redacted });
  const text = document.body.textContent ?? "";
  expect(text).toContain("(value redacted)");
  expect(text).toContain("Not usable as current evidence or export.");
  expect(text).toContain("Reason: Token pasted.");
  expect(text).not.toContain("FAIL)");
  expect(byLabel("Redact reported result of Login works").disabled).toBe(true);
});

test("a session Correction promotes the corrected summary and keeps the original", async () => {
  await mount(actionsMock(), {
    session: {
      ...session,
      summary: "Checkout run",
      currentSummary: "Checkout run against the fixed build.",
    },
  });
  const text = document.body.textContent ?? "";
  expect(text).toContain("Checkout run against the fixed build.");
  expect(text).toContain("Reported summary: Checkout run");
});
