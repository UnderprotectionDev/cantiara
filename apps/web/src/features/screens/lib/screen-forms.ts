import { WIREFRAME_LIVE_CARD_RECORD_TYPES } from "@cantiara/api/wireframe-document";
import { z } from "zod";

/** `Place live card` form: the record id is trimmed and must not be empty. */
export const placeLiveCardFormSchema = z.object({
  recordId: z.string().trim().min(1),
  recordType: z.enum(WIREFRAME_LIVE_CARD_RECORD_TYPES),
});

/** `Save as Template` form: the template name is required. */
export const saveAsTemplateFormSchema = z.object({
  name: z.string().trim().min(1, "Template name is required."),
  version: z.number(),
});

/** `Create Screen from Template` form: the title is required. */
export const createScreenFromTemplateFormSchema = z.object({
  templateId: z.string().min(1),
  title: z.string().trim().min(1, "Title is required."),
});
