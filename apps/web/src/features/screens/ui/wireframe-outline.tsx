// biome-ignore-all lint/performance/noJsxPropsBind: Controls bind to the outline row and selected block.
import { WIREFRAME_ALIGN_EDGES } from "@cantiara/api/wireframe-commands";
import {
  resolveBlock,
  type WireframeBlock,
} from "@cantiara/api/wireframe-document";
import { Button } from "@cantiara/ui/components/button";
import { type MouseEvent, useSyncExternalStore } from "react";
import type { WireframeEditor } from "../engine/editor";
import {
  ALIGN_LABELS,
  groupOutline,
  inspectBlock,
  type OutlineSourceRecord,
  sourceRecordOf,
} from "../engine/outline";
import type { ViewportSession } from "../engine/viewport-session";
import {
  type ConvertAndBindActions,
  ConvertAndBindPanel,
} from "./convert-and-bind-panel";
import {
  type LinkedBlockActions,
  LinkedBlockControls,
} from "./linked-block-controls";

export interface WireframeOutlineProps {
  convert?: ConvertAndBindActions;
  editor: WireframeEditor;
  linked?: LinkedBlockActions;
  /** `Open Source Record`: opens the record a block reads from. */
  onOpenSource?: (source: OutlineSourceRecord) => void;
  /** Called after a view-local change (collapse) so the viewport is saved. */
  onViewportChange?: () => void;
  readOnly: boolean;
  viewport: ViewportSession;
}

function AlignBar({ editor }: { editor: WireframeEditor }) {
  return (
    <fieldset
      aria-label="Align selection"
      className="flex flex-wrap gap-1 border-0 p-0"
    >
      {WIREFRAME_ALIGN_EDGES.map((edge) => (
        <Button
          key={edge}
          onClick={() => editor.alignSelection(edge)}
          size="sm"
          type="button"
          variant="outline"
        >
          {ALIGN_LABELS[edge]}
        </Button>
      ))}
    </fieldset>
  );
}

function BlockDetails({
  block,
  convert,
  editor,
  linked,
  onOpenSource,
  readOnly,
}: {
  block: WireframeBlock;
  convert?: ConvertAndBindActions;
  editor: WireframeEditor;
  linked?: LinkedBlockActions;
  onOpenSource?: (source: OutlineSourceRecord) => void;
  readOnly: boolean;
}) {
  const { document } = editor.getState();
  const source = sourceRecordOf(block);
  return (
    <div className="space-y-2 rounded-lg border border-border/70 p-2">
      <dl
        aria-label="Inspect block"
        className="grid grid-cols-[auto_1fr] gap-x-3 text-xs"
      >
        {inspectBlock(document, block).map((row) => (
          <div className="contents" key={row.label}>
            <dt className="font-medium">{row.label}</dt>
            <dd>{row.value}</dd>
          </div>
        ))}
      </dl>
      <div className="flex flex-wrap gap-1">
        {readOnly ? null : (
          <>
            <Button
              onClick={() => editor.reorder(block.id, -1)}
              size="sm"
              type="button"
              variant="outline"
            >
              Move up
            </Button>
            <Button
              onClick={() => editor.reorder(block.id, 1)}
              size="sm"
              type="button"
              variant="outline"
            >
              Move down
            </Button>
            <Button
              onClick={() => editor.removeBlock(block.id)}
              size="sm"
              type="button"
              variant="outline"
            >
              Remove Block
            </Button>
          </>
        )}
        {source && onOpenSource ? (
          <Button
            onClick={() => onOpenSource(source)}
            size="sm"
            type="button"
            variant="outline"
          >
            Open Source Record
          </Button>
        ) : null}
      </div>
      {readOnly ? null : (
        <LinkedBlockControls
          actions={linked}
          block={resolveBlock(document, block)}
          editor={editor}
          linkedBlock={block}
        />
      )}
      {readOnly || !convert ? null : (
        <ConvertAndBindPanel
          actions={convert}
          blockId={block.id}
          key={block.id}
        />
      )}
    </div>
  );
}

/**
 * The structured outline is a functional equivalent of the canvas, not a
 * read-only backup: every task has a keyboard-reachable control. Groups are
 * view-local (their collapse is part of the personal viewport, never of the
 * document). `Convert and Bind` and the other inspector controls mount on the
 * selected block's row only, so the outline stays compact.
 */
export function WireframeOutline({
  convert,
  editor,
  linked,
  onOpenSource,
  onViewportChange,
  readOnly,
  viewport,
}: WireframeOutlineProps) {
  const state = useSyncExternalStore(
    editor.subscribe,
    editor.getState,
    editor.getState,
  );
  const view = useSyncExternalStore(
    viewport.subscribe,
    viewport.getState,
    viewport.getState,
  );
  const [selectedId] = state.selection;
  const single = state.selection.length === 1;

  function select(event: MouseEvent, blockId: string) {
    if (!event.shiftKey) {
      editor.select([blockId]);
      return;
    }
    editor.select(
      state.selection.includes(blockId)
        ? state.selection.filter((id) => id !== blockId)
        : [...state.selection, blockId],
    );
  }

  if (state.document.blocks.length === 0) {
    return <p className="text-muted-foreground text-xs">No blocks yet.</p>;
  }
  return (
    <div className="space-y-2">
      {readOnly || state.selection.length < 2 ? null : (
        <AlignBar editor={editor} />
      )}
      <fieldset
        aria-label="Wireframe outline"
        className="space-y-1 border-0 p-0"
      >
        {groupOutline(state.document.blocks).map((group) => {
          const collapsed = view.collapsedGroups.includes(group.id);
          return (
            <div className="space-y-1" key={group.id}>
              <Button
                aria-expanded={!collapsed}
                onClick={() => {
                  viewport.toggleGroup(group.id);
                  onViewportChange?.();
                }}
                size="sm"
                type="button"
                variant="ghost"
              >
                {collapsed ? "Expand" : "Collapse"} {group.id} group (
                {group.items.length})
              </Button>
              {collapsed ? null : (
                <ul className="flex flex-wrap gap-1">
                  {group.items.map((block) => {
                    const isSelected = state.selection.includes(block.id);
                    const detailed = single && block.id === selectedId;
                    return (
                      <li
                        className={
                          detailed ? "basis-full space-y-2" : undefined
                        }
                        key={block.id}
                      >
                        <Button
                          aria-pressed={isSelected}
                          onClick={(event) => select(event, block.id)}
                          size="sm"
                          type="button"
                          variant={isSelected ? "default" : "outline"}
                        >
                          {block.kind}: {block.label}
                        </Button>
                        {detailed ? (
                          <BlockDetails
                            block={block}
                            convert={convert}
                            editor={editor}
                            linked={linked}
                            onOpenSource={onOpenSource}
                            readOnly={readOnly}
                          />
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          );
        })}
      </fieldset>
    </div>
  );
}
