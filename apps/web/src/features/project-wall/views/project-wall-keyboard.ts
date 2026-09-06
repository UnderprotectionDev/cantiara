export const KEYBOARD_MOVE = 16;
export const KEYBOARD_PAN = 40;

export type CanvasKeyIntent =
	| { dx: number; dy: number; type: "move" }
	| { dx: number; dy: number; type: "pan" }
	| { factor: number; type: "zoom" };

export function canvasKeyIntent(event: {
	key: string;
	shiftKey: boolean;
}): CanvasKeyIntent | null {
	const delta = arrowDelta(event.key);
	if (delta) {
		if (event.shiftKey) {
			return { dx: delta.dx, dy: delta.dy, type: "move" };
		}
		return { dx: delta.dx, dy: delta.dy, type: "pan" };
	}
	if (event.key === "=" || event.key === "+") {
		return { factor: 1.1, type: "zoom" };
	}
	if (event.key === "-" || event.key === "_") {
		return { factor: 1 / 1.1, type: "zoom" };
	}
	return null;
}

function arrowDelta(key: string): { dx: number; dy: number } | null {
	if (key === "ArrowLeft") {
		return { dx: -1, dy: 0 };
	}
	if (key === "ArrowRight") {
		return { dx: 1, dy: 0 };
	}
	if (key === "ArrowUp") {
		return { dx: 0, dy: -1 };
	}
	if (key === "ArrowDown") {
		return { dx: 0, dy: 1 };
	}
	return null;
}
