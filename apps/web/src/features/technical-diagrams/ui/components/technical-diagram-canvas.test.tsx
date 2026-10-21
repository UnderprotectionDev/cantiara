// @vitest-environment happy-dom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, test } from "vitest";

import { TechnicalDiagramCanvas } from "./technical-diagram-canvas";

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

// React Flow measures with ResizeObserver, which happy-dom does not paint.
class ResizeObserverStub {
  observe() {
    // Layout is not measured in this environment.
  }
  unobserve() {
    // Layout is not measured in this environment.
  }
  disconnect() {
    // Layout is not measured in this environment.
  }
}
(globalThis as { ResizeObserver?: unknown }).ResizeObserver =
  ResizeObserverStub;

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe("Technical Diagram canvas", () => {
  test("renders the canonical model as a view and offers Fit view", () => {
    act(() =>
      root.render(
        <TechnicalDiagramCanvas
          diagram={{
            model: {
              participants: [
                { bind: null, id: "u", kind: "Actor", label: "Founder" },
                { bind: null, id: "a", kind: "Component", label: "API" },
              ],
              steps: [],
            },
            title: "Open project",
            type: "Technical Sequence",
            view: {
              id: "v",
              layout: { u: { x: 10, y: 20 } },
              name: "Default",
              selectedNodeIds: ["u", "a"],
            },
          }}
        />,
      ),
    );
    expect(
      container.querySelector('[aria-label="Technical Diagram canvas"]'),
    ).not.toBeNull();
    expect(container.textContent).toContain("Fit view");
    expect(container.textContent).toContain("Founder (Actor)");
  });
});
