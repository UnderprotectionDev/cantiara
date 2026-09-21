import { describe, expect, test } from "vitest";

import {
  clampCoordinate,
  objectContainBox,
} from "./file-attachment-markup-geometry";

describe("File Attachment markup geometry", () => {
  test("keeps Marking coordinates on the letterboxed source visual", () => {
    // A 16:9 visual inside a wider element box letterboxes on both sides.
    const box = objectContainBox(1600, 900, 1280, 560);

    expect(box.width).toBeCloseTo(995.55, 1);
    expect(box.height).toBeCloseTo(560, 1);
    expect(box.left).toBeCloseTo((1280 - box.width) / 2, 1);
    expect(box.top).toBe(0);
  });

  test("centers a portrait visual inside a wide element box", () => {
    const box = objectContainBox(900, 1600, 1280, 560);

    expect(box.width).toBeCloseTo(315, 1);
    expect(box.height).toBe(560);
    expect(box.left).toBeCloseTo((1280 - 315) / 2, 1);
  });

  test("fills the element box when the aspect ratios already match", () => {
    const box = objectContainBox(1280, 720, 1280, 720);

    expect(box).toEqual({ height: 720, left: 0, top: 0, width: 1280 });
  });

  test("stays finite for an unloaded media element", () => {
    const box = objectContainBox(0, 0, 1280, 720);

    expect(Number.isFinite(box.left)).toBe(true);
    expect(Number.isFinite(box.top)).toBe(true);
    expect(box.width).toBe(0);
    expect(box.height).toBe(0);
  });

  test("clamps Marking coordinates onto the source surface", () => {
    expect(clampCoordinate(-0.5)).toBe(0);
    expect(clampCoordinate(1.5)).toBe(1);
    expect(clampCoordinate(0.25)).toBe(0.25);
  });
});
