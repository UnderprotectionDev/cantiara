import type { ProjectWallCardView } from "@cantiara/api/project-wall";
import {
  PROJECT_WALL_SCENE_ITEM_LIMIT,
  PROJECT_WALL_SCENE_LINK_LIMIT,
  projectWallSceneStatus,
  resolveProjectWallViewport,
} from "@cantiara/api/project-wall-viewport";
import { describe, expect, test } from "vitest";
import {
  alignCards,
  distributeCards,
  type LayoutCard,
  nudgeCards,
  previewAutoLayout,
  reorderSelection,
} from "./project-wall-layout";
import {
  buildOutline,
  hiddenCardIds,
  moveInOutline,
} from "./project-wall-outline";
import {
  cardsInView,
  linksAmong,
  transformFromViewport,
} from "./project-wall-scene";

/**
 * Hard performance scene of spec 51 #388: 500 visible items and 750 Visual
 * links, and the 2,000 / 3,000 safety scene.
 *
 * What this measures: the pure wall model and Outline derivation that every
 * canvas gesture runs per interaction, in Node on the build machine, against
 * the 16 ms p95 / 33 ms max frame budget. It does NOT measure React Flow
 * painting, layout or GPU time: those need a real browser. The canvas relies
 * on React Flow's `onlyRenderVisibleElements` so paint cost follows the
 * viewport, not the 500 cards.
 */
const P95_MS = 16;
const MAX_MS = 33;
const SAMPLES = 40;
const FRAME = { height: 520, width: 1000 };

function cardView(index: number, groups: number): ProjectWallCardView {
  return {
    density: "Compact",
    fields: [],
    groupId: groups > 0 ? `g${index % groups}` : null,
    highlight: null,
    id: `c${index}`,
    locked: index % 97 === 0,
    placedAt: "2026-01-01T00:00:00.000Z",
    position: { x: (index % 50) * 260, y: Math.floor(index / 50) * 180 },
    preview: null,
    sharedSource: false,
    source: {
      broken: null,
      kind: "Work",
      openPath: `/projects/p1#work-${index}`,
      recordId: `w${index}`,
      status: "In Progress",
      title: `Card ${index}`,
    },
    sourceType: "Work",
  };
}

function scene(cardCount: number, linkCount: number, groupCount = 10) {
  const cards = Array.from({ length: cardCount }, (_, index) =>
    cardView(index, groupCount),
  );
  const groups = Array.from({ length: groupCount }, (_, index) => ({
    collapsed: false,
    id: `g${index}`,
    title: `Group ${index}`,
  }));
  const links = Array.from({ length: linkCount }, (_, index) => ({
    fromCardId: `c${index % cardCount}`,
    id: `l${index}`,
    label: "leads to",
    toCardId: `c${(index * 7 + 1) % cardCount}`,
  }));
  return { cards, groups, links };
}

function measure(run: () => unknown) {
  run();
  const times: number[] = [];
  for (let sample = 0; sample < SAMPLES; sample += 1) {
    const start = performance.now();
    run();
    times.push(performance.now() - start);
  }
  times.sort((a, b) => a - b);
  return {
    max: times.at(-1) ?? 0,
    p95: times[Math.ceil(times.length * 0.95) - 1] ?? 0,
  };
}

function operations(cardCount: number, linkCount: number) {
  const { cards, groups, links } = scene(cardCount, linkCount);
  const layout: LayoutCard[] = cards.map(
    ({ groupId, id, locked, position }) => ({ groupId, id, locked, position }),
  );
  const everything = layout.map(({ id }) => id);
  const order = everything;
  const groupOrder = groups.map(({ id }) => id);
  let pan = 0;
  const frameWork = () => {
    // One pan/zoom frame: the transform for the next step, the cards and
    // Visual links the canvas must mount for it.
    pan = (pan + 37) % 6000;
    const transform = transformFromViewport(
      { center: { x: pan, y: pan / 3 }, zoom: 0.5 + (pan % 7) / 10 },
      FRAME,
    );
    const visible = cardsInView(layout, transform, FRAME);
    return linksAmong(links, new Set(visible.map(({ id }) => id)));
  };
  const operationList: [string, () => unknown][] = [
    ["pan/zoom frame (visible cards and links)", frameWork],
    ["Outline rows", () => buildOutline(cards, groups, ["g1", "g2"])],
    ["collapsed group lookup", () => hiddenCardIds(cards, groups, ["g1"])],
    ["move one card in the Outline", () => moveInOutline(cards, "c250", "up")],
    [
      "nudge every selected card",
      () => nudgeCards(layout, everything, { dx: 8, dy: 0 }),
    ],
    ["Align", () => alignCards(layout, everything, "left")],
    ["Distribute", () => distributeCards(layout, everything, "horizontal")],
    ["bring all to front", () => reorderSelection(order, everything, "front")],
    ["bring one forward", () => reorderSelection(order, ["c10"], "forward")],
    ["auto-layout preview", () => previewAutoLayout(layout, [], groupOrder)],
    [
      "viewport restore decision",
      () =>
        resolveProjectWallViewport({
          content: { cards: layout, groups },
          frame: FRAME,
          saved: { center: { x: 3000, y: 1000 }, collapsed: ["g1"], zoom: 1 },
        }),
    ],
    [
      "scene status",
      () => projectWallSceneStatus({ linkCount, visibleCardCount: cardCount }),
    ],
  ];
  return operationList;
}

describe("500 visible / 750 Visual link hard scene", () => {
  test("the contract limits are the acceptance numbers", () => {
    expect(PROJECT_WALL_SCENE_ITEM_LIMIT).toBe(500);
    expect(PROJECT_WALL_SCENE_LINK_LIMIT).toBe(750);
  });

  for (const [name, run] of operations(500, 750)) {
    test(`${name}: p95 <= ${P95_MS} ms and max <= ${MAX_MS} ms`, () => {
      const { max, p95 } = measure(run);
      expect(p95).toBeLessThanOrEqual(P95_MS);
      expect(max).toBeLessThanOrEqual(MAX_MS);
    });
  }
});

describe("2,000 cards / 3,000 Visual links must not crash or lose data", () => {
  const { cards, groups, links } = scene(2000, 3000);
  const layout: LayoutCard[] = cards.map(
    ({ groupId, id, locked, position }) => ({ groupId, id, locked, position }),
  );

  test("every operation completes and keeps every card and link", () => {
    for (const [, run] of operations(2000, 3000)) {
      expect(() => run()).not.toThrow();
    }
    const rows = buildOutline(cards, groups, []);
    expect(rows.filter(({ kind }) => kind === "card")).toHaveLength(2000);
    const order = reorderSelection(
      cards.map(({ id }) => id),
      ["c5", "c6"],
      "front",
    );
    expect(new Set(order).size).toBe(2000);
    expect(links).toHaveLength(3000);
  });

  test("auto-layout never moves a Lock Position card and never drops a card", () => {
    const preview = previewAutoLayout(
      layout,
      [],
      groups.map(({ id }) => id),
    );
    const lockedIds = new Set(
      layout.filter(({ locked }) => locked).map(({ id }) => id),
    );
    expect(preview.moves.some(({ cardId }) => lockedIds.has(cardId))).toBe(
      false,
    );
    expect(preview.fixed).toHaveLength(lockedIds.size);
  });

  test("beyond the hard scene the canvas warns and reduces detail", () => {
    const status = projectWallSceneStatus({
      linkCount: 3000,
      visibleCardCount: 2000,
    });
    expect(status.reducedDetail).toBe(true);
    expect(status.warning).not.toBeNull();
  });

  test("a restore decision at 2,000 cards stays within the frame budget", () => {
    const { max } = measure(() =>
      resolveProjectWallViewport({
        content: { cards: layout, groups },
        frame: FRAME,
        saved: { center: { x: 0, y: 0 }, collapsed: [], zoom: 0.5 },
      }),
    );
    expect(max).toBeLessThanOrEqual(MAX_MS);
  });
});
