import { normalizeColorHex, rgbToHex } from "@cantiara/api/moodboard-color";

/**
 * Eyedrop adapter for Color Swatch entry. The browser EyeDropper API is used
 * when present; otherwise the exact Moodboard visual is sampled on a canvas.
 * Everything here only returns a normalized HEX string for the entry field:
 * nothing is written until the founder adds the Color Swatch.
 */

interface EyeDropperResult {
  sRGBHex: string;
}

interface EyeDropperConstructor {
  new (): { open: () => Promise<EyeDropperResult> };
}

function eyeDropperConstructor(): EyeDropperConstructor | undefined {
  return (globalThis as { EyeDropper?: EyeDropperConstructor }).EyeDropper;
}

export function isEyeDropperAvailable() {
  return eyeDropperConstructor() !== undefined;
}

/** Opens the browser EyeDropper; null when unavailable, cancelled, or invalid. */
export async function pickColorWithEyeDropper(): Promise<string | null> {
  const EyeDropper = eyeDropperConstructor();
  if (!EyeDropper) {
    return null;
  }
  try {
    const { sRGBHex } = await new EyeDropper().open();
    return normalizeColorHex(sRGBHex);
  } catch {
    // The founder cancelled the picker.
    return null;
  }
}

export interface PointerRect {
  height: number;
  left: number;
  top: number;
  width: number;
}

/** Maps a pointer position over a rendered image to its natural pixel. */
export function naturalPixelAt(
  rect: PointerRect,
  natural: { height: number; width: number },
  clientX: number,
  clientY: number,
) {
  if (rect.width <= 0 || rect.height <= 0) {
    return null;
  }
  const x = Math.floor(((clientX - rect.left) / rect.width) * natural.width);
  const y = Math.floor(((clientY - rect.top) / rect.height) * natural.height);
  if (x < 0 || y < 0 || x >= natural.width || y >= natural.height) {
    return null;
  }
  return { x, y };
}

/** Reads one RGBA pixel as a normalized HEX; fully transparent pixels are null. */
export function hexFromPixelData(
  data: ArrayLike<number>,
  width: number,
  x: number,
  y: number,
): string | null {
  const offset = (y * width + x) * 4;
  const [r, g, b, a] = [
    data[offset],
    data[offset + 1],
    data[offset + 2],
    data[offset + 3],
  ];
  if (
    r === undefined ||
    g === undefined ||
    b === undefined ||
    a === undefined ||
    a === 0
  ) {
    return null;
  }
  return rgbToHex({ b, g, r });
}

/**
 * Canvas fallback: samples the pixel of the exact visual under the pointer.
 * Null when the image is cross-origin without CORS access (tainted canvas).
 */
export function sampleVisualColor(
  image: HTMLImageElement,
  clientX: number,
  clientY: number,
): string | null {
  const natural = {
    height: image.naturalHeight,
    width: image.naturalWidth,
  };
  const point = naturalPixelAt(
    image.getBoundingClientRect(),
    natural,
    clientX,
    clientY,
  );
  if (!point) {
    return null;
  }
  const canvas = document.createElement("canvas");
  canvas.width = 1;
  canvas.height = 1;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) {
    return null;
  }
  try {
    context.drawImage(image, point.x, point.y, 1, 1, 0, 0, 1, 1);
    return hexFromPixelData(context.getImageData(0, 0, 1, 1).data, 1, 0, 0);
  } catch {
    return null;
  }
}
