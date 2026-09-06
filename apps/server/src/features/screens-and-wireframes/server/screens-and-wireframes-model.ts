import { z } from "zod";

import {
	EMPTY_WIREFRAME_DOCUMENT as emptyWireframeDocument,
	WIREFRAME_DOCUMENT_SCHEMA,
	wireframeDocumentSchema,
	wireframeLinkedBlockDefinitionSchema,
} from "./wireframe-document";

export const EMPTY_WIREFRAME_DOCUMENT = emptyWireframeDocument;

export const SCREENS_COPY = {
	active: "Active",
	affectedScreens: "Affected Screens",
	align: "Align",
	archive: "Archive",
	archived: "Archived",
	broken: "Broken",
	button: "Button",
	card: "Card",
	chart: "Chart",
	collapseGroup: "Collapse",
	createScreen: "Create Screen",
	deletePermanently: "Permanently Delete",
	detachLink: "Detach Link",
	exitPresentationMode: "Exit Presentation Mode",
	expandGroup: "Expand",
	export: "Export",
	fitView: "Fit View",
	group: "Group",
	html: "HTML",
	includeArchived: "Include archived",
	input: "Input",
	inspect: "Inspect",
	inTrash: "In Trash",
	liveSource: "Live source",
	moveDown: "Move down",
	moveToTrash: "Move to Trash",
	moveUp: "Move up",
	navigation: "Navigation",
	noScreens: "No Screens yet.",
	openSourceRecord: "Open Source Record",
	outline: "Outline",
	pdf: "PDF",
	png: "PNG",
	presentationMode: "Presentation Mode",
	restore: "Restore",
	screen: "Screen",
	svg: "SVG",
	table: "Table",
	text: "Text",
	title: "Title",
	titleRequired: "Title is required.",
	unarchive: "Unarchive",
	unresolved: "Unresolved",
	wireframe: "Wireframe",
} as const;

export const SCREEN_KIND = SCREENS_COPY.screen;

export const SCREEN_LIFE = {
	active: SCREENS_COPY.active,
	archived: SCREENS_COPY.archived,
	inTrash: SCREENS_COPY.inTrash,
} as const;

export const SCREEN_EVENT_KIND = {
	archive: "archive",
	create: "create",
	deletePermanently: "delete-permanently",
	restore: "restore",
	saveVersion: "save-version",
	trash: "trash",
	unarchive: "unarchive",
} as const;

export const emptyWireframeDocumentSchema = wireframeDocumentSchema;

export function presentScreenLife(input: {
	archivedAt: Date | string | null;
	trashedAt: Date | string | null;
}): (typeof SCREEN_LIFE)[keyof typeof SCREEN_LIFE] {
	if (input.trashedAt) {
		return SCREEN_LIFE.inTrash;
	}
	if (input.archivedAt) {
		return SCREEN_LIFE.archived;
	}
	return SCREEN_LIFE.active;
}

export const wireframeVersionViewSchema = z.object({
	createdAt: z.string(),
	id: z.string().min(1),
	schema: z.literal(WIREFRAME_DOCUMENT_SCHEMA),
	screenId: z.string().min(1),
	versionNumber: z.number().int().positive(),
});

export type WireframeVersionView = z.infer<typeof wireframeVersionViewSchema>;

export const screenEventViewSchema = z.object({
	kind: z.string().min(1),
	occurredAt: z.string(),
});

export const screenViewSchema = z.object({
	archivedAt: z.string().nullable(),
	history: z.array(screenEventViewSchema),
	id: z.string().min(1),
	life: z.enum([SCREEN_LIFE.active, SCREEN_LIFE.archived, SCREEN_LIFE.inTrash]),
	projectId: z.string().min(1),
	recordKind: z.literal(SCREEN_KIND),
	revision: z.number().int().positive(),
	title: z.string(),
	trashedAt: z.string().nullable(),
	versions: z.array(wireframeVersionViewSchema),
});

export type ScreenView = z.infer<typeof screenViewSchema>;

export const createScreenPayloadSchema = z.object({
	projectId: z.string().min(1),
	title: z.string(),
});

export type CreateScreenPayload = z.infer<typeof createScreenPayloadSchema>;

export const createScreenCommandSchema = z.object({
	actorId: z.string().min(1),
	idempotencyKey: z.string().min(1),
	origin: z.literal("human"),
	payload: createScreenPayloadSchema,
});

export type CreateScreenCommand = z.infer<typeof createScreenCommandSchema>;

export const saveWireframeVersionPayloadSchema = z.object({
	document: z.unknown(),
	screenId: z.string().min(1),
});

export const saveWireframeVersionCommandSchema = z.object({
	actorId: z.string().min(1),
	baseRevision: z.number().int().positive(),
	idempotencyKey: z.string().min(1),
	origin: z.literal("human"),
	payload: saveWireframeVersionPayloadSchema,
});

export type SaveWireframeVersionCommand = z.infer<
	typeof saveWireframeVersionCommandSchema
>;

const screenIdPayloadSchema = z.object({
	screenId: z.string().min(1),
});

export const archiveScreenCommandSchema = z.object({
	actorId: z.string().min(1),
	baseRevision: z.number().int().positive(),
	idempotencyKey: z.string().min(1),
	origin: z.literal("human"),
	payload: screenIdPayloadSchema,
});

export type ArchiveScreenCommand = z.infer<typeof archiveScreenCommandSchema>;

export const unarchiveScreenCommandSchema = archiveScreenCommandSchema;
export const trashScreenCommandSchema = archiveScreenCommandSchema;
export const restoreScreenCommandSchema = archiveScreenCommandSchema;
export const permanentlyDeleteScreenCommandSchema = archiveScreenCommandSchema;

export type ScreenWriteOutcome =
	| { screen: ScreenView; status: "committed" }
	| { screen: ScreenView; status: "replayed" }
	| { conflict: string; status: "conflict" }
	| { reason: string; status: "rejected" };

export type PermanentDeleteOutcome =
	| { screenId: string; status: "committed" }
	| { screenId: string; status: "replayed" }
	| { conflict: string; status: "conflict" }
	| { reason: string; status: "rejected" };

export const createLinkedBlockPayloadSchema = z.object({
	definition: wireframeLinkedBlockDefinitionSchema,
	name: z.string().min(1),
	projectId: z.string().min(1),
});

export const createLinkedBlockCommandSchema = z.object({
	actorId: z.string().min(1),
	idempotencyKey: z.string().min(1),
	origin: z.literal("human"),
	payload: createLinkedBlockPayloadSchema,
});

export type CreateLinkedBlockCommand = z.infer<
	typeof createLinkedBlockCommandSchema
>;

export const previewLinkedBlockChangePayloadSchema = z.object({
	linkedBlockId: z.string().min(1),
	nextDefinition: wireframeLinkedBlockDefinitionSchema,
	projectId: z.string().min(1),
});

export const applyLinkedBlockChangeCommandSchema = z.object({
	actorId: z.string().min(1),
	idempotencyKey: z.string().min(1),
	origin: z.literal("human"),
	payload: previewLinkedBlockChangePayloadSchema,
	previewAcknowledged: z.boolean().optional(),
	previewFingerprint: z.string().min(1).optional(),
});

export type ApplyLinkedBlockChangeCommand = z.infer<
	typeof applyLinkedBlockChangeCommandSchema
>;

export const detachLinkedBlockCommandSchema = z.object({
	actorId: z.string().min(1),
	baseRevision: z.number().int().positive(),
	idempotencyKey: z.string().min(1),
	origin: z.literal("human"),
	payload: z.object({
		nodeId: z.string().min(1),
		screenId: z.string().min(1),
	}),
});

export type DetachLinkedBlockCommand = z.infer<
	typeof detachLinkedBlockCommandSchema
>;

export const linkedBlockViewSchema = z.object({
	definition: wireframeLinkedBlockDefinitionSchema,
	id: z.string().min(1),
	name: z.string(),
	projectId: z.string().min(1),
	revision: z.number().int().positive(),
});

export type LinkedBlockView = z.infer<typeof linkedBlockViewSchema>;

export const affectedScreenPreviewSchema = z.object({
	id: z.string().min(1),
	title: z.string(),
});

export type AffectedScreenPreview = z.infer<typeof affectedScreenPreviewSchema>;

export type LinkedBlockWriteOutcome =
	| { linkedBlock: LinkedBlockView; status: "committed" }
	| { linkedBlock: LinkedBlockView; status: "replayed" }
	| { conflict: string; status: "conflict" }
	| { reason: string; status: "rejected" };

export type LinkedBlockPreviewOutcome =
	| {
			affectedScreens: AffectedScreenPreview[];
			previewFingerprint: string;
			status: "ok";
	  }
	| { reason: string; status: "rejected" };

export type WireframeVersionDocumentView = WireframeVersionView & {
	document: z.infer<typeof wireframeDocumentSchema>;
	presentedNodes: {
		geometry: {
			height: number;
			width: number;
			x: number;
			y: number;
		};
		groupId?: string;
		id: string;
		kind: string;
		label?: string;
		linkedBlockId?: string;
		openHref: string | null;
		openSourceRecord: string;
		text?: {
			liveSourcePath: { documentId: string; sectionId: string } | null;
			status: "broken" | "ok";
			value: string;
		};
	}[];
};

export const WIREFRAME_EXPORT_FORMAT = {
	html: SCREENS_COPY.html,
	pdf: SCREENS_COPY.pdf,
	png: SCREENS_COPY.png,
	svg: SCREENS_COPY.svg,
} as const;

export type WireframeExportFormat =
	(typeof WIREFRAME_EXPORT_FORMAT)[keyof typeof WIREFRAME_EXPORT_FORMAT];

export const wireframePinSchema = z.object({
	screenId: z.string().min(1),
	versionNumber: z.number().int().positive(),
});

export type WireframePin = z.infer<typeof wireframePinSchema>;

export const openPresentationPayloadSchema = z.object({
	pins: z.array(wireframePinSchema).min(1),
	startScreenId: z.string().min(1),
});

export const exportWireframePayloadSchema = z.object({
	format: z.enum([
		WIREFRAME_EXPORT_FORMAT.html,
		WIREFRAME_EXPORT_FORMAT.pdf,
		WIREFRAME_EXPORT_FORMAT.png,
		WIREFRAME_EXPORT_FORMAT.svg,
	]),
	pins: z.array(wireframePinSchema).min(1),
	selectionNodeIds: z.array(z.string().min(1)).optional(),
	startScreenId: z.string().min(1),
});

export type ExportWireframePayload = z.infer<
	typeof exportWireframePayloadSchema
>;

export interface PresentationLinkView {
	nodeId: string;
	status: "ok" | "unresolved";
	targetScreenId: string;
}

export interface PresentationScreenView {
	document: z.infer<typeof wireframeDocumentSchema>;
	id: string;
	title: string;
	versionNumber: number;
}

export interface PresentationView {
	currentScreenId: string;
	currentVersionNumber: number;
	editing: false;
	links: PresentationLinkView[];
	mode: typeof SCREENS_COPY.presentationMode;
	screens: PresentationScreenView[];
	startScreenId: string;
	toolsHidden: true;
	unresolvedLabel: typeof SCREENS_COPY.unresolved;
	unresolvedTarget: boolean;
	writes: false;
}

export type PresentationOutcome =
	| ({ status: "ok" } & PresentationView)
	| { reason: string; status: "rejected" };

export type WireframeExportOutcome =
	| {
			bytes: Uint8Array;
			filename: string;
			format: WireframeExportFormat;
			html?: string;
			liveDocumentWritten: false;
			manifest: string;
			status: "ok";
	  }
	| { reason: string; status: "rejected" };

export const SCREEN_COUNTERPARTS = {
	personalViewportIsContent: false,
	personalViewportIsExport: false,
	personalViewportIsShareSnapshot: false,
} as const;

export const SCREEN_KEYBOARD = [
	"pan",
	"zoom",
	"select",
	"move",
	"align",
] as const;

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

const MEANINGLESS_PAD = 2000;
const MIN_ZOOM = 0.05;
const MAX_ZOOM = 8;

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
		screenId: z.string().min(1),
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

const outlineScreenPayloadSchema = z.object({
	screenId: z.string().min(1),
});

export const createOutlineNodePayloadSchema = outlineScreenPayloadSchema.extend(
	{
		kind: z.enum([
			"Button",
			"Card",
			"Chart",
			"Input",
			"Navigation",
			"Table",
			"Text",
		]),
		label: z.string().optional(),
	}
);

export const createOutlineNodeCommandSchema = z.object({
	actorId: z.string().min(1),
	baseRevision: z.number().int().positive(),
	idempotencyKey: z.string().min(1),
	origin: z.literal("human"),
	payload: createOutlineNodePayloadSchema,
});

export const reorderOutlinePayloadSchema = outlineScreenPayloadSchema.extend({
	nodeIds: z.array(z.string().min(1)).min(1),
});

export const reorderOutlineCommandSchema = z.object({
	actorId: z.string().min(1),
	baseRevision: z.number().int().positive(),
	idempotencyKey: z.string().min(1),
	origin: z.literal("human"),
	payload: reorderOutlinePayloadSchema,
});

export const groupOutlinePayloadSchema = outlineScreenPayloadSchema.extend({
	nodeIds: z.array(z.string().min(1)).min(1),
	title: z.string().min(1).optional(),
});

export const groupOutlineCommandSchema = z.object({
	actorId: z.string().min(1),
	baseRevision: z.number().int().positive(),
	idempotencyKey: z.string().min(1),
	origin: z.literal("human"),
	payload: groupOutlinePayloadSchema,
});

export const bindOutlinePayloadSchema = outlineScreenPayloadSchema.extend({
	linkedBlockId: z.string().min(1),
	nodeId: z.string().min(1),
});

export const bindOutlineCommandSchema = z.object({
	actorId: z.string().min(1),
	baseRevision: z.number().int().positive(),
	idempotencyKey: z.string().min(1),
	origin: z.literal("human"),
	payload: bindOutlinePayloadSchema,
});

export interface ViewportRestoreSession {
	inspectorOpen?: boolean;
	selectedId?: string | null;
	unsaved?: boolean;
}

export interface ViewportContent {
	groups: readonly { id: string }[];
	nodes: readonly {
		geometry: { height: number; width: number; x: number; y: number };
		groupId?: string;
		id: string;
	}[];
}

export interface RestoredPersonalViewport {
	fitted: boolean;
	inspectorOpen: false;
	selectedId: null;
	unsaved: false;
	viewport: PersonalViewport;
}

export function documentOpenHref(projectId: string): string {
	return `/projects/${projectId}#documents`;
}

export function panPersonalViewport(
	viewport: PersonalViewport,
	deltaX: number,
	deltaY: number
): PersonalViewport {
	return {
		...viewport,
		centerX: viewport.centerX + deltaX,
		centerY: viewport.centerY + deltaY,
	};
}

export function zoomPersonalViewport(
	viewport: PersonalViewport,
	factor: number
): PersonalViewport {
	return {
		...viewport,
		zoom: Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, viewport.zoom * factor)),
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
	const minX = Math.min(...content.nodes.map((node) => node.geometry.x));
	const maxX = Math.max(
		...content.nodes.map((node) => node.geometry.x + node.geometry.width)
	);
	const minY = Math.min(...content.nodes.map((node) => node.geometry.y));
	const maxY = Math.max(
		...content.nodes.map((node) => node.geometry.y + node.geometry.height)
	);
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
	const minX =
		Math.min(...content.nodes.map((node) => node.geometry.x)) - MEANINGLESS_PAD;
	const maxX =
		Math.max(
			...content.nodes.map((node) => node.geometry.x + node.geometry.width)
		) + MEANINGLESS_PAD;
	const minY =
		Math.min(...content.nodes.map((node) => node.geometry.y)) - MEANINGLESS_PAD;
	const maxY =
		Math.max(
			...content.nodes.map((node) => node.geometry.y + node.geometry.height)
		) + MEANINGLESS_PAD;
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

export function wireframeShareSnapshot(screen: ScreenView): {
	id: string;
	title: string;
	versions: ScreenView["versions"];
} {
	return {
		id: screen.id,
		title: screen.title,
		versions: screen.versions,
	};
}

export function wireframeExportInput(screen: ScreenView): {
	id: string;
	title: string;
	versions: ScreenView["versions"];
} {
	return wireframeShareSnapshot(screen);
}

export function evaluateWireframeCanvasScene(scene: {
	visibleItems: number;
	visualLinks: number;
}): {
	corrupted: boolean;
	crashed: false;
	detail: "full" | "reduced";
} {
	const itemCount = Math.max(0, Math.floor(scene.visibleItems));
	const linkCount = Math.max(0, Math.floor(scene.visualLinks));
	const items = Array.from({ length: itemCount }, (_, index) => ({
		height: 40,
		width: 120,
		x: (index % 25) * 140,
		y: Math.floor(index / 25) * 60,
	}));
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
