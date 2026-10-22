import type { ProjectWallCardView } from "@cantiara/api/project-wall";

export function cardName(card: ProjectWallCardView | undefined) {
  return card?.source.title ?? card?.source.recordId ?? "Unavailable record";
}

export function cardOptionLabel(card: ProjectWallCardView) {
  return `${card.sourceType} · ${cardName(card)}`;
}
