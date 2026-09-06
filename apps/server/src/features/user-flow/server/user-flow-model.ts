import { z } from "zod";

import { RELATIONS_COPY } from "../../relations/server/relations-catalog";

export const USER_FLOW_COPY = {
	archived: "Archived",
	bindScreen: "Bind Screen",
	condition: "Condition",
	createScreen: "Create Screen",
	createUserFlow: "Create User Flow",
	decision: "Decision",
	description: "Description",
	inTrash: RELATIONS_COPY.inTrash,
	noAccess: RELATIONS_COPY.noAccess,
	noUserFlows: "No User Flows yet.",
	openSourceRecord: "Open Source Record",
	permanentlyDeleted: RELATIONS_COPY.permanentlyDeleted,
	redactedForSecurity: RELATIONS_COPY.redactedForSecurity,
	screen: "Screen",
	title: "Title",
	transition: "Transition",
	userFlow: "User Flow",
	wireframePreview: "Wireframe preview",
} as const;

export const USER_FLOW_RECORD_KIND = "User Flow" as const;
export const SCREEN_RECORD_KIND = "Screen" as const;

export const SCREEN_NODE_KIND = "Screen" as const;

export const nodePathTextSchema = z.object({
	condition: z.string(),
	decision: z.string(),
	description: z.string(),
	transition: z.string(),
});

export type NodePathText = z.infer<typeof nodePathTextSchema>;

export const flowNodeDocumentSchema = z.object({
	chosenWireframeVersionId: z.string().min(1).nullable(),
	id: z.string().min(1),
	kind: z.literal(SCREEN_NODE_KIND),
	pathText: nodePathTextSchema,
	screenId: z.string().min(1),
});

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
	| { reason: string; status: "rejected" };

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

export interface PresentedScreenNode {
	boundAt: string | null;
	chosenWireframeVersionId: string | null;
	id: string;
	kind: typeof SCREEN_NODE_KIND;
	openHref: string | null;
	openSourceRecord: typeof USER_FLOW_COPY.openSourceRecord | null;
	pathText: NodePathText;
	preview: string | null;
	reason: string | null;
	resolution: ScreenTargetResolution;
	screenId: string;
	screenTitle: string | null;
	usageKind: "flow-node-screen-reference";
}

export interface UserFlowView {
	copy: {
		archived: typeof USER_FLOW_COPY.archived;
		openSourceRecord: typeof USER_FLOW_COPY.openSourceRecord;
		userFlow: typeof USER_FLOW_COPY.userFlow;
	};
	id: string;
	nodes: PresentedScreenNode[];
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
		const parsed = flowDocumentSchema.safeParse(JSON.parse(raw));
		if (parsed.success) {
			return parsed.data;
		}
	} catch {
		return emptyFlowDocument();
	}
	return emptyFlowDocument();
}

export function serializeFlowDocument(document: FlowDocument): string {
	return JSON.stringify(document);
}

export function usageEmbedIdForNode(nodeId: string): string {
	return `flow-node:${nodeId}`;
}

export function screenOpenHref(projectId: string, screenId: string): string {
	return `/projects/${projectId}?screen=${screenId}`;
}

export function collectionMembershipFrom(
	nodes: readonly PresentedScreenNode[]
): readonly string[] {
	return nodes
		.filter(
			(node) => node.resolution === "ok" || node.resolution === "archived"
		)
		.map((node) => node.screenId);
}

export function computedCountsFrom(nodes: readonly PresentedScreenNode[]): {
	liveScreens: number;
} {
	return {
		liveScreens: collectionMembershipFrom(nodes).length,
	};
}

export function searchHitsFrom(flow: {
	nodes: readonly PresentedScreenNode[];
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
	nodes: readonly PresentedScreenNode[];
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
