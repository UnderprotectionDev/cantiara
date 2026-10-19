import type { WireframeSnapshot } from "./snapshot";

export interface WireframeLink {
  blockId: string;
  durationMs: number;
  /** `resolved` only when the exact target Screen is among the chosen snapshots. */
  state: "resolved" | "unresolved";
  targetScreenId: string;
  targetTitle: string | null;
  targetVersion: number | null;
  transition: "fade" | "slide-left" | "slide-right";
}

/**
 * Supported links are the `screen-transition` animations of the closed set. A
 * target absent from `chosen` stays unresolved: it is never replaced by another
 * Screen, by title, or by position.
 */
export function linksOf(
  snapshot: WireframeSnapshot,
  chosen: readonly WireframeSnapshot[],
): WireframeLink[] {
  const byId = new Map(chosen.map((item) => [item.screenId, item]));
  return snapshot.document.animations.flatMap((animation) => {
    if (animation.kind !== "screen-transition") {
      return [];
    }
    const target = byId.get(animation.targetScreenId);
    return [
      {
        blockId: animation.triggerBlockId,
        durationMs: animation.durationMs,
        state: target ? ("resolved" as const) : ("unresolved" as const),
        targetScreenId: animation.targetScreenId,
        targetTitle: target?.title ?? null,
        targetVersion: target?.version ?? null,
        transition: animation.transition,
      },
    ];
  });
}

/** Blocks a `show` animation reveals start hidden; `hide` targets start visible. */
export function initiallyHiddenBlocks(snapshot: WireframeSnapshot): string[] {
  const hidden = new Set<string>();
  for (const animation of snapshot.document.animations) {
    if (animation.kind === "show-hide" && animation.action === "show") {
      hidden.add(animation.targetBlockId);
    }
  }
  return [...hidden].sort();
}
