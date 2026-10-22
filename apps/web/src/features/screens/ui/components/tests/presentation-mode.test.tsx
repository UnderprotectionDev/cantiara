// @vitest-environment happy-dom

import {
  createEmptyWireframeDocument,
  createWireframeBlock,
} from "@cantiara/api/wireframe-document";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, test, vi } from "vitest";
import { createWireframeSnapshot } from "../../../output/snapshot";
import { PresentationMode } from "../presentation-mode";

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const home = createWireframeSnapshot({
  document: {
    ...createEmptyWireframeDocument(),
    animations: [
      {
        durationMs: 300,
        id: "a",
        kind: "screen-transition",
        targetScreenId: "missing",
        transition: "fade",
        triggerBlockId: "go",
      },
    ],
    blocks: [createWireframeBlock("Button", "go", { x: 0, y: 0 })],
  },
  latestVersion: 1,
  screenId: "home",
  title: "Home",
  version: 1,
});

test("Presentation Mode exposes no edit controls and reports a broken target", () => {
  const onExit = vi.fn();
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  act(() => {
    root.render(
      <PresentationMode
        onExit={onExit}
        snapshots={[home]}
        startScreenId="home"
      />,
    );
  });

  const labels = [...document.body.querySelectorAll("button")].map(
    (button) => button.textContent,
  );
  expect(labels).toEqual(["Exit Presentation Mode", "Button"]);
  for (const editor of ["Undo", "Redo", "Save Version", "Input", "Card"]) {
    expect(labels).not.toContain(editor);
  }
  expect(document.body.querySelector("textarea, input")).toBeNull();

  act(() => {
    document.body
      .querySelector('[data-block-id="go"]')
      ?.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
  });
  expect(document.body.querySelector('[role="status"]')?.textContent).toContain(
    "Unresolved: missing",
  );
  expect(document.body.textContent).toContain("Home - Wireframe v1");

  act(() => {
    document.dispatchEvent(
      new window.KeyboardEvent("keydown", { bubbles: true, key: "Escape" }),
    );
  });
  expect(onExit).toHaveBeenCalledTimes(1);

  act(() => root.unmount());
});
