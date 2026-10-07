import type { ReturnCanvasViewport } from "@cantiara/api/return-visual-tour";
import type { Viewport } from "@xyflow/react";

export interface RoadmapVisualView {
  available: boolean;
  nodes: { id: string; x: number; y: number }[];
  records: string[];
}
interface RoadmapViewportOptions {
  capture: () => Viewport;
  fit: () => Promise<void>;
  highlight: (id: string | null) => void;
  moveTo: (id: string, signal: AbortSignal) => Promise<boolean>;
  projectId: string;
  readView: () => RoadmapVisualView;
  restore: (viewport: Viewport) => Promise<boolean>;
}

/** Current authorized Roadmap projection owns both target resolution and restoration. */
export function createRoadmapViewport(
  options: RoadmapViewportOptions,
): ReturnCanvasViewport {
  const snapshots = new Map<unknown, { viewport: Viewport; layout: string }>();
  const layout = () => JSON.stringify(options.readView().nodes);
  return {
    captureViewport() {
      const snapshot = {};
      snapshots.set(snapshot, {
        viewport: options.capture(),
        layout: layout(),
      });
      return snapshot;
    },
    clearHighlight() {
      options.highlight(null);
      return Promise.resolve();
    },
    async showTarget(target, signal) {
      if (signal.aborted) {
        return { status: "skipped", reason: "unplaceable" };
      }
      if (target.surface !== "Roadmap") {
        return { status: "skipped", reason: "unplaceable" };
      }
      const view = options.readView();
      if (!view.available || target.surfaceId !== options.projectId) {
        return { status: "skipped", reason: "inaccessible" };
      }
      const id = `${target.recordType}:${target.recordId}`;
      // Absence from authorized records cannot distinguish deletion from lost access.
      if (!view.records.includes(id)) {
        return { status: "skipped", reason: "inaccessible" };
      }
      if (!view.nodes.some((node) => node.id === id)) {
        return { status: "skipped", reason: "unplaceable" };
      }
      const moved = await options.moveTo(id, signal);
      if (!moved || signal.aborted) {
        return { status: "skipped", reason: "unplaceable" };
      }
      options.highlight(id);
      return { status: "shown" };
    },
    restoreViewport(snapshot) {
      const saved = snapshots.get(snapshot);
      snapshots.delete(snapshot);
      if (
        !(saved && options.readView().available) ||
        saved.layout !== layout()
      ) {
        return Promise.resolve(false);
      }
      return options.restore(saved.viewport);
    },
    fitVisibleContent: options.fit,
  };
}
