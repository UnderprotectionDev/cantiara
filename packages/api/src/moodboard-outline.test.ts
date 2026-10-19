import { describe, expect, test } from "vitest";

import {
  buildOutlineSections,
  dropWithinSection,
  flattenOutline,
  moveWithinSection,
  nextOutlineIndex,
  outlineSourceTarget,
} from "./moodboard-outline";
import {
  OUTLINE_UNGROUPED_SECTION,
  OUTLINE_VISUALS_SECTION,
} from "./moodboard-viewport";
import { type Moodboard, moodboardSchema } from "./moodboards";

const NOW = "2026-10-19T09:00:00.000Z";

function sceneMoodboard(visuals: number, swatches: number, groups = 0) {
  const paletteGroups = Array.from({ length: groups }, (_, index) => ({
    id: `group-${index}`,
    name: `Group ${index}`,
    position: index,
  }));
  const items = [
    ...Array.from({ length: visuals }, (_, index) => ({
      caption: index % 3 === 0 ? `Caption ${index}` : null,
      createdAt: NOW,
      id: `visual-${index}`,
      kind: "Visual" as const,
      origin:
        index % 2 === 0
          ? {
              kind: "External link" as const,
              url: `https://example.com/${index}.png`,
            }
          : {
              attachmentVersionId: `version-${index}`,
              kind: "File Attachment version" as const,
            },
      position: index,
      updatedAt: NOW,
      view: { crop: null, rotation: 0 as const },
    })),
    ...Array.from({ length: swatches }, (_, index) => ({
      color: "#112233",
      createdAt: NOW,
      id: `swatch-${index}`,
      kind: "Color Swatch" as const,
      note: null,
      paletteGroupId: groups > 0 ? `group-${index % groups}` : null,
      position: visuals + index,
      updatedAt: NOW,
    })),
  ];
  return moodboardSchema.parse({
    createdAt: NOW,
    focusOrder: [],
    id: "moodboard-1",
    items,
    paletteGroups,
    projectId: "project-1",
    revision: 1,
    title: "Scene",
    updatedAt: NOW,
  });
}

describe("Moodboard structured outline", () => {
  test("lists visuals, one section per Palette group, then ungrouped swatches", () => {
    const board = sceneMoodboard(2, 3, 1);
    board.items.push({
      color: "#445566",
      createdAt: NOW,
      id: "swatch-loose",
      kind: "Color Swatch",
      note: null,
      paletteGroupId: null,
      position: 5,
      updatedAt: NOW,
    });

    const sections = buildOutlineSections(board, []);

    expect(sections.map(({ key }) => key)).toEqual([
      OUTLINE_VISUALS_SECTION,
      "group-0",
      OUTLINE_UNGROUPED_SECTION,
    ]);
    expect(sections[1]?.items).toHaveLength(3);
    expect(sections[2]?.items.map(({ id }) => id)).toEqual(["swatch-loose"]);
  });

  test("collapse hides section members but keeps the section header reachable", () => {
    const board = sceneMoodboard(3, 0);

    const rows = flattenOutline(
      buildOutlineSections(board, [OUTLINE_VISUALS_SECTION]),
    );

    expect(rows.map(({ kind }) => kind)).toEqual(["section"]);
    expect(
      flattenOutline(buildOutlineSections(board, [])).map(({ kind }) => kind),
    ).toEqual(["section", "item", "item", "item"]);
  });

  test("Open Source Record targets the exact origin and a swatch has none", () => {
    const board = sceneMoodboard(2, 1);
    const [link, attachment, swatch] = board.items;

    expect(link && outlineSourceTarget(link)).toEqual({
      kind: "link",
      url: "https://example.com/0.png",
    });
    expect(attachment && outlineSourceTarget(attachment)).toEqual({
      attachmentVersionId: "version-1",
      kind: "attachment",
    });
    expect(swatch && outlineSourceTarget(swatch)).toBeNull();
  });

  test("Move up and Move down swap inside a section and stop at its edge", () => {
    const order = ["a", "x", "b", "y", "c"];
    const section = ["a", "b", "c"];

    expect(moveWithinSection(order, section, "b", "up")).toEqual([
      "b",
      "x",
      "a",
      "y",
      "c",
    ]);
    expect(moveWithinSection(order, section, "b", "down")).toEqual([
      "a",
      "x",
      "c",
      "y",
      "b",
    ]);
    expect(moveWithinSection(order, section, "a", "up")).toBeNull();
    expect(moveWithinSection(order, section, "c", "down")).toBeNull();
    expect(moveWithinSection(order, section, "missing", "up")).toBeNull();
  });

  test("a drop keeps the section's slots and every other item in place", () => {
    const order = ["a", "x", "b", "y", "c"];
    const section = ["a", "b", "c"];

    const dropped = dropWithinSection(order, section, "c", "a");

    expect(dropped).toEqual(["c", "x", "a", "y", "b"]);
    expect([...(dropped ?? [])].sort()).toEqual([...order].sort());
    expect(dropWithinSection(order, section, "a", "a")).toBeNull();
    expect(dropWithinSection(order, section, "a", "x")).toBeNull();
  });

  test("roving focus moves one row, jumps to the ends, and clamps", () => {
    expect(nextOutlineIndex(5, 2, "ArrowDown")).toBe(3);
    expect(nextOutlineIndex(5, 4, "ArrowDown")).toBe(4);
    expect(nextOutlineIndex(5, 0, "ArrowUp")).toBe(0);
    expect(nextOutlineIndex(5, 2, "Home")).toBe(0);
    expect(nextOutlineIndex(5, 2, "End")).toBe(4);
    expect(nextOutlineIndex(0, 0, "End")).toBe(-1);
  });
});

describe("Moodboard outline performance scenes", () => {
  function runScene(board: Moodboard) {
    const sections = buildOutlineSections(board, []);
    const listed = sections.flatMap(({ items }) => items);
    const rows = flattenOutline(sections);
    const order = board.items.map(({ id }) => id);
    const first = sections[0]?.items.map(({ id }) => id) ?? [];
    const [head] = first;
    const tail = first.at(-1);
    const moved =
      head && tail ? dropWithinSection(order, first, head, tail) : null;
    return {
      itemRows: rows.filter(({ kind }) => kind === "item"),
      listed,
      moved,
      order,
    };
  }

  test("500 visible items with 100 groups list, collapse, and reorder without loss", () => {
    const board = sceneMoodboard(300, 200, 100);

    const { itemRows, listed, moved, order } = runScene(board);

    expect(listed).toHaveLength(500);
    expect(new Set(listed.map(({ id }) => id)).size).toBe(500);
    expect(itemRows).toHaveLength(500);
    // A reorder across the whole scene is a permutation: nothing lost or doubled.
    expect([...(moved ?? [])].sort()).toEqual([...order].sort());
    const collapsedAll = buildOutlineSections(
      board,
      board.paletteGroups.map(({ id }) => id),
    );
    expect(flattenOutline(collapsedAll).length).toBeLessThan(500);
  });

  test("2.000 item data stress lists and reorders without loss", () => {
    const { itemRows, listed, moved, order } = runScene(
      sceneMoodboard(1200, 800, 100),
    );

    expect(listed).toHaveLength(2000);
    expect(new Set(listed.map(({ id }) => id)).size).toBe(2000);
    expect(itemRows).toHaveLength(2000);
    expect(moved).not.toBeNull();
    expect([...(moved ?? [])].sort()).toEqual([...order].sort());
  });
});
