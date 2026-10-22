// @vitest-environment happy-dom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, test, vi } from "vitest";

import BulkEditStatusForm, {
  BULK_EDIT_STATUS_FORM_ID,
} from "../bulk-edit-status-form";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

function setValue(element: HTMLElement, value: string, prototype: object) {
  Object.getOwnPropertyDescriptor(prototype, "value")?.set?.call(
    element,
    value,
  );
  element.dispatchEvent(
    new Event(element instanceof HTMLSelectElement ? "change" : "input", {
      bubbles: true,
    }),
  );
}

test("Preview submits the Status, Closure result and Reason", async () => {
  const onPreview = vi.fn();
  const onStatusChange = vi.fn();
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  try {
    await act(async () =>
      root.render(
        <BulkEditStatusForm
          disabled={false}
          displayed={null}
          onClosureReasonChange={vi.fn()}
          onClosureResultChange={vi.fn()}
          onPreview={onPreview}
          onStatusChange={onStatusChange}
          workStatusLabels={[]}
        />,
      ),
    );
    const form = host.querySelector(`#${BULK_EDIT_STATUS_FORM_ID}`);
    const submit = () =>
      act(async () => {
        await Promise.resolve(
          form?.dispatchEvent(
            new Event("submit", { bubbles: true, cancelable: true }),
          ),
        );
      });
    await submit();
    expect(onPreview).not.toHaveBeenCalled();

    const status = host.querySelector<HTMLSelectElement>("#bulk-edit-status");
    if (!status) {
      throw new Error("Status control required");
    }
    await act(async () =>
      setValue(status, "Closed", HTMLSelectElement.prototype),
    );
    expect(onStatusChange).toHaveBeenCalledWith("Closed");
    const reason = host.querySelector<HTMLTextAreaElement>("#bulk-edit-reason");
    if (!reason) {
      throw new Error("Reason control required");
    }
    await act(async () =>
      setValue(reason, "Shipped", HTMLTextAreaElement.prototype),
    );
    await submit();
    expect(onPreview).toHaveBeenCalledWith({
      closureReason: "Shipped",
      closureResult: "Completed",
      targetStatus: "Closed",
    });
  } finally {
    await act(async () => root.unmount());
    host.remove();
  }
});
