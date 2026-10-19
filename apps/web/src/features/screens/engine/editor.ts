import {
  applyWireframeTransaction,
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
