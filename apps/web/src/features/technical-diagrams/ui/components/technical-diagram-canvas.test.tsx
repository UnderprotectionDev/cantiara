// @vitest-environment happy-dom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

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

  const boundary = {
    model: {
      links: [{ from: "b", kind: "Contains" as const, label: null, to: "api" }],
      nodes: [
        { id: "b", kind: "Boundary" as const, label: "Backend" },
        { id: "api", kind: "Service" as const, label: "API" },
      ],
    },
    title: "Platform",
    type: "Technical Architecture" as const,
    view: {
      id: "v",
      layout: { api: { x: 50, y: 50 }, b: { x: 0, y: 0 } },
      name: "Default",
      selectedNodeIds: [],
    },
  };
  const viewportTransform = () =>
    container
      .querySelector<HTMLElement>(".react-flow__viewport")
      ?.style.transform.replace(/\s/g, "");

  test("restores the saved zoom and collapse, and Fit view returns neutral and expands groups", async () => {
    act(() =>
      root.render(
        <TechnicalDiagramCanvas
          diagram={boundary}
          savedView={{ center: { x: 100, y: 50 }, collapsed: ["b"], zoom: 1.5 }}
        />,
      ),
    );
    expect(viewportTransform()).toContain("scale(1.5)");
    expect(container.textContent).toContain("Backend (Boundary)");
    expect(container.textContent).not.toContain("API (Service)");
    expect(container.textContent).toContain("Expand group: Backend");
    vi.stubGlobal("requestAnimationFrame", (run: () => void) => run());
    const fit = [...container.querySelectorAll("button")].find(
      (button) => button.textContent === "Fit view",
    );
    await act(async () => fit?.click());
    expect(container.textContent).toContain("API (Service)");
    expect(container.textContent).toContain("Collapse group: Backend");
    vi.unstubAllGlobals();
  });

  test("reapplies the saved center with the measured frame, not the nominal one", () => {
    const width = Object.getOwnPropertyDescriptor(
      HTMLElement.prototype,
      "clientWidth",
    );
    const height = Object.getOwnPropertyDescriptor(
      HTMLElement.prototype,
      "clientHeight",
    );
    Object.defineProperty(HTMLElement.prototype, "clientWidth", {
      configurable: true,
      get() {
        return 1400;
      },
    });
    Object.defineProperty(HTMLElement.prototype, "clientHeight", {
      configurable: true,
      get() {
        return 320;
      },
    });
    try {
      act(() =>
        root.render(
          <TechnicalDiagramCanvas
            diagram={boundary}
            savedView={{
              center: { x: 100, y: 50 },
              collapsed: [],
              zoom: 1.5,
            }}
          />,
        ),
      );
      // x = 1400/2 - 100*1.5 = 550 (the nominal 800px frame would give 250).
      expect(viewportTransform()).toContain("translate(550px,85px)");
      expect(viewportTransform()).toContain("scale(1.5)");
    } finally {
      if (width) {
        Object.defineProperty(HTMLElement.prototype, "clientWidth", width);
      }
      if (height) {
        Object.defineProperty(HTMLElement.prototype, "clientHeight", height);
      }
    }
  });

  test("a saved position over an empty region fits content instead of restoring", () => {
    act(() =>
      root.render(
        <TechnicalDiagramCanvas
          diagram={boundary}
          savedView={{
            center: { x: 90_000, y: 90_000 },
            collapsed: [],
            zoom: 1.5,
          }}
        />,
      ),
    );
    expect(viewportTransform()).not.toContain("scale(1.5)");
  });

  test("collapsing a group reports only the personal view", () => {
    const onViewChange = vi.fn();
    act(() =>
      root.render(
        <TechnicalDiagramCanvas
          diagram={boundary}
          onViewChange={onViewChange}
        />,
      ),
    );
    const toggle = [...container.querySelectorAll("button")].find((button) =>
      button.textContent?.startsWith("Collapse group"),
    );
    act(() => toggle?.click());
    expect(onViewChange).toHaveBeenCalledWith(
      expect.objectContaining({ collapsed: ["b"] }),
    );
    expect(Object.keys(onViewChange.mock.calls[0]?.[0]).sort()).toEqual([
      "center",
      "collapsed",
      "zoom",
    ]);
  });
});
