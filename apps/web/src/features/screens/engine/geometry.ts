import {
  blockBounds,
  type WireframeBlock,
  type WireframeBounds,
} from "@cantiara/api/wireframe-document";
import RBush from "rbush";

interface IndexItem {
  blockId: string;
  maxX: number;
  maxY: number;
  minX: number;
  minY: number;
  order: number;
}

export interface SnapResult {
  /** Alignment guides to draw while dragging; never written to the document. */
  guides: { axis: "x" | "y"; position: number }[];
  x: number;
  y: number;
}

function toQuery(rect: WireframeBounds, margin = 0) {
  return {
    maxX: rect.x + rect.width + margin,
    maxY: rect.y + rect.height + margin,
    minX: rect.x - margin,
    minY: rect.y - margin,
  };
}

/** Best one-axis snap of `starts + offsets` onto `targets`, within `threshold`. */
function snapAxis(
  start: number,
  offsets: number[],
  targets: number[],
  threshold: number,
) {
  let best: { delta: number; target: number } | null = null;
  for (const offset of offsets) {
    for (const target of targets) {
      const delta = target - (start + offset);
      if (
        Math.abs(delta) <= threshold &&
        (!best || Math.abs(delta) < Math.abs(best.delta))
      ) {
        best = { delta, target };
      }
    }
  }
  return best;
}

/**
 * Spatial index over canonical block geometry. Hit-testing, area selection and
 * snapping read the document's own bounds, never the rendered (hand-drawn)
 * strokes, so a stroke wobble can never change what a click selects.
 */
export function createGeometryIndex(blocks: readonly WireframeBlock[]) {
  const tree = new RBush<IndexItem>();
  tree.load(
    blocks.map((block, order) => {
      const bounds = blockBounds(block);
      return {
        blockId: block.id,
        maxX: bounds.x + bounds.width,
        maxY: bounds.y + bounds.height,
        minX: bounds.x,
        minY: bounds.y,
        order,
      };
    }),
  );

  return {
    /** Topmost block under the point (later blocks paint above earlier ones). */
    hitTest(point: { x: number; y: number }): string | null {
      const hits = tree.search({
        maxX: point.x,
        maxY: point.y,
        minX: point.x,
        minY: point.y,
      });
      hits.sort((a, b) => b.order - a.order);
      return hits[0]?.blockId ?? null;
    },

    /**
     * Blocks whose bounds touch the rectangle, in document (paint) order. This
     * is the culling query: only these are drawn for a viewport.
     */
    searchRect(rect: WireframeBounds): string[] {
      return tree
        .search(toQuery(rect))
        .sort((a, b) => a.order - b.order)
        .map(({ blockId }) => blockId);
    },

    /** Blocks fully inside the rectangle, in document order. */
    selectInRect(rect: WireframeBounds): string[] {
      return tree
        .search(toQuery(rect))
        .filter(
          (item) =>
            item.minX >= rect.x &&
            item.minY >= rect.y &&
            item.maxX <= rect.x + rect.width &&
            item.maxY <= rect.y + rect.height,
        )
        .sort((a, b) => a.order - b.order)
        .map(({ blockId }) => blockId);
    },

    /**
     * Snaps a moving rectangle's edges and centre to other blocks' edges and
     * centres within `threshold`. Pure: the caller decides what to do with it.
     */
    snapMove(
      moving: WireframeBounds & { id: string },
      threshold = 6,
    ): SnapResult {
      const near = tree
        .search(toQuery(moving, threshold))
        .filter(({ blockId }) => blockId !== moving.id);
      const targetsX = near.flatMap((item) => [
        item.minX,
        (item.minX + item.maxX) / 2,
        item.maxX,
      ]);
      const targetsY = near.flatMap((item) => [
        item.minY,
        (item.minY + item.maxY) / 2,
        item.maxY,
      ]);
      const snapX = snapAxis(
        moving.x,
        [0, moving.width / 2, moving.width],
        targetsX,
        threshold,
      );
      const snapY = snapAxis(
        moving.y,
        [0, moving.height / 2, moving.height],
        targetsY,
        threshold,
      );
      const guides: SnapResult["guides"] = [];
      if (snapX) {
        guides.push({ axis: "x", position: snapX.target });
      }
      if (snapY) {
        guides.push({ axis: "y", position: snapY.target });
      }
      return {
        guides,
        x: moving.x + (snapX?.delta ?? 0),
        y: moving.y + (snapY?.delta ?? 0),
      };
    },
  };
}

export type GeometryIndex = ReturnType<typeof createGeometryIndex>;
