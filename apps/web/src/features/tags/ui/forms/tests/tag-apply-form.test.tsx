// @vitest-environment happy-dom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, test, vi } from "vitest";

import { TagApplyForm } from "../tag-apply-form";

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

const record = {
  projectId: "p1",
  recordId: "w1",
  recordType: "Work",
} as const;

function mount(onApply: (input: unknown) => Promise<unknown>) {
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  act(() => {
    root?.render(
      <TagApplyForm
        availableTags={[{ id: "t1", name: "roadmap" }]}
        onApply={onApply}
        pending={false}
        record={record}
      />,
    );
  });
}

function select(value: string) {
  const element = host?.querySelector("select") as HTMLSelectElement;
  act(() => {
    Object.getOwnPropertyDescriptor(
      HTMLSelectElement.prototype,
      "value",
    )?.set?.call(element, value);
    element.dispatchEvent(new Event("change", { bubbles: true }));
  });
  return element;
}

async function submit() {
  await act(async () => {
    host
      ?.querySelector("form")
      ?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

describe("TagApplyForm", () => {
  test("applies the chosen tag to the record and clears the choice", async () => {
    const onApply = vi.fn(async () => undefined);
    mount(onApply);
    const element = select("t1");
    await submit();
    expect(onApply).toHaveBeenCalledWith({ ...record, tagId: "t1" });
    expect(element.value).toBe("");
  });

  test("does not call the write without a chosen tag", async () => {
    const onApply = vi.fn(async () => undefined);
    mount(onApply);
    await submit();
    expect(onApply).not.toHaveBeenCalled();
  });

  test("a failed apply keeps the chosen tag for a retry", async () => {
    const onApply = vi.fn(() => Promise.reject(new Error("failed")));
    mount(onApply);
    const element = select("t1");
    await submit();
    expect(onApply).toHaveBeenCalledOnce();
    expect(element.value).toBe("t1");
  });
});
