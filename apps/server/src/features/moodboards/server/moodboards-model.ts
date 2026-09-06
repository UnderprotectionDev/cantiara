import { z } from "zod";

export const MOODBOARDS_COPY = {
	addColorSwatch: "Add Color Swatch",
	addPaletteGroup: "Add palette group",
	addVisual: "Add visual",
	caption: "Caption",
	collapseGroup: "Collapse",
	colorSwatch: "Color Swatch",
	createMoodboard: "Create Moodboard",
	crop: "Crop",
	exitPresentationMode: "Exit Presentation Mode",
	expandGroup: "Expand",
	externalLink: "External link",
	eyedrop: "Eyedrop",
	fileAttachment: "File Attachment",
	fitView: "Fit View",
	focusOrder: "Focus order",
	group: "Group",
	hex: "HEX",
	hsl: "HSL",
	inspect: "Inspect",
	moodboard: "Moodboard",
	moveDown: "Move down",
	moveUp: "Move up",
	noLiveSourceLinks: "Output carries no live source links.",
	noMoodboards: "No Moodboards yet.",
	note: "Note",
	openSourceRecord: "Open Source Record",
	outline: "Outline",
	paletteGroup: "Palette group",
	pdf: "PDF",
	picker: "Picker",
	png: "PNG",
	presentationMode: "Presentation Mode",
	preview: "Preview",
	rgb: "RGB",
	rotate: "Rotate 90°",
	snapshot: "Snapshot",
	title: "Title",
} as const;

export const MOODBOARD_KIND = MOODBOARDS_COPY.moodboard;

export const VISUAL_ORIGIN_KIND = {
	externalLink: MOODBOARDS_COPY.externalLink,
	fileAttachment: MOODBOARDS_COPY.fileAttachment,
} as const;

export const COLOR_SOURCE_KIND = {
	eyedrop: MOODBOARDS_COPY.eyedrop,
	hex: MOODBOARDS_COPY.hex,
	hsl: MOODBOARDS_COPY.hsl,
	picker: MOODBOARDS_COPY.picker,
	rgb: MOODBOARDS_COPY.rgb,
} as const;

export const MOODBOARD_SNAPSHOT_FORMAT = {
	pdf: MOODBOARDS_COPY.pdf,
	png: MOODBOARDS_COPY.png,
} as const;

export const MOODBOARD_ROTATIONS = [0, 90, 180, 270] as const;

export const MOODBOARD_COUNTERPARTS = {
	appliesColorToProductUi: false,
	approvedSnapshotRevision: false,
	autoColorSuggestion: false,
	autoCreateProjectWallCard: false,
	brandGuide: false,
	buildInPublic: false,
	captionIsCommentThread: false,
	captionIsFileDescription: false,
	captionIsMention: false,
	captionIsReaction: false,
	captionIsTask: false,
	contentCopy: false,
	designSystem: false,
	externalSurface: false,
	liveSourceLinks: false,
	personalViewportIsContent: false,
	personalViewportIsExport: false,
	personalViewportIsShareSnapshot: false,
	productionAsset: false,
	screen: false,
	shareLink: false,
	smashEntireBoard: false,
	stockImageSearch: false,
	userFlow: false,
	wireframe: false,
	writesAccountTheme: false,
	writesCompletionEffect: false,
	writesCustomCss: false,
	writesPersistentCustomField: false,
	writesProductionToken: false,
	writesProjectWallCardHighlight: false,
} as const;

export const MOODBOARD_FOREIGN_IDENTITIES = [
	"Screen",
	"production asset",
	"User Flow",
	"Wireframe",
] as const;

export const MOODBOARD_PRESENTATION_WRITES = {
	approvedSnapshotRevision: false,
	brandGuide: false,
	buildInPublic: false,
	contentCopy: false,
	externalSurface: false,
	shareLink: false,
} as const;

const captionSchema = z.string().max(280);
const noteSchema = z.string().max(280);
const hexSchema = z
	.string()
	.regex(/^#[0-9A-Fa-f]{6}$/)
	.transform((value) => value.toUpperCase());

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

const unit = z.number().min(0).max(1);

export const cropBoxSchema = z
	.object({
		height: unit,
		left: unit,
		top: unit,
		width: unit,
	})
	.strict()
	.refine(
		(box) =>
			box.width > 0 &&
			box.height > 0 &&
			box.left + box.width <= 1 &&
			box.top + box.height <= 1,
		{ message: "crop" }
	);

export const visualPresentationViewSchema = z.object({
	crop: cropBoxSchema.nullable(),
	fileAttachmentVersionId: z.string().min(1).nullable(),
	originalDownloadable: z.boolean(),
	rotation: z.union([
		z.literal(0),
		z.literal(90),
		z.literal(180),
		z.literal(270),
	]),
});

export type VisualPresentationView = z.infer<
	typeof visualPresentationViewSchema
>;

export const moodboardVisualViewSchema = z.object({
	caption: z.string(),
	groupId: z.string().min(1).nullable(),
	id: z.string().min(1),
	openHref: z.string().min(1).nullable(),
	openSourceRecord: z.literal(MOODBOARDS_COPY.openSourceRecord),
	origin: visualOriginViewSchema,
	presentation: visualPresentationViewSchema,
});

export type MoodboardVisualView = z.infer<typeof moodboardVisualViewSchema>;

export const moodboardGroupViewSchema = z.object({
	id: z.string().min(1),
	sortOrder: z.number().int(),
	title: z.string(),
	visualIds: z.array(z.string().min(1)),
});

const rgbChannelSchema = z.number().int().min(0).max(255);
const hueSchema = z.number().int().min(0).max(360);
const percentSchema = z.number().int().min(0).max(100);

export const colorInputSchema = z.discriminatedUnion("kind", [
	z
		.object({
			hex: hexSchema,
			kind: z.literal(COLOR_SOURCE_KIND.picker),
		})
		.strict(),
	z
		.object({
			hex: hexSchema,
			kind: z.literal(COLOR_SOURCE_KIND.hex),
		})
		.strict(),
	z
		.object({
			b: rgbChannelSchema,
			g: rgbChannelSchema,
			kind: z.literal(COLOR_SOURCE_KIND.rgb),
			r: rgbChannelSchema,
		})
		.strict(),
	z
		.object({
			h: hueSchema,
			kind: z.literal(COLOR_SOURCE_KIND.hsl),
			l: percentSchema,
			s: percentSchema,
		})
		.strict(),
	z
		.object({
			hex: hexSchema,
			kind: z.literal(COLOR_SOURCE_KIND.eyedrop),
			visualId: z.string().min(1),
		})
		.strict(),
]);

export type ColorInput = z.infer<typeof colorInputSchema>;

const colorSwatchSourceViewSchema = z.discriminatedUnion("kind", [
	z.object({ kind: z.literal(COLOR_SOURCE_KIND.picker) }),
	z.object({ kind: z.literal(COLOR_SOURCE_KIND.hex) }),
	z.object({ kind: z.literal(COLOR_SOURCE_KIND.rgb) }),
	z.object({ kind: z.literal(COLOR_SOURCE_KIND.hsl) }),
	z.object({
		kind: z.literal(COLOR_SOURCE_KIND.eyedrop),
		visualId: z.string().min(1),
	}),
]);

export const colorSwatchViewSchema = z.object({
	hex: z.string(),
	hsl: z.object({
		h: z.number().int(),
		l: z.number().int(),
		s: z.number().int(),
	}),
	id: z.string().min(1),
	note: z.string(),
	paletteGroupId: z.string().nullable(),
	rgb: z.object({
		b: z.number().int(),
		g: z.number().int(),
		r: z.number().int(),
	}),
	source: colorSwatchSourceViewSchema,
});

export type ColorSwatchView = z.infer<typeof colorSwatchViewSchema>;

export const paletteGroupViewSchema = z.object({
	colorSwatches: z.array(colorSwatchViewSchema),
	id: z.string().min(1),
	title: z.string(),
});

export type PaletteGroupView = z.infer<typeof paletteGroupViewSchema>;

export const moodboardViewSchema = z.object({
	colorSwatches: z.array(colorSwatchViewSchema),
	focusOrder: z.array(z.string().min(1)),
	groups: z.array(moodboardGroupViewSchema),
	id: z.string().min(1),
	paletteGroups: z.array(paletteGroupViewSchema),
	projectId: z.string().min(1),
	recordKind: z.literal(MOODBOARD_KIND),
	revision: z.number().int().positive(),
	title: z.string(),
	visuals: z.array(moodboardVisualViewSchema),
});

export type MoodboardView = z.infer<typeof moodboardViewSchema>;

export const moodboardPresentationModeViewSchema = z.object({
	contentCopy: z.literal(false),
	editingHidden: z.literal(true),
	focusOrder: z.array(z.string().min(1)),
	mode: z.literal(MOODBOARDS_COPY.presentationMode),
	moodboardId: z.string().min(1),
	toolsHidden: z.literal(true),
	writes: z.object({
		approvedSnapshotRevision: z.literal(false),
		brandGuide: z.literal(false),
		buildInPublic: z.literal(false),
		contentCopy: z.literal(false),
		externalSurface: z.literal(false),
		shareLink: z.literal(false),
	}),
});

export type MoodboardPresentationModeView = z.infer<
	typeof moodboardPresentationModeViewSchema
>;

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

export const addColorSwatchPayloadSchema = z
	.object({
		color: colorInputSchema,
		moodboardId: z.string().min(1),
		note: noteSchema.optional(),
		paletteGroupId: z.string().min(1).optional(),
	})
	.strict();

export const addColorSwatchCommandSchema = z.object({
	actorId: z.string().min(1),
	idempotencyKey: z.string().min(1),
	origin: z.literal("human"),
	payload: addColorSwatchPayloadSchema,
});

export type AddColorSwatchCommand = z.infer<typeof addColorSwatchCommandSchema>;

export const addPaletteGroupPayloadSchema = z
	.object({
		moodboardId: z.string().min(1),
		title: z.string().min(1),
	})
	.strict();

export const addPaletteGroupCommandSchema = z.object({
	actorId: z.string().min(1),
	idempotencyKey: z.string().min(1),
	origin: z.literal("human"),
	payload: addPaletteGroupPayloadSchema,
});

export type AddPaletteGroupCommand = z.infer<
	typeof addPaletteGroupCommandSchema
>;

export const setMoodboardViewTransformPayloadSchema = z
	.object({
		crop: cropBoxSchema.nullable(),
		rotation: z.union([
			z.literal(0),
			z.literal(90),
			z.literal(180),
			z.literal(270),
		]),
		visualId: z.string().min(1),
	})
	.strict();

export const setMoodboardViewTransformCommandSchema = z.object({
	actorId: z.string().min(1),
	baseRevision: z.number().int().nonnegative(),
	idempotencyKey: z.string().min(1),
	origin: z.literal("human"),
	payload: setMoodboardViewTransformPayloadSchema,
});

export type SetMoodboardViewTransformCommand = z.infer<
	typeof setMoodboardViewTransformCommandSchema
>;

export const setMoodboardFocusOrderPayloadSchema = z
	.object({
		moodboardId: z.string().min(1),
		visualIds: z.array(z.string().min(1)),
	})
	.strict();

export const setMoodboardFocusOrderCommandSchema = z.object({
	actorId: z.string().min(1),
	baseRevision: z.number().int().nonnegative(),
	idempotencyKey: z.string().min(1),
	origin: z.literal("human"),
	payload: setMoodboardFocusOrderPayloadSchema,
});

export type SetMoodboardFocusOrderCommand = z.infer<
	typeof setMoodboardFocusOrderCommandSchema
>;

export const moodboardSnapshotScopeSchema = z
	.object({
		fitEntireBoardOnOnePage: z.literal(true).optional(),
		format: z.enum([
			MOODBOARD_SNAPSHOT_FORMAT.png,
			MOODBOARD_SNAPSHOT_FORMAT.pdf,
		]),
		moodboardId: z.string().min(1),
		visualIds: z.array(z.string().min(1)).min(1),
	})
	.strict();

export type MoodboardSnapshotScope = z.infer<
	typeof moodboardSnapshotScopeSchema
>;

export const moodboardSnapshotPreviewSchema = z.object({
	applied: z.array(
		z.object({
			crop: cropBoxSchema.nullable(),
			fileAttachmentVersionId: z.string().min(1).nullable(),
			rotation: z.union([
				z.literal(0),
				z.literal(90),
				z.literal(180),
				z.literal(270),
			]),
			visualId: z.string().min(1),
		})
	),
	format: z.enum([
		MOODBOARD_SNAPSHOT_FORMAT.png,
		MOODBOARD_SNAPSHOT_FORMAT.pdf,
	]),
	liveSourceLinks: z.literal(false),
	noLiveSourceLinks: z.literal(MOODBOARDS_COPY.noLiveSourceLinks),
	viewMoment: z.string().min(1),
});

export type MoodboardSnapshotPreview = z.infer<
	typeof moodboardSnapshotPreviewSchema
>;

export const moodboardSnapshotFileSchema = z.object({
	bytes: z.instanceof(Uint8Array),
	filename: z.string().min(1),
	mimeType: z.string().min(1),
	pageCount: z.number().int().positive(),
	visualId: z.string().min(1).nullable(),
});

export const moodboardSnapshotViewSchema = z.object({
	approvedSnapshotRevision: z.literal(false),
	brandGuide: z.literal(false),
	externalSurface: z.literal(false),
	files: z.array(moodboardSnapshotFileSchema),
	liveSourceLinks: z.literal(false),
	preview: moodboardSnapshotPreviewSchema,
	shareLink: z.literal(false),
	sourceMutation: z.literal(false),
});

export type MoodboardSnapshotView = z.infer<typeof moodboardSnapshotViewSchema>;

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
			"palette-group-not-found",
			"smash-entire-board",
			"focus-order-mismatch",
		]),
		status: z.literal("rejected"),
	}),
]);

export type MoodboardWriteOutcome = z.infer<typeof moodboardWriteOutcomeSchema>;

export const moodboardSnapshotOutcomeSchema = z.discriminatedUnion("status", [
	z.object({
		snapshot: moodboardSnapshotViewSchema,
		status: z.literal("ok"),
	}),
	z.object({
		reason: z.enum([
			"invalid-command",
			"moodboard-not-found",
			"visual-not-found",
			"smash-entire-board",
		]),
		status: z.literal("rejected"),
	}),
]);

export type MoodboardSnapshotOutcome = z.infer<
	typeof moodboardSnapshotOutcomeSchema
>;

export interface PresentedColor {
	hex: string;
	hsl: { h: number; l: number; s: number };
	rgb: { b: number; g: number; r: number };
}

export function presentedColorFromInput(color: ColorInput): PresentedColor {
	if (color.kind === COLOR_SOURCE_KIND.rgb) {
		return presentedColorFromRgb(color.r, color.g, color.b);
	}
	if (color.kind === COLOR_SOURCE_KIND.hsl) {
		return presentedColorFromRgb(...hslToRgbTuple(color.h, color.s, color.l));
	}
	return presentedColorFromHex(color.hex);
}

export function presentedColorFromHex(hex: string): PresentedColor {
	const normalized = hex.toUpperCase();
	const rgb = hexToRgb(normalized);
	return {
		hex: normalized,
		hsl: rgbToHsl(rgb.r, rgb.g, rgb.b),
		rgb,
	};
}

function presentedColorFromRgb(
	r: number,
	g: number,
	b: number
): PresentedColor {
	return {
		hex: rgbToHex(r, g, b),
		hsl: rgbToHsl(r, g, b),
		rgb: { b, g, r },
	};
}

function hexToRgb(hex: string): { b: number; g: number; r: number } {
	const digits = hex.slice(1);
	return {
		b: Number.parseInt(digits.slice(4, 6), 16),
		g: Number.parseInt(digits.slice(2, 4), 16),
		r: Number.parseInt(digits.slice(0, 2), 16),
	};
}

function rgbToHex(r: number, g: number, b: number): string {
	return `#${[r, g, b]
		.map((channel) => channel.toString(16).padStart(2, "0"))
		.join("")
		.toUpperCase()}`;
}

function rgbToHsl(
	r: number,
	g: number,
	b: number
): { h: number; l: number; s: number } {
	const red = r / 255;
	const green = g / 255;
	const blue = b / 255;
	const max = Math.max(red, green, blue);
	const min = Math.min(red, green, blue);
	const lightness = (max + min) / 2;
	if (max === min) {
		return { h: 0, l: Math.round(lightness * 100), s: 0 };
	}
	const delta = max - min;
	const saturation =
		lightness > 0.5 ? delta / (2 - max - min) : delta / (max + min);
	let hue = 0;
	if (max === red) {
		hue = ((green - blue) / delta + (green < blue ? 6 : 0)) / 6;
	} else if (max === green) {
		hue = ((blue - red) / delta + 2) / 6;
	} else {
		hue = ((red - green) / delta + 4) / 6;
	}
	return {
		h: Math.round(hue * 360),
		l: Math.round(lightness * 100),
		s: Math.round(saturation * 100),
	};
}

function hslToRgbTuple(
	hue: number,
	saturation: number,
	lightness: number
): [number, number, number] {
	const h = (((hue % 360) + 360) % 360) / 360;
	const s = saturation / 100;
	const l = lightness / 100;
	if (s === 0) {
		const value = Math.round(l * 255);
		return [value, value, value];
	}
	const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
	const p = 2 * l - q;
	return [
		Math.round(hueToChannel(p, q, h + 1 / 3) * 255),
		Math.round(hueToChannel(p, q, h) * 255),
		Math.round(hueToChannel(p, q, h - 1 / 3) * 255),
	];
}

function hueToChannel(p: number, q: number, t: number): number {
	let tone = t;
	if (tone < 0) {
		tone += 1;
	}
	if (tone > 1) {
		tone -= 1;
	}
	if (tone < 1 / 6) {
		return p + (q - p) * 6 * tone;
	}
	if (tone < 1 / 2) {
		return q;
	}
	if (tone < 2 / 3) {
		return p + (q - p) * (2 / 3 - tone) * 6;
	}
	return p;
}

export function moodboardsCatalog() {
	return {
		colorInputKinds: [
			COLOR_SOURCE_KIND.picker,
			COLOR_SOURCE_KIND.eyedrop,
			COLOR_SOURCE_KIND.hex,
			COLOR_SOURCE_KIND.rgb,
			COLOR_SOURCE_KIND.hsl,
		],
		copy: MOODBOARDS_COPY,
		counterparts: MOODBOARD_COUNTERPARTS,
		foreignIdentities: MOODBOARD_FOREIGN_IDENTITIES,
		kind: MOODBOARD_KIND,
		originKinds: [
			VISUAL_ORIGIN_KIND.fileAttachment,
			VISUAL_ORIGIN_KIND.externalLink,
		],
		paths: {
			autoColorSuggestion: null,
			stockImageSearch: null,
		},
		snapshotFormats: [
			MOODBOARD_SNAPSHOT_FORMAT.png,
			MOODBOARD_SNAPSHOT_FORMAT.pdf,
		],
	};
}

export function identityPresentation(input: {
	fileAttachmentVersionId: string | null;
	originalDownloadable: boolean;
}): VisualPresentationView {
	return {
		crop: null,
		fileAttachmentVersionId: input.fileAttachmentVersionId,
		originalDownloadable: input.originalDownloadable,
		rotation: 0,
	};
}

export function presentationModeView(input: {
	focusOrder: readonly string[];
	moodboardId: string;
}): MoodboardPresentationModeView {
	return {
		contentCopy: false,
		editingHidden: true,
		focusOrder: [...input.focusOrder],
		mode: MOODBOARDS_COPY.presentationMode,
		moodboardId: input.moodboardId,
		toolsHidden: true,
		writes: MOODBOARD_PRESENTATION_WRITES,
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
	focusOrder: MoodboardView["focusOrder"];
	groups: MoodboardView["groups"];
	id: string;
	title: string;
	visuals: MoodboardView["visuals"];
} {
	return {
		focusOrder: moodboard.focusOrder,
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
