// @vitest-environment happy-dom

import type { TestReviewSession } from "@cantiara/api/test-review";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, expect, test, vi } from "vitest";
import {
  type TestReviewSignalActions,
  type TestReviewSignalData,
  TestReviewSignals,
} from "./test-review-signals";

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

function makeSession(
  id: string,
  itemId: string,
  result: string,
): TestReviewSession {
  return {
    context: null,
    executorName: id === "s1" ? "Codex" : "Claude Code",
    id,
    items: [
      {
        boundSpecs: [],
        current: { eventId: null, result, source: "Reported", usable: true },
        id: itemId,
        newContextAfterClose: false,
        normalizedResult: result,
        position: 0,
        rawResult: result,
        rawResultRedacted: false,
        reviewState: "Unreviewed",
        scenarioId: "case-1",
        scenarioVersion: 2,
        title: "Checkout",
      },
    ],
    newContextAfterClose: false,
    projectId: "p1",
    reportedAt: "2026-10-01T09:00:00.000Z",
    reporter: null,
    reviewState: "Unreviewed",
    summary: null,
    currentSummary: null,
    summaryRedacted: false,
    targetContext: null,
    withdrawn: false,
  };
}

const sessions = [
  makeSession("s1", "t1", "passed"),
  makeSession("s2", "t2", "failed"),
];

const data: TestReviewSignalData = {
  bindings: [],
  conflicts: [
    {
      members: sessions.map((session) => ({
        context: null,
        current:
          session.items[0]?.normalizedResult === "passed" ? "Passed" : "Failed",
        currentResult: session.items[0]?.normalizedResult ?? null,
        executorName: session.executorName,
        normalizedResult: session.items[0]?.normalizedResult ?? null,
        rawResult: session.items[0]?.rawResult ?? null,
        reportedAt: session.reportedAt,
        sessionId: session.id,
        sessionTestId: session.items[0]?.id ?? "",
        title: "Checkout",
      })),
      presentation: "Action Required",
      scenarioId: "case-1",
      scenarioVersion: 2,
      signalId: "test-result-conflict:case-1:2",
    },
  ],
  contextChanges: [
    {
      label: "Context changed",
      reasons: [
        {
          key: "commit",
          kind: "Technical context mismatch",
          recorded: "abc",
          target: "zzz",
        },
      ],
      sessionId: "s1",
      sessionTestId: "t1",
      title: "Checkout",
    },
  ],
  followUps: [],
  supersessions: [],
};

const WINNER_COPY = /winner is|latest wins/i;
const REPAIR_COPY = /stale|invalid|mark failed/i;

let root: Root | undefined;
let host: HTMLDivElement | undefined;

afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
});

function actionsMock() {
  return {
    bindResult: vi.fn().mockResolvedValue(undefined),
    commitFollowUp: vi.fn().mockResolvedValue(undefined),
    previewFollowUp: vi.fn().mockResolvedValue({
      fingerprint: "f".repeat(64),
      plan: {
        automaticRecords: "None",
        originatesFrom: {
          id: "s2",
          label: "Claude Code run",
          recordType: "Test Session",
        },
        originLocation: {
          id: "t2",
          recordType: "Session Test",
          sessionId: "s2",
          title: "Checkout",
        },
        results: [
          {
            currentResult: "failed",
            normalizedResult: "failed",
            rawResult: "failed",
            sessionId: "s2",
            sessionTestId: "t2",
            title: "Checkout",
          },
        ],
        target: {
          mode: "new",
          project: { id: "p1", name: "Project One" },
          work: {
            description: "d",
            startingStatus: "Not Started",
            title: "Follow up test: Checkout",
            type: "Task",
          },
        },
      },
    }),
    supersede: vi.fn().mockResolvedValue(undefined),
  } satisfies TestReviewSignalActions;
}

async function mount(actions: TestReviewSignalActions, readOnly = false) {
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  await act(() => {
    root?.render(
      <TestReviewSignals
        actions={actions}
        data={data}
        readOnly={readOnly}
        sessions={sessions}
      />,
    );
  });
}

function button(label: string) {
  const found = [...document.querySelectorAll("button")].find(
    (element) =>
      element.getAttribute("aria-label") === label ||
      element.textContent === label,
  );
  if (!found) {
    throw new Error(`No button ${label}`);
  }
  return found;
}

async function click(element: Element) {
  await act(() => {
    element.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
}

test("a conflict shows every member, picks no winner and binds only on the founder's click", async () => {
  const actions = actionsMock();
  await mount(actions);
  expect(document.body.textContent).toContain("test-result-conflict");
  expect(document.body.textContent).not.toMatch(WINNER_COPY);
  await click(button("Bind valid result: Checkout by Claude Code"));
  expect(actions.bindResult).toHaveBeenCalledWith("case-1", 2, "t2");
});

test("Context changed explains the exact difference and offers no repair action", async () => {
  await mount(actionsMock());
  expect(document.body.textContent).toContain("Context changed: Checkout");
  expect(document.body.textContent).toContain(
    "Recorded commit abc differs from target zzz",
  );
  const labels = [...document.querySelectorAll("button")].map(
    (element) => element.textContent ?? "",
  );
  expect(labels.join("|")).not.toMatch(REPAIR_COPY);
});

test("Supersedes needs two different results and shows the relation before saving", async () => {
  const actions = actionsMock();
  await mount(actions);
  const submit = button("Supersedes");
  expect((submit as HTMLButtonElement).disabled).toBe(true);
  const newer = document.querySelector<HTMLSelectElement>(
    "#test-review-supersedes-newer",
  );
  const older = document.querySelector<HTMLSelectElement>(
    "#test-review-supersedes-older",
  );
  await act(() => {
    for (const [select, value] of [
      [newer, "t1"],
      [older, "t2"],
    ] as const) {
      if (select) {
        const setter = Object.getOwnPropertyDescriptor(
          HTMLSelectElement.prototype,
          "value",
        )?.set;
        setter?.call(select, value);
        select.dispatchEvent(new Event("change", { bubbles: true }));
      }
    }
  });
  expect(document.body.textContent).toContain("Both stay in history");
  await click(button("Supersedes"));
  expect(actions.supersede).toHaveBeenCalledWith("t1", "t2");
});

test("Create follow-up work previews target, Originates from and Origin Location before committing", async () => {
  const actions = actionsMock();
  await mount(actions);
  const [, checkbox] = [...document.querySelectorAll("input[type=checkbox]")];
  await act(() => {
    checkbox?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
  await click(button("Preview: Create follow-up work"));
  expect(actions.previewFollowUp).toHaveBeenCalledWith(["t2"], {
    mode: "new",
    workType: "Task",
  });
  const text = document.body.textContent ?? "";
  expect(text).toContain("Originates from: Test Session Claude Code run");
  expect(text).toContain("Origin Location: Session Test Checkout (immutable)");
  expect(actions.commitFollowUp).not.toHaveBeenCalled();
  const heading = document.getElementById(
    "test-review-follow-up-preview-heading",
  );
  expect(document.activeElement).toBe(heading);
  await click(button("Create follow-up work"));
  expect(actions.commitFollowUp).toHaveBeenCalledTimes(1);
});

test("attaching to an existing İş accepts the visible id or key", async () => {
  const actions = actionsMock();
  await mount(actions);
  // The second mode radio is "Attach results to an existing İş".
  const [, attachRadio] = [...document.querySelectorAll('input[type="radio"]')];
  if (!attachRadio) {
    throw new Error("No attach mode radio");
  }
  await click(attachRadio);
  const text = document.body.textContent ?? "";
  expect(text).toContain("Existing İş id or key");
  expect(text).toContain("Attach results to an existing İş");
});

test("a read-only Project disables every write control", async () => {
  await mount(actionsMock(), true);
  for (const element of document.querySelectorAll("button")) {
    expect((element as HTMLButtonElement).disabled).toBe(true);
  }
});
