import type { ProjectWallView } from "@cantiara/api/project-wall";
import type { ProjectWallViewGroup } from "./project-wall-scene";

/** A wall that reaches the canvas and Outline: its collapse is personal. */
export type ProjectWallSceneView = Omit<ProjectWallView, "groups"> & {
  groups: ProjectWallViewGroup[];
};

/**
 * View-local focus on one named group: the wall's cards, links and groups
 * narrowed to that group. `null` means the group no longer exists; the caller
 * explains it instead of showing another group. Nothing is persisted.
 */
export function focusProjectWallGroup(
  wall: ProjectWallSceneView,
  groupId: string,
): ProjectWallSceneView | null {
  const group = wall.groups.find(({ id }) => id === groupId);
  if (!group) {
    return null;
  }
  const cards = wall.cards.filter((card) => card.groupId === groupId);
  const ids = new Set(cards.map(({ id }) => id));
  return {
    ...wall,
    cards,
    groups: [group],
    links: wall.links.filter(
      (link) => ids.has(link.fromCardId) && ids.has(link.toCardId),
    ),
  };
}
