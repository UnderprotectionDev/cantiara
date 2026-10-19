// biome-ignore-all lint/performance/noJsxPropsBind: Controls bind to the selected block and toolbar kind.
import type { LiveTextResolution } from "@cantiara/api/wireframe-commands";
import {
  resolveBlock,
  WIREFRAME_COMPONENT_KINDS,
  type WireframeComponentKind,
} from "@cantiara/api/wireframe-document";
import { Button } from "@cantiara/ui/components/button";
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
  lazy,
  Suspense,
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import type { WireframeEditor } from "../engine/editor";
import { CanvasTextOverlay } from "./canvas-text-overlay";
import {
  type LinkedBlockActions,
  LinkedBlockControls,
} from "./linked-block-controls";

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
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) {
      return;
    }
    const measure = () => {
      const rect = element.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        setSize(stageSizeFor(rect));
      }
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return { ref, size };
}

export interface WireframePaneProps {
  editor: WireframeEditor;
  linked?: LinkedBlockActions;
  liveText: Record<string, LiveTextResolution>;
  onSaveVersion?: () => void;
  readOnly?: boolean;
}

function Outline({ editor }: { editor: WireframeEditor }) {
  const state = useSyncExternalStore(
    editor.subscribe,
    editor.getState,
    editor.getState,
  );
  if (state.document.blocks.length === 0) {
    return <p className="text-muted-foreground text-xs">No blocks yet.</p>;
  }
  return (
    <ul aria-label="Wireframe outline" className="flex flex-wrap gap-1">
      {state.document.blocks.map((block) => (
        <li key={block.id}>
          <Button
            aria-pressed={state.selection.includes(block.id)}
            onClick={() => editor.select([block.id])}
            size="sm"
            type="button"
            variant={state.selection.includes(block.id) ? "default" : "outline"}
          >
            {block.kind}: {block.label}
          </Button>
        </li>
      ))}
    </ul>
  );
}

export function WireframePane({
  editor,
  linked,
  liveText,
  onSaveVersion,
  readOnly = false,
}: WireframePaneProps) {
  const state = useSyncExternalStore(
    editor.subscribe,
    editor.getState,
    editor.getState,
  );
  const { ref, size } = usePaneSize();
  const [editing, setEditing] = useState<string | null>(null);
  const placed = useRef(0);
  const [selectedId] = state.selection;
  const selected = state.document.blocks.find(({ id }) => id === selectedId);
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
        {onSaveVersion && !readOnly ? (
          <Button onClick={onSaveVersion} size="sm" type="button">
            Save Version
          </Button>
        ) : null}
      </div>
      <Outline editor={editor} />
      {selected && !readOnly ? (
        <LinkedBlockControls
          actions={linked}
          block={resolveBlock(state.document, selected)}
          editor={editor}
          linkedBlock={selected}
        />
      ) : null}
      <div
        className="relative h-[70vh] min-h-96 w-full overflow-hidden rounded-lg border border-border/70 bg-white"
        ref={ref}
      >
        <Suspense fallback={<p role="status">Loading Wireframe…</p>}>
          <WireframeStage
            editor={editor}
            height={size.height}
            liveText={liveText}
            onEditText={startEdit}
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
