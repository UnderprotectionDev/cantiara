// @vitest-environment happy-dom

import type {
  PlannedTestCaseRecord,
  PlannedTestCaseVersionRecord,
  SessionTestRecord,
  TestHandoffRecord,
} from "@cantiara/api/planned-tests";
import { TEST_HANDOFF_TRANSITIONS } from "@cantiara/api/planned-tests";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, expect, test, vi } from "vitest";
import { TestHandoffsView } from "./test-handoffs-view";

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const RUNNER_WORDS = /\b(run|start|poll|schedule|dispatch|execute|deliver)\b/i;
const OUTCOME_WORDS = /\b(validated|passed|failed)\b/i;

const timestamp = "2026-10-01T09:00:00.000Z";

function version(number: number): PlannedTestCaseVersionRecord {
  return {
    caseId: "c1",
    changeKind: number === 1 ? "Initial version" : "Meaningful change",
    createdAt: timestamp,
    expectedBehavior: "The order is confirmed.",
    id: `v${number}`,
    notes: null,
    preconditions: "A signed-in customer.",
    purpose: "Confirm checkout completes.",
    relations: [],
    scope: "Card payment only.",
    title: "Checkout with a saved card",
    version: number,
  };
}

const versions = [version(1), version(2)];
const planned: PlannedTestCaseRecord = {
  createdAt: timestamp,
  current: versions[1] as PlannedTestCaseVersionRecord,
  id: "c1",
  projectId: "p1",
  updatedAt: timestamp,
  versions,
};

const arrived: SessionTestRecord = {
  bind: {
    caseId: "c1",
    changesSinceBound: [{ changeKind: "Meaningful change", version: 2 }],
    currentVersion: 2,
    executedVersion: 1,
    linkedAt: null,
    origin: "Bound when recorded",
    pinnedTitle: "Checkout with a saved card",
    pinnedVersion: 1,
    summary: "Bound to v1, current v2",
    validatesCurrentVersion: false,
  },
  createdAt: timestamp,
  expectedBehavior: null,
  id: "s1",
  projectId: "p1",
  purpose: null,
  title: "Pay with the saved card",
};

const waiting: SessionTestRecord = {
  ...arrived,
  bind: null,
  expectedBehavior: "Tax is shown.",
  id: "s2",
  purpose: "Check tax display.",
  title: "Tax line",
};

function handoff(
  overrides: Partial<TestHandoffRecord> = {},
): TestHandoffRecord {
  const state = overrides.state ?? "Draft";
  return {
    allowedTransitions: [...TEST_HANDOFF_TRANSITIONS[state]],
    buildContext: {
      branch: "main",
      build: null,
      commit: null,
      repository: null,
      targetEnvironment: "staging",
    },
    createdAt: timestamp,
    dueDate: "2026-11-02",
    editable: state === "Draft" || state === "Ready to share",
    id: "h1",
    packageVersion: 0,
    projectId: "p1",
    purpose: "Check checkout on staging.",
    resultAfterCancel: false,
    scenarios: [
      {
        caseId: "c1",
        currentVersion: 2,
        summary: "Pinned to v1, current v2",
        title: "Checkout with a saved card",
        version: 1,
      },
    ],
    sessionTests: [],
    state,
    stateChangedAt: timestamp,
    suggestion: null,
    targetExecutor: "Codex",
    title: "Checkout round 1",
    updatedAt: timestamp,
    ...overrides,
  };
}

let root: Root | undefined;
let host: HTMLDivElement | undefined;

afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
});

function mount(props: Partial<Parameters<typeof TestHandoffsView>[0]> = {}) {
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  act(() => {
    root?.render(
      <TestHandoffsView
        cases={[planned]}
        handoffs={[handoff()]}
        onCreate={vi.fn().mockResolvedValue(undefined)}
        onLink={vi.fn().mockResolvedValue(undefined)}
        onTransition={vi.fn().mockResolvedValue(undefined)}
        onUpdate={vi.fn().mockResolvedValue(undefined)}
        readOnly={false}
        sessionTests={[arrived, waiting]}
        {...props}
      />,
    );
  });
}

function control(id: string) {
  const found = document.getElementById(id) as
    | HTMLInputElement
    | HTMLSelectElement
    | HTMLTextAreaElement
    | null;
  if (!found) {
    throw new Error(`No control ${id}`);
  }
  return found;
}

function setValue(id: string, value: string) {
  const target = control(id);
  const setter = Object.getOwnPropertyDescriptor(
    Object.getPrototypeOf(target),
    "value",
  )?.set;
  act(() => {
    setter?.call(target, value);
    target.dispatchEvent(
      new Event(target instanceof HTMLSelectElement ? "change" : "input", {
        bubbles: true,
      }),
    );
  });
}

function button(name: string) {
  const found = [...document.querySelectorAll("button")].find(
    (item) => item.textContent === name,
  );
  if (!found) {
    throw new Error(`No button ${name}`);
  }
  return found;
}

async function submit(formLabel: string) {
  const form = document.querySelector(`form[aria-label="${formLabel}"]`);
  if (!form) {
    throw new Error(`No ${formLabel} form`);
  }
  await act(async () => {
    form.dispatchEvent(
      new Event("submit", { bubbles: true, cancelable: true }),
    );
    await Promise.resolve();
  });
}

test("shows the process state label, exact pinned version and no result word", () => {
  mount();

  const text = document.body.textContent ?? "";
  expect(text).toContain("State: Draft");
  expect(text).toContain("Pinned to v1, current v2");
  expect(text).toContain("Target executor");
  expect(text).toContain("staging");
  expect(text).toContain("No package produced yet");
  expect(text).not.toMatch(OUTCOME_WORDS);
});

test("offers only the allowed state moves as explicit Mark as buttons", () => {
  mount({ handoffs: [handoff({ state: "Ready to share" })] });

  const marks = [...document.querySelectorAll("button")]
    .map((item) => item.textContent)
    .filter((name) => name?.startsWith("Mark as"));
  expect(marks).toEqual([
    "Mark as Draft",
    "Mark as Shared",
    "Mark as Canceled",
  ]);
});

test("a final Handoff offers no state move and no edit", () => {
  mount({ handoffs: [handoff({ state: "Canceled" })] });

  const names = [...document.querySelectorAll("button")].map(
    (item) => item.textContent,
  );
  expect(names.filter((name) => name?.startsWith("Mark as"))).toEqual([]);
  expect(names.some((name) => name?.startsWith("Edit"))).toBe(false);
});

test("a linked Session Test shows a suggestion and the Handoff does not move by itself", async () => {
  const onTransition = vi.fn().mockResolvedValue(undefined);
  const shared = handoff({
    sessionTests: [arrived],
    state: "Shared",
    suggestion: {
      reason:
        "1 linked Session Test arrived. Mark Result received when you have read them; the Test Handoff stays open until you close it.",
      state: "Result received",
    },
  });
  mount({ handoffs: [shared], onTransition });

  expect(document.querySelector('[role="status"]')?.textContent).toContain(
    "stays open until you close it",
  );
  expect(document.body.textContent).toContain("State: Shared");
  expect(onTransition).not.toHaveBeenCalled();

  await act(async () => {
    button("Mark as Result received").click();
    await Promise.resolve();
  });
  expect(onTransition).toHaveBeenCalledWith(shared, "Result received");
});

test("shows a refused move without changing the displayed state", async () => {
  const onTransition = vi
    .fn()
    .mockRejectedValue(new Error("Reload and try again."));
  mount({ onTransition });

  await act(async () => {
    button("Mark as Ready to share").click();
    await Promise.resolve();
  });

  expect(document.querySelector('[role="alert"]')?.textContent).toBe(
    "Reload and try again.",
  );
  expect(document.body.textContent).toContain("State: Draft");
});

test("a late result on a Canceled Handoff is a notice, not a reopening", () => {
  mount({
    handoffs: [
      handoff({
        resultAfterCancel: true,
        sessionTests: [arrived],
        state: "Canceled",
      }),
    ],
  });

  expect(document.body.textContent).toContain(
    "Result arrived after cancel. The Test Handoff stays Canceled.",
  );
});

test("links only a Session Test the Handoff can accept", async () => {
  const onLink = vi.fn().mockResolvedValue(undefined);
  mount({ onLink });

  const options = [
    ...control("test-handoff-h1-link").querySelectorAll("option"),
  ].map((item) => item.textContent);
  // The ad hoc test and the test bound to the selected v1 are candidates.
  expect(options).toEqual([
    "Choose a Session Test",
    "Pay with the saved card",
    "Tax line",
  ]);

  setValue("test-handoff-h1-link", "s2");
  await submit("Link Session Test to Checkout round 1");
  expect(onLink).toHaveBeenCalledWith(
    expect.objectContaining({ id: "h1" }),
    "s2",
  );
});

test("does not offer a Session Test bound to a version the Handoff did not select", () => {
  const stray: SessionTestRecord = {
    ...arrived,
    bind: arrived.bind && { ...arrived.bind, pinnedVersion: 2 },
    id: "s3",
    title: "Checkout on v2",
  };
  mount({ sessionTests: [stray] });

  expect(document.getElementById("test-handoff-h1-link")).toBeNull();
});

test("creates a Handoff from exact chosen versions with free-text executor", async () => {
  const onCreate = vi.fn().mockResolvedValue(undefined);
  mount({ handoffs: [], onCreate });

  setValue("test-handoff-new-title", "Round 2");
  setValue("test-handoff-new-purpose", "Re-check.");
  setValue("test-handoff-new-executor", "My own scanner");
  setValue("test-handoff-new-environment", "staging");
  act(() => control("test-handoff-new-case-c1").click());
  setValue("test-handoff-new-version-c1", "1");
  await submit("Create Test Handoff");

  expect(onCreate).toHaveBeenCalledWith(
    expect.objectContaining({
      purpose: "Re-check.",
      selected: { c1: 1 },
      targetEnvironment: "staging",
      targetExecutor: "My own scanner",
      title: "Round 2",
    }),
  );
});

test("every control has a programmatic label and no runner control exists", () => {
  mount();

  const controls = [...document.querySelectorAll("input, textarea, select")];
  expect(controls.length).toBeGreaterThan(0);
  for (const item of controls) {
    expect(document.querySelector(`label[for="${item.id}"]`)).not.toBeNull();
  }
  for (const item of document.querySelectorAll("button")) {
    expect(item.textContent).not.toMatch(RUNNER_WORDS);
  }
});

test("an archived Project offers no create, move, link or edit control", () => {
  mount({ readOnly: true });

  expect(document.querySelectorAll("form")).toHaveLength(0);
  expect(document.querySelectorAll("button")).toHaveLength(0);
  expect(document.body.textContent).toContain("State: Draft");
});
