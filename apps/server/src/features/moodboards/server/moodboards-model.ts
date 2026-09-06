import { z } from "zod";

export const MOODBOARDS_COPY = {
	addColorSwatch: "Add Color Swatch",
	addPaletteGroup: "Add palette group",
	addVisual: "Add visual",
	caption: "Caption",
	colorSwatch: "Color Swatch",
	createMoodboard: "Create Moodboard",
	externalLink: "External link",
	eyedrop: "Eyedrop",
	fileAttachment: "File Attachment",
	hex: "HEX",
	hsl: "HSL",
	moodboard: "Moodboard",
	noMoodboards: "No Moodboards yet.",
	note: "Note",
	paletteGroup: "Palette group",
	picker: "Picker",
	rgb: "RGB",
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

export const MOODBOARD_COUNTERPARTS = {
	appliesColorToProductUi: false,
	autoColorSuggestion: false,
	autoCreateProjectWallCard: false,
	captionIsCommentThread: false,
	captionIsFileDescription: false,
	captionIsMention: false,
	captionIsReaction: false,
	captionIsTask: false,
	designSystem: false,
	productionAsset: false,
	screen: false,
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

export const moodboardVisualViewSchema = z.object({
	caption: z.string(),
	id: z.string().min(1),
	origin: visualOriginViewSchema,
});

export type MoodboardVisualView = z.infer<typeof moodboardVisualViewSchema>;

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
	id: z.string().min(1),
	paletteGroups: z.array(paletteGroupViewSchema),
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
			"palette-group-not-found",
		]),
		status: z.literal("rejected"),
	}),
]);

export type MoodboardWriteOutcome = z.infer<typeof moodboardWriteOutcomeSchema>;

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
	};
}
