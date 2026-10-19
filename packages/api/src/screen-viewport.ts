import { z } from "zod";
import {
  blockBounds,
  type WireframeBlock,
  type WireframeBounds,
} from "./wireframe-document";

const identifierSchema = z.string().trim().min(1).max(255);

export const VIEWPORT_MIN_ZOOM = 0.1;
export const VIEWPORT_MAX_ZOOM = 4;
const FIT_PADDING = 48;

/**
 * Personal viewport of one Screen's Wireframe canvas for one account: centre,
 * zoom and view-local collapsed outline groups. It is navigation, not content:
 * it is never part of a WireframeDocument, a Wireframe version, a share
 * snapshot, an export input, a search document or a relation, and it belongs to
 * exactly one account. `.strict()` keeps selection, inspector, edit mode,
 * hover and unsaved operations out of what can be stored.
 */
export const wireframeViewportSchema = z
  .object({
    centerX: z.number().finite().min(-1_000_000).max(1_000_000),
    centerY: z.number().finite().min(-1_000_000).max(1_000_000),
    collapsedGroups: z.array(z.string().trim().min(1).max(80)).max(50),
    zoom: z.number().finite().min(VIEWPORT_MIN_ZOOM).max(VIEWPORT_MAX_ZOOM),
  })
  .strict();
export type WireframeViewport = z.infer<typeof wireframeViewportSchema>;

export const screenViewportInputSchema = z
  .object({ projectId: identifierSchema, screenId: identifierSchema })
  .strict();
export type ScreenViewportInput = z.input<typeof screenViewportInputSchema>;

export const saveScreenViewportInputSchema = z
  .object({
    projectId: identifierSchema,
    screenId: identifierSchema,
    viewport: wireframeViewportSchema,
  })
  .strict();
export type SaveScreenViewportInput = z.input<
  typeof saveScreenViewportInputSchema
>;

export interface ScreenViewportRecord {
  /** `null` until the account has moved on this canvas. */
  viewport: WireframeViewport | null;
}

export interface PaneSize {
  height: number;
  width: number;
}

export interface CanvasSize {
  height: number;
  width: number;
}

/** `Fit View`: the neutral view of the canvas, not a position of the content. */
export function neutralViewport(
  canvas: CanvasSize,
  collapsedGroups: readonly string[] = [],
): WireframeViewport {
  return {
    centerX: canvas.width / 2,
    centerY: canvas.height / 2,
    collapsedGroups: [...collapsedGroups],
    zoom: 1,
  };
}

export function clampZoom(zoom: number) {
  return Math.min(VIEWPORT_MAX_ZOOM, Math.max(VIEWPORT_MIN_ZOOM, zoom));
}

export function contentBounds(
  blocks: readonly WireframeBlock[],
): WireframeBounds | null {
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (const block of blocks) {
    const bounds = blockBounds(block);
    minX = Math.min(minX, bounds.x);
    minY = Math.min(minY, bounds.y);
    maxX = Math.max(maxX, bounds.x + bounds.width);
    maxY = Math.max(maxY, bounds.y + bounds.height);
  }
  if (!Number.isFinite(minX)) {
    return null;
  }
  return { height: maxY - minY, width: maxX - minX, x: minX, y: minY };
}

/** The canvas-space rectangle a viewport shows in a pane of the given size. */
export function visibleRect(
  viewport: Pick<WireframeViewport, "centerX" | "centerY" | "zoom">,
  pane: PaneSize,
): WireframeBounds {
  const width = pane.width / viewport.zoom;
  const height = pane.height / viewport.zoom;
  return {
    height,
    width,
    x: viewport.centerX - width / 2,
    y: viewport.centerY - height / 2,
  };
}

function intersects(a: WireframeBounds, b: WireframeBounds) {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

/** Fits the visible content (or the canvas when empty) into the pane. */
export function fitContentViewport(
  blocks: readonly WireframeBlock[],
  canvas: CanvasSize,
  pane: PaneSize,
  collapsedGroups: readonly string[] = [],
): WireframeViewport {
  const content = contentBounds(blocks) ?? {
    height: canvas.height,
    width: canvas.width,
    x: 0,
    y: 0,
  };
  const zoom = clampZoom(
    Math.min(
      1,
      pane.width / (content.width + FIT_PADDING * 2),
      pane.height / (content.height + FIT_PADDING * 2),
    ),
  );
  return {
    centerX: content.x + content.width / 2,
    centerY: content.y + content.height / 2,
    collapsedGroups: [...collapsedGroups],
    zoom,
  };
}

/**
 * A saved position is meaningful when its window shows part of the content (or
 * of the canvas when nothing is placed yet). An empty region, a non-finite
 * number or a far-off position is not.
 */
export function isMeaningfulViewport(
  viewport: WireframeViewport,
  blocks: readonly WireframeBlock[],
  canvas: CanvasSize,
  pane: PaneSize,
) {
  const window = visibleRect(viewport, pane);
  if (blocks.length === 0) {
    return intersects(window, {
      height: canvas.height,
      width: canvas.width,
      x: 0,
      y: 0,
    });
  }
  return blocks.some((block) => intersects(window, blockBounds(block)));
}

/**
 * Landing view when a canvas opens. Nothing but the saved viewport is
 * restored: no saved value is the neutral view, a meaningless one fits the
 * content instead of landing in an empty hole.
 */
export function restoreViewport(
  saved: unknown,
  blocks: readonly WireframeBlock[],
  canvas: CanvasSize,
  pane: PaneSize,
): WireframeViewport {
  if (saved === null || saved === undefined) {
    return neutralViewport(canvas);
  }
  const parsed = wireframeViewportSchema.safeParse(saved);
  if (!parsed.success) {
    const groups = (saved as { collapsedGroups?: unknown }).collapsedGroups;
    const keep = z.array(z.string().min(1).max(80)).max(50).safeParse(groups);
    return fitContentViewport(
      blocks,
      canvas,
      pane,
      keep.success ? keep.data : [],
    );
  }
  return isMeaningfulViewport(parsed.data, blocks, canvas, pane)
    ? parsed.data
    : fitContentViewport(blocks, canvas, pane, parsed.data.collapsedGroups);
}

/** Pans by a screen-pixel step; the canvas-space distance shrinks as zoom grows. */
export function panViewport(
  viewport: WireframeViewport,
  dx: number,
  dy: number,
): WireframeViewport {
  return {
    ...viewport,
    centerX: viewport.centerX + dx / viewport.zoom,
    centerY: viewport.centerY + dy / viewport.zoom,
  };
}

export function zoomViewport(
  viewport: WireframeViewport,
  factor: number,
): WireframeViewport {
  return { ...viewport, zoom: clampZoom(viewport.zoom * factor) };
}

export function toggleCollapsedGroup(
  viewport: WireframeViewport,
  group: string,
): WireframeViewport {
  const collapsed = viewport.collapsedGroups.includes(group);
  return {
    ...viewport,
    collapsedGroups: collapsed
      ? viewport.collapsedGroups.filter((item) => item !== group)
      : [...viewport.collapsedGroups, group],
  };
}

export function isSameViewport(a: WireframeViewport, b: WireframeViewport) {
  return (
    a.centerX === b.centerX &&
    a.centerY === b.centerY &&
    a.zoom === b.zoom &&
    a.collapsedGroups.length === b.collapsedGroups.length &&
    a.collapsedGroups.every(
      (group, index) => group === b.collapsedGroups[index],
    )
  );
}
