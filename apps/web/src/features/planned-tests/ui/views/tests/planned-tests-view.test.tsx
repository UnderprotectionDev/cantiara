// @vitest-environment happy-dom

import type {
  PlannedTestCaseRecord,
  PlannedTestCaseVersionRecord,
} from "@cantiara/api/planned-tests";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, expect, test, vi } from "vitest";
import { PlannedTestsView } from "../planned-tests-view";

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const RUNNER_WORDS = [
  /\brun\b/i,
  /\bstart\b/i,
  /\bexecute\b/i,
  /\bpass(ed)?\b/i,
  /\bfail(ed)?\b/i,
  /\bvalidat/i,
  /\bsession\b/i,
  /\bhandoff\b/i,
  /\bexport\b/i,
];

const timestamp = "2026-10-01T09:00:00.000Z";

function version(
  number: number,
  overrides: Partial<PlannedTestCaseVersionRecord> = {},
): PlannedTestCaseVersionRecord {
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
    ...overrides,
  };
}

function record(
  versions: PlannedTestCaseVersionRecord[],
): PlannedTestCaseRecord {
  const current = versions.at(-1) as PlannedTestCaseVersionRecord;
  return {
    createdAt: timestamp,
    current,
    id: "c1",
    projectId: "p1",
    updatedAt: timestamp,
    versions,
  };
}

let root: Root | undefined;
let host: HTMLDivElement | undefined;

afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
});

const loadTargets = () => Promise.resolve([]);

function mount(props: Partial<Parameters<typeof PlannedTestsView>[0]> = {}) {
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  act(() => {
    root?.render(
      <PlannedTestsView
        cases={[]}
        loadTargets={loadTargets}
        onCreate={vi.fn().mockResolvedValue(undefined)}
        onCreateVersion={vi.fn().mockResolvedValue(undefined)}
        readOnly={false}
        {...props}
      />,
    );
  });
}

function button(label: string) {
  const found = [...document.querySelectorAll("button")].find(
    (item) => item.textContent === label,
  );
  if (!found) {
    throw new Error(`No ${label} button`);
  }
  return found;
}

function click(label: string) {
  return act(() => {
    button(label).click();
    return Promise.resolve();
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

test("offers the PRD fields, a Planned Test Case label and relations, and no runner controls", () => {
  mount();

  const text = document.body.textContent ?? "";
  for (const label of [
    "Planned Test Cases",
    "Create Planned Test Case",
    "Title",
    "Purpose",
    "Scope",
    "Preconditions",
    "Expected behavior",
    "Notes (optional)",
    "Relations",
    "No Planned Test Cases yet.",
  ]) {
    expect(text).toContain(label);
  }
  const buttons = [...document.querySelectorAll("button")].map(
    (item) => item.textContent ?? "",
  );
  for (const forbidden of RUNNER_WORDS) {
    expect(buttons.filter((label) => forbidden.test(label))).toEqual([]);
  }
  expect(document.querySelectorAll('input[type="checkbox"]')).toHaveLength(0);
});

test("every field has a programmatic label and relations are a labelled group", () => {
  mount();

  const controls = [
    ...document.querySelectorAll("input:not([type=radio]), textarea, select"),
  ];
  expect(controls.length).toBeGreaterThanOrEqual(7);
  for (const control of controls) {
    expect(control.id).not.toBe("");
    expect(document.querySelector(`label[for="${control.id}"]`)).not.toBeNull();
  }
  expect(document.querySelector("fieldset > legend")?.textContent).toBe(
    "Relations",
  );
  expect(document.querySelector('[role="status"]')).not.toBeNull();
});

test("creating a case submits the typed definition and relations", async () => {
  const onCreate = vi.fn().mockResolvedValue(undefined);
  mount({ onCreate });
  const fill = (id: string, value: string) => {
    const element = document.getElementById(id) as
      | HTMLInputElement
      | HTMLTextAreaElement;
    const prototype =
      element instanceof HTMLTextAreaElement
        ? HTMLTextAreaElement.prototype
        : HTMLInputElement.prototype;
    act(() => {
      Object.getOwnPropertyDescriptor(prototype, "value")?.set?.call(
        element,
        value,
      );
      element.dispatchEvent(new Event("input", { bubbles: true }));
    });
  };
  fill("planned-test-new-title", "Login");
  fill("planned-test-new-purpose", "Sign in works");
  fill("planned-test-new-scope", "Email login");
  fill("planned-test-new-preconditions", "An account exists");
  fill("planned-test-new-expectedBehavior", "The dashboard opens");

  await submit("Create Planned Test Case");

  expect(onCreate).toHaveBeenCalledTimes(1);
  expect(onCreate.mock.calls[0]?.[0]).toMatchObject({
    expectedBehavior: "The dashboard opens",
    notes: "",
    preconditions: "An account exists",
    purpose: "Sign in works",
    relations: [],
    scope: "Email login",
    title: "Login",
  });
});

test("New version opens a prefilled form, moves focus to Title and saves the chosen change kind", async () => {
  const onCreateVersion = vi.fn().mockResolvedValue(undefined);
  const first = version(1);
  mount({ cases: [record([first])], onCreateVersion });

  await click("New version");

  const title = document.getElementById(
    "planned-test-c1-title",
  ) as HTMLInputElement;
  expect(title.value).toBe("Checkout with a saved card");
  expect(document.activeElement).toBe(title);
  expect(button("Cancel new version").getAttribute("aria-expanded")).toBe(
    "true",
  );
  const kinds = [
    ...document.querySelectorAll('input[name="planned-test-c1-change-kind"]'),
  ].map((item) => (item as HTMLInputElement).value);
  expect(kinds).toEqual(["Meaningful change", "Editorial change"]);

  await act(async () => {
    (
      document.getElementById(
        "planned-test-c1-kind-Editorial change",
      ) as HTMLInputElement
    ).click();
    await Promise.resolve();
  });
  await submit("New version of Checkout with a saved card");

  expect(onCreateVersion).toHaveBeenCalledTimes(1);
  const [savedRecord, values] = onCreateVersion.mock.calls[0] ?? [];
  expect(savedRecord.id).toBe("c1");
  expect(values).toMatchObject({
    changeKind: "Editorial change",
    title: "Checkout with a saved card",
  });
  expect(document.body.textContent).toContain("Version 2 saved.");
  expect(document.querySelector("form[aria-label^='New version']")).toBeNull();
});

test("a failed save keeps the form open and announces the reason", async () => {
  const onCreateVersion = vi
    .fn()
    .mockRejectedValue(new Error("Nothing changed."));
  mount({ cases: [record([version(1)])], onCreateVersion });

  await click("New version");
  await submit("New version of Checkout with a saved card");

  expect(document.querySelector('[role="alert"]')?.textContent).toBe(
    "Nothing changed.",
  );
  expect(document.body.textContent).not.toContain("Version 2 saved.");
});

test("shows the head version, every earlier version with its change kind and live relation state", () => {
  const first = version(1);
  const second = version(2, {
    changeKind: "Editorial change",
    relations: [
      {
        brokenReason: null,
        documentRevision: 4,
        id: "r1",
        label: "Checkout spec",
        sectionId: "payment",
        sectionLabel: "Payment",
        state: "resolved",
        targetId: "d1",
        targetType: "Document",
      },
      {
        brokenReason: "In Trash",
        documentRevision: null,
        id: "r2",
        label: null,
        sectionId: null,
        sectionLabel: null,
        state: "broken",
        targetId: "k1",
        targetType: "Risk",
      },
    ],
    title: "Checkout with a saved card.",
  });
  mount({ cases: [record([first, second])] });

  const text = document.body.textContent ?? "";
  expect(text).toContain("Version 2");
  expect(text).toContain("Version history (2)");
  expect(text).toContain("Version 1: Initial version");
  expect(text).toContain("Version 2: Editorial change");
  expect(text).toContain(
    "Document: Checkout spec, revision 4, section Payment",
  );
  expect(text).toContain("Risk: unavailable (In Trash)");
});

test("an archived Project shows cases without create or version controls", () => {
  mount({ cases: [record([version(1)])], readOnly: true });

  expect(document.body.textContent).toContain("Checkout with a saved card");
  expect(document.querySelector("form")).toBeNull();
  expect(
    [...document.querySelectorAll("button")].map((item) => item.textContent),
  ).not.toContain("New version");
});
