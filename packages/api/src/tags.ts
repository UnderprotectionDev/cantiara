import { z } from "zod";

export const TAG_RECORD_TYPE_OPTIONS = ["Work"] as const;

export type TagRecordType = (typeof TAG_RECORD_TYPE_OPTIONS)[number];

export const tagRecordTypeSchema = z.enum(TAG_RECORD_TYPE_OPTIONS);

const identifierSchema = z.string().trim().min(1).max(255);

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
}
