// @vitest-environment happy-dom
// biome-ignore-all lint/performance/noJsxPropsBind: The harness closes over its own state.
import type { ProjectWallCardView } from "@cantiara/api/project-wall";
import { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import ProjectWallCanvas, {
  type ProjectWallCanvasProps,
} from "./project-wall-canvas";

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

const NOW = "2026-10-20T09:00:00.000Z";
let container: HTMLDivElement;
let root: Root;

function card(
  index: number,
  overrides: Partial<ProjectWallCardView> = {},
): ProjectWallCardView {
  return {
    density: "Preview",
    fields: [],
    groupId: null,
    highlight: null,
    id: `card-${index}`,
    locked: false,
    placedAt: NOW,
    position: { x: index * 400, y: index * 10 },
    preview: null,
    sharedSource: false,
    source: {
      broken: null,
      kind: "Work",
      openPath: `/projects/p1#work-w${index}`,
      recordId: `w${index}`,
      status: "In Progress",
      title: `Record ${index}`,
    },
    sourceType: "Work",
    ...overrides,
  };
}

function props(
  cards: ProjectWallCardView[],
  overrides: Partial<ProjectWallCanvasProps> = {},
) {
  return {
    actions: {
      onDensity: vi.fn(),
      onGroup: vi.fn(),
      onHighlight: vi.fn(),
      onLock: vi.fn(),
      onRemove: vi.fn(),
    },
    cards,
    groups: [],
    links: [],
    onExpandAll: vi.fn(),
    onMove: vi.fn(),
    onReorder: vi.fn(),
    onSelectionChange: vi.fn(),
    onViewportChange: vi.fn(),
    onViewportReady: vi.fn(),
    saved: null,
    selection: [],
    ...overrides,
  } satisfies ProjectWallCanvasProps;
}

function Harness({ initial }: { initial: ProjectWallCanvasProps }) {
  const [selection, setSelection] = useState<readonly string[]>(
    initial.selection,
  );
  return (
    <ProjectWallCanvas
      {...initial}
      onSelectionChange={(ids) => {
        initial.onSelectionChange(ids);
        setSelection(ids);
      }}
      selection={selection}
    />
  );
}

function mount(canvas: ProjectWallCanvasProps) {
  act(() => root.render(<Harness initial={canvas} />));
}

function canvasSection() {
  return container.querySelector<HTMLElement>(
    '[aria-label="Project Wall canvas"]',
  ) as HTMLElement;
}

function press(
  key: string,
  init: KeyboardEventInit = {},
  target: HTMLElement = canvasSection(),
) {
  act(() => {
    target.dispatchEvent(
      new KeyboardEvent("keydown", { bubbles: true, key, ...init }),
    );
  });
}

function button(text: string) {
  const found = [...container.querySelectorAll("button")].find(
    (entry) => entry.textContent?.trim() === text,
  );
  if (!found) {
    throw new Error(`No button "${text}"`);
  }
  return found as HTMLButtonElement;
}

beforeEach(() => {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe("canvas keyboard and toolbar without a pointer", () => {
  const cards = [card(0), card(1), card(2)];

  test("select all, nudge, align and distribute move wall positions only", () => {
    const canvas = props(cards);
    mount(canvas);

    press("a", { ctrlKey: true });
    expect(canvas.onSelectionChange).toHaveBeenLastCalledWith([
      "card-0",
      "card-1",
      "card-2",
    ]);

    press("ArrowRight");
    expect(canvas.onMove).toHaveBeenLastCalledWith([
      { cardId: "card-0", position: { x: 8, y: 0 } },
      { cardId: "card-1", position: { x: 408, y: 10 } },
      { cardId: "card-2", position: { x: 808, y: 20 } },
    ]);

    act(() => button("Align Left").click());
    const aligned = (canvas.onMove as ReturnType<typeof vi.fn>).mock.lastCall;
    expect(
      aligned?.[0].map((move: { position: { x: number } }) => move.position.x),
    ).toEqual([0, 0]);

    act(() => button("Distribute Vertically").click());
    expect(canvas.onMove).toHaveBeenCalled();
  });

  test("z-order, Escape and Fit View", () => {
    const canvas = props(cards, { selection: ["card-0"] });
    mount(canvas);
    press("}", { ctrlKey: true });
    expect(canvas.onReorder).toHaveBeenLastCalledWith([
      "card-1",
      "card-2",
      "card-0",
    ]);
    act(() => button("Send to Back").click());
    expect(canvas.onReorder).toHaveBeenCalledTimes(2);
    press("Escape");
    expect(canvas.onSelectionChange).toHaveBeenLastCalledWith([]);
  });

  test("Enter on a focused card selects it", () => {
    const canvas = props(cards);
    mount(canvas);
    const node = document.createElement("div");
    node.className = "react-flow__node";
    node.dataset.id = "card-1";
    node.tabIndex = 0;
    canvasSection().append(node);
    press("Enter", {}, node);
    expect(canvas.onSelectionChange).toHaveBeenLastCalledWith(["card-1"]);
    node.remove();
  });

  test("keys typed into a field are left alone", () => {
    const canvas = props(cards, { selection: ["card-0"] });
    mount(canvas);
    const field = document.createElement("input");
    canvasSection().append(field);
    press("ArrowRight", {}, field);
    expect(canvas.onMove).not.toHaveBeenCalled();
    field.remove();
  });

  test("Lock Position keeps a card fixed in nudge and Align", () => {
    const locked = [card(0, { locked: true }), card(1), card(2)];
    const canvas = props(locked, { selection: ["card-0", "card-1"] });
    mount(canvas);
    press("ArrowDown");
    expect(canvas.onMove).toHaveBeenLastCalledWith([
      { cardId: "card-1", position: { x: 400, y: 18 } },
    ]);
  });

  test("auto-layout previews first, writes only when applied, and undoes", () => {
    const canvas = props(cards);
    mount(canvas);
    act(() => button("Preview Auto-layout").click());
    expect(canvas.onMove).not.toHaveBeenCalled();
    expect(container.textContent).toContain("Nothing is saved until you apply");

    act(() => button("Apply Auto-layout").click());
    expect(canvas.onMove).toHaveBeenCalledTimes(1);

    act(() => button("Undo Auto-layout").click());
    expect(canvas.onMove).toHaveBeenCalledTimes(2);
    const reverted = (canvas.onMove as ReturnType<typeof vi.fn>).mock
      .lastCall?.[0] as Array<{ cardId: string; position: { x: number } }>;
    expect(reverted.find(({ cardId }) => cardId === "card-2")?.position.x).toBe(
      800,
    );
  });

  test("Fit View with a collapsed group expands every group first", () => {
    const grouped = [card(0, { groupId: "g1" }), card(1)];
    const canvas = props(grouped, {
      groups: [{ collapsed: true, id: "g1", title: "Onboarding" }],
    });
    mount(canvas);
    act(() => button("Fit View").click());
    expect(canvas.onExpandAll).toHaveBeenCalledTimes(1);
  });
});

describe("hard scene", () => {
  test("beyond 500 visible cards the canvas warns and keeps every card", () => {
    const many = Array.from({ length: 501 }, (_, index) => card(index));
    mount(props(many));
    expect(container.textContent).toContain("Large wall");
    expect(container.textContent).toContain("nothing is removed");
  });

  test("500 visible cards and 750 links stay at full detail without a warning", () => {
    const exact = Array.from({ length: 500 }, (_, index) => card(index));
    const links = Array.from({ length: 750 }, (_, index) => ({
      fromCardId: `card-${index % 500}`,
      id: `l${index}`,
      label: "leads to",
      toCardId: `card-${(index + 1) % 500}`,
    }));
    mount(props(exact, { links }));
    expect(container.textContent).not.toContain("Large wall");
  });

  test("2,000 cards and 3,000 links mount without a crash", () => {
    const many = Array.from({ length: 2000 }, (_, index) => card(index));
    const links = Array.from({ length: 3000 }, (_, index) => ({
      fromCardId: `card-${index % 2000}`,
      id: `l${index}`,
      label: "leads to",
      toCardId: `card-${(index * 7 + 1) % 2000}`,
    }));
    expect(() => mount(props(many, { links }))).not.toThrow();
    expect(container.textContent).toContain("Large wall");
  });
});
