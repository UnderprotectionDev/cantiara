import type { LiveCardResolution } from "@cantiara/api/screen-origins";
import type { LiveTextResolution } from "@cantiara/api/wireframe-commands";
import {
  blockBounds,
  type WireframeBlock,
  type WireframeBounds,
  type WireframeComponentKind,
} from "@cantiara/api/wireframe-document";
import rough from "roughjs";

/** Canvas typography only; product UI keeps its own font. */
export const WIREFRAME_FONT_FAMILY = "Shantell Sans";

const generator = rough.generator();

export interface RoughPath {
  d: string;
  strokeWidth: number;
}

export type PaintMark =
  | { points: number[]; type: "line" }
  | {
      height: number;
      type: "rect";
      width: number;
      x: number;
      y: number;
    }
  | { radius: number; type: "circle"; x: number; y: number }
  | { text: string; type: "text"; x: number; y: number };

export interface PaintPlan {
  blockId: string;
  bounds: WireframeBounds;
  /** `true` for a live text reference whose source is gone. */
  broken: boolean;
  /** Solid fill: a placed component is a filled, labeled box, not an outline. */
  fill: string;
  kind: WireframeBlock["kind"];
  /** Text shown in the box, e.g. the label or a text block's current copy. */
  label: string;
  marks: PaintMark[];
  outline: RoughPath[];
}

const FILLS: Record<WireframeBlock["kind"], string> = {
  Button: "#dbeafe",
  Card: "#f1f5f9",
  Chart: "#ffedd5",
  Input: "#fef9c3",
  Navigation: "#ede9fe",
  Table: "#dcfce7",
  Text: "#ffffff",
  "Live Card": "#fff7ed",
};

/**
 * Hand-drawn outline of canonical bounds. The per-item seed is fixed in the
 * document, so rerenders and exports draw the same strokes; this output is
 * only ever painted, never used for hit-testing or snapping.
 */
export function roughOutline(block: WireframeBlock): RoughPath[] {
  const bounds = blockBounds(block);
  const drawable = generator.rectangle(
    bounds.x,
    bounds.y,
    bounds.width,
    bounds.height,
    { fillStyle: "solid", roughness: 1.2, seed: block.seed, stroke: "#334155" },
  );
  return generator
    .toPaths(drawable)
    .filter((path) => path.stroke !== "none" && path.fill === "none")
    .map(({ d, strokeWidth }) => ({ d, strokeWidth }));
}

function markLine(...points: number[]): PaintMark {
  return { points, type: "line" };
}

function componentMarks(
  block: Exclude<WireframeBlock, { kind: "Text" | "Live Card" }>,
): PaintMark[] {
  const { x, y, width, height } = blockBounds(block);
  switch (block.kind) {
    case "Button":
      return [
        {
          height: height - 12,
          type: "rect",
          width: width - 12,
          x: x + 6,
          y: y + 6,
        },
      ];
    case "Input":
      return [
        markLine(x + 10, y + 10, x + 10, y + height - 10),
        { text: block.props.placeholder, type: "text", x: x + 18, y: y + 12 },
      ];
    case "Card":
      return [
        ...(block.props.hasHeader
          ? [markLine(x, y + 36, x + width, y + 36)]
          : []),
        markLine(x + 12, y + height - 48, x + width - 12, y + height - 48),
        markLine(x + 12, y + height - 24, x + width * 0.6, y + height - 24),
      ];
    case "Table": {
      const marks: PaintMark[] = [];
      for (let row = 1; row < block.props.rows; row += 1) {
        const at = y + (height * row) / block.props.rows;
        marks.push(markLine(x, at, x + width, at));
      }
      for (let column = 1; column < block.props.columns; column += 1) {
        const at = x + (width * column) / block.props.columns;
        marks.push(markLine(at, y, at, y + height));
      }
      return marks;
    }
    case "Navigation": {
      const count = block.props.items.length;
      const slot = width / (count + 1);
      return block.props.items.map((item, index) => ({
        text: item,
        type: "text" as const,
        x: x + slot * (index + 0.5),
        y: y + height / 2 - 8,
      }));
    }
    default: {
      if (block.props.chartType === "pie") {
        return [
          {
            radius: Math.min(width, height) / 2 - 12,
            type: "circle",
            x: x + width / 2,
            y: y + height / 2,
          },
        ];
      }
      if (block.props.chartType === "line") {
        return [
          markLine(
            x + 16,
            y + height - 24,
            x + width * 0.35,
            y + height * 0.5,
            x + width * 0.6,
            y + height * 0.7,
            x + width - 16,
            y + 24,
          ),
        ];
      }
      return [0, 1, 2].map((index) => {
        const barHeight = (height - 32) * (0.4 + index * 0.25);
        return {
          height: barHeight,
          type: "rect" as const,
          width: width / 6,
          x: x + 20 + index * (width / 4),
          y: y + height - 16 - barHeight,
        };
      });
    }
  }
}

/**
 * Everything the renderer needs to paint one block, derived from canonical
 * geometry and meaning. A pure function: Konva only draws this plan.
 */
export function paintBlock(
  block: WireframeBlock,
  liveText?: LiveTextResolution,
  liveCard?: LiveCardResolution,
): PaintPlan {
  const base = {
    blockId: block.id,
    bounds: blockBounds(block),
    fill: FILLS[block.kind],
    kind: block.kind,
    outline: roughOutline(block),
  };
  if (block.kind === "Text") {
    if (block.text.mode === "placeholder") {
      return {
        ...base,
        broken: false,
        label: block.text.text,
        marks: [],
      };
    }
    const resolved = liveText ?? {
      sourcePath: "",
      state: "resolved" as const,
      text: block.text.visibleText,
    };
    const broken = resolved.state === "broken";
    return {
      ...base,
      broken,
      // A broken reference reads as broken and keeps the last visible text.
      label: broken
        ? `Broken reference: ${block.text.visibleText}`
        : resolved.text,
      marks: [],
    };
  }
  if (block.kind === "Live Card") {
    // Read-only view of one record: its title is read live, never stored here.
    const broken = liveCard?.state === "broken";
    const title = liveCard?.title ?? block.label;
    return {
      ...base,
      broken,
      label: broken
        ? `${block.props.recordType} unavailable`
        : `${block.props.recordType}: ${title}`,
      marks: [],
    };
  }
  return {
    ...base,
    broken: false,
    label: block.label,
    marks: componentMarks(block),
  };
}

export const COMPONENT_KIND_LABELS: Record<WireframeComponentKind, string> = {
  Button: "Button",
  Card: "Card",
  Chart: "Chart",
  Input: "Input",
  Navigation: "Navigation",
  Table: "Table",
};
