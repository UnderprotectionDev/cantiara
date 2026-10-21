// biome-ignore-all lint/performance/noJsxPropsBind: Konva handlers bind to the painted block.
import "@fontsource/shantell-sans/400.css";
import type { LiveCardResolution } from "@cantiara/api/screen-origins";
import { visibleRect } from "@cantiara/api/screen-viewport";
import type { LiveTextResolution } from "@cantiara/api/wireframe-commands";
import {
  resolvedBlocks,
  type WireframeBlock,
} from "@cantiara/api/wireframe-document";
import type Konva from "konva";
import { useMemo, useSyncExternalStore } from "react";
import {
  Circle,
  Group,
  Layer,
  Line,
  Path,
  Rect,
  Shape,
  Stage,
  Text,
} from "react-konva";
import type { WireframeEditor } from "../../engine/editor";
import {
  type PaintMark,
  type PaintPlan,
  paintBlock,
  WIREFRAME_FONT_FAMILY,
} from "../../engine/paint";
import { createSceneIndex, deriveVisualLinks } from "../../engine/scene";
import type { ViewportSession } from "../../engine/viewport-session";

/** Blocks this far outside the pane are still drawn so a pan never pops. */
const CULL_MARGIN = 120;

/** A finished viewport gesture; never emitted per pointer move. */
export type ViewportGesture =
  | { centerX: number; centerY: number; type: "pan" }
  | { deltaX: number; deltaY: number; type: "wheel"; zoom: boolean };

export interface WireframeStageProps {
  editor: WireframeEditor;
  height: number;
  liveCards?: Record<string, LiveCardResolution>;
  liveText: Record<string, LiveTextResolution>;
  onEditText: (blockId: string) => void;
  onViewportGesture?: (gesture: ViewportGesture) => void;
  viewport: ViewportSession;
  width: number;
}

function Mark({ mark }: { mark: PaintMark }) {
  switch (mark.type) {
    case "line":
      return <Line points={mark.points} stroke="#475569" strokeWidth={1.5} />;
    case "rect":
      return (
        <Rect
          cornerRadius={4}
          fill="#bfdbfe"
          height={mark.height}
          stroke="#475569"
          strokeWidth={1.5}
          width={mark.width}
          x={mark.x}
          y={mark.y}
        />
      );
    case "circle":
      return (
        <Circle
          fill="#fed7aa"
          radius={mark.radius}
          stroke="#475569"
          strokeWidth={1.5}
          x={mark.x}
          y={mark.y}
        />
      );
    default:
      return (
        <Text
          fill="#334155"
          fontFamily={WIREFRAME_FONT_FAMILY}
          fontSize={13}
          text={mark.text}
          x={mark.x}
          y={mark.y}
        />
      );
  }
}

function PaintedBlock({
  editor,
  onEditText,
  plan,
  selected,
}: {
  editor: WireframeEditor;
  onEditText: (blockId: string) => void;
  plan: PaintPlan;
  selected: boolean;
}) {
  const { bounds } = plan;
  function onDragMove(event: Konva.KonvaEventObject<DragEvent>) {
    // Drag state stays inside Konva: snap imperatively, never through React state.
    const node = event.target;
    const snapped = editor.geometry().snapMove({
      height: bounds.height,
      id: plan.blockId,
      width: bounds.width,
      x: bounds.x + node.x(),
      y: bounds.y + node.y(),
    });
    node.position({ x: snapped.x - bounds.x, y: snapped.y - bounds.y });
  }
  function onDragEnd(event: Konva.KonvaEventObject<DragEvent>) {
    const node = event.target;
    const to = { x: bounds.x + node.x(), y: bounds.y + node.y() };
    node.position({ x: 0, y: 0 });
    editor.commitMove(plan.blockId, to);
  }
  return (
    <Group
      draggable
      name={`block-${plan.blockId}`}
      onClick={() => editor.select([plan.blockId])}
      onDblClick={() => onEditText(plan.blockId)}
      onDragEnd={onDragEnd}
      onDragMove={onDragMove}
      onDragStart={() => editor.select([plan.blockId])}
    >
      <Rect
        fill={plan.broken ? "#fee2e2" : plan.fill}
        height={bounds.height}
        width={bounds.width}
        x={bounds.x}
        y={bounds.y}
      />
      {plan.outline.map((path) => (
        <Path
          data={path.d}
          key={path.d}
          stroke={selected ? "#2563eb" : "#334155"}
          strokeWidth={selected ? path.strokeWidth + 1 : path.strokeWidth}
        />
      ))}
      {plan.marks.map((mark, index) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: marks are derived, ordered geometry.
        <Mark key={index} mark={mark} />
      ))}
      <Text
        align="center"
        ellipsis
        fill="#0f172a"
        fontFamily={WIREFRAME_FONT_FAMILY}
        fontSize={14}
        height={bounds.height}
        text={plan.label}
        verticalAlign={plan.kind === "Card" ? "top" : "middle"}
        width={bounds.width}
        x={bounds.x}
        y={bounds.y + (plan.kind === "Card" ? 8 : 0)}
      />
    </Group>
  );
}

const paintCache = new WeakMap<
  WireframeBlock,
  {
    card: LiveCardResolution | undefined;
    plan: PaintPlan;
    text: LiveTextResolution | undefined;
  }
>();

function planFor(
  block: WireframeBlock,
  text: LiveTextResolution | undefined,
  card: LiveCardResolution | undefined,
) {
  const hit = paintCache.get(block);
  if (hit && hit.text === text && hit.card === card) {
    return hit.plan;
  }
  const plan = paintBlock(block, text, card);
  paintCache.set(block, { card, plan, text });
  return plan;
}

/**
 * Konva adapter: paints the plan derived from canonical geometry, culled to
 * the personal viewport. It owns no document state and `toJSON()` of this
 * stage is never persisted. The viewport is Stage scale and position, never a
 * CSS transform, so the Stage can not be clipped out of its pane.
 */
export default function WireframeStage({
  editor,
  height,
  liveCards,
  liveText,
  onEditText,
  onViewportGesture,
  viewport,
  width,
}: WireframeStageProps) {
  const state = editor.getState();
  const selected = new Set(state.selection);
  const view = useSyncExternalStore(
    viewport.subscribe,
    viewport.getState,
    viewport.getState,
  );
  const blocks = useMemo(
    () => resolvedBlocks(state.document),
    [state.document],
  );
  const scene = useMemo(
    () => createSceneIndex(blocks, deriveVisualLinks(state.document)),
    [blocks, state.document],
  );
  const rect = visibleRect(view, { height, width });
  const margin = CULL_MARGIN / view.zoom;
  const culling = {
    height: rect.height + margin * 2,
    width: rect.width + margin * 2,
    x: rect.x - margin,
    y: rect.y - margin,
  };
  const visibleIds = new Set(scene.visibleBlockIds(culling));
  const links = scene.visibleLinks(culling);

  function onDragEnd(event: Konva.KonvaEventObject<DragEvent>) {
    const stage = event.target.getStage();
    if (!stage || event.target !== stage) {
      return;
    }
    onViewportGesture?.({
      centerX: (width / 2 - stage.x()) / view.zoom,
      centerY: (height / 2 - stage.y()) / view.zoom,
      type: "pan",
    });
  }

  function onWheel(event: Konva.KonvaEventObject<WheelEvent>) {
    event.evt.preventDefault();
    onViewportGesture?.({
      deltaX: event.evt.deltaX,
      deltaY: event.evt.deltaY,
      type: "wheel",
      zoom: event.evt.ctrlKey || event.evt.metaKey,
    });
  }

  return (
    <Stage
      draggable
      height={height}
      onDragEnd={onDragEnd}
      onWheel={onWheel}
      scaleX={view.zoom}
      scaleY={view.zoom}
      width={width}
      x={width / 2 - view.centerX * view.zoom}
      y={height / 2 - view.centerY * view.zoom}
    >
      <Layer listening={false}>
        <Shape
          sceneFunc={(context, shape) => {
            // One path for every visible link: a single batched stroke.
            context.beginPath();
            for (const link of links) {
              const from = scene.centers.get(link.from);
              const to = scene.centers.get(link.to);
              if (from && to) {
                context.moveTo(from.x, from.y);
                context.lineTo(to.x, to.y);
              }
            }
            context.fillStrokeShape(shape);
          }}
          stroke="#94a3b8"
          strokeScaleEnabled={false}
          strokeWidth={1}
        />
      </Layer>
      <Layer>
        {blocks
          .filter((block) => visibleIds.has(block.id))
          .map((block) => (
            <PaintedBlock
              editor={editor}
              key={block.id}
              onEditText={onEditText}
              plan={planFor(block, liveText[block.id], liveCards?.[block.id])}
              selected={selected.has(block.id)}
            />
          ))}
      </Layer>
    </Stage>
  );
}
