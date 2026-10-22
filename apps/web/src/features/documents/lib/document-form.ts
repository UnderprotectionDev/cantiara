import { DOCUMENT_STARTER_SKELETON_OPTIONS } from "@cantiara/api/document-skeletons";
import {
  createDocumentInputSchema,
  documentTypeSchema,
} from "@cantiara/api/documents";
import { z } from "zod";

/** Document edit form: the contract's title, type and body rules. */
export const documentEditFormSchema = z.object({
  body: createDocumentInputSchema.shape.body,
  title: createDocumentInputSchema.shape.title,
  type: documentTypeSchema,
});

/**
 * `Create Document` form: a starter skeleton, or a title and type. Its output
 * is the create command's value.
 */
export const createDocumentFormSchema = z
  .object({
    skeleton: z.enum(DOCUMENT_STARTER_SKELETON_OPTIONS).or(z.literal("")),
    title: z.string(),
    type: documentTypeSchema,
  })
  .transform((value, context) => {
    if (value.skeleton) {
      return { skeleton: value.skeleton };
    }
    const title = createDocumentInputSchema.shape.title.safeParse(value.title);
    if (!title.success) {
      for (const issue of title.error.issues) {
        context.addIssue({
          code: "custom",
          message: issue.message,
          path: ["title"],
        });
      }
      return z.NEVER;
    }
    return { title: title.data, type: value.type };
  });
