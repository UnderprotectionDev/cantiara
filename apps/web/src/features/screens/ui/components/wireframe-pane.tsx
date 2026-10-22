// biome-ignore-all lint/performance/noJsxPropsBind: Controls bind to the selected block and toolbar kind.
import type { LiveCardResolution } from "@cantiara/api/screen-origins";
import {
  restoreViewport,
  type WireframeViewport,
} from "@cantiara/api/screen-viewport";
import type { LiveTextResolution } from "@cantiara/api/wireframe-commands";
import {
  WIREFRAME_COMPONENT_KINDS,
  type WireframeComponentKind,
} from "@cantiara/api/wireframe-document";
import { Button } from "@cantiara/ui/components/button";
import { useSelector } from "@tanstack/react-store";
import {
  BarChart3,
  CreditCard,
  type LucideIcon,
  Menu,
  MousePointerClick,
  Table2,
  TextCursorInput,
} from "lucide-react";
import {
  type KeyboardEvent,
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import {
  type CanvasKeyCommand,
  canvasKeyCommand,
} from "../../engine/canvas-keys";
import type { WireframeEditor } from "../../engine/editor";
import type { OutlineSourceRecord } from "../../engine/outline";
import { createViewportSession } from "../../engine/viewport-session";
import { LiveCardPicker } from "../forms/place-live-card-form";
import { CanvasTextOverlay } from "./canvas-text-overlay";
import type { ConvertAndBindActions } from "./convert-and-bind-panel";
import type { LinkedBlockActions } from "./linked-block-controls";
import { WireframeOutline } from "./wireframe-outline";
import type { ViewportGesture } from "./wireframe-stage";

const WireframeStage = lazy(() => import("./wireframe-stage"));

/** Lucide is the icon source for the closed semantic component kinds. */
const KIND_ICONS: Record<WireframeComponentKind, LucideIcon> = {
  Button: MousePointerClick,
  Card: CreditCard,
  Chart: BarChart3,
  Input: TextCursorInput,
  Navigation: Menu,
  Table: Table2,
};

/** The Stage always takes the pane's own pixel size; the pane never clips it. */
export function stageSizeFor(pane: { height: number; width: number }) {
  return {
    height: Math.max(1, Math.floor(pane.height)),
    width: Math.max(1, Math.floor(pane.width)),
  };
}

function usePaneSize() {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ height: 600, width: 960 });
  const [measured, setMeasured] = useState(false);
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) {
      return;
    }
    const measure = () => {
      const rect = element.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        setSize(stageSizeFor(rect));
        setMeasured(true);
      }
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return { measured, ref, size };
}

export interface WireframePaneProps {
  /** `Convert and Bind` of the selected block; mounted in the inspector area only. */
  convert?: ConvertAndBindActions;
  editor: WireframeEditor;
  linked?: LinkedBlockActions;
  liveCards?: Record<string, LiveCardResolution>;
  liveText: Record<string, LiveTextResolution>;
  /** `Open Source Record` of the selected block. */
  onOpenSource?: (source: OutlineSourceRecord) => void;
  onSaveVersion?: () => void;
  readOnly?: boolean;
  /**
   * The account's own saved viewport of this canvas and where changes go. It
   * is navigation only: nothing here reaches the document or its versions.
   */
  viewport?: {
    onChange: (viewport: WireframeViewport) => void;
    saved: WireframeViewport | null;
  };
}

export function WireframePane({
  convert,
  editor,
  linked,
  liveCards,
  liveText,
  onOpenSource,
  onSaveVersion,
  readOnly = false,
  viewport: personal,
}: WireframePaneProps) {
  const state = useSelector(editor.store);
  const { measured, ref, size } = usePaneSize();
  const [session] = useState(() =>
    createViewportSession(
      restoreViewport(
        personal?.saved ?? null,
        editor.getState().document.blocks,
        editor.getState().document.canvas,
        size,
      ),
    ),
  );
  const restored = useRef(false);
  // The first real pane size decides whether the saved position is meaningful.
  useEffect(() => {
    if (!measured || restored.current) {
      return;
    }
    restored.current = true;
    const { document } = editor.getState();
    session.restore(
      personal?.saved ?? null,
      document.blocks,
      document.canvas,
      size,
    );
  }, [editor, measured, personal?.saved, session, size]);

  function commitView(next: WireframeViewport) {
    personal?.onChange(next);
  }

  function fitView() {
    commitView(session.fitView(editor.getState().document.canvas));
  }

  function onGesture(gesture: ViewportGesture) {
    if (gesture.type === "pan") {
      commitView(
        session.set({
          ...session.getState(),
          centerX: gesture.centerX,
          centerY: gesture.centerY,
        }),
      );
      return;
    }
    commitView(
      gesture.zoom
        ? session.zoom(gesture.deltaY < 0 ? 1.1 : 1 / 1.1)
        : session.pan(gesture.deltaX, gesture.deltaY),
    );
  }

  function onCanvasKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    // Keys typed into the text overlay or any control stay theirs.
    if (event.target !== event.currentTarget) {
      return;
    }
    const command = canvasKeyCommand(event);
    if (!command) {
      return;
    }
    event.preventDefault();
    runCanvasKey(command);
  }

  function runCanvasKey(command: CanvasKeyCommand) {
    switch (command.type) {
      case "pan":
        commitView(session.pan(command.dx, command.dy));
        break;
      case "zoom":
        commitView(session.zoom(command.factor));
        break;
      case "fit":
        fitView();
        break;
      case "select":
        editor.selectStep(command.delta);
        break;
      case "move":
        if (!readOnly) {
          editor.moveSelection(command.dx, command.dy);
        }
        break;
      default:
        if (!readOnly) {
          editor.alignSelection(command.edge);
        }
    }
  }

  const [editing, setEditing] = useState<string | null>(null);
  const placed = useRef(0);
  const editingBlock = state.document.blocks.find(({ id }) => id === editing);

  function place(kind: WireframeComponentKind) {
    placed.current += 1;
    const offset = 24 + (placed.current % 10) * 28;
    editor.placeBlock(kind, { x: offset, y: offset });
  }

  const startEdit = useCallback(
    (blockId: string) => {
      const block = editor
        .getState()
        .document.blocks.find(({ id }) => id === blockId);
      // A linked block is edited at its source, never on the instance.
      if (!block || block.link || readOnly) {
        return;
      }
      setEditing(blockId);
    },
    [editor, readOnly],
  );

  function commitText(value: string) {
    if (!(editingBlock && editing)) {
      return;
    }
    setEditing(null);
    if (editingBlock.kind === "Text") {
      editor.dispatch([
        {
          blockId: editing,
          text:
            editingBlock.text.mode === "placeholder"
              ? { mode: "placeholder", text: value }
              : editingBlock.text,
          type: "setText",
        },
        { blockId: editing, label: value.slice(0, 500), type: "setLabel" },
      ]);
      return;
    }
    editor.dispatch([
      { blockId: editing, label: value.slice(0, 500), type: "setLabel" },
    ]);
  }

  return (
    <section
      aria-label="Wireframe"
      className="w-full space-y-3"
      data-testid="wireframe-pane"
    >
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="font-medium">Wireframe</h3>
        {readOnly
          ? null
          : WIREFRAME_COMPONENT_KINDS.map((kind) => {
              const Icon = KIND_ICONS[kind];
              return (
                <Button
                  key={kind}
                  onClick={() => place(kind)}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  <Icon aria-hidden="true" className="size-4" />
                  {kind}
                </Button>
              );
            })}
        <Button
          disabled={!state.canUndo}
          onClick={() => editor.undo()}
          size="sm"
          type="button"
          variant="ghost"
        >
          Undo
        </Button>
        <Button
          disabled={!state.canRedo}
          onClick={() => editor.redo()}
          size="sm"
          type="button"
          variant="ghost"
        >
          Redo
        </Button>
        <Button onClick={fitView} size="sm" type="button" variant="outline">
          Fit View
        </Button>
        {readOnly ? null : (
          <LiveCardPicker
            onPlace={(record) => {
              placed.current += 1;
              const offset = 24 + (placed.current % 10) * 28;
              editor.placeLiveCard(record, { x: offset, y: offset });
            }}
          />
        )}
        {onSaveVersion && !readOnly ? (
          <Button onClick={onSaveVersion} size="sm" type="button">
            Save Version
          </Button>
        ) : null}
      </div>
      <WireframeOutline
        convert={convert}
        editor={editor}
        linked={linked}
        onOpenSource={onOpenSource}
        onViewportChange={() => commitView(session.getState())}
        readOnly={readOnly}
        viewport={session}
      />
      {/* biome-ignore lint/a11y/noNoninteractiveElementInteractions: the canvas application region owns the keyboard grammar. */}
      <div
        aria-keyshortcuts="ArrowUp ArrowDown ArrowLeft ArrowRight + - 0 [ ]"
        aria-label="Wireframe canvas. Arrow keys pan, plus and minus zoom, 0 is Fit View, brackets select, Shift with arrows moves, Alt with arrows aligns."
        aria-roledescription="canvas"
        className="relative h-[70vh] min-h-96 w-full overflow-hidden rounded-lg border border-border/70 bg-white"
        onKeyDown={onCanvasKeyDown}
        ref={ref}
        role="application"
        // biome-ignore lint/a11y/noNoninteractiveTabindex: the canvas is an application region with its own keyboard grammar (pan, zoom, select, move, align).
        tabIndex={0}
      >
        <Suspense fallback={<p role="status">Loading Wireframe…</p>}>
          <WireframeStage
            editor={editor}
            height={size.height}
            liveCards={liveCards}
            liveText={liveText}
            onEditText={startEdit}
            onViewportGesture={onGesture}
            viewport={session}
            width={size.width}
          />
        </Suspense>
        {editingBlock ? (
          <CanvasTextOverlay
            bounds={{
              height: Math.min(editingBlock.height, 96),
              width: editingBlock.width,
              x: editingBlock.x,
              y: editingBlock.y,
            }}
            initialValue={editingBlock.label}
            onCancel={() => setEditing(null)}
            onCommit={commitText}
          />
        ) : null}
      </div>
    </section>
  );
}
