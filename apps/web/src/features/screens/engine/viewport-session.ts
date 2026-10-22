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
import { createStore } from "@tanstack/react-store";

export const KEYBOARD_PAN_STEP = 80;
export const KEYBOARD_ZOOM_FACTOR = 1.25;

/**
 * Personal viewport of one canvas for the open session. It is separate from
 * the editor on purpose: the document session knows nothing of navigation, so
 * a pan or zoom can never become a Wireframe command, a version, or an
 * undo step, and a geometry write never touches this state.
 */
export function createViewportSession(initial: WireframeViewport) {
  const store = createStore<WireframeViewport>(initial);

  function set(next: WireframeViewport) {
    store.setState(() => next);
    return next;
  }

  return {
    /** `Fit View`: the neutral view; view-local collapse is kept. */
    fitView(canvas: WireframeDocument["canvas"]) {
      return set(neutralViewport(canvas, store.state.collapsedGroups));
    },
    fitContent(
      blocks: readonly WireframeBlock[],
      canvas: WireframeDocument["canvas"],
      pane: { height: number; width: number },
    ) {
      return set(
        fitContentViewport(blocks, canvas, pane, store.state.collapsedGroups),
      );
    },
    getState: () => store.state,
    pan(dx: number, dy: number) {
      return set(panViewport(store.state, dx, dy));
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
    store,
    subscribe(listener: () => void) {
      const subscription = store.subscribe(listener);
      return () => subscription.unsubscribe();
    },
    toggleGroup(group: string) {
      return set(toggleCollapsedGroup(store.state, group));
    },
    zoom(factor: number) {
      return set(zoomViewport(store.state, factor));
    },
  };
}

export type ViewportSession = ReturnType<typeof createViewportSession>;
