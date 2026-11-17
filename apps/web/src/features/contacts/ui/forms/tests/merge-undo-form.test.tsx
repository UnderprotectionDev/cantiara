// @vitest-environment happy-dom
// biome-ignore-all lint/performance/noJsxPropsBind: The test renders the form with inline handlers.

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, expect, test, vi } from "vitest";
import { MergeUndoForm } from "../merge-undo-form";

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | undefined;
let host: HTMLDivElement | undefined;

afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
});

const conflict = {
  currentValue: "Ada",
  field: "Display name",
  previousValue: "Ada L.",
} as const;

function mount(
  onConfirm: (resolution: string | null) => void,
  withConflict: boolean,
) {
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  act(() => {
    root?.render(
      <MergeUndoForm
        conflict={withConflict ? conflict : undefined}
        onCancel={() => undefined}
        onConfirm={onConfirm}
        pending={false}
      />,
    );
  });
}

async function submit() {
  await act(async () => {
    host
      ?.querySelector("form")
      ?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    await Promise.resolve();
  });
}

test("Confirm Undo Merge with a changed field needs an answer before it confirms", async () => {
  const onConfirm = vi.fn();
  mount(onConfirm, true);
  await submit();
  expect(onConfirm).not.toHaveBeenCalled();
  expect(host?.querySelector('[role="alert"]')).toBeNull();
  await act(async () => {
    const radios = host?.querySelectorAll<HTMLButtonElement>('[role="radio"]');
    radios?.[1]?.click();
    await Promise.resolve();
  });
  await submit();
  expect(onConfirm).toHaveBeenCalledWith("Restore previous value");
});

test("Confirm Undo Merge without a changed field confirms with no answer", async () => {
  const onConfirm = vi.fn();
  mount(onConfirm, false);
  await submit();
  expect(onConfirm).toHaveBeenCalledWith(null);
});
