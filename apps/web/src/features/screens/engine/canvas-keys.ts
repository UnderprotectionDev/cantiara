import type { WireframeAlignEdge } from "@cantiara/api/wireframe-commands";
import { ALIGN_KEYS, KEYBOARD_MOVE_STEP } from "./outline";
import { KEYBOARD_PAN_STEP, KEYBOARD_ZOOM_FACTOR } from "./viewport-session";

export type CanvasKeyCommand =
  | { dx: number; dy: number; type: "pan" }
  | { dx: number; dy: number; type: "move" }
  | { edge: WireframeAlignEdge; type: "align" }
  | { factor: number; type: "zoom" }
  | { delta: number; type: "select" }
  | { type: "fit" };

const ARROWS: Record<string, readonly [number, number]> = {
  ArrowDown: [0, 1],
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, -1],
};

/**
 * Keyboard grammar of the canvas: arrows pan, Shift+arrows move the selection,
 * Alt+arrows align it, plus and minus zoom, `0` is `Fit View`, brackets walk
 * the selection. Pure, so the same keys are testable without a DOM.
 */
export function canvasKeyCommand(event: {
  altKey: boolean;
  key: string;
  shiftKey: boolean;
}): CanvasKeyCommand | null {
  const arrow = ARROWS[event.key];
  if (arrow) {
    const edge = ALIGN_KEYS[event.key];
    if (event.altKey && edge) {
      return { edge, type: "align" };
    }
    if (event.shiftKey) {
      return {
        dx: arrow[0] * KEYBOARD_MOVE_STEP,
        dy: arrow[1] * KEYBOARD_MOVE_STEP,
        type: "move",
      };
    }
    return {
      dx: arrow[0] * KEYBOARD_PAN_STEP,
      dy: arrow[1] * KEYBOARD_PAN_STEP,
      type: "pan",
    };
  }
  switch (event.key) {
    case "+":
    case "=":
      return { factor: KEYBOARD_ZOOM_FACTOR, type: "zoom" };
    case "-":
      return { factor: 1 / KEYBOARD_ZOOM_FACTOR, type: "zoom" };
    case "0":
      return { type: "fit" };
    case "]":
      return { delta: 1, type: "select" };
    case "[":
      return { delta: -1, type: "select" };
    default:
      return null;
  }
}
