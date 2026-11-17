// @vitest-environment happy-dom
// biome-ignore-all lint/performance/noJsxPropsBind: The test renders the form with inline handlers.

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, expect, test, vi } from "vitest";
import { HandoffReconcileForm } from "../handoff-reconcile-form";

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | undefined;
let host: HTMLDivElement | undefined;

afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
});

function mount(onPreview: () => Promise<never>) {
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  act(() => {
    root?.render(
      <HandoffReconcileForm
        disabled={false}
        handoffId="handoff-1"
        onConfirm={() => Promise.resolve()}
        onPreview={onPreview}
        relatedWorks={[]}
        workKey="CAN-1"
      />,
    );
  });
}

function click(label: string) {
  const button = [...(host?.querySelectorAll("button") ?? [])].find(
    (item) => item.textContent === label,
  );
  return act(async () => {
    button?.click();
    await Promise.resolve();
  });
}

test("Reconcile preview with an untitled Follow-up Work disables Preview changes and does not preview", async () => {
  const onPreview = vi.fn();
  mount(onPreview);
  await click("Add follow-up Work");
  const preview = [...(host?.querySelectorAll("button") ?? [])].find(
    (item) => item.textContent === "Preview changes",
  );
  expect(preview?.disabled).toBe(true);
  await click("Preview changes");
  expect(onPreview).not.toHaveBeenCalled();
  expect(host?.querySelector('[role="alert"]')).toBeNull();
});

test("Reconcile preview sends the trimmed Follow-up Work through the form", async () => {
  const onPreview = vi.fn().mockRejectedValue(new Error("stop"));
  mount(onPreview);
  await click("Add follow-up Work");
  const title = host?.querySelector(
    '[id^="handoff-follow-up-title-"]',
  ) as HTMLInputElement;
  await act(async () => {
    const setter = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )?.set;
    setter?.call(title, "  Write docs  ");
    title.dispatchEvent(new Event("input", { bubbles: true }));
    await Promise.resolve();
  });
  await click("Preview changes");
  expect(onPreview).toHaveBeenCalledTimes(1);
  expect(onPreview.mock.calls[0]?.[0]).toMatchObject({
    followUpWorks: [{ title: "Write docs", type: "Task" }],
    handoffId: "handoff-1",
  });
  expect(host?.querySelector('[role="alert"]')?.textContent).toBe("stop");
});
