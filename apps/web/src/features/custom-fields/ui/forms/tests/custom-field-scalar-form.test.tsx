// @vitest-environment happy-dom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, test, vi } from "vitest";
import { CustomFieldScalarForm } from "../custom-field-scalar-form";

test("a failed Custom field write keeps the edit available for another blur", async () => {
  const onCommit = vi.fn().mockRejectedValueOnce(new Error("Write failed"));
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  try {
    await act(() => {
      root.render(
        <CustomFieldScalarForm
          current={{ kind: "text", text: "Previous" }}
          disabled={false}
          id="custom-field"
          kind="text"
          onCommit={onCommit}
        />,
      );
      return Promise.resolve();
    });
    const input = host.querySelector("input");
    if (!input) {
      throw new Error("Custom field input is missing");
    }
    const setValue = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )?.set;
    await act(() => {
      setValue?.call(input, "Edited");
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("focusout", { bubbles: true }));
      return Promise.resolve();
    });
    expect(onCommit).toHaveBeenCalledWith({ kind: "text", text: "Edited" });
    expect(input.value).toBe("Edited");
    expect(host.querySelector('[role="alert"]')?.textContent).toBe(
      "Write failed",
    );
    await act(() => {
      input.dispatchEvent(new Event("focusout", { bubbles: true }));
      return Promise.resolve();
    });
    expect(onCommit).toHaveBeenCalledTimes(2);
    expect(host.querySelector('[role="alert"]')).toBeNull();
  } finally {
    await act(async () => root.unmount());
    host.remove();
    vi.unstubAllGlobals();
  }
});
