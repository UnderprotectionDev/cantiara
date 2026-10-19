import { describe, expect, test } from "vitest";

import {
  buildSnapshotPreview,
  planSnapshot,
  SNAPSHOT_SWATCHES_PER_PAGE,
  SNAPSHOT_VISUALS_PER_PAGE,
  snapshotPageCount,
} from "./moodboard-snapshot";
import {
  cropPixelRect,
  cropToInsets,
  DEFAULT_VISUAL_VIEW,
  insetsToCrop,
  isDefaultVisualView,
  presentationSequence,
  presentedSize,
  rotateQuarterTurn,
} from "./moodboard-view";
import type { Moodboard } from "./moodboards";

const NO_LIVE_LINKS = /no live source links/;
const CROP_OR_ROTATE = /Crop or Rotate 90°/;
const NOT_PUBLIC = /not a public share/;
const timestamp = "2026-10-19T09:00:00.000Z";

function board(visuals: number, swatches: number): Moodboard {
  return {
    createdAt: timestamp,
    focusOrder: [],
    id: "board-1",
    items: [
      ...Array.from({ length: visuals }, (_, index) => ({
        caption: null,
        createdAt: timestamp,
        id: `v${index}`,
        kind: "Visual" as const,
        origin: {
          kind: "External link" as const,
          url: `https://example.com/${index}`,
        },
        position: index,
        updatedAt: timestamp,
        view: DEFAULT_VISUAL_VIEW,
      })),
      ...Array.from({ length: swatches }, (_, index) => ({
        color: "#112233",
        createdAt: timestamp,
        id: `s${index}`,
        kind: "Color Swatch" as const,
        note: null,
        paletteGroupId: index % 2 === 0 ? "g1" : null,
        position: visuals + index,
        updatedAt: timestamp,
      })),
    ],
    paletteGroups: [{ id: "g1", name: "Warm", position: 0 }],
    projectId: "project-1",
    revision: 4,
    title: "Direction",
    updatedAt: timestamp,
  };
}

describe("view-local Crop and Rotate 90°", () => {
  test("four quarter turns return to the unedited presentation", () => {
    let view = DEFAULT_VISUAL_VIEW;
    const rotations = [] as number[];
    for (let turn = 0; turn < 4; turn += 1) {
      view = rotateQuarterTurn(view);
      rotations.push(view.rotation);
    }

    expect(rotations).toEqual([90, 180, 270, 0]);
    expect(isDefaultVisualView(view)).toBe(true);
  });

  test("crop applies before rotation and a quarter turn swaps the presented size", () => {
    const natural = { height: 1000, width: 2000 };
    const crop = { height: 5000, left: 1000, top: 0, width: 5000 };

    expect(cropPixelRect(natural, crop)).toEqual({
      height: 500,
      left: 200,
      top: 0,
      width: 1000,
    });
    expect(presentedSize(natural, { crop, rotation: 0 })).toEqual({
      height: 500,
      width: 1000,
    });
    expect(presentedSize(natural, { crop, rotation: 90 })).toEqual({
      height: 1000,
      width: 500,
    });
    expect(presentedSize(natural, DEFAULT_VISUAL_VIEW)).toEqual(natural);
  });

  test("insets round-trip to a crop and reject an empty or negative crop", () => {
    const crop = { height: 5000, left: 1000, top: 2000, width: 6000 };

    expect(insetsToCrop(cropToInsets(crop))).toEqual(crop);
    expect(insetsToCrop({ bottom: 0, left: 0, right: 0, top: 0 })).toBeNull();
    expect(insetsToCrop({ bottom: 0, left: 6000, right: 4000, top: 0 })).toBe(
      "invalid",
    );
    expect(insetsToCrop({ bottom: 0, left: -1, right: 0, top: 0 })).toBe(
      "invalid",
    );
  });
});

describe("Presentation Mode sequence", () => {
  test("uses the board order without a Focus order and skips removed items with one", () => {
    const { items } = board(2, 1);

    expect(presentationSequence(items, []).map(({ id }) => id)).toEqual([
      "v0",
      "v1",
      "s0",
    ]);
    expect(
      presentationSequence(items, ["s0", "gone", "v1"]).map(({ id }) => id),
    ).toEqual(["s0", "v1"]);
  });
});

describe("Snapshot page planning", () => {
  test("splits visuals and each Palette group into their own pages, never one page", () => {
    const sections = planSnapshot(
      board(SNAPSHOT_VISUALS_PER_PAGE + 1, SNAPSHOT_SWATCHES_PER_PAGE),
      board(
        SNAPSHOT_VISUALS_PER_PAGE + 1,
        SNAPSHOT_SWATCHES_PER_PAGE,
      ).items.map(({ id }) => id),
    );

    expect(
      sections.map(({ key, pages }) => [
        key,
        pages.map((p) => p.itemIds.length),
      ]),
    ).toEqual([
      ["visuals", [SNAPSHOT_VISUALS_PER_PAGE, 1]],
      ["palette:g1", [SNAPSHOT_SWATCHES_PER_PAGE / 2]],
      ["palette:none", [SNAPSHOT_SWATCHES_PER_PAGE / 2]],
    ]);
    expect(snapshotPageCount(sections)).toBe(4);
  });

  test("only the selected region is planned, in board order", () => {
    const sections = planSnapshot(board(3, 2), ["s1", "v2", "v0", "unknown"]);

    expect(sections.map(({ key, pages }) => [key, pages[0]?.itemIds])).toEqual([
      ["visuals", ["v0", "v2"]],
      ["palette:none", ["s1"]],
    ]);
  });

  test("the preview states no live links, the moment, and applied Crop or rotation", () => {
    const edited = board(2, 0);
    edited.items = edited.items.map((item) =>
      item.id === "v1" && item.kind === "Visual"
        ? { ...item, view: { crop: null, rotation: 90 as const } }
        : item,
    );

    const preview = buildSnapshotPreview(
      edited,
      ["v0", "v1"],
      new Date("2026-10-19T12:00:00.000Z"),
    );

    expect(preview.notices[0]).toMatch(NO_LIVE_LINKS);
    expect(preview.moment).toBe("Direction as of 2026-10-19, revision 4");
    expect(preview.transforms).toEqual([
      { caption: null, crop: false, itemId: "v1", rotation: 90 },
    ]);
    expect(preview.notices.join(" ")).toMatch(CROP_OR_ROTATE);
    expect(preview.notices.join(" ")).toMatch(NOT_PUBLIC);
  });
});
