import type { UserFlowView } from "@cantiara/api/user-flow";
import { type Edge, type Node, type NodeProps, ReactFlow } from "@xyflow/react";
import { useMemo } from "react";

import { ScreenReference } from "./user-flow-view";
import "@xyflow/react/dist/style.css";

type FlowNode = Node<
  {
    kind: string;
    screen: UserFlowView["nodes"][number]["screen"];
    text: string;
  },
  "flow"
>;

function FlowCard({ data }: NodeProps<FlowNode>) {
  return (
    <div className="w-[220px] rounded-lg border bg-card p-3 text-card-foreground">
      <p className="font-medium text-xs">{data.kind}</p>
      {data.text ? (
        <p className="line-clamp-3 break-words text-sm">{data.text}</p>
      ) : null}
      {data.screen ? <ScreenReference reference={data.screen} /> : null}
    </div>
  );
}

const NODE_TYPES = { flow: FlowCard };

/**
 * React Flow adapter over the resolved User Flow view. It renders the durable
 * document and owns no model of its own; the structured outline stays the
 * keyboard-complete surface.
 */
export default function UserFlowCanvas({ flow }: { flow: UserFlowView }) {
  const nodes = useMemo<FlowNode[]>(
    () =>
      flow.nodes.map((node) => ({
        data: { kind: node.kind, screen: node.screen, text: node.text },
        id: node.id,
        position: node.position,
        type: "flow",
      })),
    [flow.nodes],
  );
  const edges = useMemo<Edge[]>(
    () =>
      flow.links.map((link) => ({
        id: link.id,
        label: link.text || undefined,
        source: link.from,
        target: link.to,
      })),
    [flow.links],
  );
  return (
    <section
      aria-label="User Flow canvas"
      className="h-[360px] w-full rounded-lg border bg-muted/20"
    >
      <ReactFlow<FlowNode>
        deleteKeyCode={null}
        edges={edges}
        fitView
        nodes={nodes}
        nodesConnectable={false}
        nodesDraggable={false}
        nodeTypes={NODE_TYPES}
      />
    </section>
  );
}
