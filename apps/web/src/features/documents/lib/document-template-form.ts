import {
  documentTemplateDefinitionSchema,
  documentTemplateInstantiationSchema,
} from "@cantiara/api/document-templates";
import { z } from "zod";

/** `Create from template` form: a Document title and the placeholder values. */
export const createDocumentFromTemplateFormSchema = z.object({
  title: documentTemplateInstantiationSchema.shape.title,
  values: documentTemplateInstantiationSchema.shape.values,
});

/** `Add Document Template`, `Edit Document Template` and `Convert to template` form. */
export const documentTemplateFormSchema = z.object({
  body: documentTemplateDefinitionSchema.shape.body,
  name: documentTemplateDefinitionSchema.shape.name,
  type: documentTemplateDefinitionSchema.shape.type,
});
