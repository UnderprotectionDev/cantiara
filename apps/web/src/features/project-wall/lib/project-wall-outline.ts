import type {
  ProjectWallCardView,
  ProjectWallGroupView,
} from "@cantiara/api/project-wall";

/**
 * Structured `Outline` of a Project Wall: the pointer-free equivalent of the
 * canvas. Groups list their cards beneath them; cards without a group follow.
 * A group collapsed in this account's own view hides its cards from the
 * Outline and the canvas alike. Collapse is view-local.
 */
export type OutlineRow =
  | {
      collapsed: boolean;
      group: ProjectWallGroupView;
      kind: "group";
      memberCount: number;
    }
  | { card: ProjectWallCardView; depth: 0 | 1; kind: "card" }
  | { kind: "ungrouped"; memberCount: number };

export function cardTitle(card: ProjectWallCardView) {
  return card.source.title ?? card.source.recordId;
}

/** Card ids a collapsed group hides from this account's view. */
export function hiddenCardIds(
  cards: readonly ProjectWallCardView[],
  groups: readonly ProjectWallGroupView[],
  collapsed: readonly string[],
): Set<string> {
  const known = new Set(groups.map(({ id }) => id));
  const closed = new Set(collapsed.filter((id) => known.has(id)));
  return new Set(
    cards
      .filter(({ groupId }) => groupId && closed.has(groupId))
      .map(({ id }) => id),
  );
}

export function buildOutline(
  cards: readonly ProjectWallCardView[],
  groups: readonly ProjectWallGroupView[],
  collapsed: readonly string[],
): OutlineRow[] {
  const closed = new Set(collapsed);
  const membersOf = new Map<string, ProjectWallCardView[]>();
  const ungrouped: ProjectWallCardView[] = [];
  const known = new Set(groups.map(({ id }) => id));
  for (const card of cards) {
    if (card.groupId && known.has(card.groupId)) {
      const members = membersOf.get(card.groupId) ?? [];
      members.push(card);
      membersOf.set(card.groupId, members);
    } else {
      ungrouped.push(card);
    }
  }
  const rows: OutlineRow[] = [];
  for (const group of groups) {
    const members = membersOf.get(group.id) ?? [];
    const isCollapsed = closed.has(group.id);
    rows.push({
      collapsed: isCollapsed,
      group,
      kind: "group",
      memberCount: members.length,
    });
    if (!isCollapsed) {
      for (const card of members) {
        rows.push({ card, depth: 1, kind: "card" });
      }
    }
  }
  if (groups.length > 0 && ungrouped.length > 0) {
    rows.push({ kind: "ungrouped", memberCount: ungrouped.length });
  }
  for (const card of ungrouped) {
    rows.push({ card, depth: 0, kind: "card" });
  }
  return rows;
}

/**
 * Moves one card a step inside its own Outline section (its group, or the
 * ungrouped cards) and returns the whole wall order. A step is therefore
 * always visible in the Outline. An edge card stays where it is.
 */
export function moveInOutline(
  cards: readonly ProjectWallCardView[],
  cardId: string,
  direction: "down" | "up",
): string[] {
  const order = cards.map(({ id }) => id);
  const card = cards.find(({ id }) => id === cardId);
  if (!card) {
    return order;
  }
  const section = cards.filter(({ groupId }) => groupId === card.groupId);
  const at = section.findIndex(({ id }) => id === cardId);
  const neighbour = section[direction === "up" ? at - 1 : at + 1];
  if (!neighbour) {
    return order;
  }
  const from = order.indexOf(cardId);
  const to = order.indexOf(neighbour.id);
  order[from] = neighbour.id;
  order[to] = cardId;
  return order;
}
