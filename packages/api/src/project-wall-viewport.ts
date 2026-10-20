import { z } from "zod";

/**
 * Personal viewport of one Project Wall for one Account (spec 51 #388): the
 * viewport center, the zoom and the view-local collapse of groups. It is not
 * wall content, a relation, a share/Snapshot/export input or another user's
 * view. Selection, inspector, edit mode and unsaved operations have no field.
 */

export const PROJECT_WALL_MIN_ZOOM = 0.02;
export const PROJECT_WALL_MAX_ZOOM = 2;
/** Approximate card footprint used to decide whether a saved position still shows content. */
export const PROJECT_WALL_CARD_WIDTH = 240;
export const PROJECT_WALL_CARD_HEIGHT = 160;

/**
 * Hard scene of the acceptance test: 500 visible items and 750 Visual links
 * must hold the frame budget. It is a performance target, not a create cap;
 * a larger wall is kept whole and only reduces detail.
 */
export const PROJECT_WALL_SCENE_ITEM_LIMIT = 500;
export const PROJECT_WALL_SCENE_LINK_LIMIT = 750;
/** The wall never refuses data; the viewport only holds ids of live groups. */
export const PROJECT_WALL_COLLAPSED_MAX = 5000;

const identifierSchema = z.string().trim().min(1).max(255);
const coordinateSchema = z.number().finite().min(-1_000_000).max(1_000_000);

export const projectWallViewportSchema = z
  .object({
    center: z.object({ x: coordinateSchema, y: coordinateSchema }).strict(),
    /** Group ids collapsed in this account's view only. */
    collapsed: z
      .array(identifierSchema)
      .max(PROJECT_WALL_COLLAPSED_MAX)
      .default([]),
    zoom: z
      .number()
      .finite()
      .min(PROJECT_WALL_MIN_ZOOM)
      .max(PROJECT_WALL_MAX_ZOOM),
  })
  .strict();
export type ProjectWallViewport = z.infer<typeof projectWallViewportSchema>;

export const projectWallViewportInputSchema = z
  .object({ projectId: identifierSchema, wallId: identifierSchema })
  .strict();

export const saveProjectWallViewportInputSchema = z
  .object({
    projectId: identifierSchema,
    viewport: projectWallViewportSchema,
    wallId: identifierSchema,
  })
  .strict();
export type SaveProjectWallViewportInput = z.input<
  typeof saveProjectWallViewportInputSchema
>;

/** Persistence of the personal viewport; keyed by account, never by wall alone. */
export interface ProjectWallViewportStore {
  findViewport: (
    accountId: string,
    wallId: string,
  ) => Promise<ProjectWallViewport | null>;
  saveViewport: (
    accountId: string,
    wallId: string,
    viewport: ProjectWallViewport,
  ) => Promise<void>;
}

/** Group ids that still exist; a stale collapse never hides anything. */
export function liveCollapsedGroups(
  groups: ReadonlyArray<{ id: string }>,
  collapsed: readonly string[],
) {
  const known = new Set(groups.map(({ id }) => id));
  return [...new Set(collapsed)].filter((id) => known.has(id));
}

export function toggleCollapsedGroup(
  collapsed: readonly string[],
  groupId: string,
) {
  return collapsed.includes(groupId)
    ? collapsed.filter((id) => id !== groupId)
    : [...collapsed, groupId];
}

export interface ProjectWallViewportContent {
  cards: Array<{ groupId: string | null; position: { x: number; y: number } }>;
  groups: Array<{ id: string }>;
}

export type ProjectWallViewportResolution =
  | { collapsed: string[]; mode: "fit" }
  | {
      collapsed: string[];
      mode: "restore";
      viewport: { center: { x: number; y: number }; zoom: number };
    };

/**
 * Decides whether a saved position still means something. It is restored only
 * when the rectangle it describes shows at least one visible card; otherwise
 * (nothing saved, nothing to show, a deleted or moved region, an empty gap)
 * the canvas fits visible content instead of opening on empty space. Cards
 * hidden by a collapsed group do not count as content.
 */
export function resolveProjectWallViewport(input: {
  content: ProjectWallViewportContent;
  frame: { height: number; width: number };
  saved: ProjectWallViewport | null;
}): ProjectWallViewportResolution {
  const { content, frame, saved } = input;
  if (!saved) {
    return { collapsed: [], mode: "fit" };
  }
  const collapsed = liveCollapsedGroups(content.groups, saved.collapsed);
  const hidden = new Set(collapsed);
  const origins = content.cards.filter(
    ({ groupId }) => !(groupId && hidden.has(groupId)),
  );
  if (
    origins.length === 0 ||
    !(
      saved.zoom >= PROJECT_WALL_MIN_ZOOM &&
      saved.zoom <= PROJECT_WALL_MAX_ZOOM &&
      frame.width > 0 &&
      frame.height > 0
    )
  ) {
    return { collapsed, mode: "fit" };
  }
  const halfWidth = frame.width / saved.zoom / 2;
  const halfHeight = frame.height / saved.zoom / 2;
  const left = saved.center.x - halfWidth;
  const right = saved.center.x + halfWidth;
  const top = saved.center.y - halfHeight;
  const bottom = saved.center.y + halfHeight;
  const sees = origins.some(
    ({ position: { x, y } }) =>
      x < right &&
      x + PROJECT_WALL_CARD_WIDTH > left &&
      y < bottom &&
      y + PROJECT_WALL_CARD_HEIGHT > top,
  );
  return sees
    ? {
        collapsed,
        mode: "restore",
        viewport: { center: saved.center, zoom: saved.zoom },
      }
    : { collapsed, mode: "fit" };
}

export interface ProjectWallSceneStatus {
  /** Over the hard scene: the canvas reduces detail, nothing is dropped. */
  reducedDetail: boolean;
  /** Plain-text warning shown above the canvas, or null inside the scene. */
  warning: string | null;
}

/**
 * Visible cards (not hidden by a collapsed group) and Visual links decide the
 * canvas detail. Beyond 500 / 750 the wall warns and renders reduced detail;
 * it never truncates, rejects or rewrites stored data.
 */
export function projectWallSceneStatus(input: {
  linkCount: number;
  visibleCardCount: number;
}): ProjectWallSceneStatus {
  const over =
    input.visibleCardCount > PROJECT_WALL_SCENE_ITEM_LIMIT ||
    input.linkCount > PROJECT_WALL_SCENE_LINK_LIMIT;
  return over
    ? {
        reducedDetail: true,
        warning: `Large wall: ${input.visibleCardCount} visible cards and ${input.linkCount} Visual links. The canvas shows reduced detail; nothing is removed. Use the Outline or collapse groups.`,
      }
    : { reducedDetail: false, warning: null };
}
