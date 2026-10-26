// @vitest-environment happy-dom

import { DEFAULT_ACCOUNT_PREFERENCES } from "@cantiara/api/account-preferences";
import type {
  ProductGapFollowUpPlan,
  ProductGapRecord,
} from "@cantiara/api/product-gaps";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, expect, test, vi } from "vitest";
import { formatAccountDateTime } from "@/features/account-preferences/lib/account-preferences-format";
import { ProductGapsBoard } from "../product-gaps-board";

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const FORBIDDEN_WORDS = [
  /repeat/i,
  /\bcount\b/i,
  /priority/i,
  /score/i,
  /rank/i,
  /telemetry/i,
  /feature request/i,
  /\bmerge\b/i,
];

const timestamp = "2026-10-01T09:00:00.000Z";

const record: ProductGapRecord = {
  createdAt: timestamp,
  escapeCount: 2,
  id: "g1",
  links: [
    {
      brokenReason: null,
      id: "l1",
      kind: "Related",
      label: "Checkout",
      state: "resolved",
      targetId: "p1",
      targetType: "Project",
    },
    {
      brokenReason: "In Trash",
      id: "l2",
      kind: "Follow-up",
      label: null,
      state: "broken",
      targetId: "w1",
      targetType: "Work",
    },
  ],
  scope: "Board view only.",
  status: "Open",
  statusChangedAt: timestamp,
  title: "Bulk edit across projects",
  unmetNeed: "I edit many Works in another tool.",
  updatedAt: timestamp,
};

const workPlan: ProductGapFollowUpPlan = {
  gapId: "g1",
  kind: "Work",
  recordCount: 1,
  relation: "Follow-up",
  targetProject: { id: "p1", name: "Checkout" },
  work: {
    description: "I edit many Works in another tool.",
    title: "Bulk edit across projects",
    type: "Task",
  },
};

let root: Root | undefined;
let host: HTMLDivElement | undefined;

afterEach(() => {
  vi.useRealTimers();
  act(() => root?.unmount());
  host?.remove();
});

const loadTargets = (type: string) =>
  Promise.resolve([
    {
      label: type === "Feature" ? "Offline mode" : "Checkout",
      targetId: type === "Feature" ? "f1" : "p1",
      targetType: type as "Feature",
    },
  ]);

function computeTestDateTime(value: string) {
  return formatAccountDateTime(value, DEFAULT_ACCOUNT_PREFERENCES);
}

function mount(props: Partial<Parameters<typeof ProductGapsBoard>[0]> = {}) {
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  act(() => {
    root?.render(
      <QueryClientProvider client={queryClient}>
        <ProductGapsBoard
          formatDateTime={computeTestDateTime}
          gaps={[]}
          loadEscapes={vi.fn().mockResolvedValue([])}
          loadTargets={loadTargets}
          onConfirmFollowUp={vi.fn().mockResolvedValue(undefined)}
          onFilterChange={vi.fn()}
          onPreviewFollowUp={vi.fn().mockResolvedValue(workPlan)}
          onRecord={vi.fn().mockResolvedValue(undefined)}
          onSetStatus={vi.fn().mockResolvedValue(undefined)}
          tools={["Spreadsheet"]}
          {...props}
        />
      </QueryClientProvider>,
    );
  });
}

function setValue(id: string, value: string) {
  const field = (document.getElementById(id) ??
    document.querySelector(`[aria-label="${id}"]`)) as
    | HTMLInputElement
    | HTMLTextAreaElement
    | HTMLSelectElement
    | null;
  if (!field) {
    throw new Error(`No field ${id}`);
  }
  const prototype = {
    HTMLInputElement: HTMLInputElement.prototype,
    HTMLSelectElement: HTMLSelectElement.prototype,
    HTMLTextAreaElement: HTMLTextAreaElement.prototype,
  }[field.constructor.name as "HTMLInputElement"];
  act(() => {
    Object.getOwnPropertyDescriptor(prototype, "value")?.set?.call(
      field,
      value,
    );
    field.dispatchEvent(
      new Event(field instanceof HTMLSelectElement ? "change" : "input", {
        bubbles: true,
      }),
    );
  });
}

async function settle() {
  await new Promise((resolve) => setTimeout(resolve, 0));
  await new Promise((resolve) => setTimeout(resolve, 0));
  await new Promise((resolve) => setTimeout(resolve, 0));
}

async function click(label: string) {
  const button = [...document.querySelectorAll("button")].find(
    (item) =>
      item.textContent === label || item.getAttribute("aria-label") === label,
  );
  if (!button) {
    throw new Error(`No ${label} button`);
  }
  await act(async () => {
    button.click();
    await settle();
  });
}

async function flush() {
  await act(async () => {
    await settle();
  });
}

test("offers Record Product Gap with title, unmet need, scope and related records and nothing like a count or priority", () => {
  mount();

  const text = document.body.textContent ?? "";
  for (const label of [
    "Product Gaps",
    "Record Product Gap",
    "Title",
    "Unmet need",
    "Scope (optional)",
    "Related records",
    "Tool Escape",
    "Occurred at",
    "External tool",
    "Source",
    "Intended job",
    "Missing capability",
    "Faster",
    "More reliable",
    "Usability",
    "Habit",
    "Note (optional)",
    "No Product Gaps recorded yet.",
  ]) {
    expect(text).toContain(label);
  }
  for (const word of FORBIDDEN_WORDS) {
    expect(text).not.toMatch(word);
  }
});

async function submitForm() {
  const form = document.querySelector('form[aria-label="Record Product Gap"]');
  await act(async () => {
    form?.dispatchEvent(
      new Event("submit", { bubbles: true, cancelable: true }),
    );
    await Promise.resolve();
  });
}

function check(reason: string) {
  const box = [...document.querySelectorAll("label")]
    .find((item) => item.textContent === reason)
    ?.querySelector("input");
  if (!box) {
    throw new Error(`No ${reason} reason`);
  }
  act(() => box.click());
}

async function fillEscape() {
  await flush();
  setValue("Occurred at time", "09:30");
  setValue("product-gap-escape-tool", "Spreadsheet");
  setValue("product-gap-escape-source", "p1");
  setValue("product-gap-escape-job", "Bulk rename forty Works");
  check("Missing capability");
  check("Faster");
  setValue("product-gap-escape-note", "Needed a sort of its own.");
}

test("submits a new Product Gap with its Tool Escape and the chosen records", async () => {
  const onRecord = vi.fn().mockResolvedValue(undefined);
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2026, 9, 1, 8, 0));
  mount({ onRecord });
  await flush();

  setValue("product-gap-new-title", "Bulk edit across projects");
  setValue("product-gap-new-need", "I edit many Works in another tool.");
  setValue("product-gap-new-scope", "Board view only.");
  setValue("product-gap-new-link-target", "p1");
  await click("Add related record");
  await fillEscape();
  await submitForm();

  expect(onRecord).toHaveBeenCalledWith({
    escape: {
      intendedJob: "Bulk rename forty Works",
      note: "Needed a sort of its own.",
      occurredAt: "2026-10-01T09:30",
      reasons: ["Missing capability", "Faster"],
      source: {
        label: "Project: Checkout",
        targetId: "p1",
        targetType: "Project",
      },
      tool: "Spreadsheet",
    },
    existingGapId: "",
    links: [
      { label: "Project: Checkout", targetId: "p1", targetType: "Project" },
    ],
    scope: "Board view only.",
    title: "Bulk edit across projects",
    unmetNeed: "I edit many Works in another tool.",
  });
});

test("attaches to a Gap the founder picks, with no title or merge step", async () => {
  const onRecord = vi.fn().mockResolvedValue(undefined);
  mount({ gaps: [record], onRecord });
  await flush();

  setValue("product-gap-new-choice", "g1");
  expect(document.getElementById("product-gap-new-title")).toBeNull();
  await fillEscape();
  await submitForm();

  expect(onRecord).toHaveBeenCalledWith(
    expect.objectContaining({ existingGapId: "g1" }),
  );
});

test("refuses to submit without a source or a reason", async () => {
  const onRecord = vi.fn().mockResolvedValue(undefined);
  mount({ onRecord });
  await flush();
  setValue("product-gap-new-title", "Bulk edit across projects");
  setValue("product-gap-new-need", "I edit many Works in another tool.");
  setValue("product-gap-escape-tool", "Spreadsheet");
  setValue("product-gap-escape-job", "Bulk rename");

  await submitForm();
  expect(document.body.textContent).toContain(
    "Choose the source Project or record.",
  );
  setValue("product-gap-escape-source", "p1");
  await submitForm();
  expect(document.body.textContent).toContain("Choose at least one reason.");
  expect(onRecord).not.toHaveBeenCalled();
});

test("every Tool Escape and filter control has a visible label for keyboard and screen reader use", () => {
  mount({ gaps: [record] });

  const controls = document.querySelectorAll(
    'form input:not([type="checkbox"]), form select, form textarea',
  );
  expect(controls.length).toBeGreaterThan(8);
  for (const control of controls) {
    expect(
      (control as HTMLInputElement).labels?.length ||
        control.getAttribute("aria-label"),
    ).toBeTruthy();
  }
  expect(
    document.querySelectorAll('input[type="checkbox"]').length,
  ).toBeGreaterThanOrEqual(5);
});

test("filters by tool, reason, Project and status without ordering anything", () => {
  const onFilterChange = vi.fn();
  mount({ gaps: [record], onFilterChange });

  setValue("product-gap-filter-tool", "Spreadsheet");
  expect(onFilterChange).toHaveBeenLastCalledWith({
    projectId: "",
    reason: "",
    status: "",
    tool: "Spreadsheet",
  });
  setValue("product-gap-filter-reason", "Habit");
  setValue("product-gap-status-filter", "Met");
  expect(onFilterChange).toHaveBeenCalledTimes(3);
  const text = document.body.textContent ?? "";
  for (const word of FORBIDDEN_WORDS) {
    expect(text).not.toMatch(word);
  }
});

test("opens the exact Tool Escape events behind the number under the active filter", async () => {
  const loadEscapes = vi.fn().mockResolvedValue([
    {
      gapId: "g1",
      id: "e1",
      intendedJob: "Bulk rename forty Works",
      note: "Needed a sort of its own.",
      occurredAt: timestamp,
      reasons: ["Missing capability", "Faster"],
      recordedAt: timestamp,
      source: {
        brokenReason: null,
        label: "Checkout",
        projectId: "p1",
        state: "resolved",
        targetId: "p1",
        targetType: "Project",
      },
      tool: "Spreadsheet",
    },
  ]);
  const filter = { projectId: "", reason: "Faster", status: "", tool: "" };
  mount({ filter, gaps: [record], loadEscapes });

  await click("Open 2 Tool Escapes of Bulk edit across projects");

  expect(loadEscapes).toHaveBeenCalledWith(record, filter);
  const text = document.body.textContent ?? "";
  expect(text).toContain("Spreadsheet");
  expect(text).toContain("Reasons: Missing capability, Faster");
  expect(text).toContain("Source Project: Checkout");
  expect(text).toContain("Note: Needed a sort of its own.");
  for (const word of FORBIDDEN_WORDS) {
    expect(text).not.toMatch(word);
  }
});

test("lists a Gap with its status, need, scope and related records, naming a gone record as unavailable", () => {
  mount({ gaps: [record] });

  const text = document.body.textContent ?? "";
  expect(text).toContain("Bulk edit across projects");
  expect(text).toContain("I edit many Works in another tool.");
  expect(text).toContain("Scope: Board view only.");
  expect(text).toContain("Project: Checkout");
  expect(text).toContain("Follow-up Work: unavailable (In Trash)");
  const select = document.querySelector<HTMLSelectElement>(
    'select[id$="-status"]',
  );
  expect([...(select?.options ?? [])].map((option) => option.value)).toEqual([
    "Open",
    "Evaluating",
    "Met",
    "Conscious boundary",
  ]);
  expect(select?.labels?.[0]?.textContent).toBe(
    "Status of Bulk edit across projects",
  );
  for (const word of FORBIDDEN_WORDS) {
    expect(text).not.toMatch(word);
  }
});

test("changes status only through the founder's choice and reports a refusal", async () => {
  const onSetStatus = vi
    .fn()
    .mockResolvedValueOnce(undefined)
    .mockRejectedValueOnce(
      new Error("Product Gap changed since it was loaded."),
    );
  mount({ gaps: [record], onSetStatus });
  const select = document.querySelector<HTMLSelectElement>(
    'select[id$="-status"]',
  );
  const id = select?.id ?? "";

  setValue(id, "Evaluating");
  await flush();
  expect(onSetStatus).toHaveBeenCalledWith(record, "Evaluating");
  expect(document.body.textContent).toContain("Status changed to Evaluating.");

  setValue(id, "Met");
  await flush();
  expect(document.body.textContent).toContain(
    "Product Gap changed since it was loaded.",
  );
});

test("previews a follow-up before writing and confirms only on the founder's click", async () => {
  const onPreviewFollowUp = vi.fn().mockResolvedValue(workPlan);
  const onConfirmFollowUp = vi.fn().mockResolvedValue(undefined);
  mount({ gaps: [record], onConfirmFollowUp, onPreviewFollowUp });
  await flush();

  const target = document.querySelector<HTMLSelectElement>(
    'select[id$="-target"]:not([id^="product-gap-new"])',
  );
  setValue(target?.id ?? "", "p1");
  expect(onPreviewFollowUp).not.toHaveBeenCalled();
  await click("Preview follow-up");

  expect(onPreviewFollowUp).toHaveBeenCalledWith(record, {
    kind: "Work",
    projectId: "p1",
    workType: "Task",
  });
  expect(onConfirmFollowUp).not.toHaveBeenCalled();
  const text = document.body.textContent ?? "";
  expect(text).toContain("Create 1 Task in Checkout.");
  expect(text).toContain("Title: Bulk edit across projects");

  await click("Confirm follow-up");

  expect(onConfirmFollowUp).toHaveBeenCalledWith(record, workPlan);
  expect(document.body.textContent).toContain("Follow-up Work created.");
});

test("lets the founder discard a preview without writing", async () => {
  const onConfirmFollowUp = vi.fn().mockResolvedValue(undefined);
  mount({ gaps: [record], onConfirmFollowUp });
  await flush();
  const target = document.querySelector<HTMLSelectElement>(
    'select[id$="-target"]:not([id^="product-gap-new"])',
  );
  setValue(target?.id ?? "", "p1");
  await click("Preview follow-up");

  await click("Discard preview");

  expect(document.body.textContent).not.toContain("Create 1 Task");
  expect(onConfirmFollowUp).not.toHaveBeenCalled();
});

const closableEvent = {
  close: null,
  gapId: "g1",
  id: "e1",
  intendedJob: "Keep the release plan",
  note: null,
  occurredAt: timestamp,
  reasons: ["Missing capability"],
  recordedAt: timestamp,
  source: {
    brokenReason: null,
    label: "Checkout",
    projectId: "p1",
    state: "resolved",
    targetId: "p1",
    targetType: "Project",
  },
  tool: "Spreadsheet",
};

function idOfLabel(text: string) {
  const label = [...document.querySelectorAll("label")].find(
    (item) => item.textContent === text,
  );
  if (!label?.htmlFor) {
    throw new Error(`No label ${text}`);
  }
  return label.htmlFor;
}

test("shows the stored close evidence with its bound records and offers no second close", async () => {
  const loadEscapes = vi.fn().mockResolvedValue([
    {
      ...closableEvent,
      close: {
        candidateBuild: "build-1",
        closedAt: timestamp,
        escapeId: "e1",
        externalCopyHow: "Spreadsheet archived.",
        gapId: "g1",
        id: "c1",
        impact: "Lasting parallel source of truth",
        records: [
          {
            brokenReason: null,
            label: "Fix export",
            state: "resolved",
            targetId: "w1",
            targetType: "Work",
          },
        ],
        restoreMethod: "Manual recreate",
        workflowRef: "run-1",
      },
    },
  ]);
  mount({
    gaps: [record],
    loadEscapes,
    onCloseEscape: vi.fn().mockResolvedValue(undefined),
  });
  await click("Open 2 Tool Escapes of Bulk edit across projects");

  const text = document.body.textContent ?? "";
  expect(
    document.querySelector('[aria-label="Close evidence"]'),
  ).not.toBeNull();
  expect(text).toContain("candidate build build-1 (run run-1)");
  expect(text).toContain("Work: Fix export");
  expect(text).toContain("Spreadsheet archived.");
  expect(
    document.querySelector('button[aria-label^="Close Tool Escape"]'),
  ).toBeNull();
});

test("shows the Never held parallel truth close without proof lines", async () => {
  const loadEscapes = vi.fn().mockResolvedValue([
    {
      ...closableEvent,
      close: {
        candidateBuild: null,
        closedAt: timestamp,
        escapeId: "e1",
        externalCopyHow: null,
        gapId: "g1",
        id: "c2",
        impact: "Never held parallel truth",
        records: [],
        restoreMethod: null,
        workflowRef: null,
      },
    },
  ]);
  mount({
    gaps: [record],
    loadEscapes,
    onCloseEscape: vi.fn().mockResolvedValue(undefined),
  });
  await click("Open 2 Tool Escapes of Bulk edit across projects");

  const text = document.body.textContent ?? "";
  expect(text).toContain("Impact judged: Never held parallel truth");
  expect(text).not.toContain("candidate build");
  expect(
    document.querySelector('button[aria-label^="Close Tool Escape"]'),
  ).toBeNull();
});

test("closes through labelled controls and reads the unmet conditions of a refusal", async () => {
  const onCloseEscape = vi.fn().mockRejectedValue({
    data: {
      conditions: ["External copy closed", "Evidence bound to records"],
    },
  });
  mount({
    gaps: [record],
    loadEscapes: vi.fn().mockResolvedValue([closableEvent]),
    onCloseEscape,
  });
  await click("Open 2 Tool Escapes of Bulk edit across projects");
  await click("Close Tool Escape Spreadsheet, Keep the release plan");

  await click("Close Tool Escape");
  expect(document.querySelector('[role="alert"]')?.textContent).toContain(
    "Choose what the escape held",
  );
  expect(onCloseEscape).not.toHaveBeenCalled();

  setValue(
    idOfLabel("What the escape held"),
    "Lasting parallel source of truth",
  );
  setValue(idOfLabel("Candidate build"), "build-1");
  await click("Close Tool Escape");

  expect(onCloseEscape).toHaveBeenCalledWith(
    closableEvent,
    expect.objectContaining({ build: "build-1" }),
    "Lasting parallel source of truth",
  );
  expect(document.querySelector('[role="alert"]')?.textContent).toBe(
    "The Tool Escape was not closed. Unmet: External copy closed; Evidence bound to records.",
  );
});
