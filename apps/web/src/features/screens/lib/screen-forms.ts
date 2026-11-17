import {
  convertAndBindWorkTypeSchema,
  createScreenFromTemplateInputSchema,
  previewConvertAndBindInputSchema,
  templateNameSchema,
} from "@cantiara/api/screen-origins";
import { WIREFRAME_LIVE_CARD_RECORD_TYPES } from "@cantiara/api/wireframe-document";
import { z } from "zod";

/** `Place live card` form: the record id is trimmed and must not be empty. */
export const placeLiveCardFormSchema = z.object({
  recordId: z.string().trim().min(1),
  recordType: z.enum(WIREFRAME_LIVE_CARD_RECORD_TYPES),
});

/** `Save as Template` form: the template name is required. */
export const saveAsTemplateFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Template name is required.")
    .pipe(templateNameSchema),
  version: z.number(),
});

/** `Create Screen from Template` form: the title is required. */
export const createScreenFromTemplateFormSchema = z.object({
  templateId: z.string().min(1),
  title: z
    .string()
    .trim()
    .min(1, "Title is required.")
    .pipe(createScreenFromTemplateInputSchema.shape.title),
});

/**
 * `Convert and Bind` form: a target type, a Work type for Work only and an
 * optional title. Its output is the preview request's own fields.
 */
export const convertAndBindFormSchema = z
  .object({
    targetType: previewConvertAndBindInputSchema.shape.targetType,
    title: z.string().trim().max(255),
    workType: convertAndBindWorkTypeSchema,
  })
  .transform((value) => ({
    targetType: value.targetType,
    ...(value.title ? { title: value.title } : {}),
    ...(value.targetType === "Work" ? { workType: value.workType } : {}),
  }));

/** `Source label` of a linked block: the wireframe contract's label length bound. */
export const linkedSourceLabelFormSchema = z.object({
  label: z.string().max(500),
});

/** `Presentation and Export` form: the exact Wireframe version chosen for each picked Screen. */
export const screensOutputFormSchema = z.object({
  picked: z.record(z.string().min(1), z.number().int().positive()),
});
