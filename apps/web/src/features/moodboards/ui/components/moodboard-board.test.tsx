// @vitest-environment happy-dom
import { type Moodboard, moodboardSchema } from "@cantiara/api/moodboards";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, test, vi } from "vitest";

import {
  BOARD_DETAIL_LIMIT,
  MoodboardBoard,
  type MoodboardBoardProps,
} from "./moodboard-board";

(
  globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const NOW = "2026-10-19T09:00:00.000Z";
let root: Root | null = null;
let host: HTMLElement | null = null;

afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
  root = null;
  host = null;
});

function board(count: number): Moodboard {
  return moodboardSchema.parse({
    createdAt: NOW,
    focusOrder: [],
    id: "moodboard-1",
    items: Array.from({ length: count }, (_, index) => ({
      color: "#112233",
      createdAt: NOW,
      id: `swatch-${index}`,
      kind: "Color Swatch",
      note: null,
      paletteGroupId: null,
      position: index,
      updatedAt: NOW,
    })),
    paletteGroups: [],
    projectId: "project-1",
    revision: 1,
    title: "Scene",
    updatedAt: NOW,
  });
}

function mount(
  moodboard: Moodboard,
  overrides: Partial<MoodboardBoardProps> = {},
) {
  const props: MoodboardBoardProps = {
    moodboard,
    onSelect: vi.fn(),
    onViewportChange: vi.fn(),
    savedViewport: null,
    selectedId: null,
    ...overrides,
  };
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  act(() => root?.render(<MoodboardBoard {...props} />));
  const surface = host.querySelector<HTMLElement>(
    "[data-testid='moodboard-board']",
  ) as HTMLElement;
  return { host, props, surface };
}

function read(surface: HTMLElement) {
  return {
    centerX: Number(surface.dataset.centerX),
    centerY: Number(surface.dataset.centerY),
    zoom: Number(surface.dataset.zoom),
  };
}

describe("Moodboard board personal viewport", () => {
  test("restores the saved center and zoom", () => {
    const saved = { centerX: 300, centerY: 200, zoom: 0.8 };

    const { surface } = mount(board(12), { savedViewport: saved });

    expect(read(surface)).toEqual(saved);
  });

  test("a saved position over deleted content fits visible content", () => {
    const saved = { centerX: 90_000, centerY: 90_000, zoom: 1 };

    const { surface } = mount(board(4), { savedViewport: saved });

    expect(read(surface)).not.toEqual(saved);
    expect(surface.querySelectorAll("button").length).toBe(4);
  });

  test("Fit View returns to neutral and saves no position", () => {
    const {
      host: container,
      props,
      surface,
    } = mount(board(30), {
      savedViewport: { centerX: 100, centerY: 100, zoom: 2 },
    });
    expect(read(surface).zoom).toBe(2);

    const fit = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent === "Fit View",
    ) as HTMLElement;
    act(() => fit.click());

    expect(props.onViewportChange).toHaveBeenCalledWith(null);
    expect(read(surface).zoom).toBeLessThan(2);
  });

  test("keyboard pans and zooms and reports each move", () => {
    const { props, surface } = mount(board(12), {
      savedViewport: { centerX: 300, centerY: 200, zoom: 1 },
    });

    act(() => {
      surface.dispatchEvent(
        new KeyboardEvent("keydown", { bubbles: true, key: "ArrowRight" }),
      );
    });
    expect(read(surface).centerX).toBe(380);
    act(() => {
      surface.dispatchEvent(
        new KeyboardEvent("keydown", { bubbles: true, key: "+" }),
      );
    });
    expect(read(surface).zoom).toBeCloseTo(1.25);
    expect(props.onViewportChange).toHaveBeenCalledTimes(2);
  });
});

describe("Moodboard board hard scenes", () => {
  test("500 visible items render at reduced detail without crashing", () => {
    const { surface } = mount(board(500));

    expect(surface.querySelectorAll("[aria-hidden='true']")).toHaveLength(500);
    expect(surface.querySelectorAll("button")).toHaveLength(0);
  });

  test("2.000 item data stress renders every item and keeps focus targets bounded", () => {
    const { surface } = mount(board(2000));

    expect(surface.querySelectorAll("[aria-hidden='true']").length).toBe(2000);
    expect(surface.querySelectorAll("button").length).toBeLessThanOrEqual(
      BOARD_DETAIL_LIMIT,
    );
  });
});
