import { z } from "zod";

export const WIREFRAME_DOCUMENT_SCHEMA = "WireframeDocument" as const;
export const WIREFRAME_CANVAS_TYPEFACE = "Shantell Sans" as const;
export const WIREFRAME_BROKEN_LIVE_TEXT = "Broken" as const;
export const WIREFRAME_SNAP_THRESHOLD = 8;

export const WIREFRAME_SEMANTIC_KIND = {
	button: "Button",
	card: "Card",
	chart: "Chart",
	input: "Input",
	navigation: "Navigation",
	table: "Table",
	text: "Text",
} as const;

export type WireframeSemanticKind =
	(typeof WIREFRAME_SEMANTIC_KIND)[keyof typeof WIREFRAME_SEMANTIC_KIND];

export const WIREFRAME_DURATION = {
	long: "long",
	medium: "medium",
	short: "short",
} as const;

export const WIREFRAME_ANIMATION_KIND = {
	hoverPress: "hoverPress",
	screenTransition: "screenTransition",
	sequentialSteps: "sequentialSteps",
	showHide: "showHide",
	timedTwoState: "timedTwoState",
} as const;

const semanticKindSchema = z.enum([
	WIREFRAME_SEMANTIC_KIND.button,
	WIREFRAME_SEMANTIC_KIND.card,
	WIREFRAME_SEMANTIC_KIND.chart,
	WIREFRAME_SEMANTIC_KIND.input,
	WIREFRAME_SEMANTIC_KIND.navigation,
	WIREFRAME_SEMANTIC_KIND.table,
	WIREFRAME_SEMANTIC_KIND.text,
]);

export const wireframeGeometrySchema = z.object({
	height: z.number().positive(),
	width: z.number().positive(),
	x: z.number(),
	y: z.number(),
});

export type WireframeGeometry = z.infer<typeof wireframeGeometrySchema>;

export const placeholderTextSchema = z.object({
	mode: z.literal("placeholder"),
	value: z.string(),
});

export const liveMarkdownSectionSchema = z.object({
	documentId: z.string().min(1),
	historicalText: z.string().optional(),
	mode: z.literal("liveMarkdownSection"),
	sectionId: z.string().min(1),
});

export const wireframeTextSchema = z.discriminatedUnion("mode", [
	placeholderTextSchema,
	liveMarkdownSectionSchema,
]);

export type WireframeText = z.infer<typeof wireframeTextSchema>;

export const wireframeLiveRecordSchema = z.object({
	id: z.string().min(1),
	kind: z.enum(["Work", "Decision", "Risk"]),
});

export type WireframeLiveRecord = z.infer<typeof wireframeLiveRecordSchema>;

export const wireframeGroupSchema = z.object({
	id: z.string().min(1),
	title: z.string().min(1),
});

export type WireframeGroup = z.infer<typeof wireframeGroupSchema>;

export const wireframeNodeSchema = z
	.object({
		geometry: wireframeGeometrySchema,
		groupId: z.string().min(1).optional(),
		id: z.string().min(1),
		kind: semanticKindSchema,
		label: z.string().optional(),
		linkedBlockId: z.string().min(1).optional(),
		liveRecord: wireframeLiveRecordSchema.optional(),
		seed: z.number().int(),
		targetScreenId: z.string().min(1).optional(),
		text: wireframeTextSchema.optional(),
	})
	.superRefine((node, context) => {
		if (node.kind === WIREFRAME_SEMANTIC_KIND.text && node.text === undefined) {
			context.addIssue({
				code: z.ZodIssueCode.custom,
				message: "text-required",
				path: ["text"],
			});
		}
	});

export type WireframeNode = z.infer<typeof wireframeNodeSchema>;

export const wireframeAnimationSchema = z.object({
	duration: z.enum([
		WIREFRAME_DURATION.long,
		WIREFRAME_DURATION.medium,
		WIREFRAME_DURATION.short,
	]),
	id: z.string().min(1),
	kind: z.enum([
		WIREFRAME_ANIMATION_KIND.hoverPress,
		WIREFRAME_ANIMATION_KIND.screenTransition,
		WIREFRAME_ANIMATION_KIND.sequentialSteps,
		WIREFRAME_ANIMATION_KIND.showHide,
		WIREFRAME_ANIMATION_KIND.timedTwoState,
	]),
	nodeId: z.string().min(1).optional(),
	steps: z.array(z.string().min(1)).optional(),
	targetScreenId: z.string().min(1).optional(),
});

export type WireframeAnimation = z.infer<typeof wireframeAnimationSchema>;

export const wireframeLinkedBlockDefinitionSchema = z.object({
	geometry: z.object({
		height: z.number().positive(),
		width: z.number().positive(),
	}),
	kind: semanticKindSchema,
	label: z.string().optional(),
	text: wireframeTextSchema.optional(),
});

export type WireframeLinkedBlockDefinition = z.infer<
	typeof wireframeLinkedBlockDefinitionSchema
>;

export const wireframeDocumentSchema = z.object({
	animations: z.array(wireframeAnimationSchema).default([]),
	canvasTypeface: z
		.literal(WIREFRAME_CANVAS_TYPEFACE)
		.default(WIREFRAME_CANVAS_TYPEFACE),
	groups: z.array(wireframeGroupSchema).default([]),
	nodes: z.array(wireframeNodeSchema),
	schema: z.literal(WIREFRAME_DOCUMENT_SCHEMA),
	schemaVersion: z.literal(1),
});

export type WireframeDocument = z.infer<typeof wireframeDocumentSchema>;

export const EMPTY_WIREFRAME_DOCUMENT: WireframeDocument = {
	animations: [],
	canvasTypeface: WIREFRAME_CANVAS_TYPEFACE,
	groups: [],
	nodes: [],
	schema: WIREFRAME_DOCUMENT_SCHEMA,
	schemaVersion: 1,
};

export function isKonvaStageJson(value: unknown): boolean {
	return (
		typeof value === "object" &&
		value !== null &&
		"className" in value &&
		(value as { className: unknown }).className === "Stage"
	);
}

export function isForbiddenDocumentModel(value: unknown): boolean {
	if (typeof value !== "object" || value === null) {
		return false;
	}
	const record = value as Record<string, unknown>;
	if (record.type === "doc") {
		return true;
	}
	if (record.type === "excalidraw" || Array.isArray(record.elements)) {
		return true;
	}
	if (record.schema === "tldraw" || record.typeName === "store") {
		return true;
	}
	return "tiptap" in record || "prosemirror" in record;
}

export function parseWireframeDocument(
	value: unknown
):
	| { document: WireframeDocument; status: "ok" }
	| { reason: string; status: "rejected" } {
	if (isKonvaStageJson(value)) {
		return { reason: "konva-json-not-durable", status: "rejected" };
	}
	if (isForbiddenDocumentModel(value)) {
		return { reason: "forbidden-document-model", status: "rejected" };
	}
	const parsed = wireframeDocumentSchema.safeParse(value);
	if (!parsed.success) {
		return { reason: "invalid-wireframe-document", status: "rejected" };
	}
	return { document: parsed.data, status: "ok" };
}

export function containsPoint(
	geometry: WireframeGeometry,
	point: { x: number; y: number }
): boolean {
	return (
		point.x >= geometry.x &&
		point.x <= geometry.x + geometry.width &&
		point.y >= geometry.y &&
		point.y <= geometry.y + geometry.height
	);
}

export function hitTestWireframe(
	document: WireframeDocument,
	point: { x: number; y: number }
): WireframeNode | null {
	for (let index = document.nodes.length - 1; index >= 0; index -= 1) {
		const node = document.nodes[index];
		if (node && containsPoint(node.geometry, point)) {
			return node;
		}
	}
	return null;
}

export function snapWireframePoint(
	document: WireframeDocument,
	point: { x: number; y: number },
	threshold = WIREFRAME_SNAP_THRESHOLD
): { snapped: boolean; x: number; y: number } {
	let { x, y } = point;
	let snappedX = false;
	let snappedY = false;
	for (const node of document.nodes) {
		const edgesX = [
			node.geometry.x,
			node.geometry.x + node.geometry.width / 2,
			node.geometry.x + node.geometry.width,
		];
		const edgesY = [
			node.geometry.y,
			node.geometry.y + node.geometry.height / 2,
			node.geometry.y + node.geometry.height,
		];
		for (const edge of edgesX) {
			if (Math.abs(point.x - edge) <= threshold) {
				x = edge;
				snappedX = true;
			}
		}
		for (const edge of edgesY) {
			if (Math.abs(point.y - edge) <= threshold) {
				y = edge;
				snappedY = true;
			}
		}
	}
	return { snapped: snappedX || snappedY, x, y };
}

export function drawingStroke(node: WireframeNode): {
	geometry: WireframeGeometry;
	seed: number;
	source: "canonical";
} {
	return {
		geometry: node.geometry,
		seed: node.seed,
		source: "canonical",
	};
}

export function presentWireframeText(
	text: WireframeText,
	liveSection: { text: string } | null | undefined,
	mode: "historical" | "live"
): {
	liveSourcePath: { documentId: string; sectionId: string } | null;
	status: "broken" | "ok";
	value: string;
} {
	if (text.mode === "placeholder") {
		return { liveSourcePath: null, status: "ok", value: text.value };
	}
	const liveSourcePath = {
		documentId: text.documentId,
		sectionId: text.sectionId,
	};
	if (mode === "historical") {
		const historical = text.historicalText ?? "";
		if (historical.length > 0) {
			return { liveSourcePath, status: "ok", value: historical };
		}
		return {
			liveSourcePath,
			status: "broken",
			value: WIREFRAME_BROKEN_LIVE_TEXT,
		};
	}
	if (liveSection) {
		return { liveSourcePath, status: "ok", value: liveSection.text };
	}
	return {
		liveSourcePath,
		status: "broken",
		value: WIREFRAME_BROKEN_LIVE_TEXT,
	};
}

export function snapshotLiveText(
	text: WireframeText,
	liveSection: { text: string } | null
): WireframeText {
	if (text.mode !== "liveMarkdownSection") {
		return text;
	}
	const presented = presentWireframeText(text, liveSection, "live");
	return { ...text, historicalText: presented.value };
}

export function detachNodeFromLinkedBlock(
	node: WireframeNode,
	definition: WireframeLinkedBlockDefinition
): WireframeNode {
	const { linkedBlockId: _removed, ...rest } = node;
	return {
		...rest,
		geometry: {
			...node.geometry,
			height: definition.geometry.height,
			width: definition.geometry.width,
		},
		kind: definition.kind,
		label: definition.label,
		text: definition.text,
	};
}

export function overlayLinkedInstance(
	node: WireframeNode,
	definition: WireframeLinkedBlockDefinition | null
): WireframeNode {
	if (!(node.linkedBlockId && definition)) {
		return node;
	}
	return {
		...node,
		geometry: {
			...node.geometry,
			height: definition.geometry.height,
			width: definition.geometry.width,
		},
		kind: definition.kind,
		label: definition.label,
		text: definition.text,
	};
}

export function reorderWireframeNodes(
	document: WireframeDocument,
	nodeIds: readonly string[]
): WireframeDocument {
	const byId = new Map(document.nodes.map((node) => [node.id, node]));
	const next: WireframeNode[] = [];
	const seen = new Set<string>();
	for (const id of nodeIds) {
		const node = byId.get(id);
		if (node && !seen.has(id)) {
			next.push(node);
			seen.add(id);
		}
	}
	for (const node of document.nodes) {
		if (!seen.has(node.id)) {
			next.push(node);
		}
	}
	return { ...document, nodes: next };
}

export function groupWireframeNodes(
	document: WireframeDocument,
	input: { nodeIds: readonly string[]; title: string }
): WireframeDocument {
	const groupId = crypto.randomUUID();
	const wanted = new Set(input.nodeIds);
	return {
		...document,
		groups: [...document.groups, { id: groupId, title: input.title }],
		nodes: document.nodes.map((node) =>
			wanted.has(node.id) ? { ...node, groupId } : node
		),
	};
}

export function bindWireframeNode(
	document: WireframeDocument,
	input: { linkedBlockId: string; nodeId: string }
): WireframeDocument {
	return {
		...document,
		nodes: document.nodes.map((node) =>
			node.id === input.nodeId
				? { ...node, linkedBlockId: input.linkedBlockId }
				: node
		),
	};
}

export function moveWireframeNodes(
	document: WireframeDocument,
	input: { deltaX: number; deltaY: number; nodeIds: readonly string[] }
): WireframeDocument {
	const wanted = new Set(input.nodeIds);
	return {
		...document,
		nodes: document.nodes.map((node) =>
			wanted.has(node.id)
				? {
						...node,
						geometry: {
							...node.geometry,
							x: node.geometry.x + input.deltaX,
							y: node.geometry.y + input.deltaY,
						},
					}
				: node
		),
	};
}

export type WireframeAlignAxis =
	| "bottom"
	| "center"
	| "left"
	| "middle"
	| "right"
	| "top";

export function alignWireframeNodes(
	document: WireframeDocument,
	input: { axis: WireframeAlignAxis; nodeIds: readonly string[] }
): WireframeDocument {
	const selected = document.nodes.filter((node) =>
		input.nodeIds.includes(node.id)
	);
	if (selected.length === 0) {
		return document;
	}
	const xs = selected.map((node) => node.geometry.x);
	const ys = selected.map((node) => node.geometry.y);
	const left = Math.min(...xs);
	const right = Math.max(...xs);
	const top = Math.min(...ys);
	const bottom = Math.max(...ys);
	const centerX = (left + right) / 2;
	const middleY = (top + bottom) / 2;
	return {
		...document,
		nodes: document.nodes.map((node) => {
			if (!input.nodeIds.includes(node.id)) {
				return node;
			}
			let { x, y } = node.geometry;
			if (input.axis === "left") {
				x = left;
			} else if (input.axis === "right") {
				x = right;
			} else if (input.axis === "center") {
				x = centerX;
			} else if (input.axis === "top") {
				y = top;
			} else if (input.axis === "bottom") {
				y = bottom;
			} else {
				y = middleY;
			}
			return { ...node, geometry: { ...node.geometry, x, y } };
		}),
	};
}

export function instanceFromLinkedBlock(input: {
	definition: WireframeLinkedBlockDefinition;
	id: string;
	linkedBlockId: string;
	seed: number;
	x: number;
	y: number;
}): WireframeNode {
	return {
		geometry: {
			height: input.definition.geometry.height,
			width: input.definition.geometry.width,
			x: input.x,
			y: input.y,
		},
		id: input.id,
		kind: input.definition.kind,
		label: input.definition.label,
		linkedBlockId: input.linkedBlockId,
		seed: input.seed,
		text: input.definition.text,
	};
}
