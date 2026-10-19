import { describe, expect, test } from "vitest";

import {
  boardLayout,
  EMPTY_PERSONAL_VIEW,
  fitViewport,
  isMeaninglessViewport,
  OUTLINE_UNGROUPED_SECTION,
  OUTLINE_VISUALS_SECTION,
  panViewport,
  personalMoodboardViewSchema,
  pruneCollapsed,
  resolveViewport,
  toggleCollapsed,
  VIEWPORT_ZOOM_MAX,
  VIEWPORT_ZOOM_MIN,
  visibleRects,
  zoomViewport,
} from "./moodboard-viewport";

const SIZE = { height: 600, width: 800 };

function ids(count: number) {
  return Array.from({ length: count }, (_, index) => `item-${index}`);
}

describe("Moodboard personal viewport", () => {
  test("restores a saved position that still shows content", () => {
    const rects = boardLayout(ids(12));
    const saved = { centerX: 300, centerY: 200, zoom: 0.8 };

    expect(resolveViewport(saved, rects, SIZE)).toEqual({
      source: "restored",
      viewport: saved,
    });
  });

  test("without a saved position it fits all content", () => {
    const rects = boardLayout(ids(12));

    const resolved = resolveViewport(null, rects, SIZE);

    expect(resolved.source).toBe("fit");
    expect(visibleRects(rects, resolved.viewport, SIZE)).toHaveLength(12);
  });

  test("Fit View returns to the neutral viewport regardless of pan and zoom", () => {
    const rects = boardLayout(ids(30));
    const neutral = fitViewport(rects, SIZE);
    const moved = panViewport(zoomViewport(neutral, 3), 5000, -2000);

    expect(fitViewport(rects, SIZE)).toEqual(neutral);
    expect(moved).not.toEqual(neutral);
    expect(visibleRects(rects, neutral, SIZE)).toHaveLength(30);
  });

  test("a saved position over deleted or changed content fits visible content, never an empty region", () => {
    const before = boardLayout(ids(100));
    // The saved view was bottom-right of a 100 item board.
    const lastRect = before.at(-1);
    const saved = {
      centerX: (lastRect?.x ?? 0) + 120,
      centerY: (lastRect?.y ?? 0) + 90,
      zoom: 1,
    };
    expect(isMeaninglessViewport(saved, before, SIZE)).toBe(false);

    const after = boardLayout(ids(4));
    const resolved = resolveViewport(saved, after, SIZE);

    expect(isMeaninglessViewport(saved, after, SIZE)).toBe(true);
    expect(resolved.source).toBe("fit");
    expect(visibleRects(after, resolved.viewport, SIZE)).toHaveLength(4);
  });

  test("an empty board keeps a valid position and fits to the origin", () => {
    expect(
      resolveViewport({ centerX: 5, centerY: 5, zoom: 2 }, [], SIZE).source,
    ).toBe("restored");
    expect(fitViewport([], SIZE)).toEqual({ centerX: 0, centerY: 0, zoom: 1 });
  });

  test("a non-finite or out-of-range saved position is meaningless", () => {
    const rects = boardLayout(ids(3));

    for (const viewport of [
      { centerX: Number.NaN, centerY: 0, zoom: 1 },
      { centerX: 0, centerY: Number.POSITIVE_INFINITY, zoom: 1 },
      { centerX: 0, centerY: 0, zoom: 0 },
      { centerX: 0, centerY: 0, zoom: VIEWPORT_ZOOM_MAX + 1 },
    ]) {
      expect(isMeaninglessViewport(viewport, rects, SIZE)).toBe(true);
    }
  });

  test("zoom stays inside its range", () => {
    const start = { centerX: 0, centerY: 0, zoom: 1 };

    expect(zoomViewport(start, 1000).zoom).toBe(VIEWPORT_ZOOM_MAX);
    expect(zoomViewport(start, 0.0001).zoom).toBe(VIEWPORT_ZOOM_MIN);
  });

  test("the personal view accepts only center, zoom, and collapse", () => {
    expect(
      personalMoodboardViewSchema.safeParse(EMPTY_PERSONAL_VIEW).success,
    ).toBe(true);
    for (const extra of ["selection", "inspector", "unsavedOperations"]) {
      expect(
        personalMoodboardViewSchema.safeParse({
          ...EMPTY_PERSONAL_VIEW,
          [extra]: ["x"],
        }).success,
      ).toBe(false);
    }
    expect(
      personalMoodboardViewSchema.safeParse({
        collapsed: ["a", "a"],
        viewport: null,
      }).success,
    ).toBe(false);
  });

  test("collapse keys of deleted Palette groups are dropped and toggling is reversible", () => {
    expect(
      pruneCollapsed(
        [OUTLINE_VISUALS_SECTION, "group-live", "group-deleted"],
        ["group-live"],
      ),
    ).toEqual([OUTLINE_VISUALS_SECTION, "group-live"]);
    const collapsed = toggleCollapsed([], OUTLINE_UNGROUPED_SECTION);
    expect(collapsed).toEqual([OUTLINE_UNGROUPED_SECTION]);
    expect(toggleCollapsed(collapsed, OUTLINE_UNGROUPED_SECTION)).toEqual([]);
  });
});

describe("Moodboard canvas performance scenes", () => {
  test("500 visible items with 750 visual links lay out finitely and fit", () => {
    const rects = boardLayout(ids(500));
    // Links are sparse on a Moodboard; the budget still holds.
    const links = Array.from({ length: 750 }, (_, index) => ({
      from: rects[index % 500],
      to: rects[(index * 7 + 1) % 500],
    }));

    const fit = fitViewport(rects, SIZE);

    expect(new Set(rects.map(({ id }) => id)).size).toBe(500);
    expect(links.every(({ from, to }) => from && to)).toBe(true);
    expect(Object.values(fit).every((value) => Number.isFinite(value))).toBe(
      true,
    );
    expect(visibleRects(rects, fit, SIZE)).toHaveLength(500);
    // A zoomed-in view culls to a small subset, so rendering stays bounded.
    expect(visibleRects(rects, { ...fit, zoom: 1 }, SIZE).length).toBeLessThan(
      100,
    );
  });

  test("2.000 items stress layout, fit, and culling without losing an item", () => {
    const rects = boardLayout(ids(2000));

    const fit = fitViewport(rects, SIZE);

    expect(rects).toHaveLength(2000);
    expect(new Set(rects.map(({ id }) => id)).size).toBe(2000);
    expect(fit.zoom).toBeGreaterThanOrEqual(VIEWPORT_ZOOM_MIN);
    expect(visibleRects(rects, fit, SIZE)).toHaveLength(2000);
  });
});
