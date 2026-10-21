import { afterEach, describe, expect, test } from "vitest";

import {
  hexFromPixelData,
  isEyeDropperAvailable,
  naturalPixelAt,
  pickColorWithEyeDropper,
} from "../color-sampling";

afterEach(() => {
  Reflect.deleteProperty(globalThis, "EyeDropper");
});

describe("Color Swatch eyedrop adapter", () => {
  test("maps a pointer over a scaled image to its natural pixel", () => {
    const rect = { height: 50, left: 10, top: 20, width: 100 };
    const natural = { height: 100, width: 400 };

    expect(naturalPixelAt(rect, natural, 10, 20)).toEqual({ x: 0, y: 0 });
    expect(naturalPixelAt(rect, natural, 60, 45)).toEqual({ x: 200, y: 50 });
    expect(naturalPixelAt(rect, natural, 109.9, 69.9)).toEqual({
      x: 399,
      y: 99,
    });
    expect(naturalPixelAt(rect, natural, 9, 30)).toBeNull();
    expect(naturalPixelAt(rect, natural, 110, 30)).toBeNull();
    expect(naturalPixelAt({ ...rect, width: 0 }, natural, 10, 20)).toBeNull();
  });

  test("reads a pixel as normalized HEX and ignores transparent pixels", () => {
    const data = [0, 0, 0, 255, 255, 136, 0, 255, 9, 9, 9, 0];

    expect(hexFromPixelData(data, 3, 1, 0)).toBe("#FF8800");
    expect(hexFromPixelData(data, 3, 0, 0)).toBe("#000000");
    expect(hexFromPixelData(data, 3, 2, 0)).toBeNull();
    expect(hexFromPixelData(data, 3, 5, 5)).toBeNull();
  });

  test("uses the browser EyeDropper when present and normalizes its result", async () => {
    expect(isEyeDropperAvailable()).toBe(false);
    await expect(pickColorWithEyeDropper()).resolves.toBeNull();

    Object.defineProperty(globalThis, "EyeDropper", {
      configurable: true,
      value: class {
        open() {
          return Promise.resolve({ sRGBHex: "#3a7bd5" });
        }
      },
    });

    expect(isEyeDropperAvailable()).toBe(true);
    await expect(pickColorWithEyeDropper()).resolves.toBe("#3A7BD5");
  });

  test("a cancelled EyeDropper yields no color", async () => {
    Object.defineProperty(globalThis, "EyeDropper", {
      configurable: true,
      value: class {
        open() {
          return Promise.reject(new DOMException("cancelled", "AbortError"));
        }
      },
    });

    await expect(pickColorWithEyeDropper()).resolves.toBeNull();
  });
});
