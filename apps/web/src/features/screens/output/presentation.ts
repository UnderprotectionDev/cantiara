import { initiallyHiddenBlocks, linksOf } from "./links";
import type { WireframeSnapshot } from "./snapshot";

export interface PresentationState {
  hiddenBlockIds: readonly string[];
  screenId: string;
  /** Set when the last activation hit a target that does not resolve. */
  unresolvedTarget: { blockId: string; targetScreenId: string } | null;
}

function find(snapshots: readonly WireframeSnapshot[], screenId: string) {
  return snapshots.find((item) => item.screenId === screenId);
}

/** `null` when the chosen start Screen is not among the snapshots. */
export function startPresentation(
  snapshots: readonly WireframeSnapshot[],
  startScreenId: string,
): PresentationState | null {
  const start = find(snapshots, startScreenId);
  return start
    ? {
        hiddenBlockIds: initiallyHiddenBlocks(start),
        screenId: start.screenId,
        unresolvedTarget: null,
      }
    : null;
}

/**
 * One click in Presentation Mode. Pure and read-only: it returns the next view
 * state and never touches a document or any store. A broken target keeps the
 * viewer on the current Screen and reports it; it never opens another Screen.
 */
export function activateBlock(
  snapshots: readonly WireframeSnapshot[],
  state: PresentationState,
  blockId: string,
): PresentationState {
  const current = find(snapshots, state.screenId);
  if (!current) {
    return state;
  }
  const link = linksOf(current, snapshots).find(
    (item) => item.blockId === blockId,
  );
  if (link?.state === "resolved") {
    const target = find(snapshots, link.targetScreenId);
    if (target) {
      return {
        hiddenBlockIds: initiallyHiddenBlocks(target),
        screenId: target.screenId,
        unresolvedTarget: null,
      };
    }
  }
  if (link) {
    return {
      ...state,
      unresolvedTarget: { blockId, targetScreenId: link.targetScreenId },
    };
  }
  const hidden = new Set(state.hiddenBlockIds);
  for (const animation of current.document.animations) {
    if (
      animation.kind === "show-hide" &&
      animation.triggerBlockId === blockId
    ) {
      if (animation.action === "show") {
        hidden.delete(animation.targetBlockId);
      } else {
        hidden.add(animation.targetBlockId);
      }
    }
  }
  return {
    ...state,
    hiddenBlockIds: [...hidden].sort(),
    unresolvedTarget: null,
  };
}
