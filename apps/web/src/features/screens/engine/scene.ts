import {
  blockBounds,
  createEmptyWireframeDocument,
  createWireframeBlock,
  WIREFRAME_COMPONENT_KINDS,
  type WireframeBlock,
  type WireframeBounds,
  type WireframeDocument,
} from "@cantiara/api/wireframe-document";
import RBush from "rbush";
import { createGeometryIndex } from "./geometry";

/** Hard performance scene: visible items and visual links held to frame budget. */
export const HARD_SCENE = { items: 500, links: 750 } as const;
/** Stress scene: must not crash or corrupt. */
export const STRESS_SCENE = { items: 2000, links: 3000 } as const;

/** A visual connector between two blocks, derived from canonical geometry. */
export interface VisualLink {
  from: string;
  id: string;
  to: string;
}

interface LinkEntry {
  link: VisualLink;
  maxX: number;
  maxY: number;
  minX: number;
  minY: number;
  order: number;
}

function centerOf(bounds: WireframeBounds) {
  return {
    x: bounds.x + bounds.width / 2,
    y: bounds.y + bounds.height / 2,
  };
}

/** Visual links are derived from animation triggers and targets, never stored. */
export function deriveVisualLinks(document: WireframeDocument): VisualLink[] {
  const links: VisualLink[] = [];
  for (const animation of document.animations) {
    if (animation.kind === "show-hide" || animation.kind === "two-state") {
      links.push({
        from: animation.triggerBlockId,
        id: animation.id,
        to: animation.targetBlockId,
      });
    } else if (animation.kind === "sequence") {
      for (const [index, step] of animation.steps.entries()) {
        links.push({
          from: animation.triggerBlockId,
          id: `${animation.id}:${index}`,
          to: step.blockId,
        });
      }
    }
  }
  return links;
}

/**
 * Deterministic scene builder: a grid of closed-kind blocks plus a fixed
 * pattern of links. No randomness, so a failing run reproduces exactly.
 */
export function buildScene(size: { items: number; links: number }): {
  document: WireframeDocument;
  links: VisualLink[];
} {
  const columns = Math.max(1, Math.ceil(Math.sqrt(size.items)));
  const blocks: WireframeBlock[] = [];
  for (let index = 0; index < size.items; index += 1) {
    const kind =
      WIREFRAME_COMPONENT_KINDS[index % WIREFRAME_COMPONENT_KINDS.length] ??
      "Button";
    blocks.push(
      createWireframeBlock(kind, `scene-${index}`, {
        x: (index % columns) * 300,
        y: Math.floor(index / columns) * 200,
      }),
    );
  }
  const links: VisualLink[] = [];
  for (let index = 0; index < size.links && size.items > 1; index += 1) {
    links.push({
      from: `scene-${index % size.items}`,
      id: `link-${index}`,
      to: `scene-${(index * 7 + 1) % size.items}`,
    });
  }
  return {
    document: { ...createEmptyWireframeDocument(), blocks },
    links,
  };
}

/**
 * Culling index over blocks and visual links. A draw reads only what touches
 * the viewport rectangle; links outside it are never walked.
 */
export function createSceneIndex(
  blocks: readonly WireframeBlock[],
  links: readonly VisualLink[],
) {
  const geometry = createGeometryIndex(blocks);
  const centers = new Map(
    blocks.map((block) => [block.id, centerOf(blockBounds(block))]),
  );
  const tree = new RBush<LinkEntry>();
  tree.load(
    links.flatMap((link, order) => {
      const from = centers.get(link.from);
      const to = centers.get(link.to);
      if (!(from && to)) {
        return [];
      }
      return [
        {
          link,
          maxX: Math.max(from.x, to.x),
          maxY: Math.max(from.y, to.y),
          minX: Math.min(from.x, to.x),
          minY: Math.min(from.y, to.y),
          order,
        },
      ];
    }),
  );
  return {
    centers,
    geometry,
    visibleBlockIds: (rect: WireframeBounds) => geometry.searchRect(rect),
    visibleLinks(rect: WireframeBounds): VisualLink[] {
      return tree
        .search({
          maxX: rect.x + rect.width,
          maxY: rect.y + rect.height,
          minX: rect.x,
          minY: rect.y,
        })
        .sort((a, b) => a.order - b.order)
        .map(({ link }) => link);
    },
  };
}

export type SceneIndex = ReturnType<typeof createSceneIndex>;
