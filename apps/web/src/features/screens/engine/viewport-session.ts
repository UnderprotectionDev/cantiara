import {
  fitContentViewport,
  neutralViewport,
  panViewport,
  restoreViewport,
  toggleCollapsedGroup,
  type WireframeViewport,
  zoomViewport,
} from "@cantiara/api/screen-viewport";
import type {
  WireframeBlock,
  WireframeDocument,
} from "@cantiara/api/wireframe-document";

export const KEYBOARD_PAN_STEP = 80;
export const KEYBOARD_ZOOM_FACTOR = 1.25;

/**
 * Personal viewport of one canvas for the open session. It is separate from
 * the editor on purpose: the document session knows nothing of navigation, so
 * a pan or zoom can never become a Wireframe command, a version, or an
 * undo step, and a geometry write never touches this state.
 */
export function createViewportSession(initial: WireframeViewport) {
  let state = initial;
  const listeners = new Set<() => void>();

  function set(next: WireframeViewport) {
    state = next;
    for (const listener of listeners) {
      listener();
    }
    return next;
  }

  return {
    /** `Fit View`: the neutral view; view-local collapse is kept. */
    fitView(canvas: WireframeDocument["canvas"]) {
      return set(neutralViewport(canvas, state.collapsedGroups));
    },
    fitContent(
      blocks: readonly WireframeBlock[],
      canvas: WireframeDocument["canvas"],
      pane: { height: number; width: number },
    ) {
      return set(
        fitContentViewport(blocks, canvas, pane, state.collapsedGroups),
      );
    },
    getState: () => state,
    pan(dx: number, dy: number) {
      return set(panViewport(state, dx, dy));
    },
    /** Applies a saved value on open; meaningless positions fit the content. */
    restore(
      saved: unknown,
      blocks: readonly WireframeBlock[],
      canvas: WireframeDocument["canvas"],
      pane: { height: number; width: number },
    ) {
      return set(restoreViewport(saved, blocks, canvas, pane));
    },
    set,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    toggleGroup(group: string) {
      return set(toggleCollapsedGroup(state, group));
    },
    zoom(factor: number) {
      return set(zoomViewport(state, factor));
    },
  };
}

export type ViewportSession = ReturnType<typeof createViewportSession>;
