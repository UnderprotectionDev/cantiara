import { z } from "zod";

export const PROJECT_WALL_COPY = {
	compact: "Compact",
	createProjectWall: "Create Project Wall",
	detailed: "Detailed",
	exact: "Exact",
	exitPresentationMode: "Exit Presentation Mode",
	focusOrder: "Focus order",
	frozenCopy: "Frozen copy",
	live: "Live",
	name: "Name",
	noProjectWall: "No Project Wall yet.",
	noShareGrant: "This output does not grant share access.",
	openAllInSource: "Open all in source",
	openSourceRecord: "Open Source Record",
	pdf: "PDF",
	placeLiveCard: "Place live card",
	png: "PNG",
	presentationMode: "Presentation Mode",
	preview: "Preview",
	projectWall: "Project Wall",
	sharedSource: "Shared source",
	snapshot: "Snapshot",
} as const;

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
	nestedWall: "nested-wall",
	sourceNotFound: "source-not-found",
	unknownDensity: "unknown-density",
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
	id: string;
	members?: ProjectWallMemberPreview[];
	nodeEditing?: boolean;
	openAllInSource?: typeof PROJECT_WALL_COPY.openAllInSource;
	openSourceRecord: typeof PROJECT_WALL_COPY.openSourceRecord;
	ownQuery?: boolean;
	positionX: number;
	positionY: number;
	sourceId: string;
	sourceKind: ProjectWallSourceKind;
}

export interface ProjectWallView {
	cards: ProjectWallCardView[];
	focusOrder: string[];
	id: string;
	name: string;
	projectId: string;
	recordKind: typeof DESIGN_TYPE_PROJECT_WALL;
	revision: number;
	type: typeof DESIGN_TYPE_PROJECT_WALL;
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
			moodboard: false,
			nestedWall: false,
			perCardCss: false,
			shareGrant: false,
			wallOnlyFile: false,
			wallOnlyNote: false,
			wallOnlyTask: false,
			wikiPage: false,
			wireframe: false,
			workspaceWall: false,
		},
		densities: PROJECT_WALL_DENSITIES,
		densityFields: DENSITY_FIELDS,
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
