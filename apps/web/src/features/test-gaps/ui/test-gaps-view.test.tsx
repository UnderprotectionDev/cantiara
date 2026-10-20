// @vitest-environment happy-dom

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

const timestamp = "2026-10-01T09:00:00.000Z";

const record: TestGapRecord = {
  createdAt: timestamp,
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
  title: "Mobile coupon stacking untested",
  updatedAt: timestamp,
};

let root: Root | undefined;
let host: HTMLDivElement | undefined;

afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
});

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
        gaps={[]}
        loadTargets={loadTargets}
        onCreate={vi.fn().mockResolvedValue(undefined)}
        readOnly={false}
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

test("an archived Project lists Gaps without a filing form", () => {
  mount({ gaps: [record], readOnly: true });

  expect(document.querySelector('form[aria-label="File Test Gap"]')).toBeNull();
  expect(document.body.textContent).toContain("Test Gaps are read-only");
  expect(document.body.textContent).toContain(
    "Mobile coupon stacking untested",
  );
});
