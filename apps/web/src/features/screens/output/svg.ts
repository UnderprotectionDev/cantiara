import {
  blockBounds,
  resolvedBlocks,
  type WireframeBounds,
} from "@cantiara/api/wireframe-document";
import {
  type PaintMark,
  type PaintPlan,
  paintBlock,
  WIREFRAME_FONT_FAMILY,
} from "../engine/paint";
import type { WireframeSnapshot } from "./snapshot";

/**
 * Export renderer. It reads an exact `WireframeSnapshot` and the shared paint
 * plan (pure geometry); it does not use Konva, a Stage or `toJSON()`. Text uses
 * the version's stored `visibleText`, so output never depends on live sources.
 */
export interface SvgOptions {
  /** Only these blocks (a selection); omitted exports the whole Screen. */
  blockIds?: readonly string[];
  /** Base64 data URI of the canvas font, inlined into the SVG. */
  fontDataUri?: string;
  /** Blocks to leave out (Presentation Mode / HTML hidden state). */
  hiddenBlockIds?: readonly string[];
  /** Standalone `.svg` files need the SVG namespace; inline HTML must not carry a URL. */
  standalone?: boolean;
}

const SELECTION_PADDING = 16;
const NUMBER_PRECISION = 1000;

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function round(value: number): number {
  return Math.round(value * NUMBER_PRECISION) / NUMBER_PRECISION;
}

function markSvg(mark: PaintMark): string {
  switch (mark.type) {
    case "line":
      return `<polyline fill="none" points="${mark.points
        .map(round)
        .join(" ")}" stroke="#475569" stroke-width="1.5"/>`;
    case "rect":
      return `<rect fill="#bfdbfe" height="${round(mark.height)}" rx="4" stroke="#475569" stroke-width="1.5" width="${round(mark.width)}" x="${round(mark.x)}" y="${round(mark.y)}"/>`;
    case "circle":
      return `<circle cx="${round(mark.x)}" cy="${round(mark.y)}" fill="#fed7aa" r="${round(mark.radius)}" stroke="#475569" stroke-width="1.5"/>`;
    default:
      return `<text fill="#334155" font-size="13" x="${round(mark.x)}" y="${round(mark.y + 11)}">${escapeXml(mark.text)}</text>`;
  }
}

function blockSvg(plan: PaintPlan): string {
  const { bounds } = plan;
  const top = plan.kind === "Card";
  const textY = top ? bounds.y + 8 + 14 : bounds.y + bounds.height / 2 + 5;
  return [
    `<g data-block-id="${escapeXml(plan.blockId)}" data-kind="${plan.kind}">`,
    `<rect fill="${plan.broken ? "#fee2e2" : plan.fill}" height="${round(bounds.height)}" width="${round(bounds.width)}" x="${round(bounds.x)}" y="${round(bounds.y)}"/>`,
    ...plan.outline.map(
      (path) =>
        `<path d="${path.d}" fill="none" stroke="#334155" stroke-width="${round(path.strokeWidth)}"/>`,
    ),
    ...plan.marks.map(markSvg),
    `<text fill="#0f172a" font-size="14" text-anchor="middle" x="${round(bounds.x + bounds.width / 2)}" y="${round(textY)}">${escapeXml(plan.label)}</text>`,
    "</g>",
  ].join("");
}

function unionBounds(boxes: WireframeBounds[]): WireframeBounds {
  const left = Math.min(...boxes.map(({ x }) => x));
  const top = Math.min(...boxes.map(({ y }) => y));
  const right = Math.max(...boxes.map(({ x, width }) => x + width));
  const bottom = Math.max(...boxes.map(({ y, height }) => y + height));
  return { height: bottom - top, width: right - left, x: left, y: top };
}

export interface RenderedSvg {
  height: number;
  markup: string;
  width: number;
}

export function renderSvg(
  snapshot: WireframeSnapshot,
  options: SvgOptions = {},
): RenderedSvg {
  const { document } = snapshot;
  const selected = options.blockIds ? new Set(options.blockIds) : null;
  const hidden = new Set(options.hiddenBlockIds ?? []);
  const blocks = resolvedBlocks(document).filter(
    ({ id }) => !hidden.has(id) && (selected === null || selected.has(id)),
  );
  let view: WireframeBounds = {
    height: document.canvas.height,
    width: document.canvas.width,
    x: 0,
    y: 0,
  };
  if (selected !== null && blocks.length > 0) {
    const union = unionBounds(blocks.map(blockBounds));
    view = {
      height: union.height + SELECTION_PADDING * 2,
      width: union.width + SELECTION_PADDING * 2,
      x: union.x - SELECTION_PADDING,
      y: union.y - SELECTION_PADDING,
    };
  }
  const font = options.fontDataUri
    ? `<style>@font-face{font-family:"${WIREFRAME_FONT_FAMILY}";src:url(${options.fontDataUri}) format("woff2")}</style>`
    : "";
  const namespace = options.standalone
    ? ' xmlns="http://www.w3.org/2000/svg"'
    : "";
  const markup = [
    `<svg${namespace} data-screen-id="${escapeXml(snapshot.screenId)}" data-wireframe-version="${snapshot.version}" font-family="${WIREFRAME_FONT_FAMILY}, cursive" height="${round(view.height)}" viewBox="${round(view.x)} ${round(view.y)} ${round(view.width)} ${round(view.height)}" width="${round(view.width)}">`,
    font,
    `<rect fill="#ffffff" height="${round(view.height)}" width="${round(view.width)}" x="${round(view.x)}" y="${round(view.y)}"/>`,
    ...blocks.map((block) => blockSvg(paintBlock(block))),
    "</svg>",
  ].join("");
  return { height: view.height, markup, width: view.width };
}
