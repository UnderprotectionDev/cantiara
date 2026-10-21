// @vitest-environment happy-dom
import type { OutlineSourceTarget } from "@cantiara/api/moodboard-outline";
import { type Moodboard, moodboardSchema } from "@cantiara/api/moodboards";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, test, vi } from "vitest";

import {
  MoodboardOutline,
  type MoodboardOutlineProps,
  OUTLINE_VIRTUALIZE_THRESHOLD,
} from "../moodboard-outline";

(
  globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const NOW = "2026-10-19T09:00:00.000Z";
const FIRST_LABEL = "Visual 0 (https://example.com/0.png)";
let root: Root | null = null;
let host: HTMLElement | null = null;

afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
  root = null;
  host = null;
});

function scene(visuals: number, swatches: number, groups = 0): Moodboard {
  return moodboardSchema.parse({
    createdAt: NOW,
    focusOrder: [],
    id: "moodboard-1",
    items: [
      ...Array.from({ length: visuals }, (_, index) => ({
        caption: `Visual ${index}`,
        createdAt: NOW,
        id: `visual-${index}`,
        kind: "Visual",
        origin:
          index % 2 === 0
            ? { kind: "External link", url: `https://example.com/${index}.png` }
            : {
                attachmentVersionId: `version-${index}`,
                kind: "File Attachment version",
              },
        position: index,
        updatedAt: NOW,
        view: { crop: null, rotation: 0 },
      })),
      ...Array.from({ length: swatches }, (_, index) => ({
        color: "#112233",
        createdAt: NOW,
        id: `swatch-${index}`,
        kind: "Color Swatch",
        note: null,
        paletteGroupId: groups > 0 ? `group-${index % groups}` : null,
        position: visuals + index,
        updatedAt: NOW,
      })),
    ],
    paletteGroups: Array.from({ length: groups }, (_, index) => ({
      id: `group-${index}`,
      name: `Group ${index}`,
      position: index,
    })),
    projectId: "project-1",
    revision: 1,
    title: "Scene",
    updatedAt: NOW,
  });
}

function mount(
  moodboard: Moodboard,
  overrides: Partial<MoodboardOutlineProps> = {},
) {
  const props: MoodboardOutlineProps = {
    busy: false,
    collapsed: [],
    moodboard,
    onGroup: vi.fn(),
    onOpenSource: vi.fn(),
    onReorder: vi.fn(),
    onSelect: vi.fn(),
    onToggleSection: vi.fn(),
    selectedId: null,
    ...overrides,
  };
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  act(() => root?.render(<MoodboardOutline {...props} />));
  return { host, props };
}

function byLabel(container: HTMLElement, label: string) {
  const found = container.querySelector<HTMLElement>(`[aria-label="${label}"]`);
  if (!found) {
    throw new Error(`Missing control: ${label}`);
  }
  return found;
}

function rowButton(container: HTMLElement, index: number) {
  const found = container.querySelector<HTMLElement>(
    `[data-outline-index='${index}']`,
  );
  if (!found) {
    throw new Error(`Missing outline row ${index}`);
  }
  return found;
}

function press(element: HTMLElement) {
  act(() => element.click());
}

function key(element: HTMLElement, name: string) {
  act(() => {
    element.dispatchEvent(
      new KeyboardEvent("keydown", { bubbles: true, key: name }),
    );
  });
}

describe("Moodboard Outline tasks without a pointer", () => {
  test("selects, reorders, inspects, and opens the source record from buttons", () => {
    const { host: container, props } = mount(scene(3, 0));

    press(rowButton(container, 1));
    expect(props.onSelect).toHaveBeenCalledWith("visual-0");

    press(byLabel(container, `Move down: ${FIRST_LABEL}`));
    expect(props.onReorder).toHaveBeenCalledWith([
      "visual-1",
      "visual-0",
      "visual-2",
    ]);
    expect(byLabel(container, `Move up: ${FIRST_LABEL}`)).toHaveProperty(
      "disabled",
      true,
    );

    press(byLabel(container, `Open Source Record: ${FIRST_LABEL}`));
    expect(props.onOpenSource).toHaveBeenCalledWith(
      {
        kind: "link",
        url: "https://example.com/0.png",
      } satisfies OutlineSourceTarget,
      "visual-0",
    );
    press(
      byLabel(
        container,
        "Open Source Record: Visual 1 (File Attachment version version-1)",
      ),
    );
    expect(props.onOpenSource).toHaveBeenLastCalledWith(
      { attachmentVersionId: "version-1", kind: "attachment" },
      "visual-1",
    );

    const inspect = byLabel(container, `Inspect: ${FIRST_LABEL}`);
    expect(inspect.getAttribute("aria-expanded")).toBe("false");
    press(inspect);
    expect(inspect.getAttribute("aria-expanded")).toBe("true");
    expect(container.textContent).toContain(
      "External link: https://example.com/0.png",
    );
  });

  test("groups a Color Swatch and offers no Open Source Record for it", () => {
    const { host: container, props } = mount(scene(0, 1, 2));
    const label = "Color Swatch #112233";

    const select = byLabel(container, `Group: ${label}`) as HTMLSelectElement;
    act(() => {
      select.value = "group-1";
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });

    expect(props.onGroup).toHaveBeenCalledWith("swatch-0", "group-1");
    expect(
      container.querySelector(`[aria-label="Open Source Record: ${label}"]`),
    ).toBeNull();
  });

  test("arrow keys, Home, and End move focus between rows", () => {
    const { host: container } = mount(scene(3, 0));
    const first = rowButton(container, 1);
    first.focus();

    key(first, "ArrowDown");
    expect(document.activeElement).toBe(rowButton(container, 2));
    key(document.activeElement as HTMLElement, "End");
    expect(document.activeElement).toBe(rowButton(container, 3));
    key(document.activeElement as HTMLElement, "Home");
    expect(document.activeElement).toBe(rowButton(container, 0));
  });

  test("a section toggles collapse and exposes its state", () => {
    const { host: container, props } = mount(scene(2, 0), {
      collapsed: ["visuals"],
    });

    const toggle = container.querySelector<HTMLElement>(
      "[aria-expanded]",
    ) as HTMLElement;
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(toggle.textContent).toContain("Expand");
    expect(container.querySelector("[data-outline-index='1']")).toBeNull();
    press(toggle);
    expect(props.onToggleSection).toHaveBeenCalledWith("visuals");
  });

  test("shows the add controls slot", () => {
    const { host: container } = mount(scene(0, 0), {
      addControls: <button type="button">Add visual</button>,
    });
    expect(container.textContent).toContain("Add visual");
  });
});

describe("Moodboard Outline hard scenes", () => {
  test("500 visible items with 100 groups render a bounded, virtualized window", () => {
    const { host: container } = mount(scene(300, 200, 100));

    const outline = container.querySelector("section");
    expect(outline?.getAttribute("data-virtualized")).toBe("true");
    const rendered = container.querySelectorAll("li").length;
    expect(rendered).toBeGreaterThan(0);
    expect(rendered).toBeLessThan(OUTLINE_VIRTUALIZE_THRESHOLD + 50);
  });

  test("2.000 item data stress renders without crashing or dropping data", () => {
    const board = scene(1200, 800, 100);
    const { host: container } = mount(board);

    expect(container.querySelectorAll("li").length).toBeLessThan(200);
    expect(board.items).toHaveLength(2000);
    const setSize = Number(
      container.querySelector("[aria-setsize]")?.getAttribute("aria-setsize"),
    );
    expect(setSize).toBeGreaterThanOrEqual(2000);
  });
});
