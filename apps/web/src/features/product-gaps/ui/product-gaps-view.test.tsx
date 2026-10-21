// @vitest-environment happy-dom

import type {
  ProductGapFollowUpPlan,
  ProductGapRecord,
} from "@cantiara/api/product-gaps";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, expect, test, vi } from "vitest";
import { ProductGapsView } from "./product-gaps-view";

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

function mount(props: Partial<Parameters<typeof ProductGapsView>[0]> = {}) {
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  act(() => {
    root?.render(
      <ProductGapsView
        gaps={[]}
        loadTargets={loadTargets}
        onConfirmFollowUp={vi.fn().mockResolvedValue(undefined)}
        onPreviewFollowUp={vi.fn().mockResolvedValue(workPlan)}
        onRecord={vi.fn().mockResolvedValue(undefined)}
        onSetStatus={vi.fn().mockResolvedValue(undefined)}
        {...props}
      />,
    );
  });
}

function setValue(id: string, value: string) {
  const field = document.getElementById(id) as
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
    await Promise.resolve();
  });
}

async function flush() {
  await act(async () => {
    await Promise.resolve();
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
    "No Product Gaps recorded yet.",
  ]) {
    expect(text).toContain(label);
  }
  for (const word of FORBIDDEN_WORDS) {
    expect(text).not.toMatch(word);
  }
});

test("submits what the founder typed, with the chosen related record", async () => {
  const onRecord = vi.fn().mockResolvedValue(undefined);
  mount({ onRecord });
  await flush();

  setValue("product-gap-new-title", "Bulk edit across projects");
  setValue("product-gap-new-need", "I edit many Works in another tool.");
  setValue("product-gap-new-scope", "Board view only.");
  setValue("product-gap-new-link-target", "p1");
  await click("Add related record");
  const form = document.querySelector('form[aria-label="Record Product Gap"]');
  await act(async () => {
    form?.dispatchEvent(
      new Event("submit", { bubbles: true, cancelable: true }),
    );
    await Promise.resolve();
  });

  expect(onRecord).toHaveBeenCalledWith({
    links: [
      { label: "Project: Checkout", targetId: "p1", targetType: "Project" },
    ],
    scope: "Board view only.",
    title: "Bulk edit across projects",
    unmetNeed: "I edit many Works in another tool.",
  });
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
