// @vitest-environment happy-dom

import { applyWireframeTransaction } from "@cantiara/api/wireframe-commands";
import {
  createEmptyWireframeDocument,
  createWireframeBlock,
} from "@cantiara/api/wireframe-document";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, test, vi } from "vitest";
import { createWireframeEditor } from "../../../engine/editor";
import { LinkedBlockControls } from "../linked-block-controls";

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

test("Preview Change submits the source label through the form", async () => {
  const content = {
    height: 56,
    kind: "Navigation" as const,
    label: "Header",
    props: { items: ["Home"] },
    width: 560,
  };
  const document0 = applyWireframeTransaction(
    {
      ...createEmptyWireframeDocument(),
      blocks: [createWireframeBlock("Navigation", "n", { x: 0, y: 0 })],
    },
    [
      {
        blockId: "n",
        definition: { content, id: "def", name: "Header", revision: 1 },
        type: "linkBlock",
      },
    ],
  );
  const editor = createWireframeEditor(document0);
  const block = document0.blocks[0] as (typeof document0.blocks)[number];
  const preview = vi.fn().mockResolvedValue({
    affectedScreens: [],
    definition: { content, id: "def", name: "Header", revision: 1 },
  });
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  await act(async () =>
    root.render(
      <LinkedBlockControls
        actions={{ apply: vi.fn(), create: vi.fn(), preview }}
        block={{ ...block, ...content }}
        editor={editor}
        linkedBlock={block}
      />,
    ),
  );
  const input = host.querySelector("#linked-source-label") as HTMLInputElement;
  await act(() => {
    Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )?.set?.call(input, "Top bar");
    input.dispatchEvent(new Event("input", { bubbles: true }));
    return Promise.resolve();
  });
  await act(() => {
    host
      .querySelector("form")
      ?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    return Promise.resolve();
  });

  expect(preview).toHaveBeenCalledWith(
    "def",
    expect.objectContaining({ label: "Top bar" }),
  );
  await act(async () => root.unmount());
  host.remove();
});
