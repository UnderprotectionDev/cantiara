import {
  PROJECT_WALL_CARD_HEIGHT,
  PROJECT_WALL_CARD_WIDTH,
  type ProjectWallViewport,
} from "@cantiara/api/project-wall-viewport";

/**
 * Viewport math of the wall canvas. The personal viewport stores the center in
 * wall coordinates plus the zoom; React Flow works with a screen transform.
 */
export interface Frame {
  height: number;
  width: number;
}

export interface Transform {
  x: number;
  y: number;
  zoom: number;
}

export function transformFromViewport(
  viewport: Pick<ProjectWallViewport, "center" | "zoom">,
  frame: Frame,
): Transform {
  return {
    x: frame.width / 2 - viewport.center.x * viewport.zoom,
    y: frame.height / 2 - viewport.center.y * viewport.zoom,
    zoom: viewport.zoom,
  };
}

export function viewportFromTransform(
  transform: Transform,
  frame: Frame,
): Pick<ProjectWallViewport, "center" | "zoom"> {
  return {
    center: {
      x: (frame.width / 2 - transform.x) / transform.zoom,
      y: (frame.height / 2 - transform.y) / transform.zoom,
    },
    zoom: transform.zoom,
  };
}

/** Cards whose footprint intersects the region a transform shows. */
export function cardsInView<
  T extends { id: string; position: { x: number; y: number } },
>(cards: readonly T[], transform: Transform, frame: Frame): T[] {
  const left = -transform.x / transform.zoom;
  const top = -transform.y / transform.zoom;
  const right = left + frame.width / transform.zoom;
  const bottom = top + frame.height / transform.zoom;
  return cards.filter(
    ({ position }) =>
      position.x < right &&
      position.x + PROJECT_WALL_CARD_WIDTH > left &&
      position.y < bottom &&
      position.y + PROJECT_WALL_CARD_HEIGHT > top,
  );
}

/** Visual links with both ends in the given card set. */
export function linksAmong<L extends { fromCardId: string; toCardId: string }>(
  links: readonly L[],
  cardIds: ReadonlySet<string>,
): L[] {
  return links.filter(
    ({ fromCardId, toCardId }) =>
      cardIds.has(fromCardId) || cardIds.has(toCardId),
  );
}
