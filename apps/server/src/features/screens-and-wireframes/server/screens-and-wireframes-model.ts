import { z } from "zod";

export const SCREENS_COPY = {
	active: "Active",
	archive: "Archive",
	archived: "Archived",
	createScreen: "Create Screen",
	deletePermanently: "Delete permanently",
	includeArchived: "Include archived",
	inTrash: "In Trash",
	moveToTrash: "Move to Trash",
	noScreens: "No Screens yet.",
	restore: "Restore",
	screen: "Screen",
	title: "Title",
	unarchive: "Unarchive",
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

export const WIREFRAME_DOCUMENT_SCHEMA = "WireframeDocument" as const;

export const emptyWireframeDocumentSchema = z.object({
	nodes: z.array(z.unknown()),
	schema: z.literal(WIREFRAME_DOCUMENT_SCHEMA),
	schemaVersion: z.literal(1),
});

export type EmptyWireframeDocument = z.infer<
	typeof emptyWireframeDocumentSchema
>;

export const EMPTY_WIREFRAME_DOCUMENT: EmptyWireframeDocument = {
	nodes: [],
	schema: WIREFRAME_DOCUMENT_SCHEMA,
	schemaVersion: 1,
};

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
