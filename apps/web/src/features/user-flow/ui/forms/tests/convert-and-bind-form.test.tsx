// @vitest-environment happy-dom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, test, vi } from "vitest";
import { ConvertAndBindDialog } from "../convert-and-bind-form";

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

test("Preview submits the chosen record type through the form", async () => {
  const onPreview = vi.fn().mockRejectedValue(new Error("no plan"));
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  await act(async () =>
    root.render(
      <ConvertAndBindDialog
        node={{ id: "n1", kind: "Step" } as never}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
        onPreview={onPreview}
      />,
    ),
  );
  const select = document.querySelector(
    "#convert-target-n1",
  ) as HTMLSelectElement;
  await act(() => {
    Object.getOwnPropertyDescriptor(
      HTMLSelectElement.prototype,
      "value",
    )?.set?.call(select, "Decision");
    select.dispatchEvent(new Event("change", { bubbles: true }));
    return Promise.resolve();
  });
  await act(() => {
    document
      .querySelector("form")
      ?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    return Promise.resolve();
  });

  expect(onPreview).toHaveBeenCalledWith("Decision", "Task");
  expect(document.body.textContent).toContain(
    "The preview could not be loaded.",
  );
  await act(async () => root.unmount());
  host.remove();
});
