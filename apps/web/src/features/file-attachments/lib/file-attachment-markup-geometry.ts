export interface ContentBox {
  height: number;
  left: number;
  top: number;
  width: number;
}

export function clampCoordinate(value: number) {
  return Math.min(1, Math.max(0, value));
}

/**
 * Resolves the displayed content rect of a letterboxed media element
 * (object-contain) inside its element box, so Marking and Bind as origin
 * coordinates stay bound to the source visual instead of the responsive
 * element box around it.
 */
export function objectContainBox(
  contentWidth: number,
  contentHeight: number,
  boxWidth: number,
  boxHeight: number,
): ContentBox {
  const scale = Math.min(
    boxWidth / Math.max(contentWidth, 1),
    boxHeight / Math.max(contentHeight, 1),
  );
  const width = contentWidth * scale;
  const height = contentHeight * scale;
  return {
    height,
    left: (boxWidth - width) / 2,
    top: (boxHeight - height) / 2,
    width,
  };
}
