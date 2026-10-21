import { describe, expect, test } from "vitest";

import { commandForKey } from "../project-wall-keyboard";
import {
  alignCards,
  distributeCards,
  type LayoutCard,
  nudgeCards,
  previewAutoLayout,
  reorderSelection,
} from "../project-wall-layout";

function card(
  id: string,
  x: number,
  y: number,
  extra: Partial<LayoutCard> = {},
): LayoutCard {
  return { groupId: null, id, locked: false, position: { x, y }, ...extra };
}

const cards = [card("a", 0, 0), card("b", 500, 100), card("c", 200, 300)];

describe("Align", () => {
  test("left aligns to the leftmost selected card", () => {
    expect(alignCards(cards, ["a", "b", "c"], "left")).toEqual([
      { cardId: "b", position: { x: 0, y: 100 } },
      { cardId: "c", position: { x: 0, y: 300 } },
    ]);
  });

  test("top aligns to the topmost selected card", () => {
    const moves = alignCards(cards, ["a", "b", "c"], "top");
    expect(moves.map(({ position }) => position.y)).toEqual([0, 0]);
  });

  test("a Lock Position card stays fixed but still sets the bound", () => {
    const locked = [card("a", 0, 0), card("b", 500, 0, { locked: true })];
    const moves = alignCards(locked, ["a", "b"], "right");
    expect(moves).toEqual([{ cardId: "a", position: { x: 500, y: 0 } }]);
  });

  test("needs two selected cards", () => {
    expect(alignCards(cards, ["a"], "left")).toEqual([]);
  });
});

describe("Distribute", () => {
  test("spaces the middle cards evenly between the outer two", () => {
    const row = [card("a", 0, 0), card("b", 100, 0), card("c", 600, 0)];
    expect(distributeCards(row, ["a", "b", "c"], "horizontal")).toEqual([
      { cardId: "b", position: { x: 300, y: 0 } },
    ]);
  });

  test("needs three cards and never moves a locked card", () => {
    expect(distributeCards(cards, ["a", "b"], "vertical")).toEqual([]);
    const row = [
      card("a", 0, 0),
      card("b", 100, 0, { locked: true }),
      card("c", 600, 0),
    ];
    expect(distributeCards(row, ["a", "b", "c"], "horizontal")).toEqual([]);
  });
});

describe("nudge and z-order", () => {
  test("nudge skips Lock Position cards", () => {
    const set = [card("a", 0, 0), card("b", 0, 0, { locked: true })];
    expect(nudgeCards(set, ["a", "b"], { dx: 8, dy: 0 })).toEqual([
      { cardId: "a", position: { x: 8, y: 0 } },
    ]);
  });

  test("front, back, forward and backward", () => {
    const order = ["a", "b", "c", "d"];
    expect(reorderSelection(order, ["b"], "front")).toEqual([
      "a",
      "c",
      "d",
      "b",
    ]);
    expect(reorderSelection(order, ["c"], "back")).toEqual([
      "c",
      "a",
      "b",
      "d",
    ]);
    expect(reorderSelection(order, ["b"], "forward")).toEqual([
      "a",
      "c",
      "b",
      "d",
    ]);
    expect(reorderSelection(order, ["c"], "backward")).toEqual([
      "a",
      "c",
      "b",
      "d",
    ]);
    expect(reorderSelection(order, ["d"], "forward")).toEqual(order);
  });
});

describe("auto-layout", () => {
  const messy = [
    card("a", 900, 700, { groupId: "g2" }),
    card("b", 20, 40, { groupId: "g1" }),
    card("c", 300, 5, { groupId: "g1" }),
    card("d", 10, 500),
  ];

  test("previews group by group on a grid and does not write anything", () => {
    const preview = previewAutoLayout(messy, [], ["g1", "g2"]);
    const byId = new Map(
      preview.moves.map(({ cardId, position }) => [cardId, position]),
    );
    // g1 cards first (b, c), then g2 (a), then ungrouped (d).
    expect(byId.get("b")).toEqual({ x: 10, y: 5 });
    expect(byId.get("c")).toEqual({ x: 290, y: 5 });
    expect(byId.get("a")).toEqual({ x: 10, y: 205 });
    expect(messy[0].position).toEqual({ x: 900, y: 700 });
  });

  test("is reversible: previous restores every moved card", () => {
    const preview = previewAutoLayout(messy, [], ["g1", "g2"]);
    const restored = messy.map((item) => {
      const back = preview.previous.find(({ cardId }) => cardId === item.id);
      return back ? { ...item, position: back.position } : item;
    });
    expect(restored).toEqual(messy);
    expect(preview.previous).toHaveLength(preview.moves.length);
  });

  test("Lock Position keeps a card fixed and its cell free", () => {
    const set = [
      card("a", 0, 0),
      card("b", 400, 400, { locked: true }),
      card("c", 800, 800),
      card("d", 50, 900),
    ];
    const preview = previewAutoLayout(set, []);
    expect(preview.fixed).toEqual(["b"]);
    expect(preview.moves.some(({ cardId }) => cardId === "b")).toBe(false);
    for (const { position } of preview.moves) {
      const hitsLocked =
        position.x < 400 + 240 &&
        position.x + 240 > 400 &&
        position.y < 400 + 160 &&
        position.y + 160 > 400;
      expect(hitsLocked).toBe(false);
    }
  });

  test("a selection lays out only the selected cards", () => {
    const preview = previewAutoLayout(messy, ["a", "d"]);
    expect(preview.moves.map(({ cardId }) => cardId).sort()).toEqual([
      "a",
      "d",
    ]);
  });
});

describe("keyboard map", () => {
  const base = {
    altKey: false,
    ctrlKey: false,
    metaKey: false,
    shiftKey: false,
  };

  test("pan, zoom, select, move, align, distribute and z-order", () => {
    expect(commandForKey({ ...base, key: "ArrowLeft", altKey: true })).toEqual({
      dx: -80,
      dy: 0,
      type: "pan",
    });
    expect(commandForKey({ ...base, key: "+" })).toEqual({ type: "zoomIn" });
    expect(commandForKey({ ...base, key: "-" })).toEqual({ type: "zoomOut" });
    expect(commandForKey({ ...base, key: "0" })).toEqual({ type: "fitView" });
    expect(commandForKey({ ...base, ctrlKey: true, key: "a" })).toEqual({
      type: "selectAll",
    });
    expect(
      commandForKey({ ...base, key: "ArrowDown", shiftKey: true }),
    ).toEqual({ dx: 0, dy: 64, type: "nudge" });
    expect(
      commandForKey({
        ...base,
        altKey: true,
        code: "KeyL",
        key: "¬",
        shiftKey: true,
      }),
    ).toEqual({ edge: "left", type: "align" });
    expect(
      commandForKey({
        ...base,
        altKey: true,
        code: "KeyH",
        key: "˙",
        shiftKey: true,
      }),
    ).toEqual({ axis: "horizontal", type: "distribute" });
    expect(commandForKey({ ...base, ctrlKey: true, key: "}" })).toEqual({
      move: "front",
      type: "reorder",
    });
    expect(commandForKey({ ...base, key: "q" })).toBeNull();
  });
});
