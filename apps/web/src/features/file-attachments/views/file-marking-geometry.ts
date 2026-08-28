export const MARKING_TOOLS = [
	"pen",
	"highlighter",
	"arrow",
	"rectangle",
] as const;

export type MarkingTool = (typeof MARKING_TOOLS)[number];

export type MarkGeometry = Record<string, unknown>;

export interface DrawnMark {
	geometry: MarkGeometry;
	id: string;
	page?: number;
	tool: MarkingTool;
}

export function isMarkingTool(value: string): value is MarkingTool {
	return (MARKING_TOOLS as readonly string[]).includes(value);
}

export function undoDrawnMarks(marks: DrawnMark[]): DrawnMark[] {
	return marks.slice(0, -1);
}

export function normalizePoint(
	x: number,
	y: number,
	width: number,
	height: number
): { x: number; y: number } {
	if (width <= 0 || height <= 0) {
		return { x: 0, y: 0 };
	}
	return {
		x: Math.min(1, Math.max(0, x / width)),
		y: Math.min(1, Math.max(0, y / height)),
	};
}

export function denormalizePoint(
	point: { x: number; y: number },
	width: number,
	height: number
): { x: number; y: number } {
	return { x: point.x * width, y: point.y * height };
}

export function regionFromDrag(
	start: { x: number; y: number },
	end: { x: number; y: number }
): { height: number; width: number; x: number; y: number } {
	const x = Math.min(start.x, end.x);
	const y = Math.min(start.y, end.y);
	return {
		height: Math.max(0.01, Math.abs(end.y - start.y)),
		width: Math.max(0.01, Math.abs(end.x - start.x)),
		x,
		y,
	};
}
