import type {
  ReturnEvent,
  ReturnVisualTarget,
  SinceLastLooked,
} from "./return-to-work";

export const RETURN_VISUAL_TOUR_LIMIT = 20;

export type ReturnVisualOutcome =
  | { status: "shown" }
  | { status: "skipped"; reason: "deleted" | "inaccessible" | "unplaceable" };

/** Canvas owners resolve the exact target against their current authorized view. */
export interface ReturnCanvasViewport {
  captureViewport: () => unknown;
  clearHighlight: () => Promise<void>;
  fitVisibleContent: () => Promise<void>;
  restoreViewport: (snapshot: unknown) => Promise<boolean>;
  showTarget: (
    target: ReturnVisualTarget,
    signal: AbortSignal,
  ) => Promise<ReturnVisualOutcome>;
}

export interface ReturnVisualTourState {
  current: { event: ReturnEvent; outcome: ReturnVisualOutcome } | null;
  limit: number;
  position: number;
  remainder: { count: number; firstEventId: string } | null;
  restoration: "not-needed" | "restored" | "fit" | "failed";
  status: "idle" | "loading" | "showing" | "complete" | "closed";
  total: number;
}

/** A transient driver over the existing summary; it never reads or writes records. */
export function createReturnVisualTour(
  changes: SinceLastLooked,
  canvas: ReturnCanvasViewport,
) {
  const eligible =
    changes.lastViewedAt === null
      ? []
      : changes.groups
          .flatMap((group) => group.events)
          .filter((item) => item.visualTarget);
  const events = eligible.slice(0, RETURN_VISUAL_TOUR_LIMIT);
  const firstRemaining = eligible[RETURN_VISUAL_TOUR_LIMIT];
  let state: ReturnVisualTourState = {
    status: "idle",
    current: null,
    position: 0,
    total: events.length,
    limit: RETURN_VISUAL_TOUR_LIMIT,
    remainder: firstRemaining
      ? {
          count: eligible.length - events.length,
          firstEventId: firstRemaining.id,
        }
      : null,
    restoration: "not-needed",
  };
  let snapshot: unknown;
  let pending: Promise<void> | undefined;
  const controller = new AbortController();
  async function advance() {
    const item = events[state.position];
    if (!item?.visualTarget) {
      state = { ...state, status: "complete" };
      return;
    }
    state = { ...state, status: "loading" };
    let outcome: ReturnVisualOutcome;
    try {
      await canvas.clearHighlight();
      if (controller.signal.aborted) {
        return;
      }
      outcome = await canvas.showTarget(item.visualTarget, controller.signal);
    } catch {
      outcome = { status: "skipped", reason: "unplaceable" };
    }
    if (!controller.signal.aborted) {
      state = {
        ...state,
        status: "showing",
        current: { event: item, outcome },
        position: state.position + 1,
      };
    }
  }
  return {
    get state() {
      return state;
    },
    async start() {
      if (state.status === "idle") {
        if (events.length === 0) {
          return;
        }
        snapshot = canvas.captureViewport();
        pending = advance();
        await pending;
      }
    },
    async next() {
      if (state.status === "showing") {
        pending = advance();
        await pending;
      }
    },
    async close() {
      if (state.status === "closed") {
        return;
      }
      const started = state.status !== "idle";
      state = { ...state, status: "closed", current: null };
      controller.abort();
      if (!started) {
        return;
      }
      await pending;
      try {
        await canvas.clearHighlight();
      } catch {
        /* Restoration must still be attempted. */
      }
      let restored = false;
      try {
        restored = await canvas.restoreViewport(snapshot);
      } catch {
        /* Fit the current content below. */
      }
      if (restored) {
        state = { ...state, restoration: "restored" };
        return;
      }
      try {
        await canvas.fitVisibleContent();
        state = { ...state, restoration: "fit" };
      } catch {
        state = { ...state, restoration: "failed" };
      }
    },
  };
}
