import type {
  ProjectWallCardView,
  ProjectWallGroupView,
  ProjectWallLinkView,
  ProjectWallPosition,
} from "@cantiara/api/project-wall";
import {
  applyNodeChanges,
  type Edge,
  MarkerType,
  type Node,
  type NodeChange,
  type NodeProps,
  ReactFlow,
  ReactFlowProvider,
} from "@xyflow/react";
import { useCallback, useEffect, useMemo, useState } from "react";

import {
  ProjectWallCard,
  type ProjectWallCardActions,
} from "./project-wall-card";
import "@xyflow/react/dist/style.css";

type WallNode = Node<
  {
    actions: ProjectWallCardActions;
    card: ProjectWallCardView;
    groups: ProjectWallGroupView[];
  },
  "card"
>;

function WallCardNode({ data }: NodeProps<WallNode>) {
  return (
    <ProjectWallCard
      actions={data.actions}
      card={data.card}
      groups={data.groups}
    />
  );
}

const NODE_TYPES = { card: WallCardNode };

interface CanvasProps {
  actions: ProjectWallCardActions;
  cards: ProjectWallCardView[];
  groups: ProjectWallGroupView[];
  links: ProjectWallLinkView[];
  /** Reports a dropped card; the wall persists wall view state, never the source. */
  onMove: (
    moves: Array<{ cardId: string; position: ProjectWallPosition }>,
  ) => void;
}

function Canvas({ actions, cards, groups, links, onMove }: CanvasProps) {
  const hiddenCards = useMemo(() => {
    const collapsed = new Set(
      groups.filter((group) => group.collapsed).map(({ id }) => id),
    );
    return new Set(
      cards
        .filter((card) => card.groupId && collapsed.has(card.groupId))
        .map(({ id }) => id),
    );
  }, [cards, groups]);
  const modelNodes = useMemo<WallNode[]>(
    () =>
      cards.map((card) => ({
        data: { actions, card, groups },
        // `Lock Position` fixes the card in manual drag.
        draggable: !card.locked,
        hidden: hiddenCards.has(card.id),
        id: card.id,
        position: card.position,
        type: "card",
      })),
    [actions, cards, groups, hiddenCards],
  );
  // A Visual link is a drawn, labeled arrow; it is not a record relation.
  const edges = useMemo<Edge[]>(
    () =>
      links.map((link) => ({
        hidden:
          hiddenCards.has(link.fromCardId) || hiddenCards.has(link.toCardId),
        id: link.id,
        label: link.label,
        markerEnd: { type: MarkerType.ArrowClosed },
        source: link.fromCardId,
        target: link.toCardId,
      })),
    [hiddenCards, links],
  );
  const [nodes, setNodes] = useState(modelNodes);
  useEffect(() => setNodes(modelNodes), [modelNodes]);

  const onNodesChange = useCallback(
    (changes: NodeChange<WallNode>[]) =>
      setNodes((current) => applyNodeChanges(changes, current)),
    [],
  );
  const onNodeDragStop = useCallback(
    (_event: unknown, _node: WallNode, dragged: WallNode[]) =>
      onMove(
        dragged.map((node) => ({
          cardId: node.id,
          position: { x: node.position.x, y: node.position.y },
        })),
      ),
    [onMove],
  );

  return (
    <section
      aria-label="Project Wall canvas"
      className="h-[520px] rounded-md border"
    >
      <ReactFlow<WallNode>
        deleteKeyCode={null}
        edges={edges}
        edgesFocusable={false}
        fitView
        maxZoom={2}
        minZoom={0.1}
        nodes={nodes}
        nodesConnectable={false}
        nodesDraggable
        nodeTypes={NODE_TYPES}
        onlyRenderVisibleElements
        onNodeDragStop={onNodeDragStop}
        onNodesChange={onNodesChange}
      />
    </section>
  );
}

/** React Flow adapter: the xyflow node shape never leaves this file. */
export default function ProjectWallCanvas(props: CanvasProps) {
  return (
    <ReactFlowProvider>
      <Canvas {...props} />
    </ReactFlowProvider>
  );
}
