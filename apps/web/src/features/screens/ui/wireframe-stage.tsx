// biome-ignore-all lint/performance/noJsxPropsBind: Konva handlers bind to the painted block.
import "@fontsource/shantell-sans/400.css";
import type { LiveTextResolution } from "@cantiara/api/wireframe-commands";
import { resolvedBlocks } from "@cantiara/api/wireframe-document";
import type Konva from "konva";
import {
  Circle,
  Group,
  Layer,
  Line,
  Path,
  Rect,
  Stage,
  Text,
} from "react-konva";
import type { WireframeEditor } from "../engine/editor";
import {
  type PaintMark,
  type PaintPlan,
  paintBlock,
  WIREFRAME_FONT_FAMILY,
} from "../engine/paint";

export interface WireframeStageProps {
  editor: WireframeEditor;
  height: number;
  liveText: Record<string, LiveTextResolution>;
  onEditText: (blockId: string) => void;
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

/**
 * Konva adapter: paints the plan derived from canonical geometry. It owns no
 * document state and `toJSON()` of this stage is never persisted.
 */
export default function WireframeStage({
  editor,
  height,
  liveText,
  onEditText,
  width,
}: WireframeStageProps) {
  const state = editor.getState();
  const selected = new Set(state.selection);
  return (
    <Stage height={height} width={width}>
      <Layer>
        {resolvedBlocks(state.document).map((block) => (
          <PaintedBlock
            editor={editor}
            key={block.id}
            onEditText={onEditText}
            plan={paintBlock(block, liveText[block.id])}
            selected={selected.has(block.id)}
          />
        ))}
      </Layer>
    </Stage>
  );
}
