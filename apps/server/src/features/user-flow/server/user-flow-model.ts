import { z } from "zod";

import { RELATIONS_COPY } from "../../relations/server/relations-catalog";

export const USER_FLOW_COPY = {
	action: "Action",
	align: "Align",
	archived: "Archived",
	bindScreen: "Bind Screen",
	condition: "Condition",
	createScreen: "Create Screen",
	createUserFlow: "Create User Flow",
	decision: "Decision",
	description: "Description",
	fitView: "Fit View",
	inTrash: RELATIONS_COPY.inTrash,
	noAccess: RELATIONS_COPY.noAccess,
	noUserFlows: "No User Flows yet.",
	openSourceRecord: "Open Source Record",
	permanentlyDeleted: RELATIONS_COPY.permanentlyDeleted,
	placeNode: "Place node",
	redactedForSecurity: RELATIONS_COPY.redactedForSecurity,
	screen: "Screen",
	section: "Section",
	stateOutcome: "State/Outcome",
	title: "Title",
	transition: "Transition",
	undo: "Undo",
	userFlow: "User Flow",
	wireframePreview: "Wireframe preview",
} as const;

export const USER_FLOW_RECORD_KIND = "User Flow" as const;
export const SCREEN_RECORD_KIND = "Screen" as const;

export const SCREEN_NODE_KIND = "Screen" as const;

export const FLOW_NODE_KINDS = [
	USER_FLOW_COPY.screen,
	USER_FLOW_COPY.action,
	USER_FLOW_COPY.decision,
	USER_FLOW_COPY.stateOutcome,
	USER_FLOW_COPY.section,
] as const;

export const FLOW_SEMANTIC_SET = FLOW_NODE_KINDS;

export type FlowNodeKind = (typeof FLOW_NODE_KINDS)[number];

export const USER_FLOW_REJECTION = {
	closedSemanticSet: "closed-semantic-set",
	invalidCommand: "invalid-command",
	nothingToUndo: "nothing-to-undo",
	targetNotFound: "target-not-found",
} as const;

export type UserFlowRejectionReason =
	(typeof USER_FLOW_REJECTION)[keyof typeof USER_FLOW_REJECTION];

export const nodePathTextSchema = z.object({
	condition: z.string(),
	decision: z.string(),
	description: z.string(),
	transition: z.string(),
});

export type NodePathText = z.infer<typeof nodePathTextSchema>;

export const nodeLayoutSchema = z.object({
	x: z.number(),
	y: z.number(),
	z: z.number(),
});

export type NodeLayout = z.infer<typeof nodeLayoutSchema>;

export const nodeVisualStyleSchema = z.object({
	emphasis: z.enum(["default", "muted"]),
});

export type NodeVisualStyle = z.infer<typeof nodeVisualStyleSchema>;

const layoutWithDefault = nodeLayoutSchema
	.optional()
	.transform((layout): NodeLayout => layout ?? { x: 0, y: 0, z: 0 });

const visualStyleWithDefault = nodeVisualStyleSchema
	.optional()
	.transform((style): NodeVisualStyle => style ?? { emphasis: "default" });

export const screenFlowNodeDocumentSchema = z.object({
	chosenWireframeVersionId: z.string().min(1).nullable(),
	id: z.string().min(1),
	kind: z.literal(SCREEN_NODE_KIND),
	layout: layoutWithDefault,
	pathText: nodePathTextSchema,
	screenId: z.string().min(1),
	visualStyle: visualStyleWithDefault,
});

export const pathFlowNodeDocumentSchema = z.object({
	id: z.string().min(1),
	kind: z.enum([
		USER_FLOW_COPY.action,
		USER_FLOW_COPY.decision,
		USER_FLOW_COPY.stateOutcome,
		USER_FLOW_COPY.section,
	]),
	label: z.string(),
	layout: layoutWithDefault,
	pathText: nodePathTextSchema
		.optional()
		.transform((text) => text ?? emptyPathText()),
	visualStyle: visualStyleWithDefault,
});

export const flowNodeDocumentSchema = z.discriminatedUnion("kind", [
	screenFlowNodeDocumentSchema,
	pathFlowNodeDocumentSchema,
]);

export type FlowNodeDocument = z.infer<typeof flowNodeDocumentSchema>;

export const flowDocumentSchema = z.object({
	nodes: z.array(flowNodeDocumentSchema),
});

export type FlowDocument = z.infer<typeof flowDocumentSchema>;

export const emptyFlowDocument = (): FlowDocument => ({ nodes: [] });

export const createUserFlowPayloadSchema = z.object({
	projectId: z.string().min(1),
	title: z.string().min(1),
});

export const createUserFlowCommandSchema = z.object({
	actorId: z.string().min(1),
	idempotencyKey: z.string().min(1),
	origin: z.literal("human"),
	payload: createUserFlowPayloadSchema,
});

export type CreateUserFlowCommand = z.infer<typeof createUserFlowCommandSchema>;

export const placeScreenNodePayloadSchema = z.object({
	chosenWireframeVersionId: z.string().min(1).nullable().optional(),
	pathText: nodePathTextSchema.optional(),
	screenId: z.string().min(1),
	userFlowId: z.string().min(1),
});

export const placeFlowNodePayloadSchema = z.object({
	chosenWireframeVersionId: z.string().min(1).nullable().optional(),
	kind: z.string().min(1),
	label: z.string().optional(),
	layout: nodeLayoutSchema.optional(),
	pathText: nodePathTextSchema.optional(),
	screenId: z.string().min(1).optional(),
	userFlowId: z.string().min(1),
	visualStyle: nodeVisualStyleSchema.optional(),
});

export const placeFlowNodeCommandSchema = z.object({
	actorId: z.string().min(1),
	baseRevision: z.number().int().nonnegative(),
	idempotencyKey: z.string().min(1),
	origin: z.literal("human"),
	payload: placeFlowNodePayloadSchema,
});

export type PlaceFlowNodeCommand = z.infer<typeof placeFlowNodeCommandSchema>;

export const applyEditorOpPayloadSchema = z.object({
	axis: z
		.enum(["left", "right", "center", "top", "bottom", "middle"])
		.optional(),
	deltaX: z.number().optional(),
	deltaY: z.number().optional(),
	direction: z.enum(["front", "back"]).optional(),
	nodeIds: z.array(z.string().min(1)).optional(),
	op: z.enum(["align", "z-order", "grid", "move", "duplicate", "undo"]),
	userFlowId: z.string().min(1),
});

export const applyEditorOpCommandSchema = z.object({
	actorId: z.string().min(1),
	baseRevision: z.number().int().nonnegative(),
	idempotencyKey: z.string().min(1),
	origin: z.literal("human"),
	payload: applyEditorOpPayloadSchema,
});

export type ApplyEditorOpCommand = z.infer<typeof applyEditorOpCommandSchema>;

export const placeScreenNodeCommandSchema = z.object({
	actorId: z.string().min(1),
	baseRevision: z.number().int().nonnegative(),
	idempotencyKey: z.string().min(1),
	origin: z.literal("human"),
	payload: placeScreenNodePayloadSchema,
});

export type PlaceScreenNodeCommand = z.infer<
	typeof placeScreenNodeCommandSchema
>;

export const updateNodePathTextPayloadSchema = z.object({
	nodeId: z.string().min(1),
	pathText: nodePathTextSchema,
	userFlowId: z.string().min(1),
});

export const updateNodePathTextCommandSchema = z.object({
	actorId: z.string().min(1),
	baseRevision: z.number().int().nonnegative(),
	idempotencyKey: z.string().min(1),
	origin: z.literal("human"),
	payload: updateNodePathTextPayloadSchema,
});

export type UpdateNodePathTextCommand = z.infer<
	typeof updateNodePathTextCommandSchema
>;

export const createScreenPayloadSchema = z.object({
	body: z.string().optional(),
	currentWireframeVersionId: z.string().min(1).nullable().optional(),
	projectId: z.string().min(1),
	title: z.string().min(1),
	wireframeVersions: z
		.array(
			z.object({
				id: z.string().min(1),
				preview: z.string(),
			})
		)
		.optional(),
});

export const createScreenCommandSchema = z.object({
	actorId: z.string().min(1),
	idempotencyKey: z.string().min(1),
	origin: z.literal("human"),
	payload: createScreenPayloadSchema,
});

export type CreateScreenCommand = z.infer<typeof createScreenCommandSchema>;

export const screenLifecyclePayloadSchema = z.object({
	screenId: z.string().min(1),
});

export const screenLifecycleCommandSchema = z.object({
	actorId: z.string().min(1),
	idempotencyKey: z.string().min(1),
	origin: z.literal("human"),
	payload: screenLifecyclePayloadSchema,
});

export type ScreenLifecycleCommand = z.infer<
	typeof screenLifecycleCommandSchema
>;

export type UserFlowWriteOutcome =
	| { flow: UserFlowView; status: "committed" }
	| { flow: UserFlowView; status: "replayed" }
	| { conflict: "Conflict"; status: "conflict" }
	| { reason: UserFlowRejectionReason | string; status: "rejected" };

export type ScreenWriteOutcome =
	| { screen: ScreenView; status: "committed" }
	| { screen: ScreenView; status: "replayed" }
	| { conflict: "Conflict"; status: "conflict" }
	| { reason: string; status: "rejected" };

export interface ScreenView {
	body: string;
	id: string;
	projectId: string;
	revision: number;
	title: string;
}

export type ScreenTargetResolution = "ok" | "archived" | "broken";

export interface PresentedFlowNode {
	boundAt: string | null;
	chosenWireframeVersionId: string | null;
	id: string;
	kind: FlowNodeKind;
	label: string;
	layout: NodeLayout;
	openHref: string | null;
	openSourceRecord: typeof USER_FLOW_COPY.openSourceRecord | null;
	pathText: NodePathText;
	preview: string | null;
	reason: string | null;
	resolution: ScreenTargetResolution;
	screenId: string | null;
	screenTitle: string | null;
	usageKind: "flow-node-screen-reference" | null;
	visualStyle: NodeVisualStyle;
}

export type PresentedScreenNode = PresentedFlowNode;

export interface UserFlowView {
	copy: {
		action: typeof USER_FLOW_COPY.action;
		align: typeof USER_FLOW_COPY.align;
		archived: typeof USER_FLOW_COPY.archived;
		decision: typeof USER_FLOW_COPY.decision;
		fitView: typeof USER_FLOW_COPY.fitView;
		openSourceRecord: typeof USER_FLOW_COPY.openSourceRecord;
		screen: typeof USER_FLOW_COPY.screen;
		section: typeof USER_FLOW_COPY.section;
		stateOutcome: typeof USER_FLOW_COPY.stateOutcome;
		undo: typeof USER_FLOW_COPY.undo;
		userFlow: typeof USER_FLOW_COPY.userFlow;
	};
	id: string;
	nodes: PresentedFlowNode[];
	originRelations: readonly { id: string; type: string }[];
	projectId: string;
	recordKind: typeof USER_FLOW_RECORD_KIND;
	revision: number;
	title: string;
	usageLinks: readonly {
		embedId: string;
		kind: string;
		sourceRecordId: string;
	}[];
}

export function emptyPathText(): NodePathText {
	return {
		condition: "",
		decision: "",
		description: "",
		transition: "",
	};
}

export function parseFlowDocument(raw: string): FlowDocument {
	try {
		const parsed: unknown = JSON.parse(raw);
		const nodes = Array.isArray((parsed as { nodes?: unknown }).nodes)
			? (parsed as { nodes: unknown[] }).nodes
			: [];
		const accepted: FlowNodeDocument[] = [];
		for (const node of nodes) {
			const result = flowNodeDocumentSchema.safeParse(node);
			if (result.success) {
				accepted.push(result.data);
			}
		}
		return { nodes: accepted };
	} catch {
		return emptyFlowDocument();
	}
}

export function serializeFlowDocument(document: FlowDocument): string {
	return JSON.stringify({
		nodes: document.nodes.map((node) => {
			if (node.kind === SCREEN_NODE_KIND) {
				return {
					chosenWireframeVersionId: node.chosenWireframeVersionId,
					id: node.id,
					kind: node.kind,
					layout: node.layout,
					pathText: node.pathText,
					screenId: node.screenId,
					visualStyle: node.visualStyle,
				};
			}
			return {
				id: node.id,
				kind: node.kind,
				label: node.label,
				layout: node.layout,
				pathText: node.pathText,
				visualStyle: node.visualStyle,
			};
		}),
	});
}

export function isScreenFlowNode(
	node: FlowNodeDocument
): node is Extract<FlowNodeDocument, { kind: typeof SCREEN_NODE_KIND }> {
	return node.kind === SCREEN_NODE_KIND;
}

export function usageEmbedIdForNode(nodeId: string): string {
	return `flow-node:${nodeId}`;
}

export function screenOpenHref(projectId: string, screenId: string): string {
	return `/projects/${projectId}?screen=${screenId}`;
}

export function collectionMembershipFrom(
	nodes: readonly PresentedFlowNode[]
): readonly string[] {
	return nodes
		.filter(
			(node) =>
				node.kind === SCREEN_NODE_KIND &&
				(node.resolution === "ok" || node.resolution === "archived") &&
				node.screenId
		)
		.map((node) => node.screenId as string);
}

export function computedCountsFrom(nodes: readonly PresentedFlowNode[]): {
	liveScreens: number;
} {
	return {
		liveScreens: collectionMembershipFrom(nodes).length,
	};
}

export function searchHitsFrom(flow: {
	nodes: readonly PresentedFlowNode[];
	title: string;
}): readonly string[] {
	const hits = [flow.title];
	for (const node of flow.nodes) {
		hits.push(
			node.pathText.description,
			node.pathText.transition,
			node.pathText.condition,
			node.pathText.decision
		);
		if (node.kind !== SCREEN_NODE_KIND && node.label) {
			hits.push(node.label);
		}
		if (
			(node.resolution === "ok" || node.resolution === "archived") &&
			node.screenTitle
		) {
			hits.push(node.screenTitle);
		}
	}
	return hits.filter((hit) => hit.length > 0);
}

export function exportContentFrom(flow: {
	nodes: readonly PresentedFlowNode[];
	title: string;
}): string {
	const lines = [flow.title];
	for (const node of flow.nodes) {
		lines.push(
			node.pathText.description,
			node.pathText.transition,
			node.pathText.condition,
			node.pathText.decision
		);
		if (
			(node.resolution === "ok" || node.resolution === "archived") &&
			node.screenTitle
		) {
			lines.push(node.screenTitle);
		}
		if (node.resolution === "ok" && node.preview) {
			lines.push(node.preview);
		}
	}
	return lines.filter((line) => line.length > 0).join("\n");
}
