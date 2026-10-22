// @vitest-environment happy-dom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, test, vi } from "vitest";

import DocumentConflictResultForm from "../document-conflict-result-form";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

function setup() {
  const onApply = vi.fn();
  const onCreateDocument = vi.fn();
  const onDelete = vi.fn();
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  return {
    host,
    onApply,
    onCreateDocument,
    onDelete,
    async render() {
      await act(async () =>
        root.render(
          <DocumentConflictResultForm
            disabled={false}
            initial={{ body: "Body", title: "Title", type: "General" }}
            onApply={onApply}
            onCreateDocument={onCreateDocument}
            onDelete={onDelete}
          />,
        ),
      );
    },
    async cleanup() {
      await act(async () => root.unmount());
      host.remove();
    },
  };
}

function button(host: HTMLElement, name: string) {
  const found = [...host.querySelectorAll("button")].find(
    (item) => item.textContent === name,
  );
  if (!found) {
    throw new Error(`${name} control required`);
  }
  return found;
}

function type(input: HTMLInputElement, value: string) {
  act(() => {
    const setter = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )?.set;
    setter?.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

test("Apply parts submits the edited result and Create Document and Delete pass it along", async () => {
  const view = setup();
  try {
    await view.render();
    const title = view.host.querySelector<HTMLInputElement>(
      "#conflict-result-title",
    );
    if (!title) {
      throw new Error("Title control required");
    }
    type(title, "Edited");
    await act(async () => button(view.host, "Apply parts").click());
    expect(view.onApply).toHaveBeenCalledWith({
      body: "Body",
      title: "Edited",
      type: "General",
    });
    await act(async () => button(view.host, "Create Document").click());
    expect(view.onCreateDocument).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Edited" }),
    );
    await act(async () => button(view.host, "Delete").click());
    expect(view.onDelete).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Edited" }),
    );
  } finally {
    await view.cleanup();
  }
});

test("a blank Title disables Apply parts and never submits", async () => {
  const view = setup();
  try {
    await view.render();
    const title = view.host.querySelector<HTMLInputElement>(
      "#conflict-result-title",
    );
    if (!title) {
      throw new Error("Title control required");
    }
    type(title, "   ");
    expect(button(view.host, "Apply parts").disabled).toBe(true);
    act(() => {
      view.host
        .querySelector("form")
        ?.dispatchEvent(
          new Event("submit", { bubbles: true, cancelable: true }),
        );
    });
    expect(view.onApply).not.toHaveBeenCalled();
  } finally {
    await view.cleanup();
  }
});
