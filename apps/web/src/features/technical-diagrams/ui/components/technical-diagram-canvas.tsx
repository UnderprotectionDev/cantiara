// biome-ignore-all lint/performance/noJsxPropsBind: Handlers close over this diagram's layout.
import type { DiagramRecordCardView } from "@cantiara/api/technical-diagram-card";
import { diagramGraph } from "@cantiara/api/technical-diagram-structure";
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
import { useMemo } from "react";

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
  /** Read-only live cards of existing records placed on this canvas. */
  recordCards?: DiagramRecordCardView[];
}

const RECORD_CARD_PREFIX = "record-card:";

function Canvas({
  diagram,
  onMove,
  onMoveRecordCard,
  recordCards = [],
}: Props) {
  const reactFlow = useReactFlow();
  const graph = useMemo(() => diagramGraph(diagram.model), [diagram.model]);
  const layout = diagram.view?.layout ?? {};
  const nodes = useMemo<Node[]>(
    () => [
      ...graph.nodes.map((node, index) => ({
        data: { label: `${node.label} (${node.kind})` },
        id: node.id,
        position: layout[node.id] ?? autoPosition(index),
      })),
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
    [graph.nodes, layout, recordCards],
  );
  const edges = useMemo<Edge[]>(
    () =>
      graph.links.map((link) => ({
        id: link.id,
        label: link.label ?? undefined,
        markerEnd: { type: MarkerType.ArrowClosed },
        source: link.from,
        target: link.to,
      })),
    [graph.links],
  );
  return (
    <section
      aria-label="Technical Diagram canvas"
      className="space-y-2"
      data-diagram-type={diagram.type}
    >
      <div className="flex items-center justify-between">
        <p className="text-muted-foreground text-xs">
          Canvas view of the structured outline. Positions are saved on the
          Diagram View; the model is the outline.
        </p>
        <Button
          onClick={() => reactFlow.fitView({ duration: 0 })}
          size="sm"
          type="button"
          variant="outline"
        >
          Fit view
        </Button>
      </div>
      <div className="h-80 rounded-lg border">
        <ReactFlow
          edges={edges}
          elementsSelectable
          fitView
          nodes={nodes}
          nodesConnectable={false}
          nodesDraggable={Boolean(onMove)}
          nodesFocusable
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
