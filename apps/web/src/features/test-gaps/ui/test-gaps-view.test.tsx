// @vitest-environment happy-dom

import type {
  PlannedTestCaseRecord,
  PlannedTestCaseVersionRecord,
  SessionTestRecord,
  TestHandoffRecord,
} from "@cantiara/api/planned-tests";
import type { TestGapRecord } from "@cantiara/api/test-gaps";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, expect, test, vi } from "vitest";
import { TestGapsView } from "./test-gaps-view";

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const FORBIDDEN_WORDS = [
  /coverage/i,
  /score/i,
  /severity/i,
  /\bpriority\b/i,
  /\bbug\b/i,
  /product gap/i,
];

const DELETE_ACTIONS = /\bdelete\b|\bremove (test )?gap\b|\breopen\b|coverage/i;

const timestamp = "2026-10-01T09:00:00.000Z";

const record: TestGapRecord = {
  caseBinds: [],
  closure: null,
  createdAt: timestamp,
  handoffBinds: [],
  id: "g1",
  projectId: "p1",
  rationale: "Coupon stacking was never tried on mobile.",
  relations: [
    {
      brokenReason: null,
      documentRevision: null,
      id: "rel1",
      label: "Coupon redemption",
      sectionId: null,
      sectionLabel: null,
      state: "resolved",
      targetId: "f1",
      targetType: "Feature",
    },
    {
      brokenReason: "In Trash",
      documentRevision: null,
      id: "rel2",
      label: null,
      sectionId: null,
      sectionLabel: null,
      state: "broken",
      targetId: "r1",
      targetType: "Risk",
    },
  ],
  state: "Open",
  stateChangedAt: timestamp,
  title: "Mobile coupon stacking untested",
  updatedAt: timestamp,
};

const scenarioVersion = (version: number): PlannedTestCaseVersionRecord => ({
  caseId: "c1",
  changeKind: version === 1 ? "Initial version" : "Meaningful change",
  createdAt: timestamp,
  expectedBehavior: "The coupon applies once.",
  id: `v${version}`,
  notes: null,
  preconditions: "Signed-in customer.",
  purpose: "Check coupon stacking.",
  relations: [],
  scope: "Mobile.",
  title: "Stack coupons",
  version,
});

const plannedCases: PlannedTestCaseRecord[] = [
  {
    createdAt: timestamp,
    current: scenarioVersion(2),
    id: "c1",
    projectId: "p1",
    updatedAt: timestamp,
    versions: [scenarioVersion(1), scenarioVersion(2)],
  },
];

const sessionTestRecords: SessionTestRecord[] = [
  {
    bind: null,
    createdAt: timestamp,
    expectedBehavior: "Stacked.",
    id: "st1",
    projectId: "p1",
    purpose: "Android",
    title: "Stacked coupons on Android",
  },
  {
    bind: null,
    createdAt: timestamp,
    expectedBehavior: "Stacked.",
    id: "st2",
    projectId: "p1",
    purpose: "iOS",
    title: "Stacked coupons on iOS",
  },
];

const handoffRecords = [
  { id: "h1", state: "Shared", title: "Mobile pass" },
] as unknown as TestHandoffRecord[];

let root: Root | undefined;
let host: HTMLDivElement | undefined;

afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
});

const loadDecisions = () =>
  Promise.resolve([{ label: "Skip wallet tests", targetId: "d1" }]);

const loadTargets = () =>
  Promise.resolve([
    {
      documentRevision: null,
      label: "Coupon redemption",
      sections: [],
      targetId: "f1",
      targetType: "Feature" as const,
    },
  ]);

function mount(props: Partial<Parameters<typeof TestGapsView>[0]> = {}) {
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  act(() => {
    root?.render(
      <TestGapsView
        cases={plannedCases}
        gaps={[]}
        handoffs={handoffRecords}
        loadDecisions={loadDecisions}
        loadTargets={loadTargets}
        onClose={vi.fn().mockResolvedValue(undefined)}
        onCreate={vi.fn().mockResolvedValue(undefined)}
        onPlanCase={vi.fn().mockResolvedValue(undefined)}
        onPlanHandoff={vi.fn().mockResolvedValue(undefined)}
        onUnplanCase={vi.fn().mockResolvedValue(undefined)}
        onUnplanHandoff={vi.fn().mockResolvedValue(undefined)}
        readOnly={false}
        sessionTests={sessionTestRecords}
        {...props}
      />,
    );
  });
}

function setValue(id: string, value: string) {
  const field = document.getElementById(id) as
    | HTMLInputElement
    | HTMLTextAreaElement
    | null;
  if (!field) {
    throw new Error(`No field ${id}`);
  }
  const prototype =
    field instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype;
  act(() => {
    Object.getOwnPropertyDescriptor(prototype, "value")?.set?.call(
      field,
      value,
    );
    field.dispatchEvent(new Event("input", { bubbles: true }));
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

test("offers title, rationale and support relations under the Test Gap label and nothing like a score", () => {
  mount();

  const text = document.body.textContent ?? "";
  for (const label of [
    "Test Gaps",
    "File Test Gap",
    "Title",
    "Rationale",
    "Support relations",
    "No Test Gaps filed.",
  ]) {
    expect(text).toContain(label);
  }
  for (const word of FORBIDDEN_WORDS) {
    expect(text).not.toMatch(word);
  }
});

test("files a Gap with the typed text and the chosen support relation", async () => {
  const onCreate = vi.fn().mockResolvedValue(undefined);
  mount({ onCreate });
  await act(async () => {
    await Promise.resolve();
  });

  setValue("test-gap-new-title", "Mobile coupon stacking untested");
  setValue("test-gap-new-rationale", "Never tried on mobile.");
  const target = document.getElementById(
    "test-gap-new-relation-target",
  ) as HTMLSelectElement;
  act(() => {
    target.value = "f1";
    target.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await act(async () => {
    [...document.querySelectorAll("button")]
      .find((item) => item.textContent === "Add support relation")
      ?.click();
    await Promise.resolve();
  });
  await submit("File Test Gap");

  expect(onCreate).toHaveBeenCalledWith({
    rationale: "Never tried on mobile.",
    relations: [
      expect.objectContaining({ targetId: "f1", targetType: "Feature" }),
    ],
    title: "Mobile coupon stacking untested",
  });
});

test("shows a refusal and keeps the typed text", async () => {
  mount({ onCreate: vi.fn().mockRejectedValue(new Error("Archived.")) });

  setValue("test-gap-new-title", "Gap");
  setValue("test-gap-new-rationale", "Why.");
  await submit("File Test Gap");

  expect(document.querySelector('[role="alert"]')?.textContent).toBe(
    "Archived.",
  );
  expect(
    (document.getElementById("test-gap-new-title") as HTMLInputElement).value,
  ).toBe("Gap");
});

test("lists Gaps with rationale and live or broken support relations", () => {
  mount({ gaps: [record] });

  const text = document.body.textContent ?? "";
  expect(text).toContain("Mobile coupon stacking untested");
  expect(text).toContain("Coupon stacking was never tried on mobile.");
  expect(text).toContain("Feature: Coupon redemption");
  expect(text).toContain("Risk: unavailable (In Trash)");
});

test("the count opens exactly the Open and Planned set that produced the number", () => {
  mount({
    gaps: [
      { ...record, state: "Planned" },
      { ...record, id: "g2", title: "Refund flow untested" },
      {
        ...record,
        closure: {
          closedAt: timestamp,
          decision: null,
          outcome: "Met by result",
          rationale: "Covered by the checkout session tests.",
          sessionTests: [],
        },
        id: "g3",
        state: "Met by result",
        title: "Checkout flow untested",
      },
    ],
  });

  const summary = document.querySelector("summary");
  expect(summary?.textContent).toContain("Open and planned Test Gaps: 2");
  const shown = [
    ...document.querySelectorAll('[aria-label="Test Gaps in this count"] li'),
  ];
  expect(shown.map((item) => item.textContent)).toEqual([
    "Mobile coupon stacking untested (Planned)",
    "Refund flow untested (Open)",
  ]);
  expect(shown.map((item) => item.textContent).join(" ")).not.toContain(
    "Checkout flow untested",
  );
});

test("the count shows zero and an empty set when every Gap is closed", () => {
  mount({
    gaps: [
      { ...record, id: "g3", state: "Met by result" },
      { ...record, id: "g4", state: "Not needed" },
    ],
  });

  expect(document.querySelector("summary")?.textContent).toContain(
    "Open and planned Test Gaps: 0",
  );
  expect(document.body.textContent).toContain("No open or planned Test Gaps.");
});

test("an archived Project lists Gaps without a filing form", () => {
  mount({ gaps: [record], readOnly: true });

  expect(document.querySelector('form[aria-label="File Test Gap"]')).toBeNull();
  expect(document.body.textContent).toContain("Test Gaps are read-only");
  expect(document.body.textContent).toContain(
    "Mobile coupon stacking untested",
  );
});

function labelled(label: string) {
  const found = [...document.querySelectorAll("label")].find(
    (item) => item.textContent === label,
  );
  const control = found?.htmlFor
    ? document.getElementById(found.htmlFor)
    : null;
  if (!control) {
    throw new Error(`No ${label} control`);
  }
  return control as HTMLSelectElement;
}

function press(label: string) {
  return act(async () => {
    [...document.querySelectorAll("button")]
      .find((item) => item.textContent === label)
      ?.click();
    await Promise.resolve();
  });
}

test("shows the Gap state as Open or Planned and lists what it is planned against", () => {
  mount({
    gaps: [
      {
        ...record,
        caseBinds: [{ caseId: "c1", title: "Stack coupons", version: 1 }],
        handoffBinds: [
          { handoffId: "h1", handoffState: "Shared", title: "Mobile pass" },
        ],
        state: "Planned",
      },
      { ...record, id: "g2", title: "Refund flow untested" },
    ],
  });

  const text = document.body.textContent ?? "";
  expect(text).toContain("Planned");
  expect(text).toContain("Open");
  expect(text).toContain("Planned Test Case: Stack coupons, version 1");
  expect(text).toContain("Test Handoff: Mobile pass (Shared)");
  expect(text).not.toContain("Met by result");
});

test("links an exact Planned Test Case version and a Test Handoff to the Gap", async () => {
  const onPlanCase = vi.fn().mockResolvedValue(undefined);
  const onPlanHandoff = vi.fn().mockResolvedValue(undefined);
  mount({ gaps: [record], onPlanCase, onPlanHandoff });

  const version = labelled("Planned Test Case version");
  act(() => {
    version.value = "c1@1";
    version.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await press("Link Planned Test Case version");
  const handoff = labelled("Test Handoff");
  act(() => {
    handoff.value = "h1";
    handoff.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await press("Link Test Handoff");

  expect(onPlanCase).toHaveBeenCalledWith(record, { caseId: "c1", version: 1 });
  expect(onPlanHandoff).toHaveBeenCalledWith(record, "h1");
  expect(
    [...document.querySelectorAll('[role="status"]')]
      .map((item) => item.textContent)
      .join(" "),
  ).toContain("Linked to the Test Handoff.");
});

test("offers every version of a case as its own option and no latest choice", () => {
  mount({ gaps: [record] });

  const options = [...labelled("Planned Test Case version").options].map(
    (option) => option.textContent,
  );
  expect(options).toEqual([
    "Choose a version",
    "Stack coupons, version 2",
    "Stack coupons, version 1",
  ]);
});

test("removes a link with an accessible name and shows a refusal", async () => {
  const onUnplanHandoff = vi.fn().mockRejectedValue(new Error("Unavailable."));
  mount({
    gaps: [
      {
        ...record,
        handoffBinds: [
          { handoffId: "h1", handoffState: "Draft", title: "Mobile pass" },
        ],
        state: "Planned",
      },
    ],
    onUnplanHandoff,
  });

  const remove = document.querySelector(
    'button[aria-label="Remove link to Test Handoff Mobile pass"]',
  ) as HTMLButtonElement;
  await act(async () => {
    remove.click();
    await Promise.resolve();
  });

  expect(onUnplanHandoff).toHaveBeenCalledWith(expect.anything(), "h1");
  expect(document.querySelector('[role="alert"]')?.textContent).toBe(
    "Unavailable.",
  );
});

test("an archived Project offers no planning controls", () => {
  mount({ gaps: [record], readOnly: true });

  expect(document.body.textContent).not.toContain("Link Test Handoff");
  expect(document.body.textContent).not.toContain(
    "Link Planned Test Case version",
  );
});

function chooseOutcome(outcome: string) {
  const radio = [...document.querySelectorAll('input[type="radio"]')].find(
    (item) => (item as HTMLInputElement).value === outcome,
  ) as HTMLInputElement;
  act(() => radio.click());
}

function tick(title: string) {
  const box = [...document.querySelectorAll('input[type="checkbox"]')].find(
    (item) => item.parentElement?.textContent === title,
  ) as HTMLInputElement;
  act(() => box.click());
}

function type(label: string, value: string) {
  const form = document.querySelector('form[aria-label^="Close "]');
  const found = [...(form?.querySelectorAll("label") ?? [])].find(
    (item) => item.textContent === label,
  );
  const control = (
    found?.htmlFor ? document.getElementById(found.htmlFor) : null
  ) as HTMLTextAreaElement | null;
  if (!control) {
    throw new Error(`No ${label} control in the close form`);
  }
  act(() => {
    Object.getOwnPropertyDescriptor(
      HTMLTextAreaElement.prototype,
      "value",
    )?.set?.call(control, value);
    control.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

async function openClose() {
  await act(async () => {
    (
      document.querySelector(
        'button[aria-label="Close Mobile coupon stacking untested"]',
      ) as HTMLButtonElement
    ).click();
    await Promise.resolve();
  });
}

const submitClose = () => submit("Close Mobile coupon stacking untested");

test("Met by result cannot be submitted until Session Tests are selected, then cites exactly those", async () => {
  const onClose = vi.fn().mockResolvedValue(undefined);
  mount({ gaps: [record], onClose });
  await openClose();

  const markButton = () =>
    [...document.querySelectorAll("button")].find(
      (item) => item.textContent === "Mark as Met by result",
    ) as HTMLButtonElement;
  expect(markButton().disabled).toBe(true);
  expect(document.body.textContent).toContain(
    "Session Tests that meet this Test Gap",
  );

  tick("Stacked coupons on iOS");
  expect(markButton().disabled).toBe(false);
  type("Rationale (optional)", "iOS stacked correctly.");
  await submitClose();

  expect(onClose).toHaveBeenCalledWith(record, {
    decisionId: "",
    outcome: "Met by result",
    rationale: "iOS stacked correctly.",
    sessionTestIds: ["st2"],
  });
});

test("Not needed asks for a rationale and an optional Decision and selects no Session Test", async () => {
  const onClose = vi.fn().mockResolvedValue(undefined);
  mount({ gaps: [record], onClose });
  await openClose();

  chooseOutcome("Not needed");
  await act(async () => {
    await Promise.resolve();
  });

  expect(document.body.textContent).not.toContain(
    "Session Tests that meet this Test Gap",
  );
  const decision = labelled("Decision (optional)");
  act(() => {
    decision.value = "d1";
    decision.dispatchEvent(new Event("change", { bubbles: true }));
  });
  type("Rationale", "Wallet payments are out of scope.");
  await submitClose();

  expect(onClose).toHaveBeenCalledWith(record, {
    decisionId: "d1",
    outcome: "Not needed",
    rationale: "Wallet payments are out of scope.",
    sessionTestIds: [],
  });
});

test("a refused closure is announced and keeps the form", async () => {
  mount({
    gaps: [record],
    onClose: vi.fn().mockRejectedValue(new Error("Test Gap changed.")),
  });
  await openClose();
  chooseOutcome("Not needed");
  type("Rationale", "No.");
  await submitClose();

  expect(document.querySelector('[role="alert"]')?.textContent).toBe(
    "Test Gap changed.",
  );
  expect(document.querySelector('form[aria-label^="Close "]')).not.toBeNull();
});

test("a closed Gap shows its closure history and offers neither planning nor closing", () => {
  mount({
    gaps: [
      {
        ...record,
        caseBinds: [{ caseId: "c1", title: "Stack coupons", version: 1 }],
        closure: {
          closedAt: timestamp,
          decision: {
            brokenReason: "In Trash",
            id: "d1",
            label: null,
            state: "broken",
          },
          outcome: "Not needed",
          rationale: "Wallet payments are out of scope.",
          sessionTests: [{ id: "st1", title: "Stacked coupons on Android" }],
        },
        state: "Not needed",
      },
    ],
  });

  const text = document.body.textContent ?? "";
  expect(text).toContain("Not needed");
  expect(text).toContain("Wallet payments are out of scope.");
  expect(text).toContain("Session Test: Stacked coupons on Android");
  expect(text).toContain("Decision: unavailable (In Trash)");
  expect(text).toContain("Planned Test Case: Stack coupons, version 1");
  expect(text).not.toContain("Link Test Handoff");
  expect(document.querySelector('button[aria-label^="Close "]')).toBeNull();
  expect(text).not.toMatch(DELETE_ACTIONS);
});

test("an archived Project offers no closing and no deleting", () => {
  mount({ gaps: [record], readOnly: true });

  expect(document.querySelector('button[aria-label^="Close "]')).toBeNull();
  expect(document.body.textContent).not.toMatch(DELETE_ACTIONS);
});
