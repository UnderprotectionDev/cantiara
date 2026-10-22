// biome-ignore-all lint/performance/noJsxPropsBind: Toolbar handlers close over the editor state of this canvas.
import {
  resolveUserFlowViewport,
  type ScreenOption,
  USER_FLOW_MAX_ZOOM,
  USER_FLOW_MIN_ZOOM,
  USER_FLOW_NODE_TONES,
  type UserFlowNodeTone,
  type UserFlowView,
  type UserFlowViewport,
} from "@cantiara/api/user-flow";
import { Button } from "@cantiara/ui/components/button";
import { Checkbox } from "@cantiara/ui/components/checkbox";
import { Label } from "@cantiara/ui/components/label";
import {
  NativeSelect,
  NativeSelectOption,
} from "@cantiara/ui/components/native-select";
import { Textarea } from "@cantiara/ui/components/textarea";
import { LiteDebouncer } from "@tanstack/pacer-lite";
import {
  applyNodeChanges,
  type Edge,
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
  type AlignEdge,
  alignSelection,
  canRedo,
  canUndo,
  copySelection,
  createEditor,
  deleteSelection,
  type EditorDocument,
  type EditorState,
  isDirty,
  moveSelection,
  paste,
  redo,
  removeCard,
  reorderSelection,
  type StackMove,
  select,
  selectAll,
  setCardPositions,
  setNodePositions,
  setSelectionStyle,
  setSelectionText,
  snapSelectionToGrid,
  undo,
} from "../../lib/flow-editor";
import { commandForKey, type EditorCommand } from "../../lib/flow-keyboard";
import { hiddenNodeIds, toggleCollapsed } from "../../lib/flow-outline";
import { KIND_RADIUS, TONE_COLORS } from "../../lib/flow-style";
import { ScreenReference } from "../views/user-flow-view";
import { UserFlowOutline } from "./user-flow-outline";
import { RecordReference } from "./user-flow-records";
import "@xyflow/react/dist/style.css";

type ScreenView = NonNullable<UserFlowView["nodes"][number]["screen"]>;

type FlowNode = Node<
  {
    kind: string;
    onActivate: (id: string, additive: boolean) => void;
    screen: ScreenView | null;
    selected: boolean;
    style: UserFlowNodeTone;
    text: string;
  },
  "flow"
>;

const SELECTED_OUTLINE = "3px solid #111827";

function FlowCard({ data, id }: NodeProps<FlowNode>) {
  const colors = TONE_COLORS[data.style];
  function onKeyDown(event: KeyboardEvent) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      event.stopPropagation();
      data.onActivate(id, event.shiftKey);
    }
  }
  return (
    // biome-ignore lint/a11y/useSemanticElements: the card holds links and a nested Screen reference, which a native button cannot contain.
    <div
      aria-label={`${data.kind} node`}
      aria-pressed={data.selected}
      className="w-[220px] p-3 text-sm [&_a]:text-[inherit] [&_p]:text-[inherit]"
      onKeyDown={onKeyDown}
      role="button"
      style={{
        background: colors.background,
        border: `2px solid ${colors.border}`,
        borderRadius: KIND_RADIUS[data.kind as keyof typeof KIND_RADIUS],
        color: colors.foreground,
        outline: data.selected ? SELECTED_OUTLINE : undefined,
        outlineOffset: 2,
      }}
      tabIndex={0}
    >
      <p className="font-medium text-xs">
        {data.kind}
        {data.style === "default" ? "" : ` · ${data.style}`}
      </p>
      {data.text ? (
        <p className="line-clamp-3 break-words">{data.text}</p>
      ) : null}
      {data.screen ? <ScreenReference reference={data.screen} /> : null}
    </div>
  );
}

type CardView = UserFlowView["cards"][number];

type CanvasCard = Node<
  { card: CardView | null; onRemove: (cardId: string) => void; cardId: string },
  "card"
>;

const CARD_PREFIX = "card:";

/** A read-only live card: it shows the source record and edits only this flow. */
function LiveCard({ data }: NodeProps<CanvasCard>) {
  return (
    <section
      aria-label="Live card"
      className="w-[220px] space-y-1 rounded-md border-2 border-dashed bg-background p-3 text-sm"
    >
      {data.card ? <RecordReference reference={data.card.record} /> : null}
      <Button
        onClick={() => data.onRemove(data.cardId)}
        size="sm"
        type="button"
        variant="outline"
      >
        Remove card
      </Button>
    </section>
  );
}

const NODE_TYPES = { card: LiveCard, flow: FlowCard };

function toEditorDocument(flow: UserFlowView): EditorDocument {
  return {
    cards: flow.cards.map((card) => ({
      id: card.id,
      kind: card.record.kind as "Decision" | "Risk" | "Work",
      position: card.position,
      recordId: card.record.recordId,
    })),
    links: flow.links,
    nodes: flow.nodes.map((node) => ({
      id: node.id,
      kind: node.kind,
      position: node.position,
      screenId: node.screen?.screenId ?? null,
      sectionId: node.sectionId,
      style: node.style,
      text: node.text,
    })),
  };
}

const ALIGNMENTS: Array<{ edge: AlignEdge; label: string }> = [
  { edge: "left", label: "Align Left" },
  { edge: "center", label: "Align Center" },
  { edge: "right", label: "Align Right" },
  { edge: "top", label: "Align Top" },
  { edge: "middle", label: "Align Middle" },
  { edge: "bottom", label: "Align Bottom" },
];

const STACK_MOVES: Array<{ label: string; move: StackMove }> = [
  { label: "Bring to Front", move: "front" },
  { label: "Bring Forward", move: "forward" },
  { label: "Send Backward", move: "backward" },
  { label: "Send to Back", move: "back" },
];

function createNodeId() {
  return crypto.randomUUID();
}

interface CanvasProps {
  flow: UserFlowView;
  /** The account's saved personal viewport of this canvas, or null. */
  initialViewport?: UserFlowViewport | null;
  onDirtyChange?: (dirty: boolean) => void;
  onSave?: (document: EditorDocument) => Promise<unknown>;
  /** Reports the personal viewport; it is never part of a saved version. */
  onViewportChange?: (viewport: UserFlowViewport) => void;
  screenOptions?: ScreenOption[];
}

const VIEWPORT_SAVE_DELAY = 400;
const FALLBACK_FRAME = { height: 360, width: 800 };

function Editor({
  flow,
  initialViewport = null,
  onDirtyChange,
  onSave,
  onViewportChange,
  screenOptions = [],
}: CanvasProps) {
  const reactFlow = useReactFlow();
  const frameRef = useRef<HTMLElement>(null);
  const [collapsed, setCollapsed] = useState<string[]>(
    () => initialViewport?.collapsed ?? [],
  );
  const collapsedRef = useRef(collapsed);
  collapsedRef.current = collapsed;
  const onViewportChangeRef = useRef(onViewportChange);
  onViewportChangeRef.current = onViewportChange;
  const viewportDebouncer = useMemo(
    () =>
      new LiteDebouncer(
        (viewport: UserFlowViewport) => onViewportChangeRef.current?.(viewport),
        { wait: VIEWPORT_SAVE_DELAY },
      ),
    [],
  );

  // Personal working position: center, zoom and view-local collapse only.
  const rememberViewport = useCallback(
    (
      viewport: { x: number; y: number; zoom: number },
      nextCollapsed?: string[],
    ) => {
      const frame = frameRef.current;
      const width = frame?.clientWidth || FALLBACK_FRAME.width;
      const height = frame?.clientHeight || FALLBACK_FRAME.height;
      viewportDebouncer.maybeExecute({
        center: {
          x: (width / 2 - viewport.x) / viewport.zoom,
          y: (height / 2 - viewport.y) / viewport.zoom,
        },
        collapsed: nextCollapsed ?? collapsedRef.current,
        zoom: viewport.zoom,
      });
    },
    [viewportDebouncer],
  );

  useEffect(() => () => viewportDebouncer.flush(), [viewportDebouncer]);
  const [editor, setEditor] = useState<EditorState>(() =>
    createEditor(toEditorDocument(flow)),
  );
  const [snap, setSnap] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [textDraft, setTextDraft] = useState<string | null>(null);
  const dirty = isDirty(editor);

  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);

  // A pasted Screen node resolves through the same live reference as its source.
  const screens = useMemo(() => {
    const byScreenId = new Map<string, ScreenView>();
    for (const node of flow.nodes) {
      if (node.screen) {
        byScreenId.set(node.screen.screenId, node.screen);
      }
    }
    return byScreenId;
  }, [flow.nodes]);

  // Removing a card edits this flow document only; the source record is untouched.
  const removeLiveCard = useCallback((cardId: string) => {
    setEditor((state) => removeCard(state, cardId));
  }, []);

  const activate = useCallback((id: string, additive: boolean) => {
    setEditor((state) => select(state, [id], additive ? "toggle" : "replace"));
  }, []);

  const cardViews = useMemo(
    () => new Map(flow.cards.map((card) => [card.id, card])),
    [flow.cards],
  );

  const hidden = useMemo(
    () => hiddenNodeIds(editor.document, collapsed),
    [collapsed, editor.document],
  );

  const modelNodes = useMemo<Array<CanvasCard | FlowNode>>(() => {
    const selected = new Set(editor.selection);
    const cardNodes: CanvasCard[] = (editor.document.cards ?? []).map(
      (card) => ({
        data: {
          card: cardViews.get(card.id) ?? null,
          cardId: card.id,
          onRemove: removeLiveCard,
        },
        draggable: true,
        id: `${CARD_PREFIX}${card.id}`,
        position: card.position,
        type: "card",
      }),
    );
    const flowNodes = editor.document.nodes.map((node, index) => ({
      data: {
        kind: node.kind,
        onActivate: activate,
        screen: node.screenId ? (screens.get(node.screenId) ?? null) : null,
        selected: selected.has(node.id),
        style: node.style,
        text: node.text,
      },
      hidden: hidden.has(node.id),
      id: node.id,
      position: node.position,
      selected: selected.has(node.id),
      type: "flow" as const,
      zIndex: index,
    }));
    return [...flowNodes, ...cardNodes];
  }, [
    activate,
    cardViews,
    editor.document.cards,
    editor.document.nodes,
    editor.selection,
    hidden,
    removeLiveCard,
    screens,
  ]);

  // React Flow animates drags on its own copy; the model owns every commit.
  const [canvasNodes, setCanvasNodes] =
    useState<Array<CanvasCard | FlowNode>>(modelNodes);
  useEffect(() => {
    setCanvasNodes(modelNodes);
  }, [modelNodes]);

  const edges = useMemo<Edge[]>(
    () =>
      editor.document.links.map((link) => ({
        id: link.id,
        label: link.text || undefined,
        source: link.from,
        target: link.to,
      })),
    [editor.document.links],
  );

  const onNodesChange = useCallback(
    (changes: NodeChange<CanvasCard | FlowNode>[]) => {
      setCanvasNodes((nodes) => applyNodeChanges(changes, nodes));
      const selection = changes.filter((change) => change.type === "select");
      if (selection.length > 0) {
        setEditor((state) => {
          const ids = new Set(state.selection);
          for (const change of selection) {
            if (change.type === "select") {
              if (change.selected) {
                ids.add(change.id);
              } else {
                ids.delete(change.id);
              }
            }
          }
          return select(state, [...ids]);
        });
      }
    },
    [],
  );

  const onNodeDragStop = useCallback(
    (
      _event: unknown,
      _node: unknown,
      dragged: Array<CanvasCard | FlowNode>,
    ) => {
      // Moving a live card edits this flow document only, never the source record.
      const cardPositions = new Map<string, { x: number; y: number }>();
      const nodePositions = new Map<string, { x: number; y: number }>();
      for (const node of dragged) {
        if (node.id.startsWith(CARD_PREFIX)) {
          cardPositions.set(node.id.slice(CARD_PREFIX.length), node.position);
        } else {
          nodePositions.set(node.id, node.position);
        }
      }
      setEditor((state) =>
        setCardPositions(
          setNodePositions(state, nodePositions, { snap }),
          cardPositions,
          {
            snap,
          },
        ),
      );
    },
    [snap],
  );

  function apply(change: (state: EditorState) => EditorState) {
    setEditor(change);
  }

  // `Fit View` returns to the neutral view: every Section expanded, all visible content fitted.
  function fitNeutral() {
    collapsedRef.current = [];
    setCollapsed([]);
    window.requestAnimationFrame(() => {
      reactFlow
        .fitView({ duration: 0 })
        .then(() => rememberViewport(reactFlow.getViewport(), []))
        .catch(() => undefined);
    });
  }

  function toggleSection(sectionId: string) {
    const next = toggleCollapsed(collapsedRef.current, sectionId);
    collapsedRef.current = next;
    setCollapsed(next);
    rememberViewport(reactFlow.getViewport(), next);
  }

  // Restore the saved position only when it still shows content; otherwise fit visible content.
  function onInit(instance: ReactFlowInstance<CanvasCard | FlowNode>) {
    const frame = frameRef.current;
    const resolution = resolveUserFlowViewport({
      content: {
        cards: editor.document.cards ?? [],
        nodes: editor.document.nodes,
      },
      frame: {
        height: frame?.clientHeight ?? 0,
        width: frame?.clientWidth ?? 0,
      },
      saved: initialViewport,
    });
    if (resolution.mode === "restore") {
      const { center, zoom } = resolution.viewport;
      const width = frame?.clientWidth ?? FALLBACK_FRAME.width;
      const height = frame?.clientHeight ?? FALLBACK_FRAME.height;
      instance
        .setViewport(
          {
            x: width / 2 - center.x * zoom,
            y: height / 2 - center.y * zoom,
            zoom,
          },
          { duration: 0 },
        )
        .catch(() => undefined);
      return;
    }
    if (collapsedRef.current.join() !== resolution.collapsed.join()) {
      collapsedRef.current = resolution.collapsed;
      setCollapsed(resolution.collapsed);
    }
    instance.fitView({ duration: 0 }).catch(() => undefined);
  }

  function run(command: EditorCommand) {
    switch (command.type) {
      case "align":
        apply((state) => alignSelection(state, command.edge));
        break;
      case "clearSelection":
        apply((state) => select(state, []));
        break;
      case "copy":
        apply(copySelection);
        break;
      case "delete":
        apply(deleteSelection);
        break;
      case "fitSelection":
        reactFlow
          .fitView({
            duration: 0,
            nodes:
              editor.selection.length > 0
                ? editor.selection.map((id) => ({ id }))
                : undefined,
          })
          .catch(() => undefined);
        break;
      case "fitView":
        fitNeutral();
        break;
      case "nudge":
        apply((state) =>
          moveSelection(state, { dx: command.dx, dy: command.dy }, { snap }),
        );
        break;
      case "pan": {
        const { x, y, zoom } = reactFlow.getViewport();
        reactFlow
          .setViewport({ x: x - command.dx, y: y - command.dy, zoom })
          .catch(() => undefined);
        break;
      }
      case "paste":
        apply((state) => paste(state, createNodeId));
        break;
      case "redo":
        apply(redo);
        break;
      case "reorder":
        apply((state) => reorderSelection(state, command.move));
        break;
      case "selectAll":
        apply(selectAll);
        break;
      case "snapToGrid":
        apply(snapSelectionToGrid);
        break;
      case "undo":
        apply(undo);
        break;
      case "zoomIn":
        reactFlow.zoomIn({ duration: 0 }).catch(() => undefined);
        break;
      case "zoomOut":
        reactFlow.zoomOut({ duration: 0 }).catch(() => undefined);
        break;
      default:
        break;
    }
  }

  function onKeyDown(event: KeyboardEvent) {
    const target = event.target as HTMLElement;
    if (["INPUT", "SELECT", "TEXTAREA"].includes(target.tagName)) {
      return;
    }
    const command = commandForKey(event);
    if (command) {
      event.preventDefault();
      run(command);
    }
  }

  async function save() {
    if (!onSave) {
      return;
    }
    setSaving(true);
    try {
      await onSave(editor.document);
      setError(null);
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "User Flow could not be saved.",
      );
    } finally {
      setSaving(false);
    }
  }

  const hasSelection = editor.selection.length > 0;
  const single =
    editor.selection.length === 1
      ? editor.document.nodes.find(({ id }) => id === editor.selection[0])
      : undefined;
  const commonStyle = single?.style ?? "default";

  function commitText() {
    if (textDraft !== null) {
      apply((state) => setSelectionText(state, textDraft));
      setTextDraft(null);
    }
  }

  return (
    <div className="space-y-3">
      <div
        aria-label="User Flow editor tools"
        className="flex flex-wrap items-center gap-2"
        role="toolbar"
      >
        <Button
          disabled={!canUndo(editor)}
          onClick={() => run({ type: "undo" })}
          size="sm"
          type="button"
          variant="outline"
        >
          Undo
        </Button>
        <Button
          disabled={!canRedo(editor)}
          onClick={() => run({ type: "redo" })}
          size="sm"
          type="button"
          variant="outline"
        >
          Redo
        </Button>
        <Button
          onClick={() => run({ type: "selectAll" })}
          size="sm"
          type="button"
          variant="outline"
        >
          Select All
        </Button>
        <Button
          disabled={!hasSelection}
          onClick={() => run({ type: "copy" })}
          size="sm"
          type="button"
          variant="outline"
        >
          Copy
        </Button>
        <Button
          disabled={!editor.clipboard}
          onClick={() => run({ type: "paste" })}
          size="sm"
          type="button"
          variant="outline"
        >
          Paste
        </Button>
        <Button
          disabled={!hasSelection}
          onClick={() => run({ type: "delete" })}
          size="sm"
          type="button"
          variant="outline"
        >
          Delete
        </Button>
        <Button
          onClick={() => run({ type: "zoomIn" })}
          size="sm"
          type="button"
          variant="outline"
        >
          Zoom In
        </Button>
        <Button
          onClick={() => run({ type: "zoomOut" })}
          size="sm"
          type="button"
          variant="outline"
        >
          Zoom Out
        </Button>
        <Button
          onClick={() => run({ type: "fitView" })}
          size="sm"
          type="button"
          variant="outline"
        >
          Fit View
        </Button>
        <Button
          disabled={!hasSelection}
          onClick={() => run({ type: "fitSelection" })}
          size="sm"
          type="button"
          variant="outline"
        >
          Fit Selection
        </Button>
        {ALIGNMENTS.map(({ edge, label }) => (
          <Button
            disabled={editor.selection.length < 2}
            key={edge}
            onClick={() => run({ edge, type: "align" })}
            size="sm"
            type="button"
            variant="outline"
          >
            {label}
          </Button>
        ))}
        {STACK_MOVES.map(({ label, move }) => (
          <Button
            disabled={!hasSelection}
            key={move}
            onClick={() => run({ move, type: "reorder" })}
            size="sm"
            type="button"
            variant="outline"
          >
            {label}
          </Button>
        ))}
        <Button
          disabled={!hasSelection}
          onClick={() => run({ type: "snapToGrid" })}
          size="sm"
          type="button"
          variant="outline"
        >
          Snap Selection to Grid
        </Button>
        <label
          className="flex items-center gap-1 text-sm"
          htmlFor="user-flow-snap"
        >
          <Checkbox
            checked={snap}
            id="user-flow-snap"
            onCheckedChange={(checked) => setSnap(checked === true)}
          />
          Snap to grid
        </label>
      </div>
      {/* biome-ignore lint/a11y/noNoninteractiveElementInteractions: key events bubble from the focusable node cards; the region itself takes no focus. */}
      <section
        aria-describedby="user-flow-shortcuts"
        aria-label="User Flow canvas"
        className="h-[360px] w-full rounded-lg border bg-muted/20"
        onKeyDown={onKeyDown}
        ref={frameRef}
      >
        <ReactFlow<CanvasCard | FlowNode>
          deleteKeyCode={null}
          disableKeyboardA11y
          edges={edges}
          maxZoom={USER_FLOW_MAX_ZOOM}
          minZoom={USER_FLOW_MIN_ZOOM}
          multiSelectionKeyCode="Shift"
          nodes={canvasNodes}
          nodesConnectable={false}
          nodesDraggable
          nodeTypes={NODE_TYPES}
          onInit={onInit}
          onlyRenderVisibleElements
          onMoveEnd={(_event, viewport) => rememberViewport(viewport)}
          onNodeDragStop={onNodeDragStop}
          onNodesChange={onNodesChange}
          selectionKeyCode="Shift"
          snapGrid={[16, 16]}
          snapToGrid={snap}
        />
      </section>
      <p className="text-muted-foreground text-xs" id="user-flow-shortcuts">
        Shortcuts (Tab to a node first): Enter or Space selects a node (Shift
        adds), arrows nudge the selection (Shift for a grid step), Alt+arrows
        pan, + and - zoom, 0 fits the view, Shift+0 fits the selection, G snaps
        to the grid, Alt+Shift+L, C, R, T, M or B aligns, Cmd/Ctrl+C, V, A, Z
        and Shift+Z copy, paste, select all, undo and redo, Cmd/Ctrl+[ and ]
        reorder layers.
      </p>
      <UserFlowOutline
        collapsed={collapsed}
        createId={createNodeId}
        onChange={apply}
        onToggleCollapse={toggleSection}
        screenOptions={screenOptions}
        screens={screens}
        state={editor}
      />
      {single ? (
        <div className="space-y-2">
          <div className="space-y-1">
            <Label htmlFor="user-flow-selected-text">Selected node text</Label>
            <Textarea
              id="user-flow-selected-text"
              onBlur={commitText}
              onChange={(event) => setTextDraft(event.target.value)}
              value={textDraft ?? single.text}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="user-flow-selected-style">Style</Label>
            <NativeSelect
              id="user-flow-selected-style"
              onChange={(event) =>
                apply((state) =>
                  setSelectionStyle(
                    state,
                    event.target.value as UserFlowNodeTone,
                  ),
                )
              }
              value={commonStyle}
            >
              {USER_FLOW_NODE_TONES.map((tone) => (
                <NativeSelectOption key={tone} value={tone}>
                  {tone}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>
        </div>
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          disabled={!(dirty && onSave) || saving}
          onClick={save}
          type="button"
        >
          Save version
        </Button>
        <Button
          disabled={!dirty}
          onClick={() => setEditor(createEditor(toEditorDocument(flow)))}
          type="button"
          variant="outline"
        >
          Discard changes
        </Button>
        {dirty ? (
          <span className="text-muted-foreground text-xs" role="status">
            Unsaved changes. Save or discard them before placing a node.
          </span>
        ) : null}
      </div>
      {error ? <p role="alert">{error}</p> : null}
    </div>
  );
}

/**
 * React Flow adapter over the editor model. It renders the versioned document
 * and reports gestures back as editor operations; the xyflow node shape never
 * leaves this file. Local undo covers unsaved operations only; a saved version
 * is a boundary (see `markSaved`), and the surface re-seeds from the new
 * version.
 */
export default function UserFlowCanvas(props: CanvasProps) {
  return (
    <ReactFlowProvider>
      <Editor key={`${props.flow.id}:${props.flow.version}`} {...props} />
    </ReactFlowProvider>
  );
}
