import {
  applyWireframeTransaction,
  type WireframeAlignEdge,
  type WireframeCommand,
} from "@cantiara/api/wireframe-commands";
import {
  createWireframeBlock,
  type WireframeBlockKind,
  type WireframeDocument,
} from "@cantiara/api/wireframe-document";
import { createGeometryIndex, type GeometryIndex } from "./geometry";

export interface WireframeEditorState {
  canRedo: boolean;
  canUndo: boolean;
  document: WireframeDocument;
  selection: readonly string[];
}

/**
 * Editing session over a canonical document. State here changes only when a
 * gesture completes: drags and pointer moves live in the renderer and reach
 * the session as one transaction at the end, so no per-pointer-move value is
 * ever React state. Selection is session state and is never saved.
 */
export function createWireframeEditor(
  initial: WireframeDocument,
  options: { createId?: () => string } = {},
) {
  const createId = options.createId ?? (() => crypto.randomUUID());
  let state: WireframeEditorState = {
    canRedo: false,
    canUndo: false,
    document: initial,
    selection: [],
  };
  let undoStack: WireframeDocument[] = [];
  let redoStack: WireframeDocument[] = [];
  let index: GeometryIndex | null = null;
  const listeners = new Set<() => void>();

  function publish(document: WireframeDocument, selection = state.selection) {
    const known = new Set(document.blocks.map(({ id }) => id));
    state = {
      canRedo: redoStack.length > 0,
      canUndo: undoStack.length > 0,
      document,
      selection: selection.filter((id) => known.has(id)),
    };
    index = null;
    for (const listener of listeners) {
      listener();
    }
  }

  return {
    /** One completed gesture is one transaction; nothing changes if it fails. */
    dispatch(commands: readonly WireframeCommand[]): WireframeDocument {
      const next = applyWireframeTransaction(state.document, commands);
      undoStack = [...undoStack, state.document];
      redoStack = [];
      publish(next);
      return next;
    },

    geometry(): GeometryIndex {
      index ??= createGeometryIndex(state.document.blocks);
      return index;
    },

    getState: () => state,

    /** Moves a block once the drag ends, snapped to canonical neighbours. */
    commitMove(blockId: string, to: { x: number; y: number }) {
      const block = state.document.blocks.find(({ id }) => id === blockId);
      if (!block) {
        return;
      }
      const snapped = this.geometry().snapMove({
        height: block.height,
        id: blockId,
        width: block.width,
        x: to.x,
        y: to.y,
      });
      this.dispatch([
        { blockId, type: "moveBlock", x: snapped.x, y: snapped.y },
      ]);
    },

    /** Aligns the selection to one edge or axis as one transaction. */
    alignSelection(edge: WireframeAlignEdge) {
      if (state.selection.length < 2) {
        return;
      }
      this.dispatch([{ blockIds: state.selection, edge, type: "alignBlocks" }]);
    },

    /** Moves the selection by a keyboard step as one transaction. */
    moveSelection(dx: number, dy: number) {
      const commands = state.selection.flatMap(
        (blockId): WireframeCommand[] => {
          const block = state.document.blocks.find(({ id }) => id === blockId);
          return block
            ? [{ blockId, type: "moveBlock", x: block.x + dx, y: block.y + dy }]
            : [];
        },
      );
      if (commands.length > 0) {
        this.dispatch(commands);
      }
    },

    /** Reorders a block in paint order; `-1` is earlier (behind), `1` later. */
    reorder(blockId: string, delta: number) {
      const from = state.document.blocks.findIndex(({ id }) => id === blockId);
      const to = from + delta;
      if (from < 0 || to < 0 || to >= state.document.blocks.length) {
        return;
      }
      this.dispatch([{ blockId, toIndex: to, type: "reorderBlock" }]);
    },

    /** Removes the block as one transaction; the selection moves with it. */
    removeBlock(blockId: string) {
      this.dispatch([{ blockId, type: "removeBlock" }]);
    },

    /** Selects the next or previous block in outline order, wrapping. */
    selectStep(delta: number) {
      const { blocks } = state.document;
      if (blocks.length === 0) {
        return;
      }
      const current = blocks.findIndex(({ id }) => id === state.selection[0]);
      const entry = delta > 0 ? 0 : blocks.length - 1;
      const next =
        current < 0 ? entry : (current + delta + blocks.length) % blocks.length;
      publish(state.document, [blocks[next]?.id ?? ""]);
    },

    /** Places a new block of a closed kind at a point and selects it. */
    placeBlock(kind: WireframeBlockKind, at: { x: number; y: number }) {
      const block = createWireframeBlock(kind, createId(), at);
      this.dispatch([{ block, type: "addBlock" }]);
      publish(state.document, [block.id]);
      return block;
    },

    redo() {
      const next = redoStack.at(-1);
      if (!next) {
        return;
      }
      redoStack = redoStack.slice(0, -1);
      undoStack = [...undoStack, state.document];
      publish(next);
    },

    /** Replaces the document, e.g. after loading a version; clears history. */
    reset(document: WireframeDocument) {
      undoStack = [];
      redoStack = [];
      publish(document, []);
    },

    select(ids: readonly string[]) {
      publish(state.document, ids);
    },

    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },

    undo() {
      const previous = undoStack.at(-1);
      if (!previous) {
        return;
      }
      undoStack = undoStack.slice(0, -1);
      redoStack = [...redoStack, state.document];
      publish(previous);
    },
  };
}

export type WireframeEditor = ReturnType<typeof createWireframeEditor>;
