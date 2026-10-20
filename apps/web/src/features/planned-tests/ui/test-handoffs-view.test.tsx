// @vitest-environment happy-dom

import type {
  PlannedTestCaseRecord,
  PlannedTestCaseVersionRecord,
  SessionTestRecord,
  TestHandoffPackagePreview,
  TestHandoffPackageRecord,
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
    adHocScope: [],
    allowedTransitions: [...TEST_HANDOFF_TRANSITIONS[state]],
    contextRefs: [],
    environmentPreconditions: null,
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

function previewOf(
  overrides: Partial<TestHandoffPackagePreview> = {},
): TestHandoffPackagePreview {
  return {
    blockers: [],
    canProduce: true,
    excluded: ["Records you did not select", "Secrets, tokens and credentials"],
    fingerprint: "f".repeat(64),
    handoffId: "h1",
    included: [
      { count: 1, section: "scenarios" },
      { count: 0, section: "ad_hoc_scope" },
    ],
    json: '{ "schema_version": "test-handoff-package/1" }',
    markdown: "# Checkout round 1",
    nextPackageVersion: 1,
    ...overrides,
  };
}

function producedOf(packageVersion = 1): TestHandoffPackageRecord {
  return {
    createdAt: timestamp,
    handoffId: "h1",
    json: '{ "schema_version": "test-handoff-package/1" }',
    markdown: "# Checkout round 1",
    package: {} as TestHandoffPackageRecord["package"],
    packageVersion,
    schemaVersion: "test-handoff-package/1",
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
        loadContextTargets={vi.fn().mockResolvedValue([])}
        loadPackages={vi.fn().mockResolvedValue([])}
        onCreate={vi.fn().mockResolvedValue(undefined)}
        onLink={vi.fn().mockResolvedValue(undefined)}
        onPreviewPackage={vi.fn().mockResolvedValue(previewOf())}
        onProducePackage={vi.fn().mockResolvedValue(producedOf())}
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

test("a Draft offers no package preview and says why", () => {
  mount();

  expect(document.body.textContent).toContain("Mark it Ready to share first");
  expect(
    [...document.querySelectorAll("button")].some(
      (item) => item.textContent === "Preview package",
    ),
  ).toBe(false);
});

test("previews a closed-world package and produces it only on explicit confirm", async () => {
  const onPreviewPackage = vi.fn().mockResolvedValue(previewOf());
  const onProducePackage = vi.fn().mockResolvedValue(producedOf());
  mount({
    handoffs: [handoff({ state: "Ready to share" })],
    onPreviewPackage,
    onProducePackage,
  });

  await act(async () => {
    button("Preview package").click();
    await Promise.resolve();
  });
  expect(onProducePackage).not.toHaveBeenCalled();
  const text = document.body.textContent ?? "";
  expect(text).toContain("Package version 1 will contain");
  expect(text).toContain("Never included");
  expect(text).toContain("Secrets, tokens and credentials");
  expect(text).toContain("Markdown package");
  expect(text).toContain("JSON package");

  await act(async () => {
    button("Produce package version 1").click();
    await Promise.resolve();
  });
  expect(onProducePackage).toHaveBeenCalledWith(
    expect.objectContaining({ id: "h1" }),
    expect.objectContaining({ fingerprint: "f".repeat(64) }),
  );
  expect(document.body.textContent).toContain("Package version 1 produced.");
  for (const name of [
    "Copy Markdown package",
    "Download Markdown package",
    "Copy JSON package",
    "Download JSON package",
  ]) {
    expect(button(name)).toBeTruthy();
  }
});

test("a blocked preview shows the reasons and no rendering or confirm", async () => {
  mount({
    handoffs: [handoff({ state: "Shared" })],
    onPreviewPackage: vi.fn().mockResolvedValue(
      previewOf({
        blockers: [
          {
            kind: "secret",
            message:
              "scenarios[0].scope looks like it contains a secret (GitHub token).",
            path: "scenarios[0].scope",
          },
        ],
        canProduce: false,
        fingerprint: null,
        json: null,
        markdown: null,
      }),
    ),
  });

  await act(async () => {
    button("Preview package").click();
    await Promise.resolve();
  });

  expect(document.querySelector('[role="alert"]')?.textContent).toContain(
    "looks like it contains a secret",
  );
  expect(document.body.textContent).not.toContain("Markdown package");
  expect(
    [...document.querySelectorAll("button")].some((item) =>
      item.textContent?.startsWith("Produce package"),
    ),
  ).toBe(false);
});

test("a refused produce is shown and nothing is claimed as produced", async () => {
  mount({
    handoffs: [handoff({ state: "Ready to share" })],
    onProducePackage: vi
      .fn()
      .mockRejectedValue(new Error("The package changed since the preview.")),
  });

  await act(async () => {
    button("Preview package").click();
    await Promise.resolve();
  });
  await act(async () => {
    button("Produce package version 1").click();
    await Promise.resolve();
  });

  expect(document.querySelector('[role="alert"]')?.textContent).toBe(
    "The package changed since the preview.",
  );
  expect(document.body.textContent).not.toContain("produced.");
});

test("lists already produced packages with copy and download controls", async () => {
  mount({
    handoffs: [handoff({ packageVersion: 2, state: "Shared" })],
    loadPackages: vi.fn().mockResolvedValue([producedOf(2), producedOf(1)]),
  });
  await act(async () => {
    await Promise.resolve();
  });

  const text = document.body.textContent ?? "";
  expect(text).toContain("Package version 2");
  expect(text).toContain("Package version 1");
  expect(text).toContain("test-handoff-package/1");
});

test("the form takes ad hoc scope and environment preconditions as the founder's text", async () => {
  const onCreate = vi.fn().mockResolvedValue(undefined);
  mount({ handoffs: [], onCreate });

  setValue("test-handoff-new-title", "Round 3");
  setValue("test-handoff-new-purpose", "Re-check.");
  setValue("test-handoff-new-preconditions", "Use the staging tenant.");
  act(() => button("Add ad hoc item").click());
  setValue("test-handoff-new-adhoc-intent-0", "Check tax.");
  setValue("test-handoff-new-adhoc-expected-0", "Tax is shown.");
  await submit("Create Test Handoff");

  expect(onCreate).toHaveBeenCalledWith(
    expect.objectContaining({
      adHocScope: [{ expectedBehavior: "Tax is shown.", intent: "Check tax." }],
      environmentPreconditions: "Use the staging tenant.",
    }),
  );
});

test("a Document context ref whose section is gone says so while the reference stays exact", () => {
  mount({
    handoffs: [
      handoff({
        contextRefs: [
          {
            brokenReason: null,
            documentRevision: 3,
            kind: "Document",
            label: "Checkout spec",
            sectionId: "payment",
            sectionLabel: "Payment",
            targetId: "d1",
          },
          {
            brokenReason: null,
            documentRevision: 3,
            kind: "Document",
            label: "Checkout spec",
            sectionId: "setup",
            sectionLabel: null,
            targetId: "d1",
          },
        ],
      }),
    ],
  });

  const text = document.body.textContent ?? "";
  expect(text).toContain(
    "Document: Checkout spec, revision 3, section Payment",
  );
  expect(text).toContain(
    "Document: Checkout spec, revision 3, section no longer exists",
  );
});

test("removing one of two identical ad hoc items removes exactly that one", async () => {
  mount({ handoffs: [] });
  await act(async () => {
    await Promise.resolve();
  });
  act(() => {
    button("Add ad hoc item").click();
  });
  act(() => {
    button("Add ad hoc item").click();
  });
  for (const field of [
    "test-handoff-new-adhoc-intent-0",
    "test-handoff-new-adhoc-intent-1",
  ]) {
    setValue(field, "Check tax.");
  }
  for (const field of [
    "test-handoff-new-adhoc-expected-0",
    "test-handoff-new-adhoc-expected-1",
  ]) {
    setValue(field, "Tax is shown.");
  }
  act(() => {
    button("Remove ad hoc item 1").click();
  });

  expect(control("test-handoff-new-adhoc-intent-0").value).toBe("Check tax.");
  expect(control("test-handoff-new-adhoc-expected-0").value).toBe(
    "Tax is shown.",
  );
  expect(document.body.textContent).toContain("Remove ad hoc item 1");
  expect(document.body.textContent).not.toContain("Remove ad hoc item 2");
  expect(document.getElementById("test-handoff-new-adhoc-intent-1")).toBeNull();
  expect(
    document.getElementById("test-handoff-new-adhoc-expected-1"),
  ).toBeNull();
});

test("adds an exact Document revision and a Wireframe version as package context", async () => {
  const onCreate = vi.fn().mockResolvedValue(undefined);
  const candidates: Record<string, unknown[]> = {
    Document: [
      {
        documentRevision: 3,
        kind: "Document",
        label: "Checkout spec",
        sections: [{ id: "payment", label: "Payment" }],
        targetId: "d1",
        wireframeVersions: [],
      },
    ],
    Wireframe: [
      {
        documentRevision: null,
        kind: "Wireframe",
        label: "Checkout screen",
        sections: [],
        targetId: "sc1",
        wireframeVersions: [1, 2],
      },
    ],
  };
  const loadContextTargets = vi.fn((kind: string) =>
    Promise.resolve(candidates[kind] ?? []),
  );
  mount({
    handoffs: [],
    loadContextTargets: loadContextTargets as never,
    onCreate,
  });

  setValue("test-handoff-new-title", "Round 4");
  setValue("test-handoff-new-purpose", "Re-check.");
  setValue("test-handoff-new-context-kind", "Document");
  await act(async () => {
    await Promise.resolve();
  });
  setValue("test-handoff-new-context-target", "d1");
  setValue("test-handoff-new-context-section", "payment");
  act(() => button("Add context record").click());
  setValue("test-handoff-new-context-kind", "Wireframe");
  await act(async () => {
    await Promise.resolve();
  });
  setValue("test-handoff-new-context-target", "sc1");
  setValue("test-handoff-new-context-version", "2");
  act(() => button("Add context record").click());
  await submit("Create Test Handoff");

  expect(onCreate).toHaveBeenCalledWith(
    expect.objectContaining({
      contextRefs: [
        expect.objectContaining({
          ref: {
            documentRevision: 3,
            kind: "Document",
            sectionId: "payment",
            targetId: "d1",
          },
        }),
        expect.objectContaining({
          ref: { kind: "Wireframe", targetId: "sc1", wireframeVersion: 2 },
        }),
      ],
    }),
  );
});
