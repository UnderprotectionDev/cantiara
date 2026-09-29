import { z } from "zod";

import {
  humanMutationEnvelopeSchema,
  type MutationContract,
} from "./mutation-and-undo";

export const documentTypeSchema = z.enum([
  "General",
  "PRD",
  "Plan",
  "Spec",
  "Research Note",
  "Persona",
]);

export const documentIdSchema = z.string().trim().min(1).max(255);
export const documentRevisionSchema = z.number().int().positive();
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

const updateDocumentFieldsSchema = z
  .object({
    documentId: documentIdSchema,
    title: documentTitleSchema.optional(),
    body: documentBodySchema.optional(),
    type: documentTypeSchema.optional(),
  })
  .strict();

function hasDocumentFieldChange(input: {
  body?: string;
  title?: string;
  type?: Document["type"];
}) {
  return (
    input.title !== undefined ||
    input.body !== undefined ||
    input.type !== undefined
  );
}

export const updateDocumentInputSchema = updateDocumentFieldsSchema.refine(
  hasDocumentFieldChange,
  "At least one Document field must change.",
);

export const createDocumentMutationInputSchema = createDocumentInputSchema
  .extend(humanMutationEnvelopeSchema.shape)
  .strict();

export const updateDocumentMutationInputSchema = updateDocumentFieldsSchema
  .extend(humanMutationEnvelopeSchema.shape)
  .strict()
  .refine(hasDocumentFieldChange, "At least one Document field must change.");

export const restoreDocumentVersionInputSchema = z
  .object({
    documentId: documentIdSchema,
    revision: documentRevisionSchema,
  })
  .extend(humanMutationEnvelopeSchema.shape)
  .strict();

export const documentSchema = createDocumentInputSchema.extend({
  id: documentIdSchema,
  revision: z.number().int().nonnegative(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const documentVersionSummarySchema = documentSchema.pick({
  id: true,
  revision: true,
  title: true,
  type: true,
  createdAt: true,
  updatedAt: true,
});

export const documentVersionInputSchema = z
  .object({
    documentId: documentIdSchema,
    revision: documentRevisionSchema,
  })
  .strict();

export type Document = z.infer<typeof documentSchema>;
export type DocumentVersionSummary = z.infer<
  typeof documentVersionSummarySchema
>;
export type CreateDocumentInput = z.infer<typeof createDocumentInputSchema>;
export type UpdateDocumentInput = z.infer<typeof updateDocumentInputSchema>;

export interface DocumentMutationValue {
  document: Document | null;
}

export interface DocumentMutationContracts {
  create: (accountId: string) => MutationContract<DocumentMutationValue>;
  update: (accountId: string) => MutationContract<DocumentMutationValue>;
}

export interface DocumentsAccess {
  get: (accountId: string, documentId: string) => Promise<Document | null>;
  getVersion: (
    accountId: string,
    documentId: string,
    revision: number,
  ) => Promise<Document | null>;
  list: (accountId: string, projectId: string) => Promise<Document[]>;
  versions: (
    accountId: string,
    documentId: string,
  ) => Promise<DocumentVersionSummary[] | null>;
}

export class DocumentUnavailableError extends Error {
  constructor() {
    super("Document or Project is unavailable.");
    this.name = "DocumentUnavailableError";
  }
}
