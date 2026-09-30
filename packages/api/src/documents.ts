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
const projectDocumentScopeSchema = z
  .object({
    projectId: projectIdSchema,
    workspaceId: z.undefined().optional(),
  })
  .strict();
const personalWikiDocumentScopeSchema = z
  .object({
    projectId: z.undefined().optional(),
    workspaceId: documentIdSchema,
  })
  .strict();
export const documentScopeSchema = z.union([
  projectDocumentScopeSchema,
  personalWikiDocumentScopeSchema,
]);
export type DocumentScope = z.infer<typeof documentScopeSchema>;
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
const liveSectionDirectivePattern =
  /^:::live-section\{documentId="([^"]{1,255})" sectionId="([^"]{1,255})"\}$/;
const documentSectionHeadingPattern =
  /^(#{1,6})[ \t]+(.+?)\s+\{#([A-Za-z0-9][A-Za-z0-9_-]{0,254})\}[ \t]*$/;
const documentRecordReferencePattern =
  /\[\[record:([A-Za-z ]{1,40}):([^|\]\n]{1,255})\|([^\]\n]{1,255})\]\]/g;
const documentRecordReferenceTypes = [
  "Assumption",
  "Decision",
  "Document",
  "Feedback",
  "Milestone",
  "Open Question",
  "Production Incident",
  "Project Release",
  "Question",
  "Risk",
  "Source",
  "Technical Diagram",
  "Work",
] as const;

export interface DocumentLiveDirective {
  end: number;
  id: string;
  kind: "Work" | "Smart Collection" | "Technical Diagram" | "Document section";
  sectionId?: string;
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
  const sectionMatch = liveSectionDirectivePattern.exec(line);
  const sectionDocumentId = sectionMatch?.[1];
  if (sectionDocumentId) {
    return {
      id: sectionDocumentId,
      kind: "Document section" as const,
      sectionId: sectionMatch?.[2],
    };
  }
  return null;
}

export interface DocumentSection {
  content: string;
  end: number;
  heading: string;
  id: string;
  level: number;
  start: number;
}

export interface DocumentRecordReference {
  end: number;
  label: string;
  recordId: string;
  recordType: (typeof documentRecordReferenceTypes)[number];
  start: number;
}

export interface DocumentRecordReferenceView extends DocumentRecordReference {
  source: {
    id: string;
    projectId: string | null;
    workspaceId?: string | null;
    title: string;
  } | null;
}

function isInsideMarkdownCodeSpan(line: string, position: number) {
  const ticks = [...line.matchAll(/`+/g)];
  for (const [index, opening] of ticks.entries()) {
    const openingStart = opening.index ?? 0;
    if (openingStart >= position) {
      return false;
    }
    const openingLength = opening[0].length;
    const closing = ticks
      .slice(index + 1)
      .find((tick) => tick[0].length === openingLength);
    if (!closing) {
      continue;
    }
    const closingStart = closing.index ?? 0;
    if (openingStart < position && position < closingStart + openingLength) {
      return true;
    }
  }
  return false;
}

/** Inline record references store a readable label and a stable record identity. */
export function documentRecordReferences(
  body: string,
): DocumentRecordReference[] {
  const references: DocumentRecordReference[] = [];
  let fence: { marker: string; length: number } | null = null;
  let offset = 0;
  for (const rawLine of body.split(markdownLinesPattern)) {
    const line = rawLine.endsWith("\r") ? rawLine.slice(0, -1) : rawLine;
    const openingMarker = markdownFencePattern.exec(line)?.[1];
    if (fence) {
      const closingMarker = markdownFenceClosePattern.exec(line)?.[1];
      if (
        closingMarker &&
        closingMarker[0] === fence.marker &&
        closingMarker.length >= fence.length
      ) {
        fence = null;
      }
      offset += rawLine.length + 1;
      continue;
    }
    if (openingMarker) {
      fence = { marker: openingMarker[0] ?? "", length: openingMarker.length };
      offset += rawLine.length + 1;
      continue;
    }
    for (const match of line.matchAll(documentRecordReferencePattern)) {
      const [matchedText, recordType, recordId, label] = match;
      const position = match.index ?? 0;
      if (
        line[position - 1] === "\\" ||
        isInsideMarkdownCodeSpan(line, position) ||
        !documentRecordReferenceTypes.includes(
          recordType as (typeof documentRecordReferenceTypes)[number],
        ) ||
        !recordId ||
        !label
      ) {
        continue;
      }
      references.push({
        end: offset + position + (matchedText?.length ?? 0),
        label,
        recordId,
        recordType: recordType as DocumentRecordReference["recordType"],
        start: offset + position,
      });
    }
    offset += rawLine.length + 1;
  }
  return references;
}

/** Stable section identities are explicit Markdown heading anchors. */
export function documentSections(body: string): DocumentSection[] {
  const lines = body.split(markdownLinesPattern);
  const headings: Array<{
    contentStart: number;
    heading: string;
    id: string;
    level: number;
  }> = [];
  let offset = 0;
  let fence: { marker: string; length: number } | null = null;
  for (const rawLine of lines) {
    const line = rawLine.endsWith("\r") ? rawLine.slice(0, -1) : rawLine;
    const openingMarker = markdownFencePattern.exec(line)?.[1];
    if (fence) {
      const closingMarker = markdownFenceClosePattern.exec(line)?.[1];
      if (
        closingMarker &&
        closingMarker[0] === fence.marker &&
        closingMarker.length >= fence.length
      ) {
        fence = null;
      }
      offset += rawLine.length + 1;
      continue;
    }
    if (openingMarker) {
      fence = { marker: openingMarker[0] ?? "", length: openingMarker.length };
      offset += rawLine.length + 1;
      continue;
    }
    const match = documentSectionHeadingPattern.exec(line);
    if (match) {
      headings.push({
        contentStart: offset + line.length + 1,
        heading: (match[2] ?? "").trim(),
        id: match[3] ?? "",
        level: match[1]?.length ?? 0,
      });
    }
    offset += rawLine.length + 1;
  }
  return headings.map((section, index) => {
    const boundary = headings
      .slice(index + 1)
      .find(({ level }) => level <= section.level);
    const end =
      boundary?.contentStart === undefined
        ? body.length
        : body.lastIndexOf("\n", boundary.contentStart - 2) + 1;
    return {
      content: body.slice(section.contentStart, end).trim(),
      end,
      heading: section.heading,
      id: section.id,
      level: section.level,
      start: section.contentStart,
    };
  });
}

export function documentSectionById(body: string, sectionId: string) {
  const matches = documentSections(body).filter(({ id }) => id === sectionId);
  return matches.length === 1 ? (matches[0] ?? null) : null;
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

const createDocumentFields = {
  title: documentTitleSchema,
  body: documentBodySchema,
  type: documentTypeSchema,
  conflictDraftId: documentIdSchema.optional(),
};

const projectDocumentCreateInputSchema = z
  .object({
    ...createDocumentFields,
    projectId: projectIdSchema,
    workspaceId: z.undefined().optional(),
  })
  .strict();

const personalWikiDocumentCreateInputSchema = z
  .object({
    ...createDocumentFields,
    projectId: z.undefined().optional(),
    workspaceId: documentIdSchema,
  })
  .strict();

export const createDocumentInputSchema = z.union([
  projectDocumentCreateInputSchema,
  personalWikiDocumentCreateInputSchema,
]);

const updateDocumentFieldsSchema = z
  .object({
    documentId: documentIdSchema,
    title: documentTitleSchema.optional(),
    body: documentBodySchema.optional(),
    type: documentTypeSchema.optional(),
    conflictDraftId: documentIdSchema.optional(),
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

export const createDocumentMutationInputSchema = z.union([
  projectDocumentCreateInputSchema
    .extend(humanMutationEnvelopeSchema.shape)
    .strict(),
  personalWikiDocumentCreateInputSchema
    .extend(humanMutationEnvelopeSchema.shape)
    .strict(),
]);

export const updateDocumentMutationInputSchema = updateDocumentFieldsSchema
  .extend(humanMutationEnvelopeSchema.shape)
  .strict()
  .refine(hasDocumentFieldChange, "At least one Document field must change.");

const documentEvidenceSelectionFields = {
  documentId: documentIdSchema,
  documentRevision: z.number().int().nonnegative(),
  selectionEnd: z.number().int().positive(),
  selectionStart: z.number().int().nonnegative(),
  selectedText: z.string().min(1).max(100_000),
};

export const DOCUMENT_EVIDENCE_TARGET_TYPES = [
  "Work",
  "Document",
  "Technical Diagram",
  "Decision",
  "Risk",
  "Assumption",
  "Open Question",
  "Milestone",
  "Project Release",
  "Production Incident",
] as const;
export type DocumentEvidenceTargetType =
  (typeof DOCUMENT_EVIDENCE_TARGET_TYPES)[number];

export const documentEvidenceSelectionSchema = z
  .object(documentEvidenceSelectionFields)
  .strict()
  .refine(({ selectionEnd, selectionStart }) => selectionEnd > selectionStart, {
    message: "The selected text range must not be empty.",
  });

export type DocumentEvidenceSelection = z.infer<
  typeof documentEvidenceSelectionSchema
>;

export const pinDocumentEvidenceInputSchema = humanMutationEnvelopeSchema
  .extend({
    ...documentEvidenceSelectionFields,
    targetRecordId: documentIdSchema,
    targetRecordType: z.enum(DOCUMENT_EVIDENCE_TARGET_TYPES),
  })
  .strict()
  .refine(({ selectionEnd, selectionStart }) => selectionEnd > selectionStart, {
    message: "The selected text range must not be empty.",
  });

export type PinDocumentEvidenceInput = z.infer<
  typeof pinDocumentEvidenceInputSchema
>;

export const restoreDocumentVersionInputSchema = z
  .object({
    documentId: documentIdSchema,
    revision: documentRevisionSchema,
  })
  .extend(humanMutationEnvelopeSchema.shape)
  .strict();

export const documentSchema = z.object({
  id: documentIdSchema,
  projectId: projectIdSchema.nullable(),
  workspaceId: documentIdSchema.nullable().default(null),
  title: documentTitleSchema,
  body: documentBodySchema,
  type: documentTypeSchema,
  revision: z.number().int().nonnegative(),
  createdAt: z.string(),
  updatedAt: z.string(),
  origin: z
    .object({
      documentId: documentIdSchema,
      revision: documentRevisionSchema,
      conflictDraftId: z.string().optional(),
    })
    .nullable()
    .optional(),
});

export const documentConflictDraftSchema = z.object({
  id: documentIdSchema,
  documentId: documentIdSchema,
  projectId: projectIdSchema.nullable(),
  workspaceId: documentIdSchema.nullable().default(null),
  baseRevision: documentRevisionSchema,
  title: documentTitleSchema,
  body: documentBodySchema,
  type: documentTypeSchema,
  createdAt: z.string(),
});

export type DocumentConflictDraft = z.infer<typeof documentConflictDraftSchema>;

export const discardDocumentConflictDraftInputSchema = z
  .object({
    documentId: documentIdSchema,
    conflictDraftId: documentIdSchema,
  })
  .strict();

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
  conflictDraftId?: string;
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

export interface DocumentLiveSectionSource {
  documentId: string;
  heading: string;
  projectId: string | null;
  sectionId: string;
  text: string;
  title: string;
  workspaceId: string | null;
}

export interface DocumentsAccess {
  captureConflictDraft?: (
    accountId: string,
    input: z.infer<typeof updateDocumentMutationInputSchema>,
  ) => Promise<DocumentConflictDraft>;
  conflictDrafts?: (
    accountId: string,
    documentId: string,
  ) => Promise<DocumentConflictDraft[] | null>;
  discardConflictDraft?: (
    accountId: string,
    documentId: string,
    conflictDraftId: string,
  ) => Promise<void>;
  get: (accountId: string, documentId: string) => Promise<Document | null>;
  getLiveSection?: (
    accountId: string,
    documentId: string,
    sectionId: string,
  ) => Promise<DocumentLiveSectionSource | null>;
  getLiveWork: (
    accountId: string,
    workId: string,
  ) => Promise<LiveWorkSource | null>;
  getVersion: (
    accountId: string,
    documentId: string,
    revision: number,
  ) => Promise<Document | null>;
  list: (accountId: string, scope: DocumentScope) => Promise<Document[]>;
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

export class DocumentConflictDraftError extends Error {
  constructor() {
    super("Conflict Draft is unavailable or has already been resolved.");
    this.name = "DocumentConflictDraftError";
  }
}

export class DocumentSectionCycleError extends Error {
  constructor() {
    super("Live Document sections cannot contain a cycle.");
    this.name = "DocumentSectionCycleError";
  }
}
