import { z } from "zod";

export const PROJECT_WALL_COPY = {
	compact: "Compact",
	createProjectWall: "Create Project Wall",
	detailed: "Detailed",
	name: "Name",
	noProjectWall: "No Project Wall yet.",
	openSourceRecord: "Open Source Record",
	placeLiveCard: "Place live card",
	preview: "Preview",
	projectWall: "Project Wall",
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
	work: "Work",
} as const;

export const PROJECT_WALL_REJECTION = {
	duplicateSource: "duplicate-source",
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
	density: densitySchema.optional(),
	positionX: z.number().optional(),
	positionY: z.number().optional(),
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

export type LiveCardFieldMap = Partial<
	Record<(typeof PROJECT_WALL_FIELD)[keyof typeof PROJECT_WALL_FIELD], string>
>;

export interface ProjectWallCardView {
	density: ProjectWallDensity;
	fields: LiveCardFieldMap;
	id: string;
	openSourceRecord: typeof PROJECT_WALL_COPY.openSourceRecord;
	positionX: number;
	positionY: number;
	sourceId: string;
	sourceKind: typeof PROJECT_WALL_SOURCE_KIND.work;
}

export interface ProjectWallView {
	cards: ProjectWallCardView[];
	id: string;
	name: string;
	projectId: string;
	recordKind: typeof DESIGN_TYPE_PROJECT_WALL;
	revision: number;
	type: typeof DESIGN_TYPE_PROJECT_WALL;
}

export type ProjectWallWriteOutcome =
	| { status: "committed"; wall: ProjectWallView }
	| { status: "replayed"; wall: ProjectWallView }
	| { conflict: "Conflict"; status: "conflict" }
	| { reason: ProjectWallRejectionReason; status: "rejected" };

export function projectWallCatalog() {
	return {
		copy: PROJECT_WALL_COPY,
		counterparts: {
			moodboard: false,
			nestedWall: false,
			perCardCss: false,
			wallOnlyFile: false,
			wallOnlyNote: false,
			wallOnlyTask: false,
			wikiPage: false,
			wireframe: false,
			workspaceWall: false,
		},
		densities: PROJECT_WALL_DENSITIES,
		densityFields: DENSITY_FIELDS,
		sourceKinds: [PROJECT_WALL_SOURCE_KIND.work],
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
