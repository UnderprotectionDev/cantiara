import type { DiagramModel } from "@cantiara/db/schema/technical-diagram";
import { z } from "zod";
import { PROJECT_WALL_COLLAPSED_MAX } from "./project-wall-viewport";
import { diagramGraph } from "./technical-diagram-structure";

/**
 * Personal viewport of one Technical Diagram (spec 59 #425) for one Account:
 * the viewport center, the zoom and the view-local collapse of groups, kept per
 * diagram and per `Diagram View`. It is not diagram content (never in the
 * structural model, its hash, a version, a card or a share/export), not a
 * search field and never another Account's view. Selection and unsaved edits
 * have no field.
 */

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

export const DIAGRAM_MIN_ZOOM = 0.02;
export const DIAGRAM_MAX_ZOOM = 2;
/** Approximate node footprint used to decide whether a saved position shows content. */
export const DIAGRAM_NODE_WIDTH = 150;
export const DIAGRAM_NODE_HEIGHT = 40;

const identifierSchema = z.string().trim().min(1).max(255);
const coordinateSchema = z.number().finite().min(-1_000_000).max(1_000_000);

export const technicalDiagramViewportSchema = z
  .object({
    center: z.object({ x: coordinateSchema, y: coordinateSchema }).strict(),
    /** Group ids collapsed in this Account's view only. */
    collapsed: z
      .array(identifierSchema)
      .max(PROJECT_WALL_COLLAPSED_MAX)
      .default([]),
    zoom: z.number().finite().min(DIAGRAM_MIN_ZOOM).max(DIAGRAM_MAX_ZOOM),
  })
  .strict();
export type TechnicalDiagramViewport = z.infer<
  typeof technicalDiagramViewportSchema
>;

/** `viewId` absent means the diagram's default `Diagram View`. */
export const technicalDiagramViewportInputSchema = z
  .object({ diagramId: identifierSchema, viewId: identifierSchema.optional() })
  .strict();

export const saveTechnicalDiagramViewportInputSchema = z
  .object({
    diagramId: identifierSchema,
    viewId: identifierSchema.optional(),
    viewport: technicalDiagramViewportSchema,
  })
  .strict();
export type SaveTechnicalDiagramViewportInput = z.input<
  typeof saveTechnicalDiagramViewportInputSchema
>;

/** Collapsible groups of a model: an Architecture `Boundary` hides what it contains. */
export function diagramGroups(model: DiagramModel) {
  const graph = diagramGraph(model);
  const boundaries = new Set(
    graph.nodes.filter(({ kind }) => kind === "Boundary").map(({ id }) => id),
  );
  const children = new Map<string, string[]>();
  for (const link of graph.links) {
    if (
      boundaries.has(link.from) &&
      link.id === `${link.from}>Contains>${link.to}`
    ) {
      children.set(link.from, [...(children.get(link.from) ?? []), link.to]);
    }
  }
  const members = (id: string, seen = new Set<string>()): string[] => {
    for (const child of children.get(id) ?? []) {
      if (!seen.has(child)) {
        seen.add(child);
        members(child, seen);
      }
    }
    return [...seen];
  };
  return [...boundaries].map((id) => ({ id, memberIds: members(id) }));
}

/** Node ids hidden by the collapsed groups (a group itself stays visible). */
export function hiddenDiagramNodeIds(
  groups: ReadonlyArray<{ id: string; memberIds: string[] }>,
  collapsed: readonly string[],
) {
  const open = new Set(collapsed);
  return new Set(
    groups.flatMap(({ id, memberIds }) => (open.has(id) ? memberIds : [])),
  );
}

export interface TechnicalDiagramViewportContent {
  groups: Array<{ id: string; memberIds: string[] }>;
  nodes: Array<{ id: string; position: { x: number; y: number } }>;
}

export type TechnicalDiagramViewportResolution =
  | { collapsed: string[]; mode: "fit" }
  | {
      collapsed: string[];
      mode: "restore";
      viewport: { center: { x: number; y: number }; zoom: number };
    };

/**
 * A saved position is restored only when the rectangle it describes still shows
 * a visible node; otherwise (nothing saved, nothing to show, a deleted or
 * moved region, an empty gap) the canvas fits visible content and never opens
 * on an empty region. Nodes hidden by a collapsed group do not count.
 */
export function resolveTechnicalDiagramViewport(input: {
  content: TechnicalDiagramViewportContent;
  frame: { height: number; width: number };
  saved: TechnicalDiagramViewport | null;
}): TechnicalDiagramViewportResolution {
  const { content, frame, saved } = input;
  if (!saved) {
    return { collapsed: [], mode: "fit" };
  }
  const collapsed = liveCollapsedGroups(content.groups, saved.collapsed);
  const hidden = hiddenDiagramNodeIds(content.groups, collapsed);
  const visible = content.nodes.filter(({ id }) => !hidden.has(id));
  if (
    visible.length === 0 ||
    !(
      saved.zoom >= DIAGRAM_MIN_ZOOM &&
      saved.zoom <= DIAGRAM_MAX_ZOOM &&
      frame.width > 0 &&
      frame.height > 0
    )
  ) {
    return { collapsed, mode: "fit" };
  }
  const halfWidth = frame.width / saved.zoom / 2;
  const halfHeight = frame.height / saved.zoom / 2;
  const sees = visible.some(
    ({ position: { x, y } }) =>
      x < saved.center.x + halfWidth &&
      x + DIAGRAM_NODE_WIDTH > saved.center.x - halfWidth &&
      y < saved.center.y + halfHeight &&
      y + DIAGRAM_NODE_HEIGHT > saved.center.y - halfHeight,
  );
  return sees
    ? {
        collapsed,
        mode: "restore",
        viewport: { center: saved.center, zoom: saved.zoom },
      }
    : { collapsed, mode: "fit" };
}

/** `Fit view`: the neutral view, with every collapsed group expanded. */
export function neutralDiagramView(): TechnicalDiagramViewportResolution {
  return { collapsed: [], mode: "fit" };
}
