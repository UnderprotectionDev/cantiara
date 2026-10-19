import { z } from "zod";

import { normalizeColorHex } from "./moodboard-color";
import {
  DEFAULT_VISUAL_VIEW,
  MOODBOARD_FOCUS_ORDER_MAX,
  visualCropSchema,
  visualRotationSchema,
  visualViewSchema,
} from "./moodboard-view";
import type { MutationContract } from "./mutation-and-undo";
import { humanMutationEnvelopeSchema } from "./mutation-and-undo";

export const MOODBOARD_UI_LABELS = {
  addColorSwatch: "Add Color Swatch",
  addPaletteGroup: "Add palette group",
  addVisual: "Add visual",
  caption: "Caption",
  color: "Color",
  colorSwatch: "Color Swatch",
  eyedrop: "Eyedrop",
  colorSwatchEntryHint: "HEX, RGB, or HSL",
  crop: "Crop",
  exitPresentationMode: "Exit Presentation Mode",
  focusOrder: "Focus order",
  presentationMode: "Presentation Mode",
  resetView: "Reset view",
  rotate90: "Rotate 90°",
  createMoodboard: "Create Moodboard",
  externalLink: "External link",
  fileAttachmentVersion: "File Attachment version",
  moodboard: "Moodboard",
  noMoodboards: "No Moodboards yet.",
  noPaletteGroup: "No Palette group",
  note: "Note",
  paletteGroup: "Palette group",
  title: "Title",
} as const;

export const MOODBOARD_CAPTION_MAX_LENGTH = 280;
export const MOODBOARD_EXTERNAL_LINK_MAX_LENGTH = 2048;
export const MOODBOARD_NOTE_MAX_LENGTH = 140;
export const MOODBOARD_PALETTE_GROUP_NAME_MAX_LENGTH = 80;

const identifierSchema = z.string().trim().min(1).max(255);

export const moodboardTitleSchema = z
  .string()
  .trim()
  .min(1, "Title is required.")
  .max(255, "Title must be 255 characters or fewer.");

/** A short reason for a visual; null when absent. Never a thread or file description. */
export const moodboardCaptionSchema = z
  .string()
  .trim()
  .min(1, "Caption is required when present.")
  .max(
    MOODBOARD_CAPTION_MAX_LENGTH,
    `Caption must be ${MOODBOARD_CAPTION_MAX_LENGTH} characters or fewer.`,
  )
  .nullable();

const externalLinkSchema = z
  .string()
  .trim()
  .max(MOODBOARD_EXTERNAL_LINK_MAX_LENGTH)
  .refine((value) => {
    try {
      const { protocol } = new URL(value);
      return protocol === "https:" || protocol === "http:";
    } catch {
      return false;
    }
  }, "External link must be an http or https URL.");

export const moodboardVisualOriginSchema = z.discriminatedUnion("kind", [
  z
    .object({
      attachmentVersionId: identifierSchema,
      kind: z.literal("File Attachment version"),
    })
    .strict(),
  z
    .object({
      kind: z.literal("External link"),
      url: externalLinkSchema,
    })
    .strict(),
]);

export type MoodboardVisualOrigin = z.infer<typeof moodboardVisualOriginSchema>;

export const moodboardVisualSchema = z
  .object({
    caption: moodboardCaptionSchema,
    createdAt: z.string().datetime(),
    id: identifierSchema,
    kind: z.literal("Visual"),
    origin: moodboardVisualOriginSchema,
    position: z.number().int().nonnegative(),
    updatedAt: z.string().datetime(),
    /** View-local Crop and Rotate 90°; bound to this exact origin. */
    view: visualViewSchema,
  })
  .strict();

export type MoodboardVisual = z.infer<typeof moodboardVisualSchema>;

/** Stored Color Swatch value: one normalized upper-case `#RRGGBB`. */
export const colorSwatchHexSchema = z
  .string()
  .regex(/^#[0-9A-F]{6}$/, "Color must be a normalized HEX value.");

/** Entry form: HEX, RGB, or HSL text, normalized to the stored HEX value. */
export const colorSwatchEntrySchema = z
  .string()
  .trim()
  .transform((value, context) => {
    const hex = normalizeColorHex(value);
    if (!hex) {
      context.addIssue({
        code: "custom",
        message: "Color must be a HEX, RGB, or HSL value.",
      });
      return z.NEVER;
    }
    return hex;
  });

/** A short color note; null when absent. Never a Caption or token description. */
export const colorSwatchNoteSchema = z
  .string()
  .trim()
  .min(1, "Note is required when present.")
  .max(
    MOODBOARD_NOTE_MAX_LENGTH,
    `Note must be ${MOODBOARD_NOTE_MAX_LENGTH} characters or fewer.`,
  )
  .nullable();

export const paletteGroupNameSchema = z
  .string()
  .trim()
  .min(1, "Name is required.")
  .max(
    MOODBOARD_PALETTE_GROUP_NAME_MAX_LENGTH,
    `Name must be ${MOODBOARD_PALETTE_GROUP_NAME_MAX_LENGTH} characters or fewer.`,
  );

export const paletteGroupSchema = z
  .object({
    id: identifierSchema,
    name: paletteGroupNameSchema,
    position: z.number().int().nonnegative(),
  })
  .strict();

export type PaletteGroup = z.infer<typeof paletteGroupSchema>;

/**
 * First-class Color Swatch item. Visual-direction context only: it carries no
 * theme, Completion effect, token, CSS, custom-field, or Project Wall identity.
 */
export const colorSwatchSchema = z
  .object({
    color: colorSwatchHexSchema,
    createdAt: z.string().datetime(),
    id: identifierSchema,
    kind: z.literal("Color Swatch"),
    note: colorSwatchNoteSchema,
    paletteGroupId: identifierSchema.nullable(),
    position: z.number().int().nonnegative(),
    updatedAt: z.string().datetime(),
  })
  .strict();

export type ColorSwatch = z.infer<typeof colorSwatchSchema>;

/** Moodboard content items: visual references and Color Swatches. */
export const moodboardItemSchema = z.discriminatedUnion("kind", [
  moodboardVisualSchema,
  colorSwatchSchema,
]);

export type MoodboardItem = z.infer<typeof moodboardItemSchema>;

export const moodboardSchema = z
  .object({
    createdAt: z.string().datetime(),
    /** Optional view-local Presentation Mode order; empty means board order. */
    focusOrder: z.array(identifierSchema),
    id: identifierSchema,
    items: z.array(moodboardItemSchema),
    paletteGroups: z.array(paletteGroupSchema),
    projectId: identifierSchema,
    revision: z.number().int().nonnegative(),
    title: moodboardTitleSchema,
    updatedAt: z.string().datetime(),
  })
  .strict();

export type Moodboard = z.infer<typeof moodboardSchema>;

export interface MoodboardMutationValue {
  moodboard: Moodboard | null;
}

export const moodboardsProjectInputSchema = z
  .object({ projectId: identifierSchema })
  .strict();

const createMoodboardFieldsSchema = z
  .object({ projectId: identifierSchema, title: moodboardTitleSchema })
  .strict();

export const createMoodboardInputSchema = createMoodboardFieldsSchema;
export const createMoodboardMutationInputSchema = humanMutationEnvelopeSchema
  .extend(createMoodboardFieldsSchema.shape)
  .strict();

const addMoodboardVisualFieldsSchema = z
  .object({
    caption: moodboardCaptionSchema.default(null),
    moodboardId: identifierSchema,
    origin: moodboardVisualOriginSchema,
  })
  .strict();

export const addMoodboardVisualInputSchema = addMoodboardVisualFieldsSchema;
export const addMoodboardVisualMutationInputSchema = humanMutationEnvelopeSchema
  .extend(addMoodboardVisualFieldsSchema.shape)
  .strict();

const updateMoodboardVisualCaptionFieldsSchema = z
  .object({
    caption: moodboardCaptionSchema,
    itemId: identifierSchema,
    moodboardId: identifierSchema,
  })
  .strict();

export const updateMoodboardVisualCaptionInputSchema =
  updateMoodboardVisualCaptionFieldsSchema;
export const updateMoodboardVisualCaptionMutationInputSchema =
  humanMutationEnvelopeSchema
    .extend(updateMoodboardVisualCaptionFieldsSchema.shape)
    .strict();

const addColorSwatchFieldsSchema = z
  .object({
    color: colorSwatchEntrySchema,
    moodboardId: identifierSchema,
    note: colorSwatchNoteSchema.default(null),
    paletteGroupId: identifierSchema.nullable().default(null),
  })
  .strict();

export const addColorSwatchInputSchema = addColorSwatchFieldsSchema;
export const addColorSwatchMutationInputSchema = humanMutationEnvelopeSchema
  .extend(addColorSwatchFieldsSchema.shape)
  .strict();

const addPaletteGroupFieldsSchema = z
  .object({ moodboardId: identifierSchema, name: paletteGroupNameSchema })
  .strict();

export const addPaletteGroupInputSchema = addPaletteGroupFieldsSchema;
export const addPaletteGroupMutationInputSchema = humanMutationEnvelopeSchema
  .extend(addPaletteGroupFieldsSchema.shape)
  .strict();

const assignColorSwatchPaletteGroupFieldsSchema = z
  .object({
    itemId: identifierSchema,
    moodboardId: identifierSchema,
    paletteGroupId: identifierSchema.nullable(),
  })
  .strict();

export const assignColorSwatchPaletteGroupInputSchema =
  assignColorSwatchPaletteGroupFieldsSchema;
export const assignColorSwatchPaletteGroupMutationInputSchema =
  humanMutationEnvelopeSchema
    .extend(assignColorSwatchPaletteGroupFieldsSchema.shape)
    .strict();

const setMoodboardVisualViewFieldsSchema = z
  .object({
    crop: visualCropSchema.nullable(),
    itemId: identifierSchema,
    moodboardId: identifierSchema,
    rotation: visualRotationSchema,
  })
  .strict();

export const setMoodboardVisualViewInputSchema =
  setMoodboardVisualViewFieldsSchema;
export const setMoodboardVisualViewMutationInputSchema =
  humanMutationEnvelopeSchema
    .extend(setMoodboardVisualViewFieldsSchema.shape)
    .strict();

const setMoodboardFocusOrderFieldsSchema = z
  .object({
    itemIds: z
      .array(identifierSchema)
      .max(MOODBOARD_FOCUS_ORDER_MAX)
      .refine(
        (ids) => new Set(ids).size === ids.length,
        "Focus order cannot repeat an item.",
      ),
    moodboardId: identifierSchema,
  })
  .strict();

export const setMoodboardFocusOrderInputSchema =
  setMoodboardFocusOrderFieldsSchema;
export const setMoodboardFocusOrderMutationInputSchema =
  humanMutationEnvelopeSchema
    .extend(setMoodboardFocusOrderFieldsSchema.shape)
    .strict();

export type SetMoodboardVisualViewInput = z.output<
  typeof setMoodboardVisualViewInputSchema
>;
export type SetMoodboardFocusOrderInput = z.output<
  typeof setMoodboardFocusOrderInputSchema
>;
export type AddColorSwatchInput = z.output<typeof addColorSwatchInputSchema>;
export type AddPaletteGroupInput = z.output<typeof addPaletteGroupInputSchema>;
export type AssignColorSwatchPaletteGroupInput = z.output<
  typeof assignColorSwatchPaletteGroupInputSchema
>;
export type CreateMoodboardInput = z.output<typeof createMoodboardInputSchema>;
export type AddMoodboardVisualInput = z.output<
  typeof addMoodboardVisualInputSchema
>;
export type UpdateMoodboardVisualCaptionInput = z.output<
  typeof updateMoodboardVisualCaptionInputSchema
>;

export interface MoodboardsAccess {
  get: (accountId: string, moodboardId: string) => Promise<Moodboard | null>;
  list: (accountId: string, projectId: string) => Promise<Moodboard[] | null>;
}

export interface MoodboardMutationContracts {
  addColorSwatch: (
    accountId: string,
  ) => MutationContract<MoodboardMutationValue>;
  addPaletteGroup: (
    accountId: string,
  ) => MutationContract<MoodboardMutationValue>;
  addVisual: (accountId: string) => MutationContract<MoodboardMutationValue>;
  assignColorSwatchPaletteGroup: (
    accountId: string,
  ) => MutationContract<MoodboardMutationValue>;
  create: (accountId: string) => MutationContract<MoodboardMutationValue>;
  setFocusOrder: (
    accountId: string,
  ) => MutationContract<MoodboardMutationValue>;
  setVisualView: (
    accountId: string,
  ) => MutationContract<MoodboardMutationValue>;
  updateVisualCaption: (
    accountId: string,
  ) => MutationContract<MoodboardMutationValue>;
}

/** Next-value builders shared by the RPC handlers; they touch only the Moodboard. */
export function newMoodboard(input: {
  id: string;
  now: string;
  payload: CreateMoodboardInput;
  revision: number;
}): MoodboardMutationValue {
  return {
    moodboard: {
      createdAt: input.now,
      focusOrder: [],
      id: input.id,
      items: [],
      paletteGroups: [],
      projectId: input.payload.projectId,
      revision: input.revision,
      title: input.payload.title,
      updatedAt: input.now,
    },
  };
}

export function withAddedVisual(
  current: MoodboardMutationValue,
  input: {
    itemId: string;
    now: string;
    payload: AddMoodboardVisualInput;
    revision: number;
  },
): MoodboardMutationValue {
  const { moodboard } = current;
  if (!moodboard) {
    return current;
  }
  const visual: MoodboardVisual = {
    caption: input.payload.caption,
    createdAt: input.now,
    id: input.itemId,
    kind: "Visual",
    origin: input.payload.origin,
    position: moodboard.items.length,
    updatedAt: input.now,
    view: DEFAULT_VISUAL_VIEW,
  };
  return {
    moodboard: {
      ...moodboard,
      items: [...moodboard.items, visual],
      revision: input.revision,
      updatedAt: input.now,
    },
  };
}

export function withVisualCaption(
  current: MoodboardMutationValue,
  input: {
    now: string;
    payload: UpdateMoodboardVisualCaptionInput;
    revision: number;
  },
): MoodboardMutationValue {
  const { moodboard } = current;
  if (!moodboard) {
    return current;
  }
  return {
    moodboard: {
      ...moodboard,
      items: moodboard.items.map((item) =>
        item.kind === "Visual" && item.id === input.payload.itemId
          ? { ...item, caption: input.payload.caption, updatedAt: input.now }
          : item,
      ),
      revision: input.revision,
      updatedAt: input.now,
    },
  };
}

export function withAddedColorSwatch(
  current: MoodboardMutationValue,
  input: {
    itemId: string;
    now: string;
    payload: AddColorSwatchInput;
    revision: number;
  },
): MoodboardMutationValue {
  const { moodboard } = current;
  if (!moodboard) {
    return current;
  }
  const swatch: ColorSwatch = {
    color: input.payload.color,
    createdAt: input.now,
    id: input.itemId,
    kind: "Color Swatch",
    note: input.payload.note,
    paletteGroupId: input.payload.paletteGroupId,
    position: moodboard.items.length,
    updatedAt: input.now,
  };
  return {
    moodboard: {
      ...moodboard,
      items: [...moodboard.items, swatch],
      revision: input.revision,
      updatedAt: input.now,
    },
  };
}

export function withAddedPaletteGroup(
  current: MoodboardMutationValue,
  input: {
    groupId: string;
    now: string;
    payload: AddPaletteGroupInput;
    revision: number;
  },
): MoodboardMutationValue {
  const { moodboard } = current;
  if (!moodboard) {
    return current;
  }
  return {
    moodboard: {
      ...moodboard,
      paletteGroups: [
        ...moodboard.paletteGroups,
        {
          id: input.groupId,
          name: input.payload.name,
          position: moodboard.paletteGroups.length,
        },
      ],
      revision: input.revision,
      updatedAt: input.now,
    },
  };
}

export function withColorSwatchPaletteGroup(
  current: MoodboardMutationValue,
  input: {
    now: string;
    payload: AssignColorSwatchPaletteGroupInput;
    revision: number;
  },
): MoodboardMutationValue {
  const { moodboard } = current;
  if (!moodboard) {
    return current;
  }
  return {
    moodboard: {
      ...moodboard,
      items: moodboard.items.map((item) =>
        item.kind === "Color Swatch" && item.id === input.payload.itemId
          ? {
              ...item,
              paletteGroupId: input.payload.paletteGroupId,
              updatedAt: input.now,
            }
          : item,
      ),
      revision: input.revision,
      updatedAt: input.now,
    },
  };
}

/** Only the targeted visual's view-local Crop and rotation change; nothing else does. */
export function withVisualView(
  current: MoodboardMutationValue,
  input: {
    now: string;
    payload: SetMoodboardVisualViewInput;
    revision: number;
  },
): MoodboardMutationValue {
  const { moodboard } = current;
  if (!moodboard) {
    return current;
  }
  return {
    moodboard: {
      ...moodboard,
      items: moodboard.items.map((item) =>
        item.kind === "Visual" && item.id === input.payload.itemId
          ? {
              ...item,
              updatedAt: input.now,
              view: {
                crop: input.payload.crop,
                rotation: input.payload.rotation,
              },
            }
          : item,
      ),
      revision: input.revision,
      updatedAt: input.now,
    },
  };
}

/** The Focus order lists existing item IDs only; it never copies content. */
export function withFocusOrder(
  current: MoodboardMutationValue,
  input: {
    now: string;
    payload: SetMoodboardFocusOrderInput;
    revision: number;
  },
): MoodboardMutationValue {
  const { moodboard } = current;
  if (!moodboard) {
    return current;
  }
  return {
    moodboard: {
      ...moodboard,
      focusOrder: input.payload.itemIds,
      revision: input.revision,
      updatedAt: input.now,
    },
  };
}
