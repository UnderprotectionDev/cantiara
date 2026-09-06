import { z } from "zod";

import { RELATIONS_COPY } from "../../relations/server/relations-catalog";

export const USER_FLOW_COPY = {
	action: "Action",
	align: "Align",
	archived: "Archived",
	bindScreen: "Bind Screen",
	collapseGroup: "Collapse",
	condition: "Condition",
	confirm: "Confirm",
	convertAndBind: "Convert and Bind",
	createFromTemplate: "Create from template",
	createScreen: "Create Screen",
	createUserFlow: "Create User Flow",
	decision: "Decision",
	description: "Description",
	expandGroup: "Expand",
	fitView: "Fit View",
	group: "Group",
	inspect: "Inspect",
	inTrash: RELATIONS_COPY.inTrash,
	moveDown: "Move down",
	moveUp: "Move up",
	noAccess: RELATIONS_COPY.noAccess,
	noUserFlows: "No User Flows yet.",
	openQuestion: "Open Question",
	openSourceRecord: "Open Source Record",
	origin: RELATIONS_COPY.origin,
	originLocation: "Origin Location",
	outline: "Outline",
	permanentlyDeleted: RELATIONS_COPY.permanentlyDeleted,
	placeLiveCard: "Place live card",
	placeNode: "Place node",
	promoteToScreen: "Promote to Screen",
	rebind: "Rebind",
	redactedForSecurity: RELATIONS_COPY.redactedForSecurity,
	risk: "Risk",
	saveAsTemplate: "Save as template",
	screen: "Screen",
	section: "Section",
	stateOutcome: "State/Outcome",
	title: "Title",
	transition: "Transition",
	unbind: "Unbind",
	undo: "Undo",
	userFlow: "User Flow",
	wireframePreview: "Wireframe preview",
	work: "Work",
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
	convertDoesNotMintScreen: "convert-does-not-mint-screen",
	invalidCommand: "invalid-command",
	nothingToUndo: "nothing-to-undo",
	previewRequired: "preview-required",
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

const groupIdSchema = z
	.string()
	.min(1)
	.nullable()
	.optional()
	.transform((groupId): string | null => groupId ?? null);

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
	groupId: groupIdSchema,
	id: z.string().min(1),
	kind: z.literal(SCREEN_NODE_KIND),
	layout: layoutWithDefault,
	pathText: nodePathTextSchema,
	screenId: z.string().min(1),
	visualStyle: visualStyleWithDefault,
});

export const pathFlowNodeDocumentSchema = z.object({
	groupId: groupIdSchema,
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

export const flowGroupSchema = z.object({
	id: z.string().min(1),
	title: z.string().min(1),
});

export type FlowGroup = z.infer<typeof flowGroupSchema>;

export const CONVERT_RECORD_KINDS = [
	USER_FLOW_COPY.work,
	USER_FLOW_COPY.decision,
	USER_FLOW_COPY.risk,
	USER_FLOW_COPY.openQuestion,
] as const;

export type ConvertRecordKind = (typeof CONVERT_RECORD_KINDS)[number];

export const liveCardKindSchema = z.enum([
	USER_FLOW_COPY.work,
	USER_FLOW_COPY.decision,
	USER_FLOW_COPY.risk,
]);

export type LiveCardKind = z.infer<typeof liveCardKindSchema>;

export const flowLiveCardDocumentSchema = z.object({
	id: z.string().min(1),
	layout: layoutWithDefault,
	recordId: z.string().min(1),
	recordKind: liveCardKindSchema,
});

export type FlowLiveCardDocument = z.infer<typeof flowLiveCardDocumentSchema>;

export const flowDocumentSchema = z.object({
	groups: z
		.array(flowGroupSchema)
		.optional()
		.transform((groups): FlowGroup[] => groups ?? []),
	liveCards: z
		.array(flowLiveCardDocumentSchema)
		.optional()
		.transform((cards): FlowLiveCardDocument[] => cards ?? []),
	nodes: z.array(flowNodeDocumentSchema),
});

export type FlowDocument = z.infer<typeof flowDocumentSchema>;

export const emptyFlowDocument = (): FlowDocument => ({
	groups: [],
	liveCards: [],
	nodes: [],
});

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

export const personalViewportSchema = z
	.object({
		centerX: z.number().finite(),
		centerY: z.number().finite(),
		collapsedGroupIds: z.array(z.string().min(1)),
		zoom: z.number().finite(),
	})
	.strict();

export type PersonalViewport = z.infer<typeof personalViewportSchema>;

export const savePersonalViewportPayloadSchema = z
	.object({
		userFlowId: z.string().min(1),
		viewport: personalViewportSchema,
	})
	.strict();

export const savePersonalViewportCommandSchema = z.object({
	actorId: z.string().min(1),
	payload: savePersonalViewportPayloadSchema,
});

export type SavePersonalViewportCommand = z.infer<
	typeof savePersonalViewportCommandSchema
>;

export const groupOutlinePayloadSchema = z
	.object({
		nodeIds: z.array(z.string().min(1)).min(1),
		title: z.string().min(1).optional(),
		userFlowId: z.string().min(1),
	})
	.strict();

export const groupOutlineCommandSchema = z.object({
	actorId: z.string().min(1),
	baseRevision: z.number().int().nonnegative(),
	idempotencyKey: z.string().min(1),
	origin: z.literal("human"),
	payload: groupOutlinePayloadSchema,
});

export type GroupOutlineCommand = z.infer<typeof groupOutlineCommandSchema>;

export const reorderOutlinePayloadSchema = z
	.object({
		nodeIds: z.array(z.string().min(1)).min(1),
		userFlowId: z.string().min(1),
	})
	.strict();

export const reorderOutlineCommandSchema = z.object({
	actorId: z.string().min(1),
	baseRevision: z.number().int().nonnegative(),
	idempotencyKey: z.string().min(1),
	origin: z.literal("human"),
	payload: reorderOutlinePayloadSchema,
});

export type ReorderOutlineCommand = z.infer<typeof reorderOutlineCommandSchema>;

export const bindOutlineScreenPayloadSchema = z
	.object({
		nodeId: z.string().min(1),
		screenId: z.string().min(1),
		userFlowId: z.string().min(1),
	})
	.strict();

export const bindOutlineScreenCommandSchema = z.object({
	actorId: z.string().min(1),
	baseRevision: z.number().int().nonnegative(),
	idempotencyKey: z.string().min(1),
	origin: z.literal("human"),
	payload: bindOutlineScreenPayloadSchema,
});

export type BindOutlineScreenCommand = z.infer<
	typeof bindOutlineScreenCommandSchema
>;

export const unbindOutlineScreenPayloadSchema = z
	.object({
		nodeId: z.string().min(1),
		userFlowId: z.string().min(1),
	})
	.strict();

export const unbindOutlineScreenCommandSchema = z.object({
	actorId: z.string().min(1),
	baseRevision: z.number().int().nonnegative(),
	idempotencyKey: z.string().min(1),
	origin: z.literal("human"),
	payload: unbindOutlineScreenPayloadSchema,
});

export type UnbindOutlineScreenCommand = z.infer<
	typeof unbindOutlineScreenCommandSchema
>;

export const CANVAS_HARD_SCENE = {
	visibleItems: 500,
	visualLinks: 750,
} as const;

export const CANVAS_STRESS_SCENE = {
	visibleItems: 2000,
	visualLinks: 3000,
} as const;

export const NEUTRAL_VIEWPORT = {
	centerX: 0,
	centerY: 0,
	collapsedGroupIds: [] as readonly string[],
	zoom: 1,
};

const NODE_WIDTH = 200;
const NODE_HEIGHT = 80;
const MEANINGLESS_PAD = 2000;
const MIN_ZOOM = 0.05;
const MAX_ZOOM = 8;

export interface ViewportRestoreSession {
	inspectorOpen?: boolean;
	selectedId?: string | null;
	unsaved?: boolean;
}

export interface ViewportContent {
	groups: readonly { id: string }[];
	nodes: readonly {
		groupId: string | null;
		id: string;
		layout: NodeLayout;
	}[];
}

export interface RestoredPersonalViewport {
	fitted: boolean;
	inspectorOpen: false;
	selectedId: null;
	unsaved: false;
	viewport: PersonalViewport;
}

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

export const convertRecordKindSchema = z.enum(CONVERT_RECORD_KINDS);

export const previewConvertAndBindInputSchema = z.object({
	nodeId: z.string().min(1),
	recordKind: z.string().min(1),
	userFlowId: z.string().min(1),
	workspaceId: z.string().min(1),
});

export const convertAndBindPayloadSchema = z.object({
	body: z.string().optional(),
	nodeId: z.string().min(1),
	recordKind: z.string().min(1),
	title: z.string().optional(),
	userFlowId: z.string().min(1),
});

export const convertAndBindCommandSchema = z.object({
	actorId: z.string().min(1),
	baseRevision: z.number().int().nonnegative(),
	idempotencyKey: z.string().min(1),
	origin: z.literal("human"),
	payload: convertAndBindPayloadSchema,
	previewAcknowledged: z.boolean(),
});

export type ConvertAndBindCommand = z.infer<typeof convertAndBindCommandSchema>;

export const promoteStepToScreenPayloadSchema = z.object({
	nodeId: z.string().min(1),
	screenId: z.string().min(1).optional(),
	userFlowId: z.string().min(1),
});

export const promoteStepToScreenCommandSchema = z.object({
	actorId: z.string().min(1),
	baseRevision: z.number().int().nonnegative(),
	idempotencyKey: z.string().min(1),
	origin: z.literal("human"),
	payload: promoteStepToScreenPayloadSchema,
});

export type PromoteStepToScreenCommand = z.infer<
	typeof promoteStepToScreenCommandSchema
>;

export const previewRebindOriginInputSchema = z.object({
	nodeId: z.string().min(1),
	recordId: z.string().min(1),
	recordKind: z.string().min(1),
	userFlowId: z.string().min(1),
	workspaceId: z.string().min(1),
});

export const rebindOriginPayloadSchema = z.object({
	nodeId: z.string().min(1),
	recordId: z.string().min(1),
	recordKind: z.string().min(1),
	userFlowId: z.string().min(1),
});

export const rebindOriginCommandSchema = z.object({
	actorId: z.string().min(1),
	idempotencyKey: z.string().min(1),
	origin: z.literal("human"),
	payload: rebindOriginPayloadSchema,
	previewAcknowledged: z.boolean(),
});

export type RebindOriginCommand = z.infer<typeof rebindOriginCommandSchema>;

export const saveUserFlowTemplatePayloadSchema = z.object({
	name: z.string().min(1),
	userFlowId: z.string().min(1),
});

export const saveUserFlowTemplateCommandSchema = z.object({
	actorId: z.string().min(1),
	idempotencyKey: z.string().min(1),
	origin: z.literal("human"),
	payload: saveUserFlowTemplatePayloadSchema,
});

export type SaveUserFlowTemplateCommand = z.infer<
	typeof saveUserFlowTemplateCommandSchema
>;

export const instantiateUserFlowTemplatePayloadSchema = z.object({
	projectId: z.string().min(1),
	templateId: z.string().min(1),
	title: z.string().min(1),
});

export const instantiateUserFlowTemplateCommandSchema = z.object({
	actorId: z.string().min(1),
	idempotencyKey: z.string().min(1),
	origin: z.literal("human"),
	payload: instantiateUserFlowTemplatePayloadSchema,
});

export type InstantiateUserFlowTemplateCommand = z.infer<
	typeof instantiateUserFlowTemplateCommandSchema
>;

export const placeLiveCardPayloadSchema = z.object({
	layout: nodeLayoutSchema.optional(),
	recordId: z.string().min(1),
	recordKind: liveCardKindSchema,
	userFlowId: z.string().min(1),
});

export const placeLiveCardCommandSchema = z.object({
	actorId: z.string().min(1),
	baseRevision: z.number().int().nonnegative(),
	idempotencyKey: z.string().min(1),
	origin: z.literal("human"),
	payload: placeLiveCardPayloadSchema,
});

export type PlaceLiveCardCommand = z.infer<typeof placeLiveCardCommandSchema>;

export const moveLiveCardPayloadSchema = z.object({
	cardId: z.string().min(1),
	deltaX: z.number(),
	deltaY: z.number(),
	userFlowId: z.string().min(1),
});

export const moveLiveCardCommandSchema = z.object({
	actorId: z.string().min(1),
	baseRevision: z.number().int().nonnegative(),
	idempotencyKey: z.string().min(1),
	origin: z.literal("human"),
	payload: moveLiveCardPayloadSchema,
});

export type MoveLiveCardCommand = z.infer<typeof moveLiveCardCommandSchema>;

export const removeLiveCardPayloadSchema = z.object({
	cardId: z.string().min(1),
	userFlowId: z.string().min(1),
});

export const removeLiveCardCommandSchema = z.object({
	actorId: z.string().min(1),
	baseRevision: z.number().int().nonnegative(),
	idempotencyKey: z.string().min(1),
	origin: z.literal("human"),
	payload: removeLiveCardPayloadSchema,
});

export type RemoveLiveCardCommand = z.infer<typeof removeLiveCardCommandSchema>;

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
	groupId: string | null;
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

export interface PresentedLiveCard {
	id: string;
	layout: NodeLayout;
	openSourceRecord: typeof USER_FLOW_COPY.openSourceRecord;
	recordId: string;
	recordKind: LiveCardKind;
	status: string | null;
	title: string;
}

export interface PresentedOriginRelation {
	id: string;
	nodeId: string | null;
	recordId: string;
	recordKind: ConvertRecordKind;
	sourceVersion: string | null;
	type: string;
}

export interface ConvertOriginLocation {
	componentId: string;
	ownerId: string;
	ownerKind: typeof USER_FLOW_RECORD_KIND;
	sourceVersion: string;
}

export interface ConvertAndBindPreview {
	body: string;
	copy: {
		confirm: typeof USER_FLOW_COPY.confirm;
		convertAndBind: typeof USER_FLOW_COPY.convertAndBind;
		origin: typeof USER_FLOW_COPY.origin;
		originLocation: typeof USER_FLOW_COPY.originLocation;
	};
	origin: typeof USER_FLOW_COPY.origin;
	originLocation: ConvertOriginLocation;
	projectId: string;
	projectName: string;
	recordKind: ConvertRecordKind;
	title: string;
}

export type ConvertAndBindPreviewOutcome =
	| { preview: ConvertAndBindPreview; status: "ok" }
	| { reason: UserFlowRejectionReason | string; status: "rejected" };

export type ConvertAndBindOutcome =
	| {
			flow: UserFlowView;
			record: { id: string; kind: ConvertRecordKind; title: string };
			status: "committed";
	  }
	| {
			flow: UserFlowView;
			record: { id: string; kind: ConvertRecordKind; title: string };
			status: "replayed";
	  }
	| { conflict: "Conflict"; status: "conflict" }
	| { reason: UserFlowRejectionReason | string; status: "rejected" };

export type RebindOriginPreviewOutcome =
	| {
			preview: { fromVersion: string; toVersion: string };
			status: "ok";
	  }
	| { reason: UserFlowRejectionReason | string; status: "rejected" };

export type RebindOriginOutcome =
	| { status: "committed" }
	| { status: "replayed" }
	| { conflict: "Conflict"; status: "conflict" }
	| { reason: UserFlowRejectionReason | string; status: "rejected" };

export interface UserFlowTemplateView {
	id: string;
	name: string;
	revision: number;
	sourceProjectId?: undefined;
	structure: string;
}

export type UserFlowTemplateWriteOutcome =
	| { status: "committed"; template: UserFlowTemplateView }
	| { status: "replayed"; template: UserFlowTemplateView }
	| { conflict: "Conflict"; status: "conflict" }
	| { reason: UserFlowRejectionReason | string; status: "rejected" };

export interface UserFlowView {
	copy: {
		action: typeof USER_FLOW_COPY.action;
		align: typeof USER_FLOW_COPY.align;
		archived: typeof USER_FLOW_COPY.archived;
		convertAndBind: typeof USER_FLOW_COPY.convertAndBind;
		decision: typeof USER_FLOW_COPY.decision;
		fitView: typeof USER_FLOW_COPY.fitView;
		group: typeof USER_FLOW_COPY.group;
		inspect: typeof USER_FLOW_COPY.inspect;
		openSourceRecord: typeof USER_FLOW_COPY.openSourceRecord;
		originLocation: typeof USER_FLOW_COPY.originLocation;
		outline: typeof USER_FLOW_COPY.outline;
		promoteToScreen: typeof USER_FLOW_COPY.promoteToScreen;
		screen: typeof USER_FLOW_COPY.screen;
		section: typeof USER_FLOW_COPY.section;
		stateOutcome: typeof USER_FLOW_COPY.stateOutcome;
		unbind: typeof USER_FLOW_COPY.unbind;
		undo: typeof USER_FLOW_COPY.undo;
		userFlow: typeof USER_FLOW_COPY.userFlow;
	};
	groups: readonly FlowGroup[];
	id: string;
	liveCards: PresentedLiveCard[];
	nodes: PresentedFlowNode[];
	originRelations: readonly PresentedOriginRelation[];
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
		const bag = parsed as {
			groups?: unknown;
			liveCards?: unknown;
			nodes?: unknown;
		};
		const nodes = Array.isArray(bag.nodes) ? bag.nodes : [];
		const accepted: FlowNodeDocument[] = [];
		for (const node of nodes) {
			const result = flowNodeDocumentSchema.safeParse(node);
			if (result.success) {
				accepted.push(result.data);
			}
		}
		const groups: FlowGroup[] = [];
		if (Array.isArray(bag.groups)) {
			for (const group of bag.groups) {
				const result = flowGroupSchema.safeParse(group);
				if (result.success) {
					groups.push(result.data);
				}
			}
		}
		const liveCards: FlowLiveCardDocument[] = [];
		if (Array.isArray(bag.liveCards)) {
			for (const card of bag.liveCards) {
				const result = flowLiveCardDocumentSchema.safeParse(card);
				if (result.success) {
					liveCards.push(result.data);
				}
			}
		}
		return { groups, liveCards, nodes: accepted };
	} catch {
		return emptyFlowDocument();
	}
}

export function serializeFlowDocument(document: FlowDocument): string {
	return JSON.stringify({
		groups: document.groups,
		liveCards: (document.liveCards ?? []).map((card) => ({
			id: card.id,
			layout: card.layout,
			recordId: card.recordId,
			recordKind: card.recordKind,
		})),
		nodes: document.nodes.map((node) => {
			if (node.kind === SCREEN_NODE_KIND) {
				return {
					chosenWireframeVersionId: node.chosenWireframeVersionId,
					groupId: node.groupId,
					id: node.id,
					kind: node.kind,
					layout: node.layout,
					pathText: node.pathText,
					screenId: node.screenId,
					visualStyle: node.visualStyle,
				};
			}
			return {
				groupId: node.groupId,
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

export function nodeFrame(layout: NodeLayout): {
	height: number;
	width: number;
	x: number;
	y: number;
} {
	return {
		height: NODE_HEIGHT,
		width: NODE_WIDTH,
		x: layout.x,
		y: layout.y,
	};
}

export function fitViewportToContent(
	content: ViewportContent
): PersonalViewport {
	if (content.nodes.length === 0) {
		return {
			centerX: NEUTRAL_VIEWPORT.centerX,
			centerY: NEUTRAL_VIEWPORT.centerY,
			collapsedGroupIds: [],
			zoom: NEUTRAL_VIEWPORT.zoom,
		};
	}
	const frames = content.nodes.map((node) => nodeFrame(node.layout));
	const minX = Math.min(...frames.map((frame) => frame.x));
	const maxX = Math.max(...frames.map((frame) => frame.x + frame.width));
	const minY = Math.min(...frames.map((frame) => frame.y));
	const maxY = Math.max(...frames.map((frame) => frame.y + frame.height));
	return {
		centerX: (minX + maxX) / 2,
		centerY: (minY + maxY) / 2,
		collapsedGroupIds: [],
		zoom: NEUTRAL_VIEWPORT.zoom,
	};
}

export function viewportIsMeaningful(
	saved: PersonalViewport,
	content: ViewportContent
): boolean {
	if (
		!Number.isFinite(saved.zoom) ||
		saved.zoom < MIN_ZOOM ||
		saved.zoom > MAX_ZOOM
	) {
		return false;
	}
	if (content.nodes.length === 0) {
		return (
			saved.centerX === NEUTRAL_VIEWPORT.centerX &&
			saved.centerY === NEUTRAL_VIEWPORT.centerY
		);
	}
	const frames = content.nodes.map((node) => nodeFrame(node.layout));
	const minX = Math.min(...frames.map((frame) => frame.x)) - MEANINGLESS_PAD;
	const maxX =
		Math.max(...frames.map((frame) => frame.x + frame.width)) + MEANINGLESS_PAD;
	const minY = Math.min(...frames.map((frame) => frame.y)) - MEANINGLESS_PAD;
	const maxY =
		Math.max(...frames.map((frame) => frame.y + frame.height)) +
		MEANINGLESS_PAD;
	return (
		saved.centerX >= minX &&
		saved.centerX <= maxX &&
		saved.centerY >= minY &&
		saved.centerY <= maxY
	);
}

export function restorePersonalViewport(input: {
	content: ViewportContent;
	saved: PersonalViewport | null;
	session?: ViewportRestoreSession;
}): RestoredPersonalViewport {
	const liveGroupIds = new Set(input.content.groups.map((group) => group.id));
	const collapse = (ids: readonly string[]) =>
		ids.filter((id) => liveGroupIds.has(id));
	if (!(input.saved && viewportIsMeaningful(input.saved, input.content))) {
		return {
			fitted: true,
			inspectorOpen: false,
			selectedId: null,
			unsaved: false,
			viewport: {
				...fitViewportToContent(input.content),
				collapsedGroupIds: collapse(input.saved?.collapsedGroupIds ?? []),
			},
		};
	}
	return {
		fitted: false,
		inspectorOpen: false,
		selectedId: null,
		unsaved: false,
		viewport: {
			centerX: input.saved.centerX,
			centerY: input.saved.centerY,
			collapsedGroupIds: collapse(input.saved.collapsedGroupIds),
			zoom: input.saved.zoom,
		},
	};
}

export function userFlowShareSnapshot(flow: UserFlowView): {
	groups: UserFlowView["groups"];
	id: string;
	nodes: UserFlowView["nodes"];
	title: string;
} {
	return {
		groups: flow.groups,
		id: flow.id,
		nodes: flow.nodes,
		title: flow.title,
	};
}

export function userFlowExportInput(flow: UserFlowView): {
	groups: UserFlowView["groups"];
	id: string;
	nodes: UserFlowView["nodes"];
	title: string;
} {
	return userFlowShareSnapshot(flow);
}

export function evaluateUserFlowCanvasScene(scene: {
	visibleItems: number;
	visualLinks: number;
}): {
	corrupted: boolean;
	crashed: false;
	detail: "full" | "reduced";
} {
	const itemCount = Math.max(0, Math.floor(scene.visibleItems));
	const linkCount = Math.max(0, Math.floor(scene.visualLinks));
	const items = Array.from({ length: itemCount }, (_, index) =>
		nodeFrame({ x: index * 240, y: 0, z: index })
	);
	const links = Array.from({ length: linkCount }, (_, index) => ({
		from: itemCount === 0 ? 0 : index % itemCount,
		to: itemCount === 0 ? 0 : (index + 1) % itemCount,
	}));
	let checksum = 0;
	for (const frame of items) {
		checksum += frame.x + frame.y + frame.width + frame.height;
	}
	for (const link of links) {
		checksum += link.from + link.to;
	}
	const corrupted =
		!(Number.isFinite(checksum) && items.length === itemCount) ||
		links.length !== linkCount;
	const overHard =
		itemCount > CANVAS_HARD_SCENE.visibleItems ||
		linkCount > CANVAS_HARD_SCENE.visualLinks;
	return {
		corrupted,
		crashed: false,
		detail: overHard ? "reduced" : "full",
	};
}

export function isConvertRecordKind(value: string): value is ConvertRecordKind {
	return (CONVERT_RECORD_KINDS as readonly string[]).includes(value);
}

export function relationKindForConvert(
	kind: ConvertRecordKind
): "Work" | "Decision" | "Risk" | "Question" {
	if (kind === USER_FLOW_COPY.openQuestion) {
		return "Question";
	}
	if (kind === USER_FLOW_COPY.decision) {
		return "Decision";
	}
	if (kind === USER_FLOW_COPY.risk) {
		return "Risk";
	}
	return "Work";
}

export function convertRecordKindFromRelationKind(
	kind: string
): ConvertRecordKind | null {
	if (kind === "Question") {
		return USER_FLOW_COPY.openQuestion;
	}
	if (kind === "Decision") {
		return USER_FLOW_COPY.decision;
	}
	if (kind === "Risk") {
		return USER_FLOW_COPY.risk;
	}
	if (kind === "Work") {
		return USER_FLOW_COPY.work;
	}
	return null;
}

export function convertTitleFromNode(
	node: FlowNodeDocument,
	screenTitle: string | null
): string {
	if (isScreenFlowNode(node)) {
		return screenTitle?.trim() || USER_FLOW_COPY.screen;
	}
	const labeled = node.label.trim();
	if (labeled.length > 0) {
		return labeled;
	}
	return node.pathText.description.trim() || node.kind;
}

export function convertBodyFromNode(node: FlowNodeDocument): string {
	return node.pathText.description;
}

export function stampTemplateStructure(document: FlowDocument): string {
	const nodes = document.nodes.map((node) => {
		if (isScreenFlowNode(node)) {
			return {
				groupId: node.groupId,
				id: "placeholder",
				kind: USER_FLOW_COPY.action,
				label: USER_FLOW_COPY.screen,
				layout: node.layout,
				pathText: node.pathText,
				visualStyle: node.visualStyle,
			};
		}
		return {
			groupId: node.groupId,
			id: "placeholder",
			kind: node.kind,
			label: node.label,
			layout: node.layout,
			pathText: node.pathText,
			visualStyle: node.visualStyle,
		};
	});
	return JSON.stringify({
		groups: document.groups,
		liveCards: [],
		nodes,
	});
}
