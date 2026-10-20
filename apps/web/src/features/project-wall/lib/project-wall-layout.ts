import {
  PROJECT_WALL_CARD_HEIGHT,
  PROJECT_WALL_CARD_WIDTH,
} from "@cantiara/api/project-wall-viewport";

/**
 * Pure wall layout operations: nudge, `Align`, distribute, z-order and
 * previewable, reversible auto-layout. Every function returns wall position
 * moves or a new card order; none touches a source record. A card with
 * `Lock Position` stays fixed in every manual and automatic operation: it is
 * never in a returned move, but it still counts as an obstacle or a bound.
 */
export interface LayoutCard {
  groupId: string | null;
  id: string;
  locked: boolean;
  position: { x: number; y: number };
}

export interface PositionMove {
  cardId: string;
  position: { x: number; y: number };
}

export type AlignEdge =
  | "bottom"
  | "center"
  | "left"
  | "middle"
  | "right"
  | "top";
export type DistributeAxis = "horizontal" | "vertical";
export type StackMove = "back" | "backward" | "forward" | "front";

const GRID_GAP = 40;

function selectedCards(cards: readonly LayoutCard[], ids: readonly string[]) {
  const wanted = new Set(ids);
  return cards.filter(({ id }) => wanted.has(id));
}

function movable(cards: readonly LayoutCard[]) {
  return cards.filter(({ locked }) => !locked);
}

export function nudgeCards(
  cards: readonly LayoutCard[],
  ids: readonly string[],
  delta: { dx: number; dy: number },
): PositionMove[] {
  return movable(selectedCards(cards, ids)).map((card) => ({
    cardId: card.id,
    position: {
      x: card.position.x + delta.dx,
      y: card.position.y + delta.dy,
    },
  }));
}

/** Aligns the selected cards to the shared edge or center of the selection. */
export function alignCards(
  cards: readonly LayoutCard[],
  ids: readonly string[],
  edge: AlignEdge,
): PositionMove[] {
  const chosen = selectedCards(cards, ids);
  if (chosen.length < 2) {
    return [];
  }
  const xs = chosen.map(({ position }) => position.x);
  const ys = chosen.map(({ position }) => position.y);
  const left = Math.min(...xs);
  const right = Math.max(...xs) + PROJECT_WALL_CARD_WIDTH;
  const top = Math.min(...ys);
  const bottom = Math.max(...ys) + PROJECT_WALL_CARD_HEIGHT;
  return movable(chosen).flatMap((card) => {
    const { x, y } = card.position;
    let next = { x, y };
    switch (edge) {
      case "left":
        next = { x: left, y };
        break;
      case "right":
        next = { x: right - PROJECT_WALL_CARD_WIDTH, y };
        break;
      case "center":
        next = {
          x: (left + right) / 2 - PROJECT_WALL_CARD_WIDTH / 2,
          y,
        };
        break;
      case "top":
        next = { x, y: top };
        break;
      case "bottom":
        next = { x, y: bottom - PROJECT_WALL_CARD_HEIGHT };
        break;
      case "middle":
        next = {
          x,
          y: (top + bottom) / 2 - PROJECT_WALL_CARD_HEIGHT / 2,
        };
        break;
      default:
        break;
    }
    return next.x === x && next.y === y
      ? []
      : [{ cardId: card.id, position: next }];
  });
}

/**
 * Spaces three or more selected cards evenly between the outermost two. The
 * outermost cards and every locked card keep their position.
 */
export function distributeCards(
  cards: readonly LayoutCard[],
  ids: readonly string[],
  axis: DistributeAxis,
): PositionMove[] {
  const chosen = selectedCards(cards, ids);
  if (chosen.length < 3) {
    return [];
  }
  const key = axis === "horizontal" ? "x" : "y";
  const sorted = [...chosen].sort(
    (a, b) => a.position[key] - b.position[key] || a.id.localeCompare(b.id),
  );
  const first = sorted[0]?.position[key] ?? 0;
  const last = sorted.at(-1)?.position[key] ?? 0;
  const step = (last - first) / (sorted.length - 1);
  return sorted.flatMap((card, index) => {
    const target = first + step * index;
    if (card.locked || target === card.position[key]) {
      return [];
    }
    return [
      {
        cardId: card.id,
        position: { ...card.position, [key]: target },
      },
    ];
  });
}

/** Reorders the z-order; the first id is at the back, the last on top. */
export function reorderSelection(
  order: readonly string[],
  ids: readonly string[],
  move: StackMove,
): string[] {
  const chosen = new Set(ids);
  const picked = order.filter((id) => chosen.has(id));
  const rest = order.filter((id) => !chosen.has(id));
  if (picked.length === 0) {
    return [...order];
  }
  if (move === "front") {
    return [...rest, ...picked];
  }
  if (move === "back") {
    return [...picked, ...rest];
  }
  const next = [...order];
  if (move === "forward") {
    for (let index = next.length - 2; index >= 0; index -= 1) {
      const current = next[index] ?? "";
      const above = next[index + 1] ?? "";
      if (chosen.has(current) && !chosen.has(above)) {
        next[index] = above;
        next[index + 1] = current;
      }
    }
    return next;
  }
  for (let index = 1; index < next.length; index += 1) {
    const current = next[index] ?? "";
    const below = next[index - 1] ?? "";
    if (chosen.has(current) && !chosen.has(below)) {
      next[index] = below;
      next[index - 1] = current;
    }
  }
  return next;
}

export interface AutoLayoutPreview {
  /** Cards that stay put because of `Lock Position`. */
  fixed: string[];
  /** Positions that change. */
  moves: PositionMove[];
  /** The positions before the layout, to reverse it. */
  previous: PositionMove[];
}

function overlaps(
  a: { x: number; y: number },
  b: { x: number; y: number },
  gap: number,
) {
  return (
    a.x < b.x + PROJECT_WALL_CARD_WIDTH + gap &&
    a.x + PROJECT_WALL_CARD_WIDTH + gap > b.x &&
    a.y < b.y + PROJECT_WALL_CARD_HEIGHT + gap &&
    a.y + PROJECT_WALL_CARD_HEIGHT + gap > b.y
  );
}

/**
 * Previewable, reversible auto-layout: lays the target cards (the selection, or
 * every card when nothing is selected) out on a grid, group by group in wall
 * order, starting at the top-left of their current bounds. Cells that a
 * `Lock Position` card occupies are skipped. It only proposes positions;
 * applying it is a normal card move and `previous` reverses it.
 */
export function previewAutoLayout(
  cards: readonly LayoutCard[],
  ids: readonly string[],
  groupOrder: readonly string[] = [],
): AutoLayoutPreview {
  const targets = ids.length === 0 ? [...cards] : selectedCards(cards, ids);
  const fixed = targets.filter(({ locked }) => locked);
  const free = targets.filter(({ locked }) => !locked);
  if (free.length === 0) {
    return { fixed: fixed.map(({ id }) => id), moves: [], previous: [] };
  }
  const rank = new Map(groupOrder.map((id, index) => [id, index]));
  const ordered = free
    .map((card, index) => ({ card, index }))
    .sort((a, b) => {
      const ar = a.card.groupId
        ? (rank.get(a.card.groupId) ?? groupOrder.length)
        : groupOrder.length + 1;
      const br = b.card.groupId
        ? (rank.get(b.card.groupId) ?? groupOrder.length)
        : groupOrder.length + 1;
      return ar - br || a.index - b.index;
    })
    .map(({ card }) => card);
  const originX = Math.min(...targets.map(({ position }) => position.x));
  const originY = Math.min(...targets.map(({ position }) => position.y));
  const columns = Math.max(1, Math.ceil(Math.sqrt(ordered.length)));
  const obstacles = [...cards.filter(({ locked }) => locked)].map(
    ({ position }) => position,
  );
  const cellW = PROJECT_WALL_CARD_WIDTH + GRID_GAP;
  const cellH = PROJECT_WALL_CARD_HEIGHT + GRID_GAP;
  const moves: PositionMove[] = [];
  const previous: PositionMove[] = [];
  let slot = 0;
  for (const card of ordered) {
    let position = { x: originX, y: originY };
    do {
      position = {
        x: originX + (slot % columns) * cellW,
        y: originY + Math.floor(slot / columns) * cellH,
      };
      slot += 1;
    } while (obstacles.some((obstacle) => overlaps(position, obstacle, 0)));
    if (position.x !== card.position.x || position.y !== card.position.y) {
      moves.push({ cardId: card.id, position });
      previous.push({ cardId: card.id, position: { ...card.position } });
    }
  }
  return { fixed: fixed.map(({ id }) => id), moves, previous };
}
