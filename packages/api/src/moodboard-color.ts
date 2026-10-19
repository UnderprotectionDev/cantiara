/**
 * Pure Color Swatch math. A swatch stores one normalized `#RRGGBB` value; HEX,
 * RGB, and HSL entry are only input and display forms of that value.
 */
export interface Rgb {
  b: number;
  g: number;
  r: number;
}

export interface Hsl {
  h: number;
  l: number;
  s: number;
}

const HEX_PATTERN = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i;
const RGB_PATTERN =
  /^(?:rgb\(\s*)?(\d{1,3})\s*[,\s]\s*(\d{1,3})\s*[,\s]\s*(\d{1,3})\s*\)?$/i;
const HSL_PATTERN =
  /^hsl\(\s*(-?\d{1,4})(?:deg)?\s*[,\s]\s*(\d{1,3})%\s*[,\s]\s*(\d{1,3})%\s*\)$/i;

function channelToHex(value: number) {
  return value.toString(16).padStart(2, "0").toUpperCase();
}

export function rgbToHex({ b, g, r }: Rgb) {
  return `#${channelToHex(r)}${channelToHex(g)}${channelToHex(b)}`;
}

export function hexToRgb(hex: string): Rgb | null {
  const match = HEX_PATTERN.exec(hex.trim());
  if (!match?.[1]) {
    return null;
  }
  const digits =
    match[1].length === 3
      ? [...match[1]].map((digit) => digit + digit).join("")
      : match[1];
  return {
    b: Number.parseInt(digits.slice(4, 6), 16),
    g: Number.parseInt(digits.slice(2, 4), 16),
    r: Number.parseInt(digits.slice(0, 2), 16),
  };
}

export function rgbToHsl({ b, g, r }: Rgb): Hsl {
  const [red, green, blue] = [r / 255, g / 255, b / 255] as const;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const delta = max - min;
  const lightness = (max + min) / 2;
  if (delta === 0) {
    return { h: 0, l: Math.round(lightness * 100), s: 0 };
  }
  const saturation = delta / (1 - Math.abs(2 * lightness - 1));
  let hue: number;
  if (max === red) {
    hue = ((green - blue) / delta) % 6;
  } else if (max === green) {
    hue = (blue - red) / delta + 2;
  } else {
    hue = (red - green) / delta + 4;
  }
  return {
    h: Math.round((hue * 60 + 360) % 360),
    l: Math.round(lightness * 100),
    s: Math.round(saturation * 100),
  };
}

export function hslToRgb({ h, l, s }: Hsl): Rgb {
  const saturation = s / 100;
  const lightness = l / 100;
  const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation;
  const hue = (((h % 360) + 360) % 360) / 60;
  const second = chroma * (1 - Math.abs((hue % 2) - 1));
  const offset = lightness - chroma / 2;
  const sectors: [number, number, number][] = [
    [chroma, second, 0],
    [second, chroma, 0],
    [0, chroma, second],
    [0, second, chroma],
    [second, 0, chroma],
    [chroma, 0, second],
  ];
  const [red, green, blue] = sectors[Math.floor(hue) % 6] ?? [0, 0, 0];
  const toChannel = (value: number) => Math.round((value + offset) * 255);
  return { b: toChannel(blue), g: toChannel(green), r: toChannel(red) };
}

export function formatRgb({ b, g, r }: Rgb) {
  return `rgb(${r}, ${g}, ${b})`;
}

export function formatHsl({ h, l, s }: Hsl) {
  return `hsl(${h}, ${s}%, ${l}%)`;
}

/** Parses HEX (`#abc`, `#aabbcc`), RGB, or HSL entry; null when invalid. */
export function parseColorInput(input: string): Rgb | null {
  const value = input.trim();
  const hex = hexToRgb(value);
  if (hex) {
    return hex;
  }
  const rgb = RGB_PATTERN.exec(value);
  if (rgb) {
    const [r, g, b] = [rgb[1], rgb[2], rgb[3]].map(Number) as [
      number,
      number,
      number,
    ];
    return [r, g, b].every((channel) => channel <= 255) ? { b, g, r } : null;
  }
  const hsl = HSL_PATTERN.exec(value);
  if (hsl) {
    const [h, s, l] = [hsl[1], hsl[2], hsl[3]].map(Number) as [
      number,
      number,
      number,
    ];
    return s <= 100 && l <= 100 ? hslToRgb({ h, l, s }) : null;
  }
  return null;
}

/** Normalized `#RRGGBB`, or null when the input is not a color. */
export function normalizeColorHex(input: string): string | null {
  const rgb = parseColorInput(input);
  return rgb ? rgbToHex(rgb) : null;
}
