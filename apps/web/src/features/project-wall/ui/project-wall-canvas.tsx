// biome-ignore-all lint/performance/noJsxPropsBind: Toolbar handlers close over the cards and selection of this canvas.
import type {
  ProjectWallCardView,
  ProjectWallGroupView,
  ProjectWallLinkView,
  ProjectWallPosition,
} from "@cantiara/api/project-wall";
import {
  PROJECT_WALL_MAX_ZOOM,
  PROJECT_WALL_MIN_ZOOM,
  type ProjectWallViewport,
  projectWallSceneStatus,
  resolveProjectWallViewport,
} from "@cantiara/api/project-wall-viewport";
import { Button } from "@cantiara/ui/components/button";
import {
  applyNodeChanges,
  type Edge,
  MarkerType,
  type Node,
  type NodeChange,
  type NodeProps,
  ReactFlow,
  type ReactFlowInstance,
  ReactFlowProvider,
  useReactFlow,
} from "@xyflow/react";
import {
  type KeyboardEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { commandForKey, type WallCommand } from "../lib/project-wall-keyboard";
import {
  type AlignEdge,
  type AutoLayoutPreview,
  alignCards,
  type DistributeAxis,
  distributeCards,
  type LayoutCard,
  nudgeCards,
  type PositionMove,
  previewAutoLayout,
  reorderSelection,
  type StackMove,
} from "../lib/project-wall-layout";
import { hiddenCardIds } from "../lib/project-wall-outline";
import {
  transformFromViewport,
  viewportFromTransform,
} from "../lib/project-wall-scene";
import {
  ProjectWallCard,
  type ProjectWallCardActions,
} from "./project-wall-card";
import "@xyflow/react/dist/style.css";

type WallNode = Node<
  {
    actions: ProjectWallCardActions | undefined;
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
const FALLBACK_FRAME = { height: 520, width: 1000 };
const ALIGNMENTS: Array<{ edge: AlignEdge; label: string }> = [
  { edge: "left", label: "Align Left" },
  { edge: "center", label: "Align Center" },
  { edge: "right", label: "Align Right" },
  { edge: "top", label: "Align Top" },
  { edge: "middle", label: "Align Middle" },
  { edge: "bottom", label: "Align Bottom" },
];
const DISTRIBUTIONS: Array<{ axis: DistributeAxis; label: string }> = [
  { axis: "horizontal", label: "Distribute Horizontally" },
  { axis: "vertical", label: "Distribute Vertically" },
];
const STACK_MOVES: Array<{ label: string; move: StackMove }> = [
  { label: "Bring to Front", move: "front" },
  { label: "Send to Back", move: "back" },
];
const VIEWPORT_SAVE_DELAY = 400;

export interface ProjectWallCanvasProps {
  actions: ProjectWallCardActions;
  cards: ProjectWallCardView[];
  /** Groups with the account's own collapse already applied. */
  groups: ProjectWallGroupView[];
  links: ProjectWallLinkView[];
  /** `Fit View` shows every group again, so it drops the view-local collapse. */
  onExpandAll: () => void;
  /** Reports a dropped, nudged, aligned or laid-out card; wall view state only. */
  onMove: (
    moves: Array<{ cardId: string; position: ProjectWallPosition }>,
  ) => void;
  /** Reports the new card order (z-order); wall view state only. */
  onReorder: (cardIds: string[]) => void;
  onSelectionChange: (cardIds: string[]) => void;
  /** Reports the personal viewport after the user moved it. */
  onViewportChange: (
    viewport: Pick<ProjectWallViewport, "center" | "zoom">,
  ) => void;
  /** Reports the opening viewport without asking to save it. */
  onViewportReady: (
    viewport: Pick<ProjectWallViewport, "center" | "zoom">,
  ) => void;
  /** The account's saved personal viewport of this wall, or null. */
  saved: ProjectWallViewport | null;
  selection: readonly string[];
}

function Canvas({
  actions,
  cards,
  groups,
  links,
  onExpandAll,
  onMove,
  onReorder,
  onSelectionChange,
  onViewportChange,
  onViewportReady,
  saved,
  selection,
}: ProjectWallCanvasProps) {
  const reactFlow = useReactFlow<WallNode, Edge>();
  const frameRef = useRef<HTMLElement>(null);
  const collapsedIds = useMemo(
    () => groups.filter((group) => group.collapsed).map(({ id }) => id),
    [groups],
  );
  const hiddenCards = useMemo(
    () => hiddenCardIds(cards, groups, collapsedIds),
    [cards, collapsedIds, groups],
  );
  const scene = projectWallSceneStatus({
    linkCount: links.length,
    visibleCardCount: cards.length - hiddenCards.size,
  });
  const selected = useMemo(() => new Set(selection), [selection]);
  const [preview, setPreview] = useState<AutoLayoutPreview | null>(null);
  // Positions the founder just committed; shown until the wall reloads.
  const [optimistic, setOptimistic] = useState<
    ReadonlyMap<string, ProjectWallPosition>
  >(new Map());
  const [applied, setApplied] = useState<AutoLayoutPreview | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const frame = useCallback(() => {
    const element = frameRef.current;
    return {
      height: element?.clientHeight || FALLBACK_FRAME.height,
      width: element?.clientWidth || FALLBACK_FRAME.width,
    };
  }, []);

  // --- Personal viewport -------------------------------------------------------
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reportViewport = useCallback(
    (instance: Pick<ReactFlowInstance, "getViewport">) => {
      if (saveTimer.current) {
        clearTimeout(saveTimer.current);
      }
      saveTimer.current = setTimeout(
        () =>
          onViewportChange(
            viewportFromTransform(instance.getViewport(), frame()),
          ),
        VIEWPORT_SAVE_DELAY,
      );
    },
    [frame, onViewportChange],
  );
  useEffect(
    () => () => {
      if (saveTimer.current) {
        clearTimeout(saveTimer.current);
      }
    },
    [],
  );

  // The opening decision is made once, from the viewport loaded with the wall.
  const opened = useRef<boolean>(false);
  function onInit(instance: ReactFlowInstance<WallNode, Edge>) {
    if (opened.current) {
      return;
    }
    opened.current = true;
    // Restore only when the saved position still shows a visible card;
    // otherwise fit visible content instead of opening on empty space.
    const size = frame();
    const resolved = resolveProjectWallViewport({
      content: {
        cards: cards.map(({ groupId, position }) => ({ groupId, position })),
        groups,
      },
      frame: size,
      saved: saved ? { ...saved, collapsed: collapsedIds } : null,
    });
    const ready = () =>
      onViewportReady(viewportFromTransform(instance.getViewport(), size));
    if (resolved.mode === "restore") {
      instance
        .setViewport(transformFromViewport(resolved.viewport, size))
        .then(ready);
      return;
    }
    instance.fitView({ duration: 0 }).then(ready);
  }

  // `Fit View` returns to the neutral view: every group expands, then all
  // visible content is fitted.
  const pendingFit = useRef<boolean>(false);
  const fitNow = useCallback(() => {
    requestAnimationFrame(() => {
      reactFlow.fitView({ duration: 0 }).then(() => reportViewport(reactFlow));
    });
  }, [reactFlow, reportViewport]);
  const fitView = useCallback(() => {
    if (collapsedIds.length === 0) {
      fitNow();
      return;
    }
    pendingFit.current = true;
    onExpandAll();
  }, [collapsedIds.length, fitNow, onExpandAll]);

  // --- Nodes and edges -----------------------------------------------------------
  const layoutCards = useMemo<LayoutCard[]>(
    () =>
      cards.map(({ groupId, id, locked, position }) => ({
        groupId,
        id,
        locked,
        position,
      })),
    [cards],
  );
  const previewPositions = useMemo(
    () =>
      new Map(
        (preview?.moves ?? []).map(({ cardId, position }) => [
          cardId,
          position,
        ]),
      ),
    [preview],
  );
  // A reloaded wall carries the committed positions itself.
  // biome-ignore lint/correctness/useExhaustiveDependencies: The wall reload is the trigger.
  useEffect(() => setOptimistic(new Map()), [cards]);
  const modelNodes = useMemo<WallNode[]>(
    () =>
      cards.map((card, index) => ({
        data: {
          // Beyond the hard scene the canvas drops detail, never data.
          actions: scene.reducedDetail ? undefined : actions,
          card: scene.reducedDetail
            ? { ...card, density: "Compact", fields: [], preview: null }
            : card,
          groups,
        },
        // `Lock Position` fixes the card in manual drag.
        draggable: !card.locked,
        hidden: hiddenCards.has(card.id),
        id: card.id,
        position:
          previewPositions.get(card.id) ??
          optimistic.get(card.id) ??
          card.position,
        selected: selected.has(card.id),
        type: "card",
        zIndex: index,
      })),
    [
      actions,
      cards,
      groups,
      hiddenCards,
      optimistic,
      previewPositions,
      scene.reducedDetail,
      selected,
    ],
  );
  // A Visual link is a drawn, labeled arrow; it is not a record relation.
  const edges = useMemo<Edge[]>(
    () =>
      links.map((link) => ({
        hidden:
          hiddenCards.has(link.fromCardId) || hiddenCards.has(link.toCardId),
        id: link.id,
        label: scene.reducedDetail ? undefined : link.label,
        markerEnd: scene.reducedDetail
          ? undefined
          : { type: MarkerType.ArrowClosed },
        source: link.fromCardId,
        target: link.toCardId,
      })),
    [hiddenCards, links, scene.reducedDetail],
  );
  const [nodes, setNodes] = useState(modelNodes);
  useEffect(() => setNodes(modelNodes), [modelNodes]);

  useEffect(() => {
    if (pendingFit.current && !nodes.some((node) => node.hidden)) {
      pendingFit.current = false;
      fitNow();
    }
  }, [fitNow, nodes]);

  const onNodesChange = useCallback(
    (changes: NodeChange<WallNode>[]) => {
      setNodes((current) => applyNodeChanges(changes, current));
      const picks = changes.filter((change) => change.type === "select");
      if (picks.length > 0) {
        const next = new Set(selection);
        for (const change of picks) {
          if (change.type === "select") {
            if (change.selected) {
              next.add(change.id);
            } else {
              next.delete(change.id);
            }
          }
        }
        onSelectionChange([...next]);
      }
    },
    [onSelectionChange, selection],
  );

  // --- Keyboard and toolbar operations --------------------------------------------
  const applyMoves = useCallback(
    (moves: PositionMove[]) => {
      if (moves.length === 0) {
        return;
      }
      setOptimistic((current) => {
        const next = new Map(current);
        for (const move of moves) {
          next.set(move.cardId, move.position);
        }
        return next;
      });
      onMove(moves);
    },
    [onMove],
  );
  const onNodeDragStop = useCallback(
    (_event: unknown, _node: WallNode, dragged: WallNode[]) =>
      applyMoves(
        dragged.map((node) => ({
          cardId: node.id,
          position: { x: node.position.x, y: node.position.y },
        })),
      ),
    [applyMoves],
  );
  const align = (edge: AlignEdge) =>
    applyMoves(alignCards(layoutCards, selection, edge));
  const distribute = (axis: DistributeAxis) =>
    applyMoves(distributeCards(layoutCards, selection, axis));
  const stack = (move: StackMove) =>
    onReorder(
      reorderSelection(
        cards.map(({ id }) => id),
        selection,
        move,
      ),
    );

  const pan = useCallback(
    (dx: number, dy: number) => {
      const { x, y, zoom } = reactFlow.getViewport();
      reactFlow
        .setViewport({ x: x - dx, y: y - dy, zoom }, { duration: 0 })
        .then(() => reportViewport(reactFlow));
    },
    [reactFlow, reportViewport],
  );
  const zoomBy = useCallback(
    (direction: "in" | "out") => {
      const run = direction === "in" ? reactFlow.zoomIn : reactFlow.zoomOut;
      run({ duration: 0 }).then(() => reportViewport(reactFlow));
    },
    [reactFlow, reportViewport],
  );

  const run = (command: WallCommand) => {
    switch (command.type) {
      case "align":
        align(command.edge);
        break;
      case "distribute":
        distribute(command.axis);
        break;
      case "nudge":
        applyMoves(
          nudgeCards(layoutCards, selection, {
            dx: command.dx,
            dy: command.dy,
          }),
        );
        break;
      case "pan":
        pan(command.dx, command.dy);
        break;
      case "reorder":
        stack(command.move);
        break;
      case "selectAll":
        onSelectionChange(
          cards.filter(({ id }) => !hiddenCards.has(id)).map(({ id }) => id),
        );
        break;
      case "clearSelection":
        onSelectionChange([]);
        break;
      case "zoomIn":
        zoomBy("in");
        break;
      case "zoomOut":
        zoomBy("out");
        break;
      case "fitView":
        fitView();
        break;
      default:
        break;
    }
  };

  function onKeyDown(event: KeyboardEvent<HTMLElement>) {
    const target = event.target as HTMLElement;
    if (target.closest("input, select, textarea, [contenteditable]")) {
      return;
    }
    const node = target.closest<HTMLElement>(".react-flow__node");
    if (
      (event.key === "Enter" || event.key === " ") &&
      node &&
      target === node
    ) {
      event.preventDefault();
      const id = node.dataset.id ?? "";
      onSelectionChange(
        selected.has(id)
          ? selection.filter((entry) => entry !== id)
          : [...selection, id],
      );
      return;
    }
    const command = commandForKey(event);
    if (command) {
      event.preventDefault();
      run(command);
    }
  }

  // --- Auto-layout: preview, apply, undo ------------------------------------------
  function startPreview() {
    const proposal = previewAutoLayout(
      layoutCards,
      selection,
      groups.map(({ id }) => id),
    );
    setApplied(null);
    setPreview(proposal);
    setStatus(
      proposal.moves.length === 0 ? "Auto-layout: nothing to rearrange." : null,
    );
  }
  function applyPreview() {
    if (!preview) {
      return;
    }
    applyMoves(preview.moves);
    setApplied(preview);
    setPreview(null);
  }
  function undoLayout() {
    if (!applied) {
      return;
    }
    applyMoves(applied.previous);
    setApplied(null);
  }

  return (
    // biome-ignore lint/a11y/noNoninteractiveElementInteractions: Key events bubble from the focusable cards and tools to give the canvas its keyboard commands.
    <section
      // Keyboard commands: arrows nudge, Alt+arrows pan, + and - zoom, 0 fits.
      aria-keyshortcuts="ArrowLeft ArrowRight ArrowUp ArrowDown Alt+ArrowLeft Alt+ArrowRight Alt+ArrowUp Alt+ArrowDown + - 0 Control+A Alt+Shift+L Alt+Shift+R Alt+Shift+T Alt+Shift+B Alt+Shift+C Alt+Shift+M Alt+Shift+H Alt+Shift+V"
      aria-label="Project Wall canvas"
      className="space-y-2"
      onKeyDown={onKeyDown}
    >
      <div
        aria-label="Canvas tools"
        className="flex flex-wrap items-center gap-1"
        role="toolbar"
      >
        <Button onClick={fitView} size="sm" type="button" variant="outline">
          Fit View
        </Button>
        <Button
          onClick={() => zoomBy("in")}
          size="sm"
          type="button"
          variant="outline"
        >
          Zoom in
        </Button>
        <Button
          onClick={() => zoomBy("out")}
          size="sm"
          type="button"
          variant="outline"
        >
          Zoom out
        </Button>
        {ALIGNMENTS.map(({ edge, label }) => (
          <Button
            disabled={selection.length < 2}
            key={edge}
            onClick={() => align(edge)}
            size="sm"
            type="button"
            variant="outline"
          >
            {label}
          </Button>
        ))}
        {DISTRIBUTIONS.map(({ axis, label }) => (
          <Button
            disabled={selection.length < 3}
            key={axis}
            onClick={() => distribute(axis)}
            size="sm"
            type="button"
            variant="outline"
          >
            {label}
          </Button>
        ))}
        {STACK_MOVES.map(({ label, move }) => (
          <Button
            disabled={selection.length < 1}
            key={move}
            onClick={() => stack(move)}
            size="sm"
            type="button"
            variant="outline"
          >
            {label}
          </Button>
        ))}
        <Button
          onClick={startPreview}
          size="sm"
          type="button"
          variant="outline"
        >
          Preview Auto-layout
        </Button>
        {applied ? (
          <Button
            onClick={undoLayout}
            size="sm"
            type="button"
            variant="outline"
          >
            Undo Auto-layout
          </Button>
        ) : null}
      </div>
      <p className="text-muted-foreground text-xs">
        {selection.length} selected. Focus a card and press Enter to select it;
        arrows move the selection, Alt+arrows pan, + and - zoom, 0 fits the
        view.
      </p>
      {preview && preview.moves.length > 0 ? (
        <fieldset
          aria-label="Auto-layout preview"
          className="m-0 flex flex-wrap items-center gap-2 rounded-md border p-2 text-sm"
        >
          <span>
            Auto-layout moves {preview.moves.length} card
            {preview.moves.length === 1 ? "" : "s"}
            {preview.fixed.length > 0
              ? `; ${preview.fixed.length} keep Lock Position`
              : ""}
            . Nothing is saved until you apply it.
          </span>
          <Button onClick={applyPreview} size="sm" type="button">
            Apply Auto-layout
          </Button>
          <Button
            onClick={() => setPreview(null)}
            size="sm"
            type="button"
            variant="outline"
          >
            Cancel preview
          </Button>
        </fieldset>
      ) : null}
      {status ? <p role="status">{status}</p> : null}
      {scene.warning ? <p role="status">{scene.warning}</p> : null}
      <section
        aria-label="Project Wall scene"
        className="h-[520px] rounded-md border"
        ref={frameRef}
      >
        <ReactFlow<WallNode>
          deleteKeyCode={null}
          disableKeyboardA11y
          edges={edges}
          edgesFocusable={false}
          maxZoom={PROJECT_WALL_MAX_ZOOM}
          minZoom={PROJECT_WALL_MIN_ZOOM}
          nodes={nodes}
          nodesConnectable={false}
          nodesDraggable
          nodeTypes={NODE_TYPES}
          onInit={onInit}
          onlyRenderVisibleElements
          onMoveEnd={() => reportViewport(reactFlow)}
          onNodeDragStop={onNodeDragStop}
          onNodesChange={onNodesChange}
        />
      </section>
    </section>
  );
}

/** React Flow adapter: the xyflow node shape never leaves this file. */
export default function ProjectWallCanvas(props: ProjectWallCanvasProps) {
  return (
    <ReactFlowProvider>
      <Canvas {...props} />
    </ReactFlowProvider>
  );
}
