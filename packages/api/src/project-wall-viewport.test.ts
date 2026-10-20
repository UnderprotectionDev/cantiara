import { describe, expect, test } from "vitest";

import {
  liveCollapsedGroups,
  PROJECT_WALL_SCENE_ITEM_LIMIT,
  PROJECT_WALL_SCENE_LINK_LIMIT,
  projectWallSceneStatus,
  projectWallViewportSchema,
  resolveProjectWallViewport,
} from "./project-wall-viewport";

const FRAME = { height: 400, width: 800 };

const content = {
  cards: [
    { groupId: null, position: { x: 0, y: 0 } },
    { groupId: "g1", position: { x: 2000, y: 0 } },
  ],
  groups: [{ id: "g1" }],
};

describe("Project Wall viewport resolution", () => {
  test("restores a saved position that still shows a card", () => {
    const saved = { center: { x: 100, y: 50 }, collapsed: [], zoom: 1 };
    expect(
      resolveProjectWallViewport({ content, frame: FRAME, saved }),
    ).toEqual({
      collapsed: [],
      mode: "restore",
      viewport: { center: saved.center, zoom: 1 },
    });
  });

  test("without a saved position it fits visible content", () => {
    expect(
      resolveProjectWallViewport({ content, frame: FRAME, saved: null }),
    ).toEqual({ collapsed: [], mode: "fit" });
  });

  test("a position over an empty region is meaningless and fits", () => {
    const saved = { center: { x: 9000, y: 9000 }, collapsed: [], zoom: 1 };
    expect(
      resolveProjectWallViewport({ content, frame: FRAME, saved }).mode,
    ).toBe("fit");
  });

  test("cards hidden by a collapsed group do not make a position meaningful", () => {
    const saved = { center: { x: 2000, y: 0 }, collapsed: ["g1"], zoom: 1 };
    const resolved = resolveProjectWallViewport({
      content,
      frame: FRAME,
      saved,
    });
    expect(resolved).toEqual({ collapsed: ["g1"], mode: "fit" });
  });

  test("an empty wall fits", () => {
    const saved = { center: { x: 0, y: 0 }, collapsed: [], zoom: 1 };
    expect(
      resolveProjectWallViewport({
        content: { cards: [], groups: [] },
        frame: FRAME,
        saved,
      }).mode,
    ).toBe("fit");
  });

  test("a stale collapse of a deleted group is dropped", () => {
    expect(liveCollapsedGroups([{ id: "g1" }], ["g1", "ghost", "g1"])).toEqual([
      "g1",
    ]);
  });

  test("the schema is strict and has no selection or inspector field", () => {
    const base = { center: { x: 0, y: 0 }, collapsed: [], zoom: 1 };
    expect(projectWallViewportSchema.safeParse(base).success).toBe(true);
    expect(
      projectWallViewportSchema.safeParse({ ...base, selection: ["a"] })
        .success,
    ).toBe(false);
    expect(
      projectWallViewportSchema.safeParse({ ...base, zoom: 50 }).success,
    ).toBe(false);
  });
});

describe("Project Wall scene status", () => {
  test("500 visible cards and 750 links keep full detail", () => {
    expect(
      projectWallSceneStatus({
        linkCount: PROJECT_WALL_SCENE_LINK_LIMIT,
        visibleCardCount: PROJECT_WALL_SCENE_ITEM_LIMIT,
      }),
    ).toEqual({ reducedDetail: false, warning: null });
  });

  test("beyond the hard scene it warns and reduces detail without a cap", () => {
    const status = projectWallSceneStatus({
      linkCount: 3000,
      visibleCardCount: 2000,
    });
    expect(status.reducedDetail).toBe(true);
    expect(status.warning).toContain("2000");
    expect(status.warning).toContain("nothing is removed");
  });
});
