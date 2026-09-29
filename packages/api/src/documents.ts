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
export const projectIdSchema = z.string().trim().min(1).max(255);
export const documentTitleSchema = z.string().trim().min(1).max(255);
export const documentBodySchema = z.string().max(1_000_000);
const markdownLinesPattern = /\n/;
const markdownFencePattern = /^ {0,3}(`{3,}|~{3,})/;
const markdownFenceClosePattern = /^ {0,3}(`{3,}|~{3,})[ \t]*$/;
const liveWorkDirectivePattern = /^:::live-work\{workId="([^"]{1,255})"\}$/;
const liveCollectionDirectivePattern =
  /^:::live-collection\{viewId="([^"]{1,255})"\}$/;
const liveDiagramDirectivePattern =
  /^:::live-diagram\{diagramId="([^"]{1,255})"(?: viewId="([^"]{1,255})")?\}$/;

export interface DocumentLiveDirective {
  end: number;
  id: string;
  kind: "Work" | "Smart Collection" | "Technical Diagram";
  start: number;
  viewId?: string;
}

function liveDirectiveFromLine(line: string) {
  const workId = liveWorkDirectivePattern.exec(line)?.[1];
  if (workId) {
    return { id: workId, kind: "Work" as const };
  }
  const collectionId = liveCollectionDirectivePattern.exec(line)?.[1];
  if (collectionId) {
    return { id: collectionId, kind: "Smart Collection" as const };
  }
  const diagramMatch = liveDiagramDirectivePattern.exec(line);
  const diagramId = diagramMatch?.[1];
  if (diagramId) {
    return {
      id: diagramId,
      kind: "Technical Diagram" as const,
      viewId: diagramMatch[2],
    };
  }
  return null;
}

/** Live block directives carry only source identity; current fields are read at view time. */
export function documentLiveDirectives(body: string): DocumentLiveDirective[] {
  const directives: DocumentLiveDirective[] = [];
  let fence: { marker: string; length: number } | null = null;
  let start = 0;
  for (const line of body.split(markdownLinesPattern)) {
    const normalizedLine = line.endsWith("\r") ? line.slice(0, -1) : line;
    const openingMarker = markdownFencePattern.exec(normalizedLine)?.[1];
    if (fence) {
      const closingMarker = markdownFenceClosePattern.exec(normalizedLine)?.[1];
      if (
        closingMarker &&
        closingMarker[0] === fence.marker &&
        closingMarker.length >= fence.length
      ) {
        fence = null;
      }
      start += line.length + 1;
      continue;
    }
    if (openingMarker) {
      fence = { marker: openingMarker[0] ?? "", length: openingMarker.length };
      start += line.length + 1;
      continue;
    }
    const directive = liveDirectiveFromLine(normalizedLine);
    if (
      directive &&
      documentIdSchema.safeParse(directive.id).success &&
      (!directive.viewId ||
        documentIdSchema.safeParse(directive.viewId).success)
    ) {
      directives.push({
        ...directive,
        start,
        end: start + normalizedLine.length,
      });
    }
    start += line.length + 1;
  }
  return directives;
}

export function documentLiveWorkDirectives(body: string) {
  return documentLiveDirectives(body).filter(({ kind }) => kind === "Work");
}

export function documentLiveWorkIds(body: string): string[] {
  return documentLiveWorkDirectives(body).map(({ id }) => id);
}

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

export const documentSchema = createDocumentInputSchema.extend({
  id: documentIdSchema,
  revision: z.number().int().nonnegative(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type Document = z.infer<typeof documentSchema>;
export type CreateDocumentInput = z.infer<typeof createDocumentInputSchema>;
export type UpdateDocumentInput = z.infer<typeof updateDocumentInputSchema>;

export interface DocumentMutationValue {
  document: Document | null;
}

export interface DocumentMutationContracts {
  create: (accountId: string) => MutationContract<DocumentMutationValue>;
  update: (accountId: string) => MutationContract<DocumentMutationValue>;
}

export interface LiveWorkSource {
  id: string;
  key: string;
  plannedStartDate: string | null;
  priority: Array<{ name: string; rank: string }>;
  projectId: string;
  status: string;
  targetDate: string | null;
  title: string;
  type: string;
}

export interface DocumentsAccess {
  get: (accountId: string, documentId: string) => Promise<Document | null>;
  getLiveWork: (
    accountId: string,
    workId: string,
  ) => Promise<LiveWorkSource | null>;
  list: (accountId: string, projectId: string) => Promise<Document[]>;
}

export class DocumentUnavailableError extends Error {
  constructor() {
    super("Document or Project is unavailable.");
    this.name = "DocumentUnavailableError";
  }
}
