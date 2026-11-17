// @vitest-environment happy-dom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, test, vi } from "vitest";

import { LiveBlockAddForm } from "../live-block-add-form";

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

function submitButton() {
  return (host as HTMLElement).querySelector(
    'button[type="submit"]',
  ) as HTMLButtonElement;
}

function mount(onAdd: (key: string) => void, selectedCount = 0) {
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  act(() => {
    root?.render(
      <LiveBlockAddForm
        addable={[{ key: "Document:d1:", title: "Brief", type: "Document" }]}
        onAdd={onAdd}
        selectedCount={selectedCount}
      />,
    );
  });
}

describe("LiveBlockAddForm", () => {
  test("submitting without a chosen source adds nothing", async () => {
    const onAdd = vi.fn();
    mount(onAdd);
    await act(async () => {
      host
        ?.querySelector("form")
        ?.dispatchEvent(
          new Event("submit", { bubbles: true, cancelable: true }),
        );
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(onAdd).not.toHaveBeenCalled();
    expect(submitButton().disabled).toBe(true);
  });

  test("the Add live block submit is disabled once four live blocks exist", () => {
    mount(vi.fn(), 4);
    expect(host?.textContent).toContain("Add live block");
    expect(submitButton().disabled).toBe(true);
  });
});
