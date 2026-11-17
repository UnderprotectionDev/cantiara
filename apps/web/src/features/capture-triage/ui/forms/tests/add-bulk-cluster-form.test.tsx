// @vitest-environment happy-dom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, test, vi } from "vitest";

import { AddBulkClusterForm } from "../add-bulk-cluster-form";

(
  globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | null = null;
let host: HTMLElement | null = null;

afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
  root = null;
  host = null;
});

async function typeAndSubmit(onAdd: (name: string) => Promise<unknown>) {
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  act(() => {
    root?.render(<AddBulkClusterForm disabled={false} onAdd={onAdd} />);
  });
  const input = host.querySelector("input") as HTMLInputElement;
  const setter = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    "value",
  )?.set;
  act(() => {
    setter?.call(input, "Pricing");
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await act(async () => {
    host
      ?.querySelector("form")
      ?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  return input;
}

describe("Add Bulk cluster form", () => {
  test("clears the Cluster name once the layout is saved", async () => {
    const onAdd = vi.fn(async () => undefined);
    const input = await typeAndSubmit(onAdd);
    expect(onAdd).toHaveBeenCalledWith("Pricing");
    expect(input.value).toBe("");
  });

  test("keeps the Cluster name when saving the layout fails", async () => {
    const onAdd = vi.fn(() => Promise.reject(new Error("offline")));
    const input = await typeAndSubmit(onAdd);
    expect(onAdd).toHaveBeenCalledWith("Pricing");
    expect(input.value).toBe("Pricing");
  });
});
