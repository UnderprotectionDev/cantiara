// @vitest-environment happy-dom
// biome-ignore-all lint/performance/noJsxPropsBind: The test renders the form with inline handlers.

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, expect, test, vi } from "vitest";
import { ConvertToWorkForm } from "../convert-to-work-form";

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | undefined;
let host: HTMLDivElement | undefined;

afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
});

function mount(handlers: {
  onConfirm: () => Promise<void>;
  onPreview: (workType: string) => Promise<void>;
}) {
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  act(() => {
    root?.render(
      <ConvertToWorkForm
        canConfirm
        onClose={() => undefined}
        onConfirm={handlers.onConfirm}
        onPreview={handlers.onPreview}
        onWorkTypeChange={() => undefined}
        pending={false}
        recordId="feedback-1"
      >
        {null}
      </ConvertToWorkForm>,
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

test("Convert to Work previews the chosen Work type and confirms only on Confirm", async () => {
  const onConfirm = vi.fn().mockResolvedValue(undefined);
  const onPreview = vi.fn().mockResolvedValue(undefined);
  mount({ onConfirm, onPreview });
  const select = host?.querySelector("select") as HTMLSelectElement;
  await act(async () => {
    select.value = "Bug";
    select.dispatchEvent(new Event("change", { bubbles: true }));
    await Promise.resolve();
  });
  await click("Preview");
  expect(onPreview).toHaveBeenCalledWith("Bug");
  expect(onConfirm).not.toHaveBeenCalled();
  await click("Confirm");
  expect(onConfirm).toHaveBeenCalledTimes(1);
});
