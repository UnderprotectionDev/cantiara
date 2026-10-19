import {
  USER_FLOW_LINK_LIMIT,
  USER_FLOW_NODE_LIMIT,
  type UserFlowNodeTone,
} from "@cantiara/api/user-flow";

/**
 * Pure editor model over the versioned User Flow document. React Flow is only
 * the adapter that renders this state and reports pointer gestures back as
 * operations; nothing here knows xyflow, so the durable model is never an
 * xyflow JSON shape.
 *
 * Every document-changing operation is one undoable local operation. Selection
 * and the clipboard are session state: they never enter history and never reach
 * a saved version.
 */

export const GRID_SIZE = 16;
/** Fixed card footprint the adapter renders; alignment is computed from it. */
export const NODE_WIDTH = 220;
export const NODE_HEIGHT = 96;
export const HISTORY_LIMIT = 100;
/** Offset of each repeated paste, so a pasted copy never hides its source. */
export const PASTE_OFFSET = GRID_SIZE * 2;

export interface EditorNode {
  id: string;
  kind: "Action" | "Decision" | "Screen" | "Section" | "State/Outcome";
  position: { x: number; y: number };
  /** Live Screen reference; copy and paste keep the id, never a Screen copy. */
  screenId: string | null;
  style: UserFlowNodeTone;
  text: string;
}

/**
 * Read-only live card of a Work, Decision or Risk. It holds the record id and
 * its place only; moving or removing it edits this flow document and never the
 * source record.
 */
export interface EditorCard {
  id: string;
  kind: "Decision" | "Risk" | "Work";
  position: { x: number; y: number };
  recordId: string;
}

export interface EditorLink {
  from: string;
  id: string;
  text: string;
  to: string;
}

/** Array order of `nodes` is the z-order: later nodes are drawn above. */
export interface EditorDocument {
  /** Absent means no cards; every operation below carries cards through unchanged. */
  cards?: EditorCard[];
  links: EditorLink[];
  nodes: EditorNode[];
}

interface Clipboard {
  links: EditorLink[];
  nodes: EditorNode[];
  pastes: number;
}

export interface EditorState {
  clipboard: Clipboard | null;
  document: EditorDocument;
  future: EditorDocument[];
  past: EditorDocument[];
  /** Document the last save or load produced; the dirty baseline. */
  saved: EditorDocument;
  /** Selected node ids in document order. */
  selection: string[];
}

export type AlignEdge =
  | "bottom"
  | "center"
  | "left"
  | "middle"
  | "right"
  | "top";

export type StackMove = "backward" | "back" | "forward" | "front";

export type SelectMode = "add" | "replace" | "toggle";

export function createEditor(document: EditorDocument): EditorState {
  return {
    clipboard: null,
    document,
    future: [],
    past: [],
    saved: document,
    selection: [],
  };
}

export function snapToGrid(value: number, grid = GRID_SIZE) {
  return Math.round(value / grid) * grid;
}

function inDocumentOrder(document: EditorDocument, ids: Iterable<string>) {
  const wanted = new Set(ids);
  return document.nodes.filter(({ id }) => wanted.has(id)).map(({ id }) => id);
}

/** Records one local operation; an operation that changes nothing records nothing. */
function commit(
  state: EditorState,
  document: EditorDocument,
  selection: readonly string[] = state.selection,
): EditorState {
  if (document === state.document) {
    return { ...state, selection: inDocumentOrder(document, selection) };
  }
  return {
    ...state,
    document,
    future: [],
    past: [...state.past, state.document].slice(-HISTORY_LIMIT),
    selection: inDocumentOrder(document, selection),
  };
}

function selectedSet(state: EditorState) {
  return new Set(state.selection);
}

export function isDirty(state: EditorState) {
  return state.document !== state.saved;
}

/** A save is a version boundary: undo never reaches back across it. */
export function markSaved(
  state: EditorState,
  saved: EditorDocument,
): EditorState {
  return {
    ...state,
    document: saved,
    future: [],
    past: [],
    saved,
    selection: inDocumentOrder(saved, state.selection),
  };
}

// --- Selection (not undoable) ---------------------------------------------

export function select(
  state: EditorState,
  ids: readonly string[],
  mode: SelectMode = "replace",
): EditorState {
  const known = new Set(state.document.nodes.map(({ id }) => id));
  const valid = ids.filter((id) => known.has(id));
  let next: Set<string>;
  if (mode === "replace") {
    next = new Set(valid);
  } else if (mode === "add") {
    next = new Set([...state.selection, ...valid]);
  } else {
    next = new Set(state.selection);
    for (const id of valid) {
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
    }
  }
  return { ...state, selection: inDocumentOrder(state.document, next) };
}

export function selectAll(state: EditorState): EditorState {
  return {
    ...state,
    selection: state.document.nodes.map(({ id }) => id),
  };
}

export function clearSelection(state: EditorState): EditorState {
  return { ...state, selection: [] };
}

// --- Move and grid ----------------------------------------------------------

function mapSelected(
  state: EditorState,
  change: (node: EditorNode) => EditorNode,
): EditorDocument {
  const selected = selectedSet(state);
  let changed = false;
  const nodes = state.document.nodes.map((node) => {
    if (!selected.has(node.id)) {
      return node;
    }
    const next = change(node);
    if (
      next.position.x !== node.position.x ||
      next.position.y !== node.position.y ||
      next.style !== node.style ||
      next.text !== node.text
    ) {
      changed = true;
      return next;
    }
    return node;
  });
  return changed ? { ...state.document, nodes } : state.document;
}

/** Moves the selection by a delta; with `snap`, each node lands on the grid. */
export function moveSelection(
  state: EditorState,
  delta: { dx: number; dy: number },
  options: { snap?: boolean } = {},
): EditorState {
  return commit(
    state,
    mapSelected(state, (node) => {
      const x = node.position.x + delta.dx;
      const y = node.position.y + delta.dy;
      return {
        ...node,
        position: options.snap
          ? { x: snapToGrid(x), y: snapToGrid(y) }
          : { x, y },
      };
    }),
  );
}

/** Drag end from the adapter: absolute positions, optionally grid-snapped. */
export function setNodePositions(
  state: EditorState,
  positions: ReadonlyMap<string, { x: number; y: number }>,
  options: { snap?: boolean } = {},
): EditorState {
  let changed = false;
  const nodes = state.document.nodes.map((node) => {
    const target = positions.get(node.id);
    if (!target) {
      return node;
    }
    const position = options.snap
      ? { x: snapToGrid(target.x), y: snapToGrid(target.y) }
      : target;
    if (position.x === node.position.x && position.y === node.position.y) {
      return node;
    }
    changed = true;
    return { ...node, position };
  });
  return commit(state, changed ? { ...state.document, nodes } : state.document);
}

/** Drag end of live cards: only this flow document changes. */
export function setCardPositions(
  state: EditorState,
  positions: ReadonlyMap<string, { x: number; y: number }>,
  options: { snap?: boolean } = {},
): EditorState {
  let changed = false;
  const cards = (state.document.cards ?? []).map((card) => {
    const target = positions.get(card.id);
    if (!target) {
      return card;
    }
    const position = options.snap
      ? { x: snapToGrid(target.x), y: snapToGrid(target.y) }
      : target;
    if (position.x === card.position.x && position.y === card.position.y) {
      return card;
    }
    changed = true;
    return { ...card, position };
  });
  return commit(state, changed ? { ...state.document, cards } : state.document);
}

/** Removes a live card from the flow; the source record is not touched. */
export function removeCard(state: EditorState, cardId: string): EditorState {
  const cards = state.document.cards ?? [];
  if (!cards.some(({ id }) => id === cardId)) {
    return state;
  }
  return commit(state, {
    ...state.document,
    cards: cards.filter(({ id }) => id !== cardId),
  });
}

export function snapSelectionToGrid(state: EditorState): EditorState {
  return moveSelection(state, { dx: 0, dy: 0 }, { snap: true });
}

// --- Align ------------------------------------------------------------------

/** Aligns two or more selected nodes to their shared bounds. */
export function alignSelection(
  state: EditorState,
  edge: AlignEdge,
): EditorState {
  const selected = selectedSet(state);
  const nodes = state.document.nodes.filter(({ id }) => selected.has(id));
  if (nodes.length < 2) {
    return state;
  }
  const minX = Math.min(...nodes.map(({ position }) => position.x));
  const maxX = Math.max(
    ...nodes.map(({ position }) => position.x + NODE_WIDTH),
  );
  const minY = Math.min(...nodes.map(({ position }) => position.y));
  const maxY = Math.max(
    ...nodes.map(({ position }) => position.y + NODE_HEIGHT),
  );
  return commit(
    state,
    mapSelected(state, (node) => {
      const { x, y } = node.position;
      switch (edge) {
        case "left":
          return { ...node, position: { x: minX, y } };
        case "right":
          return { ...node, position: { x: maxX - NODE_WIDTH, y } };
        case "center":
          return {
            ...node,
            position: { x: (minX + maxX) / 2 - NODE_WIDTH / 2, y },
          };
        case "top":
          return { ...node, position: { x, y: minY } };
        case "bottom":
          return { ...node, position: { x, y: maxY - NODE_HEIGHT } };
        default:
          return {
            ...node,
            position: { x, y: (minY + maxY) / 2 - NODE_HEIGHT / 2 },
          };
      }
    }),
  );
}

// --- Z-order ----------------------------------------------------------------

/** Re-stacks the selection; the relative order inside the selection is kept. */
export function reorderSelection(
  state: EditorState,
  move: StackMove,
): EditorState {
  const selected = selectedSet(state);
  if (selected.size === 0) {
    return state;
  }
  const nodes = [...state.document.nodes];
  if (move === "front" || move === "back") {
    const picked = nodes.filter(({ id }) => selected.has(id));
    const rest = nodes.filter(({ id }) => !selected.has(id));
    const next = move === "front" ? [...rest, ...picked] : [...picked, ...rest];
    return commit(state, rearranged(state, next));
  }
  if (move === "forward") {
    for (let index = nodes.length - 2; index >= 0; index -= 1) {
      const current = nodes[index];
      const above = nodes[index + 1];
      if (
        current &&
        above &&
        selected.has(current.id) &&
        !selected.has(above.id)
      ) {
        nodes[index] = above;
        nodes[index + 1] = current;
      }
    }
  } else {
    for (let index = 1; index < nodes.length; index += 1) {
      const current = nodes[index];
      const below = nodes[index - 1];
      if (
        current &&
        below &&
        selected.has(current.id) &&
        !selected.has(below.id)
      ) {
        nodes[index] = below;
        nodes[index - 1] = current;
      }
    }
  }
  return commit(state, rearranged(state, nodes));
}

function rearranged(state: EditorState, nodes: EditorNode[]): EditorDocument {
  const same = nodes.every(
    (node, index) => node === state.document.nodes[index],
  );
  return same ? state.document : { ...state.document, nodes };
}

// --- Node fields ------------------------------------------------------------

export function setSelectionText(state: EditorState, text: string) {
  return commit(
    state,
    mapSelected(state, (node) => ({ ...node, text })),
  );
}

/** Style is decoration only: `kind` and `screenId` are never touched here. */
export function setSelectionStyle(state: EditorState, style: UserFlowNodeTone) {
  return commit(
    state,
    mapSelected(state, (node) => ({ ...node, style })),
  );
}

// --- Delete -----------------------------------------------------------------

/** Deletes the selected nodes and the links that would dangle. */
export function deleteSelection(state: EditorState): EditorState {
  const selected = selectedSet(state);
  if (selected.size === 0) {
    return state;
  }
  return commit(
    state,
    {
      ...state.document,
      links: state.document.links.filter(
        ({ from, to }) => !(selected.has(from) || selected.has(to)),
      ),
      nodes: state.document.nodes.filter(({ id }) => !selected.has(id)),
    },
    [],
  );
}

// --- Copy / paste -----------------------------------------------------------

/** Copies the selected nodes and the links between them into the session clipboard. */
export function copySelection(state: EditorState): EditorState {
  const selected = selectedSet(state);
  if (selected.size === 0) {
    return state;
  }
  return {
    ...state,
    clipboard: {
      links: state.document.links.filter(
        ({ from, to }) => selected.has(from) && selected.has(to),
      ),
      nodes: state.document.nodes.filter(({ id }) => selected.has(id)),
      pastes: 0,
    },
  };
}

/**
 * Pastes the clipboard as new nodes with fresh ids. A pasted Screen node keeps
 * its live `screenId`: pasting never copies a Screen. The pasted nodes become
 * the selection. A paste that would break the scene limits does nothing.
 */
export function paste(state: EditorState, createId: () => string): EditorState {
  const { clipboard } = state;
  if (!clipboard || clipboard.nodes.length === 0) {
    return state;
  }
  if (
    state.document.nodes.length + clipboard.nodes.length >
      USER_FLOW_NODE_LIMIT ||
    state.document.links.length + clipboard.links.length > USER_FLOW_LINK_LIMIT
  ) {
    return state;
  }
  const pastes = clipboard.pastes + 1;
  const offset = PASTE_OFFSET * pastes;
  const taken = new Set([
    ...state.document.nodes.map(({ id }) => id),
    ...state.document.links.map(({ id }) => id),
  ]);
  const fresh = () => {
    let id = createId();
    while (taken.has(id)) {
      id = createId();
    }
    taken.add(id);
    return id;
  };
  const idMap = new Map<string, string>();
  const nodes = clipboard.nodes.map((node) => {
    const id = fresh();
    idMap.set(node.id, id);
    return {
      ...node,
      id,
      position: { x: node.position.x + offset, y: node.position.y + offset },
    };
  });
  const links = clipboard.links.flatMap((link) => {
    const from = idMap.get(link.from);
    const to = idMap.get(link.to);
    return from && to ? [{ ...link, from, id: fresh(), to }] : [];
  });
  const next = commit(
    {
      ...state,
      clipboard: { ...clipboard, pastes },
    },
    {
      ...state.document,
      links: [...state.document.links, ...links],
      nodes: [...state.document.nodes, ...nodes],
    },
    nodes.map(({ id }) => id),
  );
  return next;
}

// --- Undo / redo ------------------------------------------------------------

export function canUndo(state: EditorState) {
  return state.past.length > 0;
}

export function canRedo(state: EditorState) {
  return state.future.length > 0;
}

/** Reverts the latest unsaved local operation; selection keeps only live ids. */
export function undo(state: EditorState): EditorState {
  const previous = state.past.at(-1);
  if (!previous) {
    return state;
  }
  return {
    ...state,
    document: previous,
    future: [state.document, ...state.future],
    past: state.past.slice(0, -1),
    selection: inDocumentOrder(previous, state.selection),
  };
}

export function redo(state: EditorState): EditorState {
  const [next, ...rest] = state.future;
  if (!next) {
    return state;
  }
  return {
    ...state,
    document: next,
    future: rest,
    past: [...state.past, state.document].slice(-HISTORY_LIMIT),
    selection: inDocumentOrder(next, state.selection),
  };
}
