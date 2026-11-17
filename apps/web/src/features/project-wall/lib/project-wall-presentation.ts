import type { ProjectWallView } from "@cantiara/api/project-wall";

export function cardLabel(card: ProjectWallView["cards"][number]) {
  return card.source.title ?? `${card.sourceType} (unavailable)`;
}
