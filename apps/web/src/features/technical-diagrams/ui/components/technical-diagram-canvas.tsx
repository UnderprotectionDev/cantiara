// biome-ignore-all lint/performance/noJsxPropsBind: Handlers close over this diagram's layout.
import type { DiagramRecordCardView } from "@cantiara/api/technical-diagram-card";
import { diagramGraph } from "@cantiara/api/technical-diagram-structure";
import {
  DIAGRAM_MAX_ZOOM,
  DIAGRAM_MIN_ZOOM,
  diagramGroups,
  hiddenDiagramNodeIds,
  neutralDiagramView,
  resolveTechnicalDiagramViewport,
  type TechnicalDiagramViewport,
  toggleCollapsedGroup,
} from "@cantiara/api/technical-diagram-viewport";
import type { TechnicalDiagramSource } from "@cantiara/api/technical-diagrams";
import { Button } from "@cantiara/ui/components/button";
import {
  type Edge,
  MarkerType,
  type Node,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
} from "@xyflow/react";
import { useMemo, useRef, useState } from "react";

import { autoPosition } from "../../lib/technical-diagram-edit";
import "@xyflow/react/dist/style.css";

interface Props {
  diagram: Pick<TechnicalDiagramSource, "model" | "title" | "type" | "view">;
  /** Reports a dropped node; coordinates are `Diagram View` metadata only. */
  onMove?: (elementId: string, position: { x: number; y: number }) => void;
  /** Moves a record card; only the card position is saved, never the record. */
  onMoveRecordCard?: (
    cardId: string,
    position: { x: number; y: number },
  ) => void;
  /** Personal view report (center, zoom, collapse); never diagram content. */
  onViewChange?: (view: TechnicalDiagramViewport) => void;
  /** Read-only live cards of existing records placed on this canvas. */
  recordCards?: DiagramRecordCardView[];
  /** This Account's last personal view of the diagram view; null when none. */
  savedView?: TechnicalDiagramViewport | null;
}

const RECORD_CARD_PREFIX = "record-card:";
/** Nominal frame (the `h-80` canvas) used when the real size is not measured. */
const NOMINAL_FRAME = { height: 320, width: 800 };

function Canvas({
  diagram,
  onMove,
  onMoveRecordCard,
  onViewChange,
  recordCards = [],
  savedView = null,
}: Props) {
  const reactFlow = useReactFlow();
  const frameRef = useRef<HTMLDivElement>(null);
  const graph = useMemo(() => diagramGraph(diagram.model), [diagram.model]);
  const layout = diagram.view?.layout ?? {};
  const groups = useMemo(() => diagramGroups(diagram.model), [diagram.model]);
  const frameSize = () => {
    const box = frameRef.current;
    return box?.clientWidth && box.clientHeight
      ? { height: box.clientHeight, width: box.clientWidth }
      : NOMINAL_FRAME;
  };
  // A saved position is restored only if it still shows content; otherwise the
  // canvas fits visible content and never opens on an empty region.
  const [opening] = useState(() =>
    resolveTechnicalDiagramViewport({
      content: {
        groups,
        nodes: graph.nodes.map((node, index) => ({
          id: node.id,
          position: layout[node.id] ?? autoPosition(index),
        })),
      },
      frame: NOMINAL_FRAME,
      saved: savedView,
    }),
  );
  const [collapsed, setCollapsed] = useState(opening.collapsed);
  const hidden = useMemo(
    () => hiddenDiagramNodeIds(groups, collapsed),
    [groups, collapsed],
  );
  const report = (nextCollapsed: string[]) => {
    const { x, y, zoom } = reactFlow.getViewport();
    const frame = frameSize();
    onViewChange?.({
      center: {
        x: (frame.width / 2 - x) / zoom,
        y: (frame.height / 2 - y) / zoom,
      },
      collapsed: nextCollapsed,
      zoom,
    });
  };
  const toggleGroup = (groupId: string) => {
    const next = toggleCollapsedGroup(collapsed, groupId);
    setCollapsed(next);
    report(next);
  };
  const fitNeutral = () => {
    const neutral = neutralDiagramView();
    setCollapsed(neutral.collapsed);
    // One frame later the expanded groups are part of what is fitted.
    requestAnimationFrame(() => {
      reactFlow.fitView({ duration: 0 });
      report(neutral.collapsed);
    });
  };
  const nodes = useMemo<Node[]>(
    () => [
      ...graph.nodes.flatMap((node, index) =>
        hidden.has(node.id)
          ? []
          : [
              {
                data: { label: `${node.label} (${node.kind})` },
                id: node.id,
                position: layout[node.id] ?? autoPosition(index),
              },
            ],
      ),
      ...recordCards.map((card) => ({
        connectable: false,
        data: {
          label: card.broken
            ? `${card.sourceType} · Broken — ${card.broken.reason}`
            : `${card.sourceType} · ${card.title ?? ""}${card.status ? ` · ${card.status}` : ""} (read-only)`,
        },
        id: `${RECORD_CARD_PREFIX}${card.id}`,
        position: { x: card.x, y: card.y },
        style: { borderStyle: "dashed" },
      })),
    ],
    [graph.nodes, hidden, layout, recordCards],
  );
  const edges = useMemo<Edge[]>(
    () =>
      graph.links
        .filter((link) => !(hidden.has(link.from) || hidden.has(link.to)))
        .map((link) => ({
          id: link.id,
          label: link.label ?? undefined,
          markerEnd: { type: MarkerType.ArrowClosed },
          source: link.from,
          target: link.to,
        })),
    [graph.links, hidden],
  );
  const labels = new Map(graph.nodes.map((node) => [node.id, node.label]));
  const restored = opening.mode === "restore" ? opening.viewport : null;
  return (
    <section
      aria-label="Technical Diagram canvas"
      className="space-y-2"
      data-diagram-type={diagram.type}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-muted-foreground text-xs">
          Canvas view of the structured outline. Positions are saved on the
          Diagram View; the model is the outline. Your zoom, position and
          collapsed groups are personal and not part of the diagram.
        </p>
        <Button onClick={fitNeutral} size="sm" type="button" variant="outline">
          Fit view
        </Button>
      </div>
      {groups.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {groups.map((group) => (
            <Button
              aria-pressed={collapsed.includes(group.id)}
              key={group.id}
              onClick={() => toggleGroup(group.id)}
              size="sm"
              type="button"
              variant="ghost"
            >
              {collapsed.includes(group.id) ? "Expand group" : "Collapse group"}
              {`: ${labels.get(group.id) ?? group.id}`}
            </Button>
          ))}
        </div>
      ) : null}
      <div className="h-80 rounded-lg border" ref={frameRef}>
        <ReactFlow
          defaultViewport={
            restored
              ? {
                  x:
                    NOMINAL_FRAME.width / 2 - restored.center.x * restored.zoom,
                  y:
                    NOMINAL_FRAME.height / 2 -
                    restored.center.y * restored.zoom,
                  zoom: restored.zoom,
                }
              : undefined
          }
          edges={edges}
          elementsSelectable
          fitView={!restored}
          maxZoom={DIAGRAM_MAX_ZOOM}
          minZoom={DIAGRAM_MIN_ZOOM}
          nodes={nodes}
          nodesConnectable={false}
          nodesDraggable={Boolean(onMove)}
          nodesFocusable
          onMoveEnd={(event) => {
            // Only a user gesture is a personal position; programmatic moves
            // (the first fit, Fit view) carry no event.
            if (event) {
              report(collapsed);
            }
          }}
          onNodeDragStop={(_event, node) => {
            const position = {
              x: Math.round(node.position.x),
              y: Math.round(node.position.y),
            };
            if (node.id.startsWith(RECORD_CARD_PREFIX)) {
              onMoveRecordCard?.(
                node.id.slice(RECORD_CARD_PREFIX.length),
                position,
              );
              return;
            }
            onMove?.(node.id, position);
          }}
        />
      </div>
    </section>
  );
}

export function TechnicalDiagramCanvas(props: Props) {
  return (
    <ReactFlowProvider>
      <Canvas {...props} />
    </ReactFlowProvider>
  );
}
