// @vitest-environment happy-dom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, expect, test, vi } from "vitest";
import PublicRoadmapReviewForm from "../public-roadmap-review-form";

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | undefined;
let host: HTMLDivElement | undefined;

afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
});

async function settle() {
  await new Promise((resolve) => setTimeout(resolve, 0));
  await new Promise((resolve) => setTimeout(resolve, 0));
  await new Promise((resolve) => setTimeout(resolve, 0));
}

function mount(onSave: (days: number | null) => Promise<unknown>) {
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  act(() => {
    root?.render(
      <PublicRoadmapReviewForm days={null} disabled={false} onSave={onSave} />,
    );
  });
}

async function typeDays(value: string) {
  const input = host?.querySelector("input") as HTMLInputElement;
  await act(async () => {
    Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )?.set?.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    await settle();
  });
}

async function submit() {
  await act(async () => {
    host
      ?.querySelector("form")
      ?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    await settle();
  });
}

test("a number outside the schema range shows the range message and does not save", async () => {
  const onSave = vi.fn().mockResolvedValue(undefined);
  mount(onSave);
  await typeDays("0");
  await submit();
  expect(onSave).not.toHaveBeenCalled();
  expect(host?.querySelector('[role="alert"]')?.textContent).toContain(
    "Enter a whole number of days from 7 to 180.",
  );
});

test("a valid interval saves as a number and a blank one clears it", async () => {
  const onSave = vi.fn().mockResolvedValue(undefined);
  mount(onSave);
  await typeDays("30");
  await submit();
  expect(onSave).toHaveBeenLastCalledWith(30);
  await typeDays("");
  await submit();
  expect(onSave).toHaveBeenLastCalledWith(null);
});
