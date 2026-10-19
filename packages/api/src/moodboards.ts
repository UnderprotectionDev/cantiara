import { z } from "zod";

import type { MutationContract } from "./mutation-and-undo";
import { humanMutationEnvelopeSchema } from "./mutation-and-undo";

export const MOODBOARD_UI_LABELS = {
  addVisual: "Add visual",
  caption: "Caption",
  createMoodboard: "Create Moodboard",
  externalLink: "External link",
  fileAttachmentVersion: "File Attachment version",
  moodboard: "Moodboard",
  noMoodboards: "No Moodboards yet.",
  title: "Title",
} as const;

export const MOODBOARD_CAPTION_MAX_LENGTH = 280;
export const MOODBOARD_EXTERNAL_LINK_MAX_LENGTH = 2048;

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
  })
  .strict();

export type MoodboardVisual = z.infer<typeof moodboardVisualSchema>;

/**
 * Moodboard content items. Only visual references exist today; Color Swatch
 * items join this union without reshaping the Moodboard record.
 */
export const moodboardItemSchema = z.discriminatedUnion("kind", [
  moodboardVisualSchema,
]);

export type MoodboardItem = z.infer<typeof moodboardItemSchema>;

export const moodboardSchema = z
  .object({
    createdAt: z.string().datetime(),
    id: identifierSchema,
    items: z.array(moodboardItemSchema),
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
  addVisual: (accountId: string) => MutationContract<MoodboardMutationValue>;
  create: (accountId: string) => MutationContract<MoodboardMutationValue>;
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
      id: input.id,
      items: [],
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
        item.id === input.payload.itemId
          ? { ...item, caption: input.payload.caption, updatedAt: input.now }
          : item,
      ),
      revision: input.revision,
      updatedAt: input.now,
    },
  };
}
