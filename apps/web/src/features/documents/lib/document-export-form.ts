import { z } from "zod";

/** `Export` of a Document version: the Document, a positive Version and a `Markdown` or `PDF` format. */
export const documentExportFormSchema = z.object({
  documentId: z.string().min(1),
  format: z.enum(["Markdown", "PDF"]),
  revision: z.number().int().positive(),
});
