import { z } from "zod";

export const MOODBOARDS_COPY = {
	addVisual: "Add visual",
	caption: "Caption",
	collapseGroup: "Collapse",
	createMoodboard: "Create Moodboard",
	expandGroup: "Expand",
	externalLink: "External link",
	fileAttachment: "File Attachment",
	fitView: "Fit View",
	group: "Group",
	inspect: "Inspect",
	moodboard: "Moodboard",
	moveDown: "Move down",
	moveUp: "Move up",
	noMoodboards: "No Moodboards yet.",
	openSourceRecord: "Open Source Record",
	outline: "Outline",
	title: "Title",
} as const;

export const MOODBOARD_KIND = MOODBOARDS_COPY.moodboard;

export const VISUAL_ORIGIN_KIND = {
	externalLink: MOODBOARDS_COPY.externalLink,
	fileAttachment: MOODBOARDS_COPY.fileAttachment,
} as const;

export const MOODBOARD_COUNTERPARTS = {
	autoCreateProjectWallCard: false,
	captionIsCommentThread: false,
	captionIsFileDescription: false,
	captionIsMention: false,
	captionIsReaction: false,
	captionIsTask: false,
	designSystem: false,
	personalViewportIsContent: false,
	personalViewportIsExport: false,
	personalViewportIsShareSnapshot: false,
	productionAsset: false,
	screen: false,
	userFlow: false,
	wireframe: false,
} as const;

export const MOODBOARD_FOREIGN_IDENTITIES = [
	"Screen",
	"production asset",
	"User Flow",
	"Wireframe",
] as const;

const captionSchema = z.string().max(280);

const fileAttachmentOriginSchema = z
	.object({
		fileAttachmentVersionId: z.string().min(1),
		kind: z.literal(VISUAL_ORIGIN_KIND.fileAttachment),
	})
	.strict();

const externalLinkOriginSchema = z
	.object({
		kind: z.literal(VISUAL_ORIGIN_KIND.externalLink),
		url: z
			.string()
			.url()
			.refine(
				(value) => value.startsWith("http://") || value.startsWith("https://"),
				{ message: "url" }
			),
	})
	.strict();

export const visualOriginInputSchema = z.discriminatedUnion("kind", [
	fileAttachmentOriginSchema,
	externalLinkOriginSchema,
]);

export const visualOriginViewSchema = z.discriminatedUnion("kind", [
	z.object({
		fileAttachmentId: z.string().min(1),
		fileAttachmentVersionId: z.string().min(1),
		kind: z.literal(VISUAL_ORIGIN_KIND.fileAttachment),
		title: z.string(),
	}),
	z.object({
		kind: z.literal(VISUAL_ORIGIN_KIND.externalLink),
		url: z.string().min(1),
	}),
]);

export const moodboardVisualViewSchema = z.object({
	caption: z.string(),
	groupId: z.string().min(1).nullable(),
	id: z.string().min(1),
	openHref: z.string().min(1).nullable(),
	openSourceRecord: z.literal(MOODBOARDS_COPY.openSourceRecord),
	origin: visualOriginViewSchema,
});

export type MoodboardVisualView = z.infer<typeof moodboardVisualViewSchema>;

export const moodboardGroupViewSchema = z.object({
	id: z.string().min(1),
	sortOrder: z.number().int(),
	title: z.string(),
	visualIds: z.array(z.string().min(1)),
});

export const moodboardViewSchema = z.object({
	groups: z.array(moodboardGroupViewSchema),
	id: z.string().min(1),
	projectId: z.string().min(1),
	recordKind: z.literal(MOODBOARD_KIND),
	revision: z.number().int().positive(),
	title: z.string(),
	visuals: z.array(moodboardVisualViewSchema),
});

export type MoodboardView = z.infer<typeof moodboardViewSchema>;

export const createMoodboardPayloadSchema = z
	.object({
		projectId: z.string().min(1),
		title: z.string().min(1),
	})
	.strict();

export const createMoodboardCommandSchema = z.object({
	actorId: z.string().min(1),
	idempotencyKey: z.string().min(1),
	origin: z.literal("human"),
	payload: createMoodboardPayloadSchema,
});

export type CreateMoodboardCommand = z.infer<
	typeof createMoodboardCommandSchema
>;

export const addMoodboardVisualPayloadSchema = z
	.object({
		caption: captionSchema.optional(),
		moodboardId: z.string().min(1),
		origin: visualOriginInputSchema,
	})
	.strict();

export const addMoodboardVisualCommandSchema = z.object({
	actorId: z.string().min(1),
	idempotencyKey: z.string().min(1),
	origin: z.literal("human"),
	payload: addMoodboardVisualPayloadSchema,
});

export type AddMoodboardVisualCommand = z.infer<
	typeof addMoodboardVisualCommandSchema
>;

export const setMoodboardCaptionPayloadSchema = z
	.object({
		caption: captionSchema,
		visualId: z.string().min(1),
	})
	.strict();

export const setMoodboardCaptionCommandSchema = z.object({
	actorId: z.string().min(1),
	baseRevision: z.number().int().nonnegative(),
	idempotencyKey: z.string().min(1),
	origin: z.literal("human"),
	payload: setMoodboardCaptionPayloadSchema,
});

export type SetMoodboardCaptionCommand = z.infer<
	typeof setMoodboardCaptionCommandSchema
>;

export const moodboardWriteOutcomeSchema = z.discriminatedUnion("status", [
	z.object({
		moodboard: moodboardViewSchema,
		status: z.literal("committed"),
	}),
	z.object({
		moodboard: moodboardViewSchema,
		status: z.literal("replayed"),
	}),
	z.object({
		conflict: z.literal("Conflict"),
		status: z.literal("conflict"),
	}),
	z.object({
		reason: z.enum([
			"invalid-command",
			"moodboard-not-found",
			"file-attachment-not-found",
			"visual-not-found",
			"visuals-not-found",
		]),
		status: z.literal("rejected"),
	}),
]);

export type MoodboardWriteOutcome = z.infer<typeof moodboardWriteOutcomeSchema>;

export function moodboardsCatalog() {
	return {
		copy: MOODBOARDS_COPY,
		counterparts: MOODBOARD_COUNTERPARTS,
		foreignIdentities: MOODBOARD_FOREIGN_IDENTITIES,
		kind: MOODBOARD_KIND,
		originKinds: [
			VISUAL_ORIGIN_KIND.fileAttachment,
			VISUAL_ORIGIN_KIND.externalLink,
		],
	};
}

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

const VISUAL_TILE = 160;
const VISUAL_GAP = 40;
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
		moodboardId: z.string().min(1),
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
		moodboardId: z.string().min(1),
		title: z.string().min(1).optional(),
		visualIds: z.array(z.string().min(1)).min(1),
	})
	.strict();

export const groupOutlineCommandSchema = z.object({
	actorId: z.string().min(1),
	idempotencyKey: z.string().min(1),
	origin: z.literal("human"),
	payload: groupOutlinePayloadSchema,
});

export type GroupOutlineCommand = z.infer<typeof groupOutlineCommandSchema>;

export const reorderOutlinePayloadSchema = z
	.object({
		moodboardId: z.string().min(1),
		visualIds: z.array(z.string().min(1)).min(1),
	})
	.strict();

export const reorderOutlineCommandSchema = z.object({
	actorId: z.string().min(1),
	idempotencyKey: z.string().min(1),
	origin: z.literal("human"),
	payload: reorderOutlinePayloadSchema,
});

export type ReorderOutlineCommand = z.infer<typeof reorderOutlineCommandSchema>;

export interface ViewportRestoreSession {
	inspectorOpen?: boolean;
	selectedId?: string | null;
	unsaved?: boolean;
}

export interface ViewportContent {
	groups: readonly { id: string }[];
	visuals: readonly { groupId: string | null; id: string }[];
}

export interface RestoredPersonalViewport {
	fitted: boolean;
	inspectorOpen: false;
	selectedId: null;
	unsaved: false;
	viewport: PersonalViewport;
}

export function fileAttachmentOpenHref(
	projectId: string,
	_fileAttachmentId: string
): string {
	return `/projects/${projectId}#file-attachment`;
}

export function visualFrame(index: number): {
	height: number;
	width: number;
	x: number;
	y: number;
} {
	return {
		height: VISUAL_TILE,
		width: VISUAL_TILE,
		x: index * (VISUAL_TILE + VISUAL_GAP),
		y: 0,
	};
}

export function fitViewportToContent(
	content: ViewportContent
): PersonalViewport {
	if (content.visuals.length === 0) {
		return {
			centerX: NEUTRAL_VIEWPORT.centerX,
			centerY: NEUTRAL_VIEWPORT.centerY,
			collapsedGroupIds: [],
			zoom: NEUTRAL_VIEWPORT.zoom,
		};
	}
	const frames = content.visuals.map((_, index) => visualFrame(index));
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
	if (content.visuals.length === 0) {
		return (
			saved.centerX === NEUTRAL_VIEWPORT.centerX &&
			saved.centerY === NEUTRAL_VIEWPORT.centerY
		);
	}
	const frames = content.visuals.map((_, index) => visualFrame(index));
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

export function moodboardShareSnapshot(moodboard: MoodboardView): {
	groups: MoodboardView["groups"];
	id: string;
	title: string;
	visuals: MoodboardView["visuals"];
} {
	return {
		groups: moodboard.groups,
		id: moodboard.id,
		title: moodboard.title,
		visuals: moodboard.visuals,
	};
}

export function moodboardExportInput(moodboard: MoodboardView): {
	groups: MoodboardView["groups"];
	id: string;
	title: string;
	visuals: MoodboardView["visuals"];
} {
	return moodboardShareSnapshot(moodboard);
}

export function evaluateMoodboardCanvasScene(scene: {
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
		visualFrame(index)
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
