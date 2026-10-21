// @vitest-environment happy-dom

import { createEmptyWireframeDocument } from "@cantiara/api/wireframe-document";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, test, vi } from "vitest";
import { createWireframeEditor } from "../../../engine/editor";
import { WireframePane } from "../wireframe-pane";

vi.mock("../wireframe-stage", () => ({
  default: () => <div data-testid="stage" />,
}));

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

afterEach(() => {
  document.body.innerHTML = "";
});

function setInput(
  element: HTMLInputElement | HTMLSelectElement,
  value: string,
) {
  const proto =
    element instanceof HTMLSelectElement
      ? HTMLSelectElement.prototype
      : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, "value")?.set?.call(element, value);
  element.dispatchEvent(
    new Event(element instanceof HTMLSelectElement ? "change" : "input", {
      bubbles: true,
    }),
  );
}

async function mountPane(readOnly: boolean) {
  const editor = createWireframeEditor(createEmptyWireframeDocument());
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  await act(() => {
    root.render(
      <WireframePane editor={editor} liveText={{}} readOnly={readOnly} />,
    );
  });
  return {
    container,
    editor,
    unmount: () => act(async () => root.unmount()),
  };
}

test("Place live card adds a read-only reference and moving it changes only placement", async () => {
  const view = await mountPane(false);
  const form = view.container.querySelector(
    'form[aria-label="Place live card"]',
  );
  expect(form).not.toBeNull();

  await act(() => {
    setInput(form?.querySelector("select") as HTMLSelectElement, "Decision");
  });
  await act(() => {
    setInput(form?.querySelector("input") as HTMLInputElement, "decision-9");
  });
  await act(() => {
    form?.dispatchEvent(
      new Event("submit", { bubbles: true, cancelable: true }),
    );
  });

  const [card] = view.editor.getState().document.blocks;
  expect(card).toMatchObject({
    kind: "Live Card",
    props: { recordId: "decision-9", recordType: "Decision" },
  });

  await act(() => {
    view.editor.commitMove(card?.id ?? "", { x: 400, y: 300 });
  });
  const [moved] = view.editor.getState().document.blocks;
  // Only placement differs; the record reference is untouched and the pane
  // has no source-record write path at all.
  expect(moved).toEqual({ ...card, x: moved?.x, y: moved?.y });
  expect(moved?.x).not.toBe(card?.x);
  await view.unmount();
});

test("a read-only pane offers no Place live card", async () => {
  const view = await mountPane(true);
  expect(
    view.container.querySelector('form[aria-label="Place live card"]'),
  ).toBeNull();
  await view.unmount();
});
