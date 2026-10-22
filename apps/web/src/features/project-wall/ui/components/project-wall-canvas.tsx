// biome-ignore-all lint/performance/noJsxPropsBind: Toolbar handlers close over the cards and selection of this canvas.
import type {
  ProjectWallCardView,
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
import { LiteDebouncer } from "@tanstack/pacer-lite";
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

import {
  commandForKey,
  type WallCommand,
} from "../../lib/project-wall-keyboard";
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
} from "../../lib/project-wall-layout";
import { hiddenCardIds } from "../../lib/project-wall-outline";
import {
  type ProjectWallViewGroup,
  transformFromViewport,
  viewportFromTransform,
} from "../../lib/project-wall-scene";
import {
  ProjectWallCard,
  type ProjectWallCardActions,
} from "./project-wall-card";
import "@xyflow/react/dist/style.css";

type WallNode = Node<
  {
    actions: ProjectWallCardActions | undefined;
    card: ProjectWallCardView;
    groups: ProjectWallViewGroup[];
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
const QUEUED_MOVE_DELAY = 250;

export interface ProjectWallCanvasProps {
  actions: ProjectWallCardActions;
  cards: ProjectWallCardView[];
  /** Groups with the account's own collapse already applied. */
  groups: ProjectWallViewGroup[];
  links: ProjectWallLinkView[];
  /** `Fit View` shows every group again, so it drops the view-local collapse. */
  onExpandAll: () => void;
  /** Reports a dropped, nudged, aligned or laid-out card; wall view state only.
   * Resolves `false` when the save failed, so the canvas can revert it. */
  onMove: (
    moves: Array<{ cardId: string; position: ProjectWallPosition }>,
  ) => Promise<boolean>;
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
  // The scene counts what the canvas really renders: a link whose both ends
  // are hidden by a collapsed group is not a visible link.
  const visibleLinkCount = useMemo(
    () =>
      links.filter(
        (link) =>
          !(hiddenCards.has(link.fromCardId) || hiddenCards.has(link.toCardId)),
      ).length,
    [hiddenCards, links],
  );
  const scene = projectWallSceneStatus({
    linkCount: visibleLinkCount,
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
  const onViewportChangeRef = useRef(onViewportChange);
  onViewportChangeRef.current = onViewportChange;
  // Leaving the wall within the debounce window still reports the last
  // computed viewport: flushing must not drop the personal view.
  const viewportDebouncer = useMemo(
    () =>
      new LiteDebouncer(
        (next: Pick<ProjectWallViewport, "center" | "zoom">) =>
          onViewportChangeRef.current(next),
        { wait: VIEWPORT_SAVE_DELAY },
      ),
    [],
  );
  const reportViewport = useCallback(
    (instance: Pick<ReactFlowInstance, "getViewport">) => {
      viewportDebouncer.maybeExecute(
        viewportFromTransform(instance.getViewport(), frame()),
      );
    },
    [frame, viewportDebouncer],
  );
  useEffect(() => () => viewportDebouncer.flush(), [viewportDebouncer]);

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
  // Layout reads what the founder currently sees: the optimistic positions of
  // moves that have not been reloaded yet come before the saved wall ones, so
  // nudging, aligning and layout never resurrect a pre-drag position.
  const layoutCards = useMemo<LayoutCard[]>(
    () =>
      cards.map(({ groupId, id, locked, position }) => ({
        groupId,
        id,
        locked,
        position: optimistic.get(id) ?? position,
      })),
    [cards, optimistic],
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
  // The reloaded wall carries committed positions itself: each card's overlay
  // drops as soon as its saved position equals it. A failed save is reverted
  // by the move commit instead of waiting for a refetch that never changes.
  useEffect(() => {
    setOptimistic((current) => {
      if (current.size === 0) {
        return current;
      }
      const savedPositions = new Map(
        cards.map((card) => [card.id, card.position]),
      );
      const next = new Map(current);
      for (const [id, position] of current) {
        const known = savedPositions.get(id);
        if (!known || (known.x === position.x && known.y === position.y)) {
          next.delete(id);
        }
      }
      return next.size === current.size ? current : next;
    });
  }, [cards]);
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

  // --- Card moves and keyboard commands -------------------------------------------
  const onMoveRef = useRef(onMove);
  onMoveRef.current = onMove;
  const queued = useRef(new Map<string, ProjectWallPosition>());
  const commitQueuedRef = useRef<() => void>(() => undefined);
  const queueDebouncer = useMemo(
    () =>
      new LiteDebouncer(() => commitQueuedRef.current(), {
        wait: QUEUED_MOVE_DELAY,
      }),
    [],
  );

  const commit = useCallback(
    (moves: PositionMove[]) => {
      if (moves.length === 0) {
        return;
      }
      // Any write supersedes the coalesced keyboard nudges.
      queued.current.clear();
      queueDebouncer.cancel();
      const attempt = Promise.resolve(onMoveRef.current(moves));
      attempt
        .then((succeeded) => {
          if (succeeded !== false) {
            // Success is confirmed by the reloaded wall carrying the committed
            // positions; the overlay drop matches it position by position.
            return;
          }
          // A failed save keeps the saved positions: drop this move's overlay.
          const reverted = new Set(moves.map(({ cardId }) => cardId));
          setOptimistic((current) => {
            const next = new Map(current);
            for (const id of reverted) {
              next.delete(id);
            }
            return next;
          });
        })
        .catch(() => undefined);
    },
    [queueDebouncer],
  );
  commitQueuedRef.current = () => {
    const pending = [...queued.current].map(([cardId, position]) => ({
      cardId,
      position,
    }));
    queued.current.clear();
    commit(pending);
  };

  // Immediate send: drags, align, distribute and layout application.
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
      commit(moves);
    },
    [commit],
  );

  // Keyboard auto-repeat coalesces into one write of the latest absolute
  // positions of the same cards instead of one round trip per keypress.
  const queueMoves = useCallback(
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
      for (const move of moves) {
        queued.current.set(move.cardId, move.position);
      }
      queueDebouncer.maybeExecute();
    },
    [queueDebouncer],
  );

  // A manual drag supersedes any shown `Preview Auto-layout` proposal.
  const dropPreview = useCallback(() => {
    setPreview(null);
    setStatus(null);
  }, []);

  useEffect(
    () => () => {
      // A wall left inside the coalescing window still commits its queued moves.
      queueDebouncer.cancel();
      const pending = [...queued.current].map(([cardId, position]) => ({
        cardId,
        position,
      }));
      queued.current.clear();
      Promise.resolve(onMoveRef.current(pending)).catch(() => undefined);
    },
    [queueDebouncer],
  );

  const onNodeDragStop = useCallback(
    (_event: unknown, _node: WallNode, dragged: WallNode[]) => {
      dropPreview();
      applyMoves(
        dragged.map((node) => ({
          cardId: node.id,
          position: { x: node.position.x, y: node.position.y },
        })),
      );
    },
    [applyMoves, dropPreview],
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

  // `repeat` distinguishes a single keypress from keyboard auto-repeat: a
  // press moves at once, a held key coalesces into one coalesced write.
  const run = (command: WallCommand, repeat?: boolean) => {
    switch (command.type) {
      case "align":
        dropPreview();
        align(command.edge);
        break;
      case "distribute":
        dropPreview();
        distribute(command.axis);
        break;
      case "nudge": {
        dropPreview();
        const moves = nudgeCards(layoutCards, selection, {
          dx: command.dx,
          dy: command.dy,
        });
        if (repeat) {
          queueMoves(moves);
        } else {
          applyMoves(moves);
        }
        break;
      }
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
      run(command, event.repeat);
    }
  }

  // --- Auto-layout: preview, apply, undo ------------------------------------------
  function startPreview() {
    // With no selection every VISIBLE card is the target: cards hidden by a
    // collapsed group must not be rearranged invisibly.
    const targets =
      selection.length > 0
        ? selection
        : cards.filter(({ id }) => !hiddenCards.has(id)).map(({ id }) => id);
    const proposal = previewAutoLayout(
      layoutCards,
      targets,
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
