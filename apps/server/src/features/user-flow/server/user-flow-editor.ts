import {
	FLOW_NODE_KINDS,
	FLOW_SEMANTIC_SET,
	type FlowDocument,
	type FlowNodeDocument,
	type FlowNodeKind,
	type NodeLayout,
	USER_FLOW_COPY,
	USER_FLOW_RECORD_KIND,
} from "./user-flow-model";

export const USER_FLOW_COUNTERPARTS = {
	colorAsType: false,
	moodboard: false,
	projectWall: false,
	shapeAsType: false,
	stateMachine: false,
	technicalSequence: false,
	xyflowPublicContract: false,
} as const;

export const TECHNICAL_SEQUENCE_KINDS = [
	"Lifeline",
	"Sync Message",
	"Async Message",
	"Event Message",
	"Return Message",
	"Control Group",
] as const;

export const STATE_MACHINE_KINDS = [
	"State",
	"Transition",
	"Initial State",
] as const;

export const FOREIGN_SURFACE_KINDS = [
	"Moodboard",
	"Project Wall",
	"Color Swatch",
] as const;

export const FLOW_GRID_SIZE = 16;

export const EDITOR_COMMONS = [
	"multi-select",
	"pan",
	"zoom",
	"Fit View",
	"align",
	"z-order",
	"grid",
	"copy/paste",
	"keyboard",
	"undo",
] as const;

export type EditorAlignAxis =
	| "left"
	| "right"
	| "center"
	| "top"
	| "bottom"
	| "middle";

export type EditorZDirection = "front" | "back";

export interface EditorCamera {
	x: number;
	y: number;
	zoom: number;
}

export function isFlowNodeKind(value: string): value is FlowNodeKind {
	return (FLOW_NODE_KINDS as readonly string[]).includes(value);
}

export function userFlowCatalog() {
	return {
		copy: USER_FLOW_COPY,
		counterparts: USER_FLOW_COUNTERPARTS,
		editorCommons: EDITOR_COMMONS,
		recordKind: USER_FLOW_RECORD_KIND,
		semanticSet: FLOW_SEMANTIC_SET,
	};
}

export function defaultLayout(index = 0): NodeLayout {
	return {
		x: index * 240,
		y: 0,
		z: index,
	};
}

export function alignNodes(
	document: FlowDocument,
	nodeIds: readonly string[],
	axis: EditorAlignAxis
): FlowDocument {
	const selected = document.nodes.filter((node) => nodeIds.includes(node.id));
	if (selected.length === 0) {
		return document;
	}
	const xs = selected.map((node) => node.layout.x);
	const ys = selected.map((node) => node.layout.y);
	const left = Math.min(...xs);
	const right = Math.max(...xs);
	const top = Math.min(...ys);
	const bottom = Math.max(...ys);
	const centerX = (left + right) / 2;
	const middleY = (top + bottom) / 2;
	const nextX = xForAlign(axis, { centerX, left, right });
	const nextY = yForAlign(axis, { bottom, middleY, top });
	return {
		...document,
		nodes: document.nodes.map((node) => {
			if (!nodeIds.includes(node.id)) {
				return node;
			}
			return {
				...node,
				layout: {
					...node.layout,
					x: nextX ?? node.layout.x,
					y: nextY ?? node.layout.y,
				},
			};
		}),
	};
}

function xForAlign(
	axis: EditorAlignAxis,
	bounds: { centerX: number; left: number; right: number }
): number | null {
	if (axis === "left") {
		return bounds.left;
	}
	if (axis === "right") {
		return bounds.right;
	}
	if (axis === "center") {
		return bounds.centerX;
	}
	return null;
}

function yForAlign(
	axis: EditorAlignAxis,
	bounds: { bottom: number; middleY: number; top: number }
): number | null {
	if (axis === "top") {
		return bounds.top;
	}
	if (axis === "bottom") {
		return bounds.bottom;
	}
	if (axis === "middle") {
		return bounds.middleY;
	}
	return null;
}

export function orderZ(
	document: FlowDocument,
	nodeIds: readonly string[],
	direction: EditorZDirection
): FlowDocument {
	const zs = document.nodes.map((node) => node.layout.z);
	const maxZ = zs.length === 0 ? 0 : Math.max(...zs);
	const minZ = zs.length === 0 ? 0 : Math.min(...zs);
	const selected = document.nodes.filter((node) => nodeIds.includes(node.id));
	if (selected.length === 0) {
		return document;
	}
	const nextZ = new Map<string, number>();
	if (direction === "front") {
		let z = maxZ;
		for (const node of selected) {
			z += 1;
			nextZ.set(node.id, z);
		}
	} else {
		let z = minZ - selected.length;
		for (const node of selected) {
			nextZ.set(node.id, z);
			z += 1;
		}
	}
	return {
		...document,
		nodes: document.nodes.map((node) => {
			const z = nextZ.get(node.id);
			if (z === undefined) {
				return node;
			}
			return {
				...node,
				layout: { ...node.layout, z },
			};
		}),
	};
}

export function snapToGrid(
	document: FlowDocument,
	nodeIds: readonly string[],
	size = FLOW_GRID_SIZE
): FlowDocument {
	const selected = new Set(nodeIds);
	return {
		...document,
		nodes: document.nodes.map((node) => {
			if (!selected.has(node.id)) {
				return node;
			}
			return {
				...node,
				layout: {
					...node.layout,
					x: Math.round(node.layout.x / size) * size,
					y: Math.round(node.layout.y / size) * size,
				},
			};
		}),
	};
}

export function moveNodes(
	document: FlowDocument,
	nodeIds: readonly string[],
	deltaX: number,
	deltaY: number
): FlowDocument {
	const selected = new Set(nodeIds);
	return {
		...document,
		nodes: document.nodes.map((node) => {
			if (!selected.has(node.id)) {
				return node;
			}
			return {
				...node,
				layout: {
					...node.layout,
					x: node.layout.x + deltaX,
					y: node.layout.y + deltaY,
				},
			};
		}),
	};
}

export function duplicateNodes(
	document: FlowDocument,
	nodeIds: readonly string[],
	newId: () => string = () => crypto.randomUUID()
): FlowDocument {
	const copies: FlowNodeDocument[] = [];
	for (const node of document.nodes) {
		if (!nodeIds.includes(node.id)) {
			continue;
		}
		copies.push({
			...node,
			id: newId(),
			layout: {
				...node.layout,
				x: node.layout.x + FLOW_GRID_SIZE * 2,
				y: node.layout.y + FLOW_GRID_SIZE * 2,
				z: node.layout.z + 1,
			},
		});
	}
	return { ...document, nodes: [...document.nodes, ...copies] };
}

export function fitViewFrame(
	document: FlowDocument,
	nodeIds?: readonly string[]
): EditorCamera {
	const targets =
		nodeIds && nodeIds.length > 0
			? document.nodes.filter((node) => nodeIds.includes(node.id))
			: document.nodes;
	if (targets.length === 0) {
		return { x: 0, y: 0, zoom: 1 };
	}
	const xs = targets.map((node) => node.layout.x);
	const ys = targets.map((node) => node.layout.y);
	return {
		x: (Math.min(...xs) + Math.max(...xs)) / 2,
		y: (Math.min(...ys) + Math.max(...ys)) / 2,
		zoom: 1,
	};
}

export function panCamera(
	camera: EditorCamera,
	deltaX: number,
	deltaY: number
): EditorCamera {
	return {
		...camera,
		x: camera.x + deltaX,
		y: camera.y + deltaY,
	};
}

export function zoomCamera(camera: EditorCamera, factor: number): EditorCamera {
	return {
		...camera,
		zoom: Math.min(4, Math.max(0.25, camera.zoom * factor)),
	};
}
