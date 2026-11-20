// @vitest-environment happy-dom

import { applyWireframeTransaction } from "@cantiara/api/wireframe-commands";
import {
  createEmptyWireframeDocument,
  createWireframeBlock,
} from "@cantiara/api/wireframe-document";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, test, vi } from "vitest";
import { createWireframeEditor } from "../../../engine/editor";
import { LinkedBlockControls } from "../linked-block-controls";

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

test("Preview Change submits the source label and a retried Apply Change keeps its command", async () => {
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
    definition: { content, id: "def", name: "Header", revision: 2 },
  });
  const apply = vi
    .fn()
    .mockRejectedValueOnce(new Error("Connection lost"))
    .mockResolvedValueOnce({
      affectedScreens: [],
      definition: {
        content: { ...content, label: "Top bar" },
        id: "def",
        name: "Header",
        revision: 2,
      },
    });
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  await act(async () =>
    root.render(
      <QueryClientProvider client={new QueryClient()}>
        <LinkedBlockControls
          actions={{ apply, create: vi.fn(), preview }}
          block={{ ...block, ...content }}
          editor={editor}
          linkedBlock={block}
        />
      </QueryClientProvider>,
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
  await act(async () => {
    host
      .querySelector("form")
      ?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    await new Promise((resolve) => setTimeout(resolve, 20));
  });

  expect(preview).toHaveBeenCalledWith(
    "def",
    expect.objectContaining({ label: "Top bar" }),
  );
  async function applyChange() {
    await act(async () => {
      [...host.querySelectorAll("button")]
        .find((button) => button.textContent === "Apply Change")
        ?.click();
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
  }
  await applyChange();
  expect(host.textContent).toContain("Linked block could not be updated.");
  await applyChange();
  expect(apply).toHaveBeenCalledTimes(2);
  expect(apply.mock.calls[0]).toEqual([
    "def",
    expect.objectContaining({ label: "Top bar" }),
    1,
    expect.any(String),
  ]);
  expect(apply.mock.calls[1]).toEqual(apply.mock.calls[0]);
  await act(async () => root.unmount());
  host.remove();
});
