import { z } from "zod";

/**
 * Personal viewport of one Moodboard for one Account: center, zoom, and the
 * view-local collapse of outline sections. It is neither Moodboard content nor
 * share/Snapshot/export input nor another user's view, and it never carries
 * selection, inspector, or unsaved operations.
 */

export const VIEWPORT_ZOOM_MIN = 0.05;
export const VIEWPORT_ZOOM_MAX = 4;
export const VIEWPORT_COLLAPSED_MAX = 200;
/** Outline section key for visuals; Palette group IDs and `ungrouped` cover swatches. */
export const OUTLINE_VISUALS_SECTION = "visuals";
export const OUTLINE_UNGROUPED_SECTION = "ungrouped";

const finite = z.number().refine(Number.isFinite, "Must be a finite number.");

export const personalViewportSchema = z
  .object({
    centerX: finite,
    centerY: finite,
    zoom: finite.pipe(z.number().min(VIEWPORT_ZOOM_MIN).max(VIEWPORT_ZOOM_MAX)),
  })
  .strict();

export type PersonalViewport = z.infer<typeof personalViewportSchema>;

export const personalMoodboardViewSchema = z
  .object({
    collapsed: z
      .array(z.string().trim().min(1).max(255))
      .max(VIEWPORT_COLLAPSED_MAX)
      .refine(
        (keys) => new Set(keys).size === keys.length,
        "Collapsed sections cannot repeat.",
      ),
    viewport: personalViewportSchema.nullable(),
  })
  .strict();

export type PersonalMoodboardView = z.infer<typeof personalMoodboardViewSchema>;

export const EMPTY_PERSONAL_VIEW: PersonalMoodboardView = {
  collapsed: [],
  viewport: null,
};

export const personalMoodboardViewInputSchema = z
  .object({ moodboardId: z.string().trim().min(1).max(255) })
  .strict();

export const savePersonalMoodboardViewInputSchema =
  personalMoodboardViewInputSchema
    .extend({ view: personalMoodboardViewSchema })
    .strict();

export interface PersonalMoodboardViewsAccess {
  /** Null when the Moodboard is not owned by the Account. */
  get: (
    accountId: string,
    moodboardId: string,
  ) => Promise<PersonalMoodboardView | null>;
  /** Null when the Moodboard is not owned by the Account. */
  save: (
    accountId: string,
    moodboardId: string,
    view: PersonalMoodboardView,
  ) => Promise<PersonalMoodboardView | null>;
}

export interface BoardRect {
  height: number;
  id: string;
  width: number;
  x: number;
  y: number;
}

export interface BoardSize {
  height: number;
  width: number;
}

export const BOARD_CARD_WIDTH = 240;
export const BOARD_CARD_HEIGHT = 180;
export const BOARD_CARD_GAP = 24;
const BOARD_COLUMNS_MAX = 50;
const FIT_PADDING = 0.9;

/**
 * Deterministic board placement from the item order alone. Positions are not
 * stored, so no layout data can leak into the Moodboard record or export.
 */
export function boardLayout(itemIds: readonly string[]): BoardRect[] {
  const columns = Math.max(
    1,
    Math.min(BOARD_COLUMNS_MAX, Math.ceil(Math.sqrt(itemIds.length))),
  );
  return itemIds.map((id, index) => ({
    height: BOARD_CARD_HEIGHT,
    id,
    width: BOARD_CARD_WIDTH,
    x: (index % columns) * (BOARD_CARD_WIDTH + BOARD_CARD_GAP),
    y: Math.floor(index / columns) * (BOARD_CARD_HEIGHT + BOARD_CARD_GAP),
  }));
}

export function clampZoom(zoom: number) {
  if (!Number.isFinite(zoom)) {
    return 1;
  }
  return Math.min(VIEWPORT_ZOOM_MAX, Math.max(VIEWPORT_ZOOM_MIN, zoom));
}

/** `Fit View`: the neutral viewport that shows all content, or the origin when empty. */
export function fitViewport(
  rects: readonly BoardRect[],
  size: BoardSize,
): PersonalViewport {
  if (rects.length === 0 || size.width <= 0 || size.height <= 0) {
    return { centerX: 0, centerY: 0, zoom: 1 };
  }
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (const rect of rects) {
    minX = Math.min(minX, rect.x);
    minY = Math.min(minY, rect.y);
    maxX = Math.max(maxX, rect.x + rect.width);
    maxY = Math.max(maxY, rect.y + rect.height);
  }
  const zoom = clampZoom(
    Math.min(size.width / (maxX - minX), size.height / (maxY - minY)) *
      FIT_PADDING,
  );
  return { centerX: (minX + maxX) / 2, centerY: (minY + maxY) / 2, zoom };
}

/** Board-space rectangle a viewport shows in a container of the given pixel size. */
export function visibleRegion(viewport: PersonalViewport, size: BoardSize) {
  const width = size.width / viewport.zoom;
  const height = size.height / viewport.zoom;
  return {
    bottom: viewport.centerY + height / 2,
    left: viewport.centerX - width / 2,
    right: viewport.centerX + width / 2,
    top: viewport.centerY - height / 2,
  };
}

/** Rects that intersect the viewport's visible region. */
export function visibleRects(
  rects: readonly BoardRect[],
  viewport: PersonalViewport,
  size: BoardSize,
) {
  const region = visibleRegion(viewport, size);
  return rects.filter(
    (rect) =>
      rect.x < region.right &&
      rect.x + rect.width > region.left &&
      rect.y < region.bottom &&
      rect.y + rect.height > region.top,
  );
}

/**
 * A saved position is meaningless when it would open on an empty or lost
 * region: deleted or changed content leaves no item in view. An empty board
 * has no content to be lost, so any valid position stays.
 */
export function isMeaninglessViewport(
  viewport: PersonalViewport,
  rects: readonly BoardRect[],
  size: BoardSize,
) {
  const parsed = personalViewportSchema.safeParse(viewport);
  if (!parsed.success) {
    return true;
  }
  if (rects.length === 0) {
    return false;
  }
  return visibleRects(rects, viewport, size).length === 0;
}

export interface ResolvedViewport {
  source: "fit" | "restored";
  viewport: PersonalViewport;
}

/** Restores the saved position, or fits visible content when it is missing or meaningless. */
export function resolveViewport(
  saved: PersonalViewport | null,
  rects: readonly BoardRect[],
  size: BoardSize,
): ResolvedViewport {
  if (saved && !isMeaninglessViewport(saved, rects, size)) {
    return { source: "restored", viewport: saved };
  }
  return { source: "fit", viewport: fitViewport(rects, size) };
}

/** Zoom around the center; the result stays inside the zoom range. */
export function zoomViewport(
  viewport: PersonalViewport,
  factor: number,
): PersonalViewport {
  return { ...viewport, zoom: clampZoom(viewport.zoom * factor) };
}

/** Pan by screen pixels (positive moves the content left/up, like scrolling). */
export function panViewport(
  viewport: PersonalViewport,
  deltaX: number,
  deltaY: number,
): PersonalViewport {
  return {
    ...viewport,
    centerX: viewport.centerX + deltaX / viewport.zoom,
    centerY: viewport.centerY + deltaY / viewport.zoom,
  };
}

/** Drops collapse keys of sections that no longer exist (deleted groups). */
export function pruneCollapsed(
  collapsed: readonly string[],
  paletteGroupIds: readonly string[],
) {
  const known = new Set([
    OUTLINE_VISUALS_SECTION,
    OUTLINE_UNGROUPED_SECTION,
    ...paletteGroupIds,
  ]);
  return collapsed.filter((key) => known.has(key));
}

export function toggleCollapsed(collapsed: readonly string[], key: string) {
  return collapsed.includes(key)
    ? collapsed.filter((existing) => existing !== key)
    : [...collapsed, key];
}
