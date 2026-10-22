// @vitest-environment happy-dom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, test, vi } from "vitest";

import RecordTablePasteForm from "../record-table-paste-form";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

test("Preview paste hands the pasted text to review", async () => {
  const onReview = vi.fn();
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  try {
    await act(async () =>
      root.render(<RecordTablePasteForm onReview={onReview} />),
    );
    const textarea = host.querySelector("textarea");
    if (!textarea) {
      throw new Error("Paste rows control required");
    }
    expect(textarea.getAttribute("aria-label")).toBe("Paste rows");
    act(() => {
      Object.getOwnPropertyDescriptor(
        HTMLTextAreaElement.prototype,
        "value",
      )?.set?.call(textarea, "Title\tDecision\nLaunch\tShip");
      textarea.dispatchEvent(new Event("input", { bubbles: true }));
    });
    const preview = [...host.querySelectorAll("button")].find(
      (item) => item.textContent === "Preview paste",
    );
    await act(async () => preview?.click());
    expect(onReview).toHaveBeenCalledWith("Title\tDecision\nLaunch\tShip");
  } finally {
    await act(async () => root.unmount());
    host.remove();
  }
});
