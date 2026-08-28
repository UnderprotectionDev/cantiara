import type { KonvaEventObject } from "konva/lib/Node";
import { useCallback } from "react";
import { Arrow, Layer, Line, Rect, Stage } from "react-konva";

import type { DrawnMark } from "./file-marking-geometry";
import { denormalizePoint } from "./file-marking-geometry";

export default function FileMarkingCanvas({
	height,
	marks,
	onDrawEnd,
	onDrawMove,
	onDrawStart,
	width,
}: {
	height: number;
	marks: DrawnMark[];
	onDrawEnd: () => void;
	onDrawMove: (point: { x: number; y: number }) => void;
	onDrawStart: (point: { x: number; y: number }) => void;
	width: number;
}) {
	const pointer = useCallback(
		(event: KonvaEventObject<MouseEvent>) => {
			const pos = event.target.getStage()?.getPointerPosition();
			if (!pos) {
				return null;
			}
			return { x: pos.x / width, y: pos.y / height };
		},
		[height, width]
	);
	const start = useCallback(
		(event: KonvaEventObject<MouseEvent>) => {
			const point = pointer(event);
			if (point) {
				onDrawStart(point);
			}
		},
		[onDrawStart, pointer]
	);
	const move = useCallback(
		(event: KonvaEventObject<MouseEvent>) => {
			const point = pointer(event);
			if (point) {
				onDrawMove(point);
			}
		},
		[onDrawMove, pointer]
	);
	if (width <= 0 || height <= 0) {
		return null;
	}
	return (
		<Stage
			height={height}
			onMouseDown={start}
			onMouseMove={move}
			onMouseUp={onDrawEnd}
			width={width}
		>
			<Layer>
				{marks.map((mark) => (
					<MarkShape height={height} key={mark.id} mark={mark} width={width} />
				))}
			</Layer>
		</Stage>
	);
}

function MarkShape({
	height,
	mark,
	width,
}: {
	height: number;
	mark: DrawnMark;
	width: number;
}) {
	if (mark.tool === "pen" || mark.tool === "highlighter") {
		return <StrokeMark height={height} mark={mark} width={width} />;
	}
	if (mark.tool === "arrow") {
		return <ArrowMark height={height} mark={mark} width={width} />;
	}
	return <RectMark height={height} mark={mark} width={width} />;
}

function StrokeMark({
	height,
	mark,
	width,
}: {
	height: number;
	mark: DrawnMark;
	width: number;
}) {
	const points = Array.isArray(mark.geometry.points)
		? (mark.geometry.points as number[])
		: [];
	const scaled: number[] = [];
	for (let index = 0; index < points.length; index += 2) {
		const x = points[index];
		const y = points[index + 1];
		if (typeof x !== "number" || typeof y !== "number") {
			continue;
		}
		const pixel = denormalizePoint({ x, y }, width, height);
		scaled.push(pixel.x, pixel.y);
	}
	return (
		<Line
			listening={false}
			opacity={mark.tool === "highlighter" ? 0.4 : 1}
			points={scaled}
			stroke={mark.tool === "highlighter" ? "#facc15" : "#111827"}
			strokeWidth={mark.tool === "highlighter" ? 16 : 3}
			tension={0.4}
		/>
	);
}

function ArrowMark({
	height,
	mark,
	width,
}: {
	height: number;
	mark: DrawnMark;
	width: number;
}) {
	const start = denormalizePoint(
		{ x: Number(mark.geometry.x1 ?? 0), y: Number(mark.geometry.y1 ?? 0) },
		width,
		height
	);
	const end = denormalizePoint(
		{ x: Number(mark.geometry.x2 ?? 0), y: Number(mark.geometry.y2 ?? 0) },
		width,
		height
	);
	return (
		<Arrow
			fill="#111827"
			listening={false}
			points={[start.x, start.y, end.x, end.y]}
			stroke="#111827"
			strokeWidth={3}
		/>
	);
}

function RectMark({
	height,
	mark,
	width,
}: {
	height: number;
	mark: DrawnMark;
	width: number;
}) {
	const origin = denormalizePoint(
		{ x: Number(mark.geometry.x ?? 0), y: Number(mark.geometry.y ?? 0) },
		width,
		height
	);
	return (
		<Rect
			height={Number(mark.geometry.height ?? 0) * height}
			listening={false}
			stroke="#111827"
			strokeWidth={2}
			width={Number(mark.geometry.width ?? 0) * width}
			x={origin.x}
			y={origin.y}
		/>
	);
}
