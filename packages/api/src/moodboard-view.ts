import { z } from "zod";

/** Crop edges are basis points (0..10000) of the original image. */
export const CROP_SCALE = 10_000;

export const visualRotationSchema = z.union([
  z.literal(0),
  z.literal(90),
  z.literal(180),
  z.literal(270),
]);

export type VisualRotation = z.infer<typeof visualRotationSchema>;

export const visualCropSchema = z
  .object({
    height: z.number().int().min(1).max(CROP_SCALE),
    left: z
      .number()
      .int()
      .min(0)
      .max(CROP_SCALE - 1),
    top: z
      .number()
      .int()
      .min(0)
      .max(CROP_SCALE - 1),
    width: z.number().int().min(1).max(CROP_SCALE),
  })
  .strict()
  .refine(
    ({ left, width }) => left + width <= CROP_SCALE,
    "Crop must stay inside the image.",
  )
  .refine(
    ({ height, top }) => top + height <= CROP_SCALE,
    "Crop must stay inside the image.",
  );

export type VisualCrop = z.infer<typeof visualCropSchema>;

/**
 * View-local presentation of one visual on one Moodboard: crop first, then the
 * clockwise rotation. It is metadata only; original bytes are never rewritten.
 */
export const visualViewSchema = z
  .object({
    crop: visualCropSchema.nullable(),
    rotation: visualRotationSchema,
  })
  .strict();

export type VisualView = z.infer<typeof visualViewSchema>;

export const DEFAULT_VISUAL_VIEW: VisualView = { crop: null, rotation: 0 };

export function isDefaultVisualView(view: VisualView) {
  return view.crop === null && view.rotation === 0;
}

/** `Rotate 90°`: one clockwise quarter turn; the fourth turn returns to 0. */
export function rotateQuarterTurn(view: VisualView): VisualView {
  return {
    ...view,
    rotation: ((view.rotation + 90) % 360) as VisualRotation,
  };
}

/** The stable key a view is bound to: the exact File Attachment version or link. */
export function visualOriginKey(
  origin:
    | { attachmentVersionId: string; kind: "File Attachment version" }
    | { kind: "External link"; url: string },
) {
  return origin.kind === "File Attachment version"
    ? origin.attachmentVersionId
    : origin.url;
}

export interface PixelRect {
  height: number;
  left: number;
  top: number;
  width: number;
}

/** Pixel rectangle of the crop on an image of the given natural size. */
export function cropPixelRect(
  natural: { height: number; width: number },
  crop: VisualCrop | null,
): PixelRect {
  if (!crop) {
    return { height: natural.height, left: 0, top: 0, width: natural.width };
  }
  const left = Math.min(
    natural.width - 1,
    Math.floor((crop.left * natural.width) / CROP_SCALE),
  );
  const top = Math.min(
    natural.height - 1,
    Math.floor((crop.top * natural.height) / CROP_SCALE),
  );
  const width = Math.max(
    1,
    Math.min(
      natural.width - left,
      Math.round((crop.width * natural.width) / CROP_SCALE),
    ),
  );
  const height = Math.max(
    1,
    Math.min(
      natural.height - top,
      Math.round((crop.height * natural.height) / CROP_SCALE),
    ),
  );
  return { height, left, top, width };
}

/** Size of the presented visual after crop and rotation. */
export function presentedSize(
  natural: { height: number; width: number },
  view: VisualView,
) {
  const { height, width } = cropPixelRect(natural, view.crop);
  return view.rotation === 90 || view.rotation === 270
    ? { height: width, width: height }
    : { height, width };
}

/** Crop expressed as four inset percentages, for the Crop controls. */
export function cropToInsets(crop: VisualCrop | null) {
  if (!crop) {
    return { bottom: 0, left: 0, right: 0, top: 0 };
  }
  return {
    bottom: CROP_SCALE - crop.top - crop.height,
    left: crop.left,
    right: CROP_SCALE - crop.left - crop.width,
    top: crop.top,
  };
}

/** Inverse of {@link cropToInsets}; all-zero insets mean no crop. Null when empty. */
export function insetsToCrop(insets: {
  bottom: number;
  left: number;
  right: number;
  top: number;
}): VisualCrop | null | "invalid" {
  const width = CROP_SCALE - insets.left - insets.right;
  const height = CROP_SCALE - insets.top - insets.bottom;
  if (
    [insets.bottom, insets.left, insets.right, insets.top].some(
      (value) => !Number.isInteger(value) || value < 0,
    ) ||
    width < 1 ||
    height < 1
  ) {
    return "invalid";
  }
  if (width === CROP_SCALE && height === CROP_SCALE) {
    return null;
  }
  return { height, left: insets.left, top: insets.top, width };
}

/** Focus order: unique item IDs, each of which must exist on the Moodboard. */
export const MOODBOARD_FOCUS_ORDER_MAX = 750;

/**
 * Resolves Presentation Mode steps. With a Focus order the listed items that
 * still exist come first in that order; without one the board order is used.
 * Items are the Moodboard's own items, so nothing is copied.
 */
export function presentationSequence<TItem extends { id: string }>(
  items: readonly TItem[],
  focusOrder: readonly string[],
): TItem[] {
  if (focusOrder.length === 0) {
    return [...items];
  }
  const byId = new Map(items.map((item) => [item.id, item]));
  return focusOrder.flatMap((id) => {
    const item = byId.get(id);
    return item ? [item] : [];
  });
}
