// biome-ignore-all lint/performance/noJsxPropsBind: Viewport controls bind to the mounted canvas.

import type { ReturnCanvasViewport } from "@cantiara/api/return-visual-tour";
import type {
  Milestone,
  RoadmapOriginLink,
  RoadmapView,
} from "@cantiara/api/roadmap-horizon";
import type { WorkProfile } from "@cantiara/api/work-lifecycle";
import { Button } from "@cantiara/ui/components/button";
import { useCreateStore, useSelector } from "@tanstack/react-store";
import {
  type Node,
  type NodeProps,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
} from "@xyflow/react";
import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { projectRoadmapWorks } from "../../lib/roadmap-projection";
import {
  createRoadmapViewport,
  type RoadmapVisualView,
} from "../../lib/roadmap-viewport";
import { useRoadmapSession } from "../../store/roadmap-session";
import "@xyflow/react/dist/style.css";
import "./roadmap-canvas.css";

type RoadmapNode = Node<
  { title: string; detail: string; highlighted: boolean },
  "roadmap"
>;
function RoadmapCard({ data }: NodeProps<RoadmapNode>) {
  return (
    <div
      className={`h-[100px] w-[260px] rounded-lg border bg-card p-3 text-card-foreground ${data.highlighted ? "ring-4 ring-ring" : ""}`}
    >
      <p className="line-clamp-2 text-sm font-medium break-words">
        {data.title}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">{data.detail}</p>
      {data.highlighted === true && (
        <p className="text-xs">Current visual change</p>
      )}
    </div>
  );
}
const NODE_TYPES = { roadmap: RoadmapCard };

interface RoadmapCanvasProps {
  available?: boolean;
  milestones: Milestone[];
  onReady?: (canvas: ReturnCanvasViewport) => void;
  origins: RoadmapOriginLink[];
  projectId: string;
  view: RoadmapView | null;
  works: WorkProfile[];
}

export default function RoadmapCanvas(props: RoadmapCanvasProps) {
  return (
    <ReactFlowProvider key={props.projectId}>
      <RoadmapCanvasSession {...props} />
    </ReactFlowProvider>
  );
}

function RoadmapCanvasSession({
  projectId,
  works,
  origins,
  milestones,
  view,
  available = true,
  onReady,
}: RoadmapCanvasProps) {
  const session = useRoadmapSession();
  const flow = useReactFlow<RoadmapNode>();
  const canvasState = useCreateStore<{
    ready: boolean;
    highlight: string | null;
  }>({
    ready: false,
    highlight: null,
  });
  const { ready, highlight } = useSelector(canvasState, (value) => value);
  const active = useRef<boolean>(false);
  useLayoutEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  const records = [
    ...works.map((work) => `Work:${work.id}`),
    ...milestones.map((milestone) => `Milestone:${milestone.id}`),
  ];
  const nodes = useMemo(() => {
    const { shown } = projectRoadmapWorks(works, origins, view);
    const groups = new Map<string, number>();
    const rows = new Map<number, number>();
    const result: RoadmapNode[] = shown.map(({ work }) => {
      const groupValues = {
        Type: work.type,
        Status: work.status,
        Horizon: work.roadmapHorizon ?? "No horizon",
      };
      const group = groupValues[view?.groupBy ?? "Horizon"];
      if (!groups.has(group)) {
        groups.set(group, groups.size);
      }
      const column = groups.get(group) ?? 0;
      const row = rows.get(column) ?? 0;
      rows.set(column, row + 1);
      return {
        id: `Work:${work.id}`,
        type: "roadmap",
        position: { x: column * 300, y: row * 140 },
        width: 260,
        height: 100,
        data: {
          title: `${work.key} · ${work.title}`,
          detail: `${group} · ${work.status}`,
          highlighted: highlight === `Work:${work.id}`,
        },
      };
    });
    const milestoneX = groups.size * 300;
    for (const [index, milestone] of milestones.entries()) {
      result.push({
        id: `Milestone:${milestone.id}`,
        type: "roadmap",
        position: { x: milestoneX, y: index * 140 },
        width: 260,
        height: 100,
        data: {
          title: milestone.title,
          detail: `Milestone - ${milestone.status}`,
          highlighted: highlight === `Milestone:${milestone.id}`,
        },
      });
    }
    return result;
  }, [works, origins, milestones, view, highlight]);
  const current = useRef<RoadmapVisualView>({ available, records, nodes: [] });
  current.current = {
    available,
    records,
    nodes: nodes.map((node) => ({ id: node.id, ...node.position })),
  };
  useEffect(() => {
    if (!(ready && onReady)) {
      return;
    }
    onReady(
      createRoadmapViewport({
        projectId,
        readView: () => current.current,
        capture: () => flow.getViewport(),
        highlight: (id) =>
          canvasState.setState((value) => ({ ...value, highlight: id })),
        moveTo: (id, signal) => {
          if (signal.aborted) {
            return Promise.resolve(false);
          }
          const node = flow.getNode(id);
          if (!node) {
            return Promise.resolve(false);
          }
          // Zero-duration moves cannot continue after the driver cancels and restores.
          return flow.setCenter(node.position.x + 130, node.position.y + 50, {
            zoom: 1,
            duration: 0,
          });
        },
        restore: async (viewport) => {
          const restored = await flow.setViewport(viewport, { duration: 0 });
          if (restored) {
            session?.setState((state) => ({ ...state, viewport }));
          }
          return restored;
        },
        fit: async () => {
          if (!current.current.available) {
            throw new Error("Roadmap is unavailable.");
          }
          const fitted = current.current.nodes.length
            ? await flow.fitView({ duration: 0, padding: "8.333333333333334%" })
            : await flow.setViewport({ x: 0, y: 0, zoom: 1 }, { duration: 0 });
          if (!fitted) {
            throw new Error("Roadmap viewport could not be fitted.");
          }
          session?.setState((state) => ({
            ...state,
            viewport: flow.getViewport(),
          }));
        },
      }),
    );
  }, [canvasState, flow, onReady, projectId, ready, session]);
  return (
    <section aria-label="Roadmap canvas" className="roadmap-canvas space-y-2">
      <div className="flex flex-wrap gap-2">
        <Button
          disabled={!ready}
          onClick={() => flow.zoomIn({ duration: 0 })}
          type="button"
          variant="outline"
        >
          Zoom in
        </Button>
        <Button
          disabled={!ready}
          onClick={() => flow.zoomOut({ duration: 0 })}
          type="button"
          variant="outline"
        >
          Zoom out
        </Button>
        <Button
          disabled={!ready}
          onClick={() =>
            flow.fitView({ duration: 0, padding: "8.333333333333334%" })
          }
          type="button"
          variant="outline"
        >
          Fit View
        </Button>
      </div>
      <div
        className={`w-full rounded-lg border bg-muted/20 ${onReady ? "h-[240px] sm:h-[300px]" : "h-[360px] sm:h-[420px]"}`}
      >
        <ReactFlow<RoadmapNode>
          defaultViewport={session?.state.viewport ?? undefined}
          deleteKeyCode={null}
          edges={[]}
          elementsSelectable={false}
          maxZoom={2}
          minZoom={0.1}
          nodes={nodes}
          nodesConnectable={false}
          nodesDraggable={false}
          nodeTypes={NODE_TYPES}
          onInit={async (instance) => {
            if (!active.current) {
              return;
            }
            try {
              if (
                !session?.state.viewport &&
                current.current.nodes.length > 0
              ) {
                const placed = await instance.fitView({
                  duration: 0,
                  padding: "8.333333333333334%",
                });
                if (!placed && active.current) {
                  const neutral = await instance.setViewport(
                    { x: 0, y: 0, zoom: 1 },
                    { duration: 0 },
                  );
                  if (!neutral) {
                    return;
                  }
                }
              }
              if (active.current) {
                canvasState.setState((value) => ({ ...value, ready: true }));
              }
            } catch {
              // A failed initial placement cannot register a ready tour adapter.
            }
          }}
          onMoveEnd={(_event, viewport) =>
            session?.setState((state) => ({ ...state, viewport }))
          }
        />
      </div>
      {!nodes.length && (
        <p className="text-sm text-muted-foreground">
          No planned Work matches this view.
        </p>
      )}
    </section>
  );
}
