import { describe, expect, test } from "vitest";

import {
  formatHsl,
  formatRgb,
  hexToRgb,
  normalizeColorHex,
  parseColorInput,
  rgbToHex,
  rgbToHsl,
} from "./moodboard-color";

describe("Color Swatch parsing and normalization", () => {
  test.each([
    ["#ff8800", "#FF8800"],
    ["FF8800", "#FF8800"],
    ["#f80", "#FF8800"],
    ["  #Ff8800  ", "#FF8800"],
    ["rgb(255, 136, 0)", "#FF8800"],
    ["rgb(255 136 0)", "#FF8800"],
    ["255, 136, 0", "#FF8800"],
    ["hsl(32, 100%, 50%)", "#FF8800"],
    ["hsl(32deg 100% 50%)", "#FF8800"],
    ["hsl(392, 100%, 50%)", "#FF8800"],
  ])("normalizes %s to %s", (input, hex) => {
    expect(normalizeColorHex(input)).toBe(hex);
  });

  test.each([
    "",
    "#ff88",
    "#gg0000",
    "rgb(256, 0, 0)",
    "rgb(1, 2)",
    "rgb(1.5, 2, 3)",
    "hsl(10, 101%, 50%)",
    "hsl(10, 50, 50)",
    "red",
    "#ff8800; background: url(x)",
  ])("rejects %s", (input) => {
    expect(parseColorInput(input)).toBeNull();
    expect(normalizeColorHex(input)).toBeNull();
  });

  test("HEX, RGB, and HSL round trip back to the same normalized HEX", () => {
    for (const hex of ["#000000", "#FFFFFF", "#FF8800", "#3A7BD5", "#0F0F0F"]) {
      const rgb = hexToRgb(hex);
      expect(rgb).not.toBeNull();
      if (!rgb) {
        continue;
      }
      expect(rgbToHex(rgb)).toBe(hex);
      expect(normalizeColorHex(formatRgb(rgb))).toBe(hex);
      // Whole-number HSL is lossy: it must land within rounding of the source.
      const viaHsl = parseColorInput(formatHsl(rgbToHsl(rgb)));
      expect(Math.abs((viaHsl?.r ?? 999) - rgb.r)).toBeLessThanOrEqual(2);
      expect(Math.abs((viaHsl?.g ?? 999) - rgb.g)).toBeLessThanOrEqual(2);
      expect(Math.abs((viaHsl?.b ?? 999) - rgb.b)).toBeLessThanOrEqual(2);
    }
    expect(normalizeColorHex("hsl(32, 100%, 50%)")).toBe("#FF8800");
  });

  test("formats display strings", () => {
    expect(formatRgb({ b: 0, g: 136, r: 255 })).toBe("rgb(255, 136, 0)");
    expect(formatHsl({ h: 32, l: 50, s: 100 })).toBe("hsl(32, 100%, 50%)");
  });
});
