import { z } from "zod";

import {
  documentBodySchema,
  documentLiveDirectives,
  documentRecordReferences,
  documentTitleSchema,
  documentTypeSchema,
  isInsideMarkdownCodeSpan,
  projectIdSchema,
} from "./documents";
import type { MutationContract } from "./mutation-and-undo";
import { humanMutationEnvelopeSchema } from "./mutation-and-undo";

export const personalReviewTemplate = {
  id: "personal-review",
  name: "Personal Review",
  body: "## Period\n\n## What changed?\n\n## What worked?\n\n## What was difficult?\n\n## Decisions and learnings\n\n## What will I change next?\n\n## Related records\n",
  type: "General",
} as const;

const placeholderPattern = /\{\{([a-z][a-z0-9_]*)\}\}/g;
const fenceOpeningPattern = /^ {0,3}(`{3,}|~{3,})/;
const fenceClosingPattern = /^ {0,3}(`{3,}|~{3,})[ \t]*$/;
const blockquotePrefixPattern = /^(?: {0,3}>[ \t]?)+/;
const linePattern = /\n/;
const indentedCodePattern = /^(?: {4}|\t)/;

function markdownContainerContent(line: string) {
  return line.replace(blockquotePrefixPattern, "");
}

function textPlaceholderRanges(text: string, offset: number) {
  return [...text.matchAll(placeholderPattern)]
    .filter(
      (match) =>
        !(
          isInsideMarkdownCodeSpan(text, match.index) ||
          indentedCodePattern.test(
            text.slice(
              text.lastIndexOf("\n", match.index - 1) + 1,
              match.index,
            ),
          )
        ),
    )
    .map((match) => ({
      name: match[1] ?? "",
      start: offset + match.index,
      end: offset + match.index + match[0].length,
    }));
}

function placeholderRanges(body: string) {
  const ranges: { name: string; start: number; end: number }[] = [];
  let fence: string | null = null;
  let offset = 0;
  let textStart = 0;
  for (const line of body.split(linePattern)) {
    const content = markdownContainerContent(line);
    const marker = fenceOpeningPattern.exec(content)?.[1];
    if (fence) {
      const closing = fenceClosingPattern.exec(content.trimEnd())?.[1];
      if (
        closing &&
        closing[0] === fence[0] &&
        closing.length >= fence.length
      ) {
        fence = null;
        textStart = offset + line.length + 1;
      }
    } else if (marker) {
      ranges.push(
        ...textPlaceholderRanges(body.slice(textStart, offset), textStart),
      );
      fence = marker;
    }
    offset += line.length + 1;
  }
  if (!fence) {
    ranges.push(...textPlaceholderRanges(body.slice(textStart), textStart));
  }
  return ranges;
}

export function documentTemplateFields(body: string): string[] {
  return [...new Set(placeholderRanges(body).map(({ name }) => name))];
}

export function documentTemplateSkeleton(body: string): string {
  const replacements = [
    ...documentRecordReferences(body).map(({ start, end, label }) => ({
      start,
      end,
      text: label,
    })),
    ...documentLiveDirectives(body).map(({ start, end }) => ({
      start,
      end,
      text: "",
    })),
  ].sort((left, right) => left.start - right.start);
  let result = "";
  let offset = 0;
  for (const replacement of replacements) {
    if (replacement.start < offset) {
      continue;
    }
    result += body.slice(offset, replacement.start) + replacement.text;
    offset = replacement.end;
  }
  return result + body.slice(offset);
}

export function renderDocumentTemplate(
  body: string,
  values: Record<string, string>,
): string {
  let result = "";
  let offset = 0;
  for (const range of placeholderRanges(body)) {
    if (!Object.hasOwn(values, range.name)) {
      throw new Error(`A value is required for ${range.name}.`);
    }
    result += body.slice(offset, range.start) + values[range.name];
    offset = range.end;
  }
  return documentBodySchema.parse(
    documentTemplateSkeleton(result + body.slice(offset)),
  );
}

export const documentTemplateScopeSchema = z
  .object({ projectId: projectIdSchema.nullable() })
  .strict();
export const documentTemplateDefinitionSchema = documentTemplateScopeSchema
  .extend({
    name: documentTitleSchema,
    body: documentBodySchema,
    type: documentTypeSchema,
  })
  .strict();
export const documentTemplateSchema = documentTemplateDefinitionSchema
  .extend({
    id: z.string().min(1).max(255),
    revision: z.number().int().positive(),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  })
  .strict();
export const createDocumentTemplateInputSchema =
  documentTemplateDefinitionSchema
    .extend({
      sourceDocumentId: z.string().min(1).max(255).optional(),
      sourceRevision: z.number().int().positive().optional(),
      ...humanMutationEnvelopeSchema.shape,
    })
    .strict()
    .refine(
      (input) =>
        Boolean(input.sourceDocumentId) === Boolean(input.sourceRevision),
      "Source Document and Version must be provided together.",
    );
export const updateDocumentTemplateInputSchema =
  documentTemplateDefinitionSchema
    .omit({ projectId: true })
    .extend({
      templateId: z.string().min(1).max(255),
      ...humanMutationEnvelopeSchema.shape,
    })
    .strict();
export const documentTemplateInstantiationSchema = documentTemplateScopeSchema
  .extend({
    templateId: z.string().min(1).max(255),
    templateRevision: z.number().int().positive().optional(),
    title: documentTitleSchema,
    values: z.record(z.string(), z.string().max(100_000)),
  })
  .strict();
export const createDocumentFromTemplateInputSchema =
  documentTemplateInstantiationSchema
    .extend(humanMutationEnvelopeSchema.shape)
    .strict();

export type DocumentTemplate = z.infer<typeof documentTemplateSchema>;
export interface DocumentTemplateMutationValue {
  template: DocumentTemplate | null;
}
export interface DocumentTemplateAccess {
  get: (
    accountId: string,
    templateId: string,
  ) => Promise<DocumentTemplate | null>;
  list: (
    accountId: string,
    projectId: string | null,
  ) => Promise<DocumentTemplate[]>;
}
export interface DocumentTemplateMutationContracts {
  create: (
    accountId: string,
  ) => MutationContract<DocumentTemplateMutationValue>;
  update: (
    accountId: string,
  ) => MutationContract<DocumentTemplateMutationValue>;
}
