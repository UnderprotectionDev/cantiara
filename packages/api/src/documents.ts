import { z } from "zod";

import {
  DOCUMENT_STARTER_SKELETON_OPTIONS,
  DOCUMENT_STARTER_SKELETONS,
} from "./document-skeletons";
import {
  humanMutationEnvelopeSchema,
  type MutationContract,
} from "./mutation-and-undo";
import { tagNameKey } from "./tags";

export interface DocumentInlineTagToken {
  end: number;
  name: string;
  start: number;
}

const documentIndentedCodePattern = /^(?: {4}|\t)/;
const documentBackticksPattern = /`+/g;
const documentUrlPattern = /(?:https?:\/\/|mailto:|www\.)[^\s<>]+|<[^>\n]*>/g;
const documentLinkDestinationPattern = /\]\(/g;
const documentTagPattern =
  /(?<![\p{L}\p{N}_/#])#(?:\[((?:\\.|[^\]\\\r\n]){1,800})\]|([\p{L}\p{N}][\p{L}\p{N}_/-]{0,199})(?![\p{L}\p{N}_/-]))/gu;
const documentTagInvalidEscapePattern = /\\[^\\\]nr]/;
const documentTagEscapePattern = /\\([\\\]nr])/g;
const documentBareTagPattern = /^[\p{L}\p{N}][\p{L}\p{N}_/-]{0,199}$/u;
const documentQuotePrefixPattern = /^ {0,3}(?:> ?)+/;

function isEscapedMarkdownPosition(body: string, position: number) {
  let escapes = 0;
  for (
    let cursor = position - 1;
    cursor >= 0 && body[cursor] === "\\";
    cursor -= 1
  ) {
    escapes += 1;
  }
  return escapes % 2 === 1;
}

function markdownTagCodeRanges(body: string) {
  const excluded: Array<{ start: number; end: number }> = [];
  let fence: { marker: string; length: number } | null = null;
  let offset = 0;
  for (const rawLine of body.split("\n")) {
    const line = rawLine
      .replaceAll("\r", "")
      .replace(documentQuotePrefixPattern, "");
    const marker = markdownFencePattern.exec(line)?.[1];
    if (fence || marker || documentIndentedCodePattern.test(line)) {
      const previous = excluded.at(-1);
      if (previous && previous.end + 1 === offset) {
        previous.end = offset + rawLine.length;
      } else {
        excluded.push({ start: offset, end: offset + rawLine.length });
      }
    }
    if (fence) {
      const closing = markdownFenceClosePattern.exec(line)?.[1];
      if (closing?.[0] === fence.marker && closing.length >= fence.length) {
        fence = null;
      }
    } else if (marker) {
      fence = { marker: marker[0] ?? "", length: marker.length };
    }
    offset += rawLine.length + 1;
  }
  return excluded;
}

function isExcludedPosition(
  ranges: readonly { start: number; end: number }[],
  position: number,
) {
  let start = 0;
  let end = ranges.length - 1;
  while (start <= end) {
    const middle = Math.floor((start + end) / 2);
    const range = ranges[middle];
    if (!range) {
      return false;
    }
    if (position < range.start) {
      end = middle - 1;
    } else if (position >= range.end) {
      start = middle + 1;
    } else {
      return true;
    }
  }
  return false;
}

function markdownInlineCodeRanges(
  body: string,
  excluded: readonly { start: number; end: number }[],
) {
  const ticks = [...body.matchAll(documentBackticksPattern)].filter(
    (match) =>
      !(
        isExcludedPosition(excluded, match.index) ||
        isEscapedMarkdownPosition(body, match.index)
      ),
  );
  const nextByLength = new Map<number, number>();
  const closings = new Map<number, number>();
  for (let index = ticks.length - 1; index >= 0; index -= 1) {
    const length = ticks[index]?.[0].length ?? 0;
    const closing = nextByLength.get(length);
    if (closing !== undefined) {
      closings.set(index, closing);
    }
    nextByLength.set(length, index);
  }
  const ranges: Array<{ start: number; end: number }> = [];
  for (let index = 0; index < ticks.length; index += 1) {
    const opening = ticks[index];
    const closingIndex = closings.get(index);
    if (!opening || closingIndex === undefined) {
      continue;
    }
    const closing = ticks[closingIndex];
    if (closing) {
      ranges.push({
        start: opening.index,
        end: closing.index + closing[0].length,
      });
      index = closingIndex;
    }
  }
  return ranges;
}

function markdownTagUrlRanges(body: string) {
  const ranges = [...body.matchAll(documentUrlPattern)].map((match) => ({
    start: match.index,
    end: match.index + match[0].length,
  }));
  for (const opening of body.matchAll(documentLinkDestinationPattern)) {
    const { index: openingIndex } = opening;
    let depth = 1;
    for (
      let cursor = openingIndex + 2;
      cursor < body.length && body[cursor] !== "\n";
      cursor += 1
    ) {
      if (isEscapedMarkdownPosition(body, cursor)) {
        continue;
      }
      if (body[cursor] === "(") {
        depth += 1;
      } else if (body[cursor] === ")") {
        depth -= 1;
      }
      if (depth === 0) {
        ranges.push({ start: openingIndex, end: cursor + 1 });
        break;
      }
    }
  }
  return ranges;
}

function inlineTagName(match: RegExpMatchArray) {
  const [, encodedName, bareName] = match;
  if (encodedName && documentTagInvalidEscapePattern.test(encodedName)) {
    return "";
  }
  return encodedName
    ? encodedName.replace(
        documentTagEscapePattern,
        (_match, escaped: string) => {
          if (escaped === "n") {
            return "\n";
          }
          return escaped === "r" ? "\r" : escaped;
        },
      )
    : (bareName ?? "");
}

export function documentInlineTagTokens(
  body: string,
): DocumentInlineTagToken[] {
  const codeRanges = markdownTagCodeRanges(body);
  const excluded = [
    ...codeRanges,
    ...markdownInlineCodeRanges(body, codeRanges),
    ...markdownTagUrlRanges(body),
  ].sort((left, right) => left.start - right.start);
  const merged: Array<{ start: number; end: number }> = [];
  for (const range of excluded) {
    const previous = merged.at(-1);
    if (previous && range.start <= previous.end) {
      previous.end = Math.max(previous.end, range.end);
    } else {
      merged.push({ ...range });
    }
  }
  const tokens: DocumentInlineTagToken[] = [];
  for (const match of body.matchAll(documentTagPattern)) {
    const { index: start } = match;
    const end = start + match[0].length;
    if (
      isEscapedMarkdownPosition(body, start) ||
      isExcludedPosition(merged, start) ||
      isExcludedPosition(merged, end - 1)
    ) {
      continue;
    }
    const name = inlineTagName(match);
    if (name.length <= 200 && name.trim()) {
      tokens.push({ start, end, name });
    }
  }
  return tokens;
}

export interface DocumentInlineTag extends DocumentInlineTagToken {
  tagId: string;
}

export function renameDocumentInlineTag(
  body: string,
  inlineTags: readonly DocumentInlineTag[],
  tagId: string,
  name: string,
) {
  const token = documentBareTagPattern.test(name)
    ? `#${name}`
    : `#[${name.replaceAll("\\", "\\\\").replaceAll("]", "\\]").replaceAll("\n", "\\n").replaceAll("\r", "\\r")}]`;
  let nextBody = "";
  let cursor = 0;
  const nextTags: DocumentInlineTag[] = [];
  for (const current of [...inlineTags].sort(
    (left, right) => left.start - right.start,
  )) {
    nextBody += body.slice(cursor, current.start);
    const start = nextBody.length;
    const replacement =
      current.tagId === tagId ? token : body.slice(current.start, current.end);
    nextBody += replacement;
    nextTags.push({
      ...current,
      start,
      end: nextBody.length,
      name: current.tagId === tagId ? name : current.name,
    });
    cursor = current.end;
  }
  return { body: nextBody + body.slice(cursor), inlineTags: nextTags };
}

export function resolveDocumentInlineTags(
  body: string,
  tags: readonly { id: string; name: string }[],
  existingBindings: readonly DocumentInlineTag[] = [],
): DocumentInlineTag[] {
  const byName = new Map(tags.map((tag) => [tagNameKey(tag.name), tag.id]));
  const availableIds = new Set(tags.map(({ id }) => id));
  const byPosition = new Map(
    existingBindings.map((binding) => [binding.start, binding]),
  );
  return documentInlineTagTokens(body).flatMap((token) => {
    const existing = byPosition.get(token.start);
    const tagId =
      existing &&
      existing.end === token.end &&
      existing.name === token.name &&
      availableIds.has(existing.tagId)
        ? existing.tagId
        : byName.get(tagNameKey(token.name));
    return tagId ? [{ ...token, tagId }] : [];
  });
}

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
export const documentHierarchyInputSchema = z
  .object({
    documentId: documentIdSchema,
    folder: z.string().trim().min(1).max(255).nullable(),
    parentDocumentId: documentIdSchema.nullable(),
  })
  .strict();
export const documentOrganizationInputSchema = z.discriminatedUnion("action", [
  documentHierarchyInputSchema.extend({ action: z.literal("hierarchy") }),
  z
    .object({
      action: z.literal("archive"),
      documentId: documentIdSchema,
      archived: z.boolean(),
    })
    .strict(),
]);
export const organizeDocumentMutationInputSchema = z.discriminatedUnion(
  "action",
  [
    documentOrganizationInputSchema.options[0].extend(
      humanMutationEnvelopeSchema.shape,
    ),
    documentOrganizationInputSchema.options[1].extend(
      humanMutationEnvelopeSchema.shape,
    ),
  ],
);
export type DocumentHierarchyInput = z.infer<
  typeof documentHierarchyInputSchema
>;
export type DocumentOrganizationInput = z.infer<
  typeof documentOrganizationInputSchema
>;
export interface DocumentHierarchyPreview {
  allowed: boolean;
  depth: number;
  descendantIds: string[];
  descendants?: Array<{
    id: string;
    title: string;
    archivedAt?: string | null;
  }>;
  reason: string | null;
}

export function previewDocumentHierarchy(
  documents: readonly Pick<Document, "id" | "projectId" | "parentDocumentId">[],
  input: DocumentHierarchyInput,
): DocumentHierarchyPreview {
  const record = documents.find(({ id }) => id === input.documentId);
  const byId = new Map(documents.map((item) => [item.id, item]));
  const descendantIds: string[] = [];
  const visited = new Set([input.documentId]);
  let frontier = [input.documentId];
  let height = 1;
  while (frontier.length) {
    const next = documents
      .filter(
        (item) =>
          item.parentDocumentId &&
          frontier.includes(item.parentDocumentId) &&
          !visited.has(item.id),
      )
      .map(({ id }) => id);
    for (const id of next) {
      visited.add(id);
      descendantIds.push(id);
    }
    if (next.length) {
      height += 1;
    }
    frontier = next;
  }
  let depth = 1;
  let parentId = input.parentDocumentId;
  const ancestors = new Set<string>();
  let reason: string | null = record ? null : "Document is unavailable.";
  while (parentId && !reason) {
    if (visited.has(parentId) || ancestors.has(parentId)) {
      reason = "Document hierarchy cannot contain a cycle.";
      break;
    }
    ancestors.add(parentId);
    const parent = byId.get(parentId);
    if (!parent || parent.projectId !== record?.projectId) {
      reason = "Parent Document must belong to the same scope.";
      break;
    }
    depth += 1;
    parentId = parent.parentDocumentId ?? null;
  }
  if (!reason && depth + height - 1 > 3) {
    reason = "Document hierarchy is limited to three levels.";
  }
  return { allowed: reason === null, reason, depth, descendantIds };
}
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
  source: { id: string; projectId: string; title: string } | null;
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

export const createDocumentInputSchema = z
  .object({
    projectId: projectIdSchema,
    title: documentTitleSchema,
    body: documentBodySchema,
    type: documentTypeSchema,
  })
  .strict();

export const createDocumentSkeletonInputSchema = z
  .object({
    projectId: projectIdSchema,
    skeleton: z.enum(DOCUMENT_STARTER_SKELETON_OPTIONS),
  })
  .strict();

export const documentCreationInputSchema = z.union([
  createDocumentInputSchema,
  createDocumentSkeletonInputSchema,
]);

export function documentCreationFields(
  input: z.infer<typeof documentCreationInputSchema>,
): CreateDocumentInput {
  if (!("skeleton" in input)) {
    return createDocumentInputSchema.parse(input);
  }
  const selection = DOCUMENT_STARTER_SKELETONS.find(
    ({ skeleton, surface }) =>
      skeleton === input.skeleton && surface === "Document",
  );
  if (!selection) {
    throw new DocumentUnavailableError();
  }
  const documentTypeBySkeleton = {
    Persona: "Persona",
    Retrospective: "General",
    "Launch Plan": "Plan",
  } as const;
  return createDocumentInputSchema.parse({
    body: selection.emptyHeadings
      .map((heading) => `## ${heading}`)
      .join("\n\n"),
    projectId: input.projectId,
    title: input.skeleton,
    type: documentTypeBySkeleton[input.skeleton],
  });
}

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

export const createDocumentMutationInputSchema = z.union([
  createDocumentInputSchema.extend(humanMutationEnvelopeSchema.shape).strict(),
  createDocumentSkeletonInputSchema
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

export const documentSchema = createDocumentInputSchema.extend({
  archivedAt: z.string().nullable().optional(),
  folder: z.string().nullable().optional(),
  parentDocumentId: documentIdSchema.nullable().optional(),
  inlineTags: z
    .array(
      z.object({
        tagId: documentIdSchema,
        name: z.string(),
        start: z.number().int().nonnegative(),
        end: z.number().int().positive(),
      }),
    )
    .optional(),
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
  organize?: (accountId: string) => MutationContract<DocumentMutationValue>;
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
  projectId: string;
  sectionId: string;
  text: string;
  title: string;
}

export interface DocumentsAccess {
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
  list: (
    accountId: string,
    projectId: string,
    archived?: boolean,
  ) => Promise<Document[]>;
  previewOrganization?: (
    accountId: string,
    input: DocumentOrganizationInput,
  ) => Promise<DocumentHierarchyPreview>;
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

export class DocumentSectionCycleError extends Error {
  constructor() {
    super("Live Document sections cannot contain a cycle.");
    this.name = "DocumentSectionCycleError";
  }
}

export class DocumentHierarchyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DocumentHierarchyError";
  }
}
