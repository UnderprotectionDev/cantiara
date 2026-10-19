import type { AlignEdge, StackMove } from "./flow-editor";

/**
 * Keyboard alternative of every pointer gesture of the editor. The map is
 * pure so it is tested without a DOM; the canvas only dispatches the result.
 */
export type EditorCommand =
  | { type: "align"; edge: AlignEdge }
  | { type: "clearSelection" }
  | { type: "copy" }
  | { type: "delete" }
  | { type: "fitSelection" }
  | { type: "fitView" }
  | { type: "nudge"; dx: number; dy: number }
  | { type: "pan"; dx: number; dy: number }
  | { type: "paste" }
  | { type: "redo" }
  | { type: "reorder"; move: StackMove }
  | { type: "selectAll" }
  | { type: "snapToGrid" }
  | { type: "undo" }
  | { type: "zoomIn" }
  | { type: "zoomOut" };

export interface KeyInput {
  altKey: boolean;
  /** Physical key (`KeyL`); Alt rewrites `key` on some layouts, so align uses it. */
  code?: string;
  ctrlKey: boolean;
  key: string;
  metaKey: boolean;
  shiftKey: boolean;
}

export const NUDGE_STEP = 1;
export const NUDGE_STEP_LARGE = 16;
export const PAN_STEP = 80;

const ARROWS: Record<string, { dx: number; dy: number }> = {
  ArrowDown: { dx: 0, dy: 1 },
  ArrowLeft: { dx: -1, dy: 0 },
  ArrowRight: { dx: 1, dy: 0 },
  ArrowUp: { dx: 0, dy: -1 },
};

const ALIGN_KEYS: Record<string, AlignEdge> = {
  b: "bottom",
  c: "center",
  l: "left",
  m: "middle",
  r: "right",
  t: "top",
};

function withModifier(input: KeyInput, key: string): EditorCommand | null {
  switch (key) {
    case "a":
      return { type: "selectAll" };
    case "c":
      return { type: "copy" };
    case "v":
      return { type: "paste" };
    case "z":
      return input.shiftKey ? { type: "redo" } : { type: "undo" };
    case "y":
      return { type: "redo" };
    case "]":
      return { move: "forward", type: "reorder" };
    case "[":
      return { move: "backward", type: "reorder" };
    case "}":
      return { move: "front", type: "reorder" };
    case "{":
      return { move: "back", type: "reorder" };
    default:
      return null;
  }
}

/** Maps a key press to an editor command; `null` leaves the key alone. */
export function commandForKey(input: KeyInput): EditorCommand | null {
  const key = input.key.length === 1 ? input.key.toLowerCase() : input.key;
  const arrow = ARROWS[input.key];
  if (input.metaKey || input.ctrlKey) {
    return withModifier(input, key);
  }
  if (input.altKey) {
    if (arrow) {
      return { dx: arrow.dx * PAN_STEP, dy: arrow.dy * PAN_STEP, type: "pan" };
    }
    const letter = input.code?.startsWith("Key")
      ? input.code.slice(3).toLowerCase()
      : key;
    const edge = input.shiftKey ? ALIGN_KEYS[letter] : undefined;
    return edge ? { edge, type: "align" } : null;
  }
  if (arrow) {
    const step = input.shiftKey ? NUDGE_STEP_LARGE : NUDGE_STEP;
    return { dx: arrow.dx * step, dy: arrow.dy * step, type: "nudge" };
  }
  switch (input.key) {
    case "Delete":
    case "Backspace":
      return { type: "delete" };
    case "Escape":
      return { type: "clearSelection" };
    case "+":
    case "=":
      return { type: "zoomIn" };
    case "-":
    case "_":
      return { type: "zoomOut" };
    case "0":
      return { type: "fitView" };
    case ")":
      return { type: "fitSelection" };
    case "g":
    case "G":
      return { type: "snapToGrid" };
    default:
      return null;
  }
}
