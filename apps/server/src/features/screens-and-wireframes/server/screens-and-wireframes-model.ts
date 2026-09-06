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
	archive: "Archive",
	archived: "Archived",
	broken: "Broken",
	button: "Button",
	card: "Card",
	chart: "Chart",
	createScreen: "Create Screen",
	deletePermanently: "Permanently Delete",
	detachLink: "Detach Link",
	includeArchived: "Include archived",
	input: "Input",
	inTrash: "In Trash",
	liveSource: "Live source",
	moveToTrash: "Move to Trash",
	navigation: "Navigation",
	noScreens: "No Screens yet.",
	restore: "Restore",
	screen: "Screen",
	table: "Table",
	text: "Text",
	title: "Title",
	titleRequired: "Title is required.",
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
		id: string;
		kind: string;
		label?: string;
		linkedBlockId?: string;
		text?: {
			liveSourcePath: { documentId: string; sectionId: string } | null;
			status: "broken" | "ok";
			value: string;
		};
	}[];
};
