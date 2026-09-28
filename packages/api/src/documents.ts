import { z } from "zod";

export const documentTypeSchema = z.enum([
  "General",
  "PRD",
  "Plan",
  "Spec",
  "Research Note",
  "Persona",
]);

export const documentIdSchema = z.string().trim().min(1).max(255);
export const projectIdSchema = z.string().trim().min(1).max(255);
export const documentTitleSchema = z.string().trim().min(1).max(255);
export const documentBodySchema = z.string().max(1_000_000);

export const createDocumentInputSchema = z
  .object({
    projectId: projectIdSchema,
    title: documentTitleSchema,
    body: documentBodySchema,
    type: documentTypeSchema,
  })
  .strict();

export const updateDocumentInputSchema = z
  .object({
    documentId: documentIdSchema,
    baseRevision: z.number().int().nonnegative(),
    title: documentTitleSchema.optional(),
    body: documentBodySchema.optional(),
    type: documentTypeSchema.optional(),
  })
  .strict()
  .refine(
    ({ title, body, type }) =>
      title !== undefined || body !== undefined || type !== undefined,
    "At least one Document field must change.",
  );

export const documentSchema = createDocumentInputSchema.extend({
  id: documentIdSchema,
  revision: z.number().int().nonnegative(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type Document = z.infer<typeof documentSchema>;
export type CreateDocumentInput = z.infer<typeof createDocumentInputSchema>;
export type UpdateDocumentInput = z.infer<typeof updateDocumentInputSchema>;

export interface DocumentsAccess {
  create: (accountId: string, input: CreateDocumentInput) => Promise<Document>;
  get: (accountId: string, documentId: string) => Promise<Document | null>;
  list: (accountId: string, projectId: string) => Promise<Document[]>;
  update: (accountId: string, input: UpdateDocumentInput) => Promise<Document>;
}

export class DocumentUnavailableError extends Error {
  constructor() {
    super("Document or Project is unavailable.");
    this.name = "DocumentUnavailableError";
  }
}

export class DocumentStaleRevisionError extends Error {
  constructor() {
    super("Document changed after this edit started.");
    this.name = "DocumentStaleRevisionError";
  }
}
