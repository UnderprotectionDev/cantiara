import { z } from "zod";

import {
  humanMutationEnvelopeSchema,
  type MutationContract,
} from "./mutation-and-undo";

export const TAG_RECORD_TYPE_OPTIONS = ["Work"] as const;

export type TagRecordType = (typeof TAG_RECORD_TYPE_OPTIONS)[number];

export const tagRecordTypeSchema = z.enum(TAG_RECORD_TYPE_OPTIONS);

const identifierSchema = z.string().trim().min(1).max(255);
const revisionSchema = z.number().int().nonnegative().safe();

export const tagNameSchema = z
  .string()
  .trim()
  .min(1, "Tag name is required.")
  .max(200, "Tag name must be 200 characters or fewer.");

export function tagNameKey(name: string) {
  return name.trim().toLocaleLowerCase("en-US");
}

export const createTagInputSchema = z.object({ name: tagNameSchema }).strict();

export type CreateTagInput = z.input<typeof createTagInputSchema>;
export type ParsedCreateTagInput = z.output<typeof createTagInputSchema>;

export const renameTagInputSchema = z
  .object({
    expectedRevision: revisionSchema.optional(),
    name: tagNameSchema,
    tagId: identifierSchema,
  })
  .strict();

export type RenameTagInput = z.input<typeof renameTagInputSchema>;
export type ParsedRenameTagInput = z.output<typeof renameTagInputSchema>;

export const renameTagCommandSchema = z
  .object({
    name: tagNameSchema,
    tagId: identifierSchema,
  })
  .strict();

export type RenameTagCommand = z.infer<typeof renameTagCommandSchema>;

export type TagRenameAccess = (
  accountId: string,
  input: ParsedRenameTagInput,
) => Promise<Tag>;

export const renameTagMutationInputSchema = humanMutationEnvelopeSchema.extend(
  renameTagCommandSchema.shape,
);

export type RenameTagMutationInput = z.input<
  typeof renameTagMutationInputSchema
>;

export const undoTagRenameInputSchema = humanMutationEnvelopeSchema.extend({
  receiptId: identifierSchema,
  tagId: identifierSchema,
});

export type UndoTagRenameInput = z.input<typeof undoTagRenameInputSchema>;

export const tagSchema = z
  .object({
    createdAt: z.string().datetime({ offset: true }),
    id: identifierSchema,
    name: tagNameSchema,
    revision: z.number().int().nonnegative().safe(),
    updatedAt: z.string().datetime({ offset: true }),
  })
  .strict();

export type Tag = z.infer<typeof tagSchema>;

export interface TagRenameResult {
  receiptId: string;
  tag: Tag;
}

export interface TagMutationValue {
  tag: Tag | null;
}

export type TagMutationContract = MutationContract<TagMutationValue>;

export interface TagMutationContracts {
  rename: (accountId: string) => TagMutationContract;
}

export const TAG_MARKDOWN_MANIFEST_VERSION = 1 as const;

export const tagMarkdownManifestSchema = z
  .object({
    tags: z
      .array(
        z
          .object({
            id: identifierSchema,
            name: tagNameSchema,
          })
          .strict(),
      )
      .readonly(),
    version: z.literal(TAG_MARKDOWN_MANIFEST_VERSION),
  })
  .strict();

export type TagMarkdownManifest = z.infer<typeof tagMarkdownManifestSchema>;

export const tagMarkdownExportSchema = z
  .object({
    manifest: tagMarkdownManifestSchema,
    markdown: z.string(),
  })
  .strict();

export type TagMarkdownExport = z.infer<typeof tagMarkdownExportSchema>;

/**
 * The Documents exporter owns the Markdown body. This helper only packages
 * that unchanged body with the Workspace identity mapping it already
 * resolved, so an export cannot turn a Tag into a second copy identity.
 */
export function createTagMarkdownExport(
  markdown: string,
  tags: readonly Pick<Tag, "id" | "name">[],
): TagMarkdownExport {
  const manifestTags = tags
    .map(({ id, name }) => ({ id, name }))
    .sort((left, right) => left.id.localeCompare(right.id));

  return tagMarkdownExportSchema.parse({
    markdown,
    manifest: {
      tags: manifestTags,
      version: TAG_MARKDOWN_MANIFEST_VERSION,
    },
  });
}

export interface TagInlineRenameInput {
  committedAt: string;
  nextName: string;
  previousName: string;
  tagId: string;
  workspaceId: string;
}

/**
 * Documents owns tokenization and version creation. It participates in the
 * Tags rename transaction through this narrow writer instead of creating a
 * second tag dictionary or teaching Tags how to parse Markdown.
 */
export interface TagInlineRenameWriter<TTransaction = unknown> {
  renameInlineUses: (
    transaction: TTransaction,
    input: TagInlineRenameInput,
  ) => Promise<void>;
}

export const tagSuggestionSchema = z
  .object({
    projectUsageCount: z.number().int().nonnegative().safe(),
    tag: tagSchema,
  })
  .strict();

export type TagSuggestion = z.infer<typeof tagSuggestionSchema>;

export const tagAssignmentSchema = z
  .object({
    createdAt: z.string().datetime({ offset: true }),
    id: identifierSchema,
    recordId: identifierSchema,
    recordType: tagRecordTypeSchema,
    tagId: identifierSchema,
  })
  .strict();

export type TagAssignment = z.infer<typeof tagAssignmentSchema>;

export const tagRecordSchema = z
  .object({
    archivedAt: z.string().datetime({ offset: true }).nullable(),
    id: identifierSchema,
    key: identifierSchema,
    projectId: identifierSchema,
    recordType: tagRecordTypeSchema,
    tags: z.array(tagSchema),
    title: z.string().trim().min(1).max(255),
  })
  .strict();

export type TagRecord = z.infer<typeof tagRecordSchema>;

export const tagsInputSchema = z
  .object({ projectId: identifierSchema })
  .strict();

export type TagsInput = z.input<typeof tagsInputSchema>;

export const tagRecordsInputSchema = z
  .object({
    projectId: identifierSchema,
    tagId: identifierSchema.optional(),
  })
  .strict();

export type TagRecordsInput = z.input<typeof tagRecordsInputSchema>;

const tagAssignmentInputSchema = z
  .object({
    projectId: identifierSchema,
    recordId: identifierSchema,
    recordType: tagRecordTypeSchema,
    tagId: identifierSchema,
  })
  .strict();

export const applyTagInputSchema = tagAssignmentInputSchema;
export const removeTagInputSchema = tagAssignmentInputSchema;

export type ApplyTagInput = z.input<typeof applyTagInputSchema>;
export type RemoveTagInput = z.input<typeof removeTagInputSchema>;

export interface TagStore {
  apply: (
    workspaceId: string,
    input: ApplyTagInput,
  ) => Promise<TagAssignment | null>;
  create: (workspaceId: string, input: ParsedCreateTagInput) => Promise<Tag>;
  findWorkspaceId: (accountId: string) => Promise<string | null>;
  list: (
    workspaceId: string,
    projectId: string,
  ) => Promise<TagSuggestion[] | null>;
  listRecords: (
    workspaceId: string,
    input: TagRecordsInput,
  ) => Promise<TagRecord[] | null>;
  remove: (
    workspaceId: string,
    input: RemoveTagInput,
  ) => Promise<{ status: true } | null>;
}

export interface TagsAccess {
  apply: (
    accountId: string,
    input: ApplyTagInput,
  ) => Promise<TagAssignment | null>;
  create: (accountId: string, input: CreateTagInput) => Promise<Tag>;
  list: (
    accountId: string,
    projectId: string,
  ) => Promise<TagSuggestion[] | null>;
  records: (
    accountId: string,
    input: TagRecordsInput,
  ) => Promise<TagRecord[] | null>;
  remove: (
    accountId: string,
    input: RemoveTagInput,
  ) => Promise<{ status: true } | null>;
  rename: TagRenameAccess;
}
