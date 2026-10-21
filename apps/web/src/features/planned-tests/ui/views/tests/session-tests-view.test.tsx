// @vitest-environment happy-dom

import type {
  PlannedTestCaseRecord,
  PlannedTestCaseVersionRecord,
  SessionTestRecord,
} from "@cantiara/api/planned-tests";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, expect, test, vi } from "vitest";
import { SessionTestsView } from "../session-tests-view";

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const OUTCOME_WORDS = /validated|passed|failed/i;

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

const versions = [version(1), version(2), version(3)];
const planned: PlannedTestCaseRecord = {
  createdAt: timestamp,
  current: versions[2] as PlannedTestCaseVersionRecord,
  id: "c1",
  projectId: "p1",
  updatedAt: timestamp,
  versions,
};

const boundTest: SessionTestRecord = {
  bind: {
    caseId: "c1",
    changesSinceBound: [
      { changeKind: "Editorial change", version: 2 },
      { changeKind: "Meaningful change", version: 3 },
    ],
    currentVersion: 3,
    executedVersion: 1,
    linkedAt: null,
    origin: "Bound when recorded",
    pinnedTitle: "Checkout with a saved card",
    pinnedVersion: 1,
    summary: "Bound to v1, current v3",
    validatesCurrentVersion: false,
  },
  createdAt: timestamp,
  expectedBehavior: null,
  id: "s1",
  projectId: "p1",
  purpose: null,
  title: "Pay with the saved card",
};

const adHocTest: SessionTestRecord = {
  bind: null,
  createdAt: timestamp,
  expectedBehavior: "Tax is shown.",
  id: "s2",
  projectId: "p1",
  purpose: "Check tax display.",
  title: "Tax line",
};

let root: Root | undefined;
let host: HTMLDivElement | undefined;

afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
});

function mount(props: Partial<Parameters<typeof SessionTestsView>[0]> = {}) {
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  act(() => {
    root?.render(
      <SessionTestsView
        cases={[planned]}
        onLink={vi.fn().mockResolvedValue(undefined)}
        onRecord={vi.fn().mockResolvedValue(undefined)}
        readOnly={false}
        sessionTests={[boundTest, adHocTest]}
        {...props}
      />,
    );
  });
}

function setValue(id: string, value: string) {
  const control = document.getElementById(id) as
    | HTMLInputElement
    | HTMLSelectElement
    | HTMLTextAreaElement
    | null;
  if (!control) {
    throw new Error(`No control ${id}`);
  }
  const prototype = Object.getPrototypeOf(control);
  const setter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;
  act(() => {
    setter?.call(control, value);
    control.dispatchEvent(
      new Event(control instanceof HTMLSelectElement ? "change" : "input", {
        bubbles: true,
      }),
    );
  });
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

test("shows the explicit version difference and never a validated state", () => {
  mount();

  const text = document.body.textContent ?? "";
  expect(text).toContain("Bound to v1, current v3");
  expect(text).toContain("Version 2: Editorial change");
  expect(text).toContain("Version 3: Meaningful change");
  expect(text).not.toMatch(OUTCOME_WORDS);
});

test("an ad hoc test shows what was recorded and offers a one-way link", () => {
  mount();

  const text = document.body.textContent ?? "";
  expect(text).toContain("Check tax display.");
  expect(text).toContain("Tax is shown.");
  expect(document.getElementById("session-test-s2-link")).not.toBeNull();
  expect(document.getElementById("session-test-s1-link")).toBeNull();
});

test("every control has a programmatic label and no result or run control exists", () => {
  mount();

  const controls = [...document.querySelectorAll("input, textarea, select")];
  expect(controls.length).toBeGreaterThan(0);
  for (const control of controls) {
    expect(document.querySelector(`label[for="${control.id}"]`)).not.toBeNull();
  }
  const buttons = [...document.querySelectorAll("button")].map(
    (item) => item.textContent,
  );
  expect(buttons).toEqual(["Record Session Test", "Link"]);
});

test("records an ad hoc test with its own content and a bound test without it", async () => {
  const onRecord = vi.fn().mockResolvedValue(undefined);
  mount({ onRecord });

  setValue("session-test-new-title", "Tax line");
  setValue("session-test-new-purpose", "Check tax display.");
  setValue("session-test-new-expected", "Tax is shown.");
  await submit("Record Session Test");
  expect(onRecord).toHaveBeenLastCalledWith({
    binding: null,
    expectedBehavior: "Tax is shown.",
    purpose: "Check tax display.",
    title: "Tax line",
  });

  setValue("session-test-new-title", "Pay");
  setValue("session-test-new-bound", "c1@2");
  expect(document.getElementById("session-test-new-purpose")).toBeNull();
  await submit("Record Session Test");
  expect(onRecord).toHaveBeenLastCalledWith(
    expect.objectContaining({ binding: { caseId: "c1", version: 2 } }),
  );
});

test("links an ad hoc test to the exact chosen version and shows a refusal", async () => {
  const onLink = vi
    .fn()
    .mockRejectedValueOnce(new Error("Already bound."))
    .mockResolvedValue(undefined);
  mount({ onLink });

  setValue("session-test-s2-link", "c1@2");
  await submit("Link Tax line to a Planned Test Case");
  expect(onLink).toHaveBeenCalledWith("s2", { caseId: "c1", version: 2 });
  expect(document.querySelector('[role="alert"]')?.textContent).toBe(
    "Already bound.",
  );
});

test("an archived Project offers no record or link control", () => {
  mount({ readOnly: true });

  expect(document.querySelectorAll("form")).toHaveLength(0);
  expect(document.body.textContent).toContain("Bound to v1, current v3");
});
