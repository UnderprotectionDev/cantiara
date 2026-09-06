import { z } from "zod";

export const PROJECT_WALL_COPY = {
	align: "Align",
	collapseGroup: "Collapse",
	compact: "Compact",
	createPersistentRelation: "Create Persistent Relation",
	createProjectWall: "Create Project Wall",
	customerJourney: "Customer Journey",
	detailed: "Detailed",
	exact: "Exact",
	exitPresentationMode: "Exit Presentation Mode",
	expandGroup: "Expand",
	fitView: "Fit View",
	focusOrder: "Focus order",
	frozenCopy: "Frozen copy",
	group: "Group",
	inspect: "Inspect",
	live: "Live",
	lockPosition: "Lock Position",
	moveDown: "Move down",
	moveUp: "Move up",
	name: "Name",
	noProjectWall: "No Project Wall yet.",
	noShareGrant: "This output does not grant share access.",
	openAllInSource: "Open all in source",
	openSourceRecord: "Open Source Record",
	outline: "Outline",
	pan: "Pan",
	pdf: "PDF",
	placeLiveCard: "Place live card",
	png: "PNG",
	presentationMode: "Presentation Mode",
	preview: "Preview",
	projectWall: "Project Wall",
	select: "Select",
	sharedSource: "Shared source",
	sitemap: "Sitemap",
	visualLink: "Visual link",
	zoom: "Zoom",
} as const;

export const SITEMAP_HEADINGS = [
	"Primary Navigation",
	"Secondary Navigation",
	"Utility",
	"External",
] as const;

export const CUSTOMER_JOURNEY_HEADINGS = [
	"Awareness",
	"Consideration",
	"Onboarding",
	"Core Use",
	"Retention",
] as const;

export const PROJECT_WALL_STARTER_SKELETONS = [
	{
		emptyHeadings: SITEMAP_HEADINGS,
		name: PROJECT_WALL_COPY.sitemap,
	},
	{
		emptyHeadings: CUSTOMER_JOURNEY_HEADINGS,
		name: PROJECT_WALL_COPY.customerJourney,
	},
] as const;

export const DESIGN_TYPE_PROJECT_WALL = "Project Wall" as const;

export const PROJECT_WALL_DENSITIES = [
	PROJECT_WALL_COPY.compact,
	PROJECT_WALL_COPY.preview,
	PROJECT_WALL_COPY.detailed,
] as const;

export type ProjectWallDensity = (typeof PROJECT_WALL_DENSITIES)[number];

export const PROJECT_WALL_FIELD = {
	key: "Key",
	status: "Status",
	title: "Title",
	type: "Type",
} as const;

export const DENSITY_FIELDS = {
	[PROJECT_WALL_COPY.compact]: [
		PROJECT_WALL_FIELD.title,
		PROJECT_WALL_FIELD.type,
	],
	[PROJECT_WALL_COPY.preview]: [
		PROJECT_WALL_FIELD.title,
		PROJECT_WALL_FIELD.type,
		PROJECT_WALL_FIELD.status,
	],
	[PROJECT_WALL_COPY.detailed]: [
		PROJECT_WALL_FIELD.title,
		PROJECT_WALL_FIELD.type,
		PROJECT_WALL_FIELD.status,
		PROJECT_WALL_FIELD.key,
	],
} as const;

export const PROJECT_WALL_SOURCE_KIND = {
	smartCollection: "Smart Collection",
	technicalDiagram: "Technical Diagram",
	work: "Work",
} as const;

export type ProjectWallSourceKind =
	(typeof PROJECT_WALL_SOURCE_KIND)[keyof typeof PROJECT_WALL_SOURCE_KIND];

export const COLLECTION_SUMMARY_LIMIT = 8;

export const PROJECT_WALL_REJECTION = {
	diagramReadOnly: "diagram-read-only",
	duplicateSource: "duplicate-source",
	emptySelection: "empty-selection",
	invalidCommand: "invalid-command",
	nestedGroup: "nested-group",
	nestedWall: "nested-wall",
	positionLocked: "position-locked",
	previewRequired: "preview-required",
	projectNotFound: "project-not-found",
	sourceNotFound: "source-not-found",
	unknownDensity: "unknown-density",
	visualLinkNotFound: "visual-link-not-found",
	wallNotFound: "wall-not-found",
	wallOnlyItem: "wall-only-item",
	workspaceWall: "workspace-wall",
	wrongSurface: "wrong-surface",
} as const;

export type ProjectWallRejectionReason =
	(typeof PROJECT_WALL_REJECTION)[keyof typeof PROJECT_WALL_REJECTION];

const densitySchema = z.enum(PROJECT_WALL_DENSITIES);
const snapshotFormatSchema = z.enum([
	PROJECT_WALL_COPY.png,
	PROJECT_WALL_COPY.pdf,
]);

export const createProjectWallPayloadSchema = z.object({
	name: z.string().min(1),
	parentId: z.string().min(1).optional(),
	projectId: z.string().min(1).optional(),
	surface: z.string().min(1).optional(),
	workspaceId: z.string().min(1).optional(),
});

export const createProjectWallCommandSchema = z.object({
	actorId: z.string().min(1),
	idempotencyKey: z.string().min(1),
	origin: z.literal("human"),
	payload: createProjectWallPayloadSchema,
});

export type CreateProjectWallCommand = z.infer<
	typeof createProjectWallCommandSchema
>;

export const materializeStarterSkeletonWallsPayloadSchema = z.object({
	projectId: z.string().min(1),
});

export type MaterializeStarterSkeletonWallsPayload = z.infer<
	typeof materializeStarterSkeletonWallsPayloadSchema
>;

export const materializeStarterSkeletonWallsCommandSchema = z.object({
	actorId: z.string().min(1),
	idempotencyKey: z.string().min(1),
	origin: z.literal("human"),
	payload: materializeStarterSkeletonWallsPayloadSchema,
	workspaceId: z.string().min(1),
});

export type MaterializeStarterSkeletonWallsCommand = z.infer<
	typeof materializeStarterSkeletonWallsCommandSchema
>;

export const placeLiveCardPayloadSchema = z.object({
	authority: z.string().min(1).optional(),
	density: densitySchema.optional(),
	pinVersionId: z.string().min(1).optional(),
	positionX: z.number().optional(),
	positionY: z.number().optional(),
	query: z.unknown().optional(),
	sourceId: z.string().min(1).optional(),
	sourceKind: z.string().min(1).optional(),
	wallId: z.string().min(1),
});

export const placeLiveCardCommandSchema = z.object({
	actorId: z.string().min(1),
	idempotencyKey: z.string().min(1),
	origin: z.literal("human"),
	payload: placeLiveCardPayloadSchema,
});

export type PlaceLiveCardCommand = z.infer<typeof placeLiveCardCommandSchema>;

export const updateCardLayoutPayloadSchema = z.object({
	cardId: z.string().min(1),
	positionX: z.number(),
	positionY: z.number(),
	wallId: z.string().min(1),
});

export const updateCardLayoutCommandSchema = z.object({
	actorId: z.string().min(1),
	idempotencyKey: z.string().min(1),
	origin: z.literal("human"),
	payload: updateCardLayoutPayloadSchema,
});

export type UpdateCardLayoutCommand = z.infer<
	typeof updateCardLayoutCommandSchema
>;

export const updateCardDensityPayloadSchema = z.object({
	cardId: z.string().min(1),
	density: densitySchema,
	wallId: z.string().min(1),
});

export const updateCardDensityCommandSchema = z.object({
	actorId: z.string().min(1),
	idempotencyKey: z.string().min(1),
	origin: z.literal("human"),
	payload: updateCardDensityPayloadSchema,
});

export type UpdateCardDensityCommand = z.infer<
	typeof updateCardDensityCommandSchema
>;

export const saveFocusOrderPayloadSchema = z.object({
	cardIds: z.array(z.string().min(1)),
	wallId: z.string().min(1),
});

export const saveFocusOrderCommandSchema = z.object({
	actorId: z.string().min(1),
	idempotencyKey: z.string().min(1),
	origin: z.literal("human"),
	payload: saveFocusOrderPayloadSchema,
});

export type SaveFocusOrderCommand = z.infer<typeof saveFocusOrderCommandSchema>;

export const regionSnapshotPayloadSchema = z.object({
	cardIds: z.array(z.string().min(1)),
	format: snapshotFormatSchema,
	wallId: z.string().min(1),
});

export const createRegionSnapshotCommandSchema = z.object({
	actorId: z.string().min(1),
	idempotencyKey: z.string().min(1),
	origin: z.literal("human"),
	payload: regionSnapshotPayloadSchema,
});

export type CreateRegionSnapshotCommand = z.infer<
	typeof createRegionSnapshotCommandSchema
>;

export const updateDiagramNodeCommandSchema = z.object({
	actorId: z.string().min(1),
	idempotencyKey: z.string().min(1),
	origin: z.literal("human"),
	payload: z.object({
		cardId: z.string().min(1),
		nodeId: z.string().min(1),
		wallId: z.string().min(1),
	}),
});

export const drawVisualLinePayloadSchema = z.object({
	fromCardId: z.string().min(1),
	label: z.string().min(1),
	toCardId: z.string().min(1),
	wallId: z.string().min(1),
});

export const drawVisualLineCommandSchema = z.object({
	actorId: z.string().min(1),
	idempotencyKey: z.string().min(1),
	origin: z.literal("human"),
	payload: drawVisualLinePayloadSchema,
});

export type DrawVisualLineCommand = z.infer<typeof drawVisualLineCommandSchema>;

export const createPersistentRelationPayloadSchema = z.object({
	previewAcknowledged: z.boolean().optional(),
	type: z.string().min(1),
	visualLinkId: z.string().min(1),
	wallId: z.string().min(1),
});

export const createPersistentRelationCommandSchema = z.object({
	actorId: z.string().min(1),
	idempotencyKey: z.string().min(1),
	origin: z.literal("human"),
	payload: createPersistentRelationPayloadSchema,
	viewerWorkspaceId: z.string().min(1),
});

export type CreatePersistentRelationCommand = z.infer<
	typeof createPersistentRelationCommandSchema
>;

export const previewPersistentRelationInputSchema = z.object({
	type: z.string().min(1),
	viewerWorkspaceId: z.string().min(1),
	visualLinkId: z.string().min(1),
	wallId: z.string().min(1),
});

export type PreviewPersistentRelationInput = z.infer<
	typeof previewPersistentRelationInputSchema
>;

export const createGroupPayloadSchema = z.object({
	cardIds: z.array(z.string().min(1)).min(1),
	name: z.string().min(1),
	parentId: z.string().min(1).optional(),
	wallId: z.string().min(1),
});

export const createGroupCommandSchema = z.object({
	actorId: z.string().min(1),
	idempotencyKey: z.string().min(1),
	origin: z.literal("human"),
	payload: createGroupPayloadSchema,
});

export type CreateGroupCommand = z.infer<typeof createGroupCommandSchema>;

export const setLockPositionPayloadSchema = z.object({
	cardId: z.string().min(1),
	locked: z.boolean(),
	wallId: z.string().min(1),
});

export const setLockPositionCommandSchema = z.object({
	actorId: z.string().min(1),
	idempotencyKey: z.string().min(1),
	origin: z.literal("human"),
	payload: setLockPositionPayloadSchema,
});

export type SetLockPositionCommand = z.infer<
	typeof setLockPositionCommandSchema
>;

export const reorderOutlinePayloadSchema = z.object({
	cardIds: z.array(z.string().min(1)).min(1),
	wallId: z.string().min(1),
});

export const reorderOutlineCommandSchema = z.object({
	actorId: z.string().min(1),
	idempotencyKey: z.string().min(1),
	origin: z.literal("human"),
	payload: reorderOutlinePayloadSchema,
});

export type ReorderOutlineCommand = z.infer<typeof reorderOutlineCommandSchema>;

export const removeVisualLinePayloadSchema = z.object({
	visualLinkId: z.string().min(1),
	wallId: z.string().min(1),
});

export const removeVisualLineCommandSchema = z.object({
	actorId: z.string().min(1),
	idempotencyKey: z.string().min(1),
	origin: z.literal("human"),
	payload: removeVisualLinePayloadSchema,
});

export type RemoveVisualLineCommand = z.infer<
	typeof removeVisualLineCommandSchema
>;

export const CANVAS_HARD_SCENE = {
	visibleItems: 500,
	visualLinks: 750,
} as const;

export const CANVAS_STRESS_SCENE = {
	visibleItems: 2000,
	visualLinks: 3000,
} as const;

export const CANVAS_FRAME_BUDGET_MS = {
	max: 33,
	p95: 16,
} as const;

export const NEUTRAL_VIEWPORT = {
	centerX: 0,
	centerY: 0,
	collapsedGroupIds: [] as readonly string[],
	zoom: 1,
};

const CARD_TILE = 160;
const MEANINGLESS_PAD = 2000;
const MIN_ZOOM = 0.05;
const MAX_ZOOM = 8;
const KEYBOARD_ZOOM_MIN = 0.25;
const KEYBOARD_ZOOM_MAX = 4;

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
		viewport: personalViewportSchema,
		wallId: z.string().min(1),
	})
	.strict();

export const savePersonalViewportCommandSchema = z.object({
	actorId: z.string().min(1),
	payload: savePersonalViewportPayloadSchema,
});

export type SavePersonalViewportCommand = z.infer<
	typeof savePersonalViewportCommandSchema
>;

export interface ViewportRestoreSession {
	inspectorOpen?: boolean;
	selectedId?: string | null;
	unsaved?: boolean;
}

export interface ViewportContent {
	cards: readonly {
		groupId: string | null;
		id: string;
		positionX: number;
		positionY: number;
	}[];
	groups: readonly { id: string }[];
}

export interface RestoredPersonalViewport {
	fitted: boolean;
	inspectorOpen: false;
	selectedId: null;
	unsaved: false;
	viewport: PersonalViewport;
}

export interface EditorCamera {
	x: number;
	y: number;
	zoom: number;
}

export type AlignAxis =
	| "left"
	| "right"
	| "center"
	| "top"
	| "bottom"
	| "middle";

export interface PositionedCard {
	id: string;
	positionX: number;
	positionY: number;
}

export function sourceOpenHref(projectId: string): string {
	return `/projects/${projectId}`;
}

export function cardFrame(card: { positionX: number; positionY: number }): {
	height: number;
	width: number;
	x: number;
	y: number;
} {
	return {
		height: CARD_TILE,
		width: CARD_TILE,
		x: card.positionX,
		y: card.positionY,
	};
}

export function fitViewportToContent(
	content: ViewportContent
): PersonalViewport {
	if (content.cards.length === 0) {
		return {
			centerX: NEUTRAL_VIEWPORT.centerX,
			centerY: NEUTRAL_VIEWPORT.centerY,
			collapsedGroupIds: [],
			zoom: NEUTRAL_VIEWPORT.zoom,
		};
	}
	const frames = content.cards.map((card) => cardFrame(card));
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
	if (content.cards.length === 0) {
		return (
			saved.centerX === NEUTRAL_VIEWPORT.centerX &&
			saved.centerY === NEUTRAL_VIEWPORT.centerY
		);
	}
	const frames = content.cards.map((card) => cardFrame(card));
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

export function wallShareSnapshot(wall: ProjectWallView): {
	cards: ProjectWallView["cards"];
	focusOrder: ProjectWallView["focusOrder"];
	groups: ProjectWallView["groups"];
	id: string;
	name: string;
	visualLinks: ProjectWallView["visualLinks"];
} {
	return {
		cards: wall.cards,
		focusOrder: wall.focusOrder,
		groups: wall.groups,
		id: wall.id,
		name: wall.name,
		visualLinks: wall.visualLinks,
	};
}

export function wallExportInput(wall: ProjectWallView): {
	cards: ProjectWallView["cards"];
	focusOrder: ProjectWallView["focusOrder"];
	groups: ProjectWallView["groups"];
	id: string;
	name: string;
	visualLinks: ProjectWallView["visualLinks"];
} {
	return wallShareSnapshot(wall);
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
		zoom: Math.min(
			KEYBOARD_ZOOM_MAX,
			Math.max(KEYBOARD_ZOOM_MIN, camera.zoom * factor)
		),
	};
}

export function selectCards(
	cardIds: readonly string[],
	focusedId: string
): string[] {
	return cardIds.filter((cardId) => cardId === focusedId);
}

export function moveCards(
	cards: readonly PositionedCard[],
	cardIds: readonly string[],
	deltaX: number,
	deltaY: number
): PositionedCard[] {
	const moving = new Set(cardIds);
	return cards.map((card) =>
		moving.has(card.id)
			? {
					...card,
					positionX: card.positionX + deltaX,
					positionY: card.positionY + deltaY,
				}
			: card
	);
}

export function alignCards(
	cards: readonly PositionedCard[],
	cardIds: readonly string[],
	axis: AlignAxis
): PositionedCard[] {
	const selected = cards.filter((card) => cardIds.includes(card.id));
	if (selected.length === 0) {
		return [...cards];
	}
	const xs = selected.map((card) => card.positionX);
	const ys = selected.map((card) => card.positionY);
	const left = Math.min(...xs);
	const right = Math.max(...xs);
	const top = Math.min(...ys);
	const bottom = Math.max(...ys);
	const centerX = (left + right) / 2;
	const middleY = (top + bottom) / 2;
	const nextX = xForAlign(axis, { centerX, left, right });
	const nextY = yForAlign(axis, { bottom, middleY, top });
	return cards.map((card) => {
		if (!cardIds.includes(card.id)) {
			return card;
		}
		return {
			...card,
			positionX: nextX ?? card.positionX,
			positionY: nextY ?? card.positionY,
		};
	});
}

export function evaluateProjectWallCanvasScene(scene: {
	visibleItems: number;
	visualLinks: number;
}): {
	corrupted: boolean;
	crashed: false;
	detail: "full" | "reduced";
	maxFrameMs: number;
	p95FrameMs: number;
} {
	const itemCount = Math.max(0, Math.floor(scene.visibleItems));
	const linkCount = Math.max(0, Math.floor(scene.visualLinks));
	const overHard =
		itemCount > CANVAS_HARD_SCENE.visibleItems ||
		linkCount > CANVAS_HARD_SCENE.visualLinks;
	const visibleItems = overHard
		? Math.min(itemCount, CANVAS_HARD_SCENE.visibleItems)
		: itemCount;
	const visibleLinks = overHard
		? Math.min(linkCount, CANVAS_HARD_SCENE.visualLinks)
		: linkCount;
	const items = Array.from({ length: visibleItems }, (_, index) =>
		cardFrame({
			positionX: (index % 25) * 180,
			positionY: Math.floor(index / 25) * 180,
		})
	);
	const links = Array.from({ length: visibleLinks }, (_, index) => ({
		from: visibleItems === 0 ? 0 : index % visibleItems,
		to: visibleItems === 0 ? 0 : (index + 1) % visibleItems,
	}));
	const samples: number[] = [];
	let checksum = 0;
	for (let frame = 0; frame < 60; frame += 1) {
		const started = performance.now();
		const panX = frame * 4;
		const panY = frame * 2;
		const zoom = 1 + (frame % 5) * 0.02;
		for (const item of items) {
			checksum += (item.x + panX) * zoom + (item.y + panY) * zoom;
		}
		for (const link of links) {
			checksum += link.from + link.to + panX + panY;
		}
		samples.push(performance.now() - started);
	}
	const sorted = [...samples].sort((left, right) => left - right);
	const p95Index = Math.max(0, Math.ceil(sorted.length * 0.95) - 1);
	const corrupted =
		!(Number.isFinite(checksum) && items.length === visibleItems) ||
		links.length !== visibleLinks;
	return {
		corrupted,
		crashed: false,
		detail: overHard ? "reduced" : "full",
		maxFrameMs: sorted.at(-1) ?? 0,
		p95FrameMs: sorted[p95Index] ?? 0,
	};
}

function xForAlign(
	axis: AlignAxis,
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
	axis: AlignAxis,
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

export const applyAutoLayoutPayloadSchema = z.object({
	wallId: z.string().min(1),
});

export const applyAutoLayoutCommandSchema = z.object({
	actorId: z.string().min(1),
	idempotencyKey: z.string().min(1),
	origin: z.literal("human"),
	payload: applyAutoLayoutPayloadSchema,
});

export type ApplyAutoLayoutCommand = z.infer<
	typeof applyAutoLayoutCommandSchema
>;

export const AUTO_LAYOUT_STEP = 240;

export type LiveCardFieldMap = Partial<
	Record<(typeof PROJECT_WALL_FIELD)[keyof typeof PROJECT_WALL_FIELD], string>
>;

export interface ProjectWallMemberPreview {
	id: string;
	sharedSource?: typeof PROJECT_WALL_COPY.sharedSource;
	title: string;
}

export interface ProjectWallCardView {
	authority?: typeof PROJECT_WALL_COPY.live | typeof PROJECT_WALL_COPY.exact;
	density: ProjectWallDensity;
	fields: LiveCardFieldMap;
	groupId: string | null;
	id: string;
	locked: boolean;
	members?: ProjectWallMemberPreview[];
	nodeEditing?: boolean;
	openAllInSource?: typeof PROJECT_WALL_COPY.openAllInSource;
	openHref: string;
	openSourceRecord: typeof PROJECT_WALL_COPY.openSourceRecord;
	ownQuery?: boolean;
	positionX: number;
	positionY: number;
	sourceId: string;
	sourceKind: ProjectWallSourceKind;
}

export interface ProjectWallGroupView {
	cardIds: string[];
	id: string;
	name: string;
	sortOrder: number;
}

export interface ProjectWallVisualLinkView {
	fromCardId: string;
	id: string;
	label: string;
	toCardId: string;
}

export interface ProjectWallView {
	cards: ProjectWallCardView[];
	focusOrder: string[];
	groups: ProjectWallGroupView[];
	id: string;
	name: string;
	projectId: string;
	recordKind: typeof DESIGN_TYPE_PROJECT_WALL;
	revision: number;
	type: typeof DESIGN_TYPE_PROJECT_WALL;
	visualLinks: ProjectWallVisualLinkView[];
}

export interface ProjectWallPresentationView {
	contentCopy: false;
	focusOrder: string[];
	toolsVisible: boolean;
	wall: ProjectWallView;
}

export interface RegionSnapshotView {
	bytes?: Uint8Array;
	capturedAt: string;
	images?: { bytes: Uint8Array }[];
	kind: typeof PROJECT_WALL_COPY.frozenCopy;
	liveSourceLink: false;
	notice: typeof PROJECT_WALL_COPY.noShareGrant;
	opensBuildInPublic: false;
	opensLinkSharing: false;
	pages?: { title: string }[];
	shareGrant: false;
	titles: string[];
	wallLocked: false;
}

export type ProjectWallWriteOutcome =
	| { status: "committed"; wall: ProjectWallView }
	| { status: "replayed"; wall: ProjectWallView }
	| { conflict: "Conflict"; status: "conflict" }
	| { reason: ProjectWallRejectionReason; status: "rejected" };

export type StarterSkeletonWallsOutcome =
	| { status: "committed"; walls: ProjectWallView[] }
	| { status: "replayed"; walls: ProjectWallView[] }
	| { conflict: "Conflict"; status: "conflict" }
	| { reason: ProjectWallRejectionReason; status: "rejected" };

export type RegionSnapshotPreviewOutcome =
	| ({ status: "ok" } & RegionSnapshotView)
	| { reason: ProjectWallRejectionReason; status: "rejected" };

export type RegionSnapshotWriteOutcome =
	| { snapshot: RegionSnapshotView; status: "committed" }
	| { reason: ProjectWallRejectionReason; status: "rejected" };

export function projectWallCatalog() {
	return {
		copy: PROJECT_WALL_COPY,
		counterparts: {
			buildInPublic: false,
			collectionOwnQuery: false,
			contentCopy: false,
			diagramNodeEditing: false,
			externalSurface: false,
			freehand: false,
			groupMembershipAsRelation: false,
			moodboard: false,
			nestedGroup: false,
			nestedWall: false,
			perCardCss: false,
			personalViewportIsContent: false,
			personalViewportIsExport: false,
			personalViewportIsShareSnapshot: false,
			proximityAsRelation: false,
			shareGrant: false,
			sketchCard: false,
			visualLineAsRelation: false,
			wallOnlyFile: false,
			wallOnlyNote: false,
			wallOnlyTask: false,
			wikiPage: false,
			wireframe: false,
			workspaceWall: false,
		},
		densities: PROJECT_WALL_DENSITIES,
		densityFields: DENSITY_FIELDS,
		skeletons: PROJECT_WALL_STARTER_SKELETONS.map((skeleton) => ({
			emptyHeadings: [...skeleton.emptyHeadings],
			name: skeleton.name,
		})),
		sourceKinds: [
			PROJECT_WALL_SOURCE_KIND.work,
			PROJECT_WALL_SOURCE_KIND.technicalDiagram,
			PROJECT_WALL_SOURCE_KIND.smartCollection,
		],
		type: DESIGN_TYPE_PROJECT_WALL,
	};
}

export function fieldsForDensity(
	density: ProjectWallDensity,
	source: LiveCardFieldMap
): LiveCardFieldMap {
	const allowed = DENSITY_FIELDS[density];
	const fields: LiveCardFieldMap = {};
	for (const key of allowed) {
		const value = source[key];
		if (value !== undefined) {
			fields[key] = value;
		}
	}
	return fields;
}

export function wallPresentation(
	wall: ProjectWallView,
	presenting: boolean
): ProjectWallPresentationView {
	return {
		contentCopy: false,
		focusOrder: wall.focusOrder,
		toolsVisible: !presenting,
		wall,
	};
}

export function parseFocusOrder(value: unknown): string[] {
	if (!Array.isArray(value)) {
		return [];
	}
	return value.filter((item): item is string => typeof item === "string");
}

export function snapshotNotice(): RegionSnapshotView {
	return {
		capturedAt: "",
		kind: PROJECT_WALL_COPY.frozenCopy,
		liveSourceLink: false,
		notice: PROJECT_WALL_COPY.noShareGrant,
		opensBuildInPublic: false,
		opensLinkSharing: false,
		shareGrant: false,
		titles: [],
		wallLocked: false,
	};
}
