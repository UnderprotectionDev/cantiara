import { z } from "zod";

import {
  humanMutationEnvelopeSchema,
  type MutationContract,
} from "./mutation-and-undo";

export const CUSTOM_FIELD_TYPE_OPTIONS = [
  "Text",
  "Number",
  "Boolean",
  "Date",
  "Single select",
  "Multi select",
] as const;

export type CustomFieldType = (typeof CUSTOM_FIELD_TYPE_OPTIONS)[number];

export const customFieldTypeSchema = z.enum(CUSTOM_FIELD_TYPE_OPTIONS);

export const CUSTOM_FIELD_RECORD_TYPE_OPTIONS = [
  "Work",
  "Feedback",
  "User Research Session",
  "Risk",
  "Assumption",
  "Decision",
  "Test Handoff",
  "Test Session",
  "Planned Test Scenario",
  "Test Gap",
  "Production Incident",
  "Milestone",
  "Project Release",
] as const;

export type CustomFieldRecordType =
  (typeof CUSTOM_FIELD_RECORD_TYPE_OPTIONS)[number];

export const customFieldRecordTypeSchema = z.enum(
  CUSTOM_FIELD_RECORD_TYPE_OPTIONS,
);

const identifierSchema = z.string().trim().min(1).max(255);

export const customFieldNameSchema = z
  .string()
  .trim()
  .min(1, "Field name is required.")
  .max(200, "Field name must be 200 characters or fewer.");

export const customFieldOptionsSchema = z
  .array(z.string().trim().min(1).max(200))
  .max(100, "A field can have at most 100 options.")
  .superRefine((options, context) => {
    const seen = new Set<string>();
    for (const [index, option] of options.entries()) {
      const key = option.toLocaleLowerCase("en-US");
      if (seen.has(key)) {
        context.addIssue({
          code: "custom",
          message: "Select options must be unique.",
          path: [index],
        });
      }
      seen.add(key);
    }
  });

const customFieldRecordTypesSchema = z
  .array(customFieldRecordTypeSchema)
  .min(1, "Choose at least one record type.")
  .max(CUSTOM_FIELD_RECORD_TYPE_OPTIONS.length)
  .superRefine((recordTypes, context) => {
    if (new Set(recordTypes).size !== recordTypes.length) {
      context.addIssue({
        code: "custom",
        message: "Record types must be unique.",
      });
    }
  });

const customFieldCreationFieldsSchema = z
  .object({
    name: customFieldNameSchema,
    options: customFieldOptionsSchema.optional(),
    projectId: identifierSchema,
    recordTypes: customFieldRecordTypesSchema,
    type: customFieldTypeSchema,
  })
  .strict();

function validateCustomFieldOptions(
  input: { options?: readonly string[]; type: CustomFieldType },
  context: z.RefinementCtx,
) {
  const options = input.options ?? [];
  const isSelect =
    input.type === "Single select" || input.type === "Multi select";

  if (isSelect && options.length === 0) {
    context.addIssue({
      code: "custom",
      message:
        "Single select and Multi select fields need at least one option.",
      path: ["options"],
    });
  }

  if (!isSelect && options.length > 0) {
    context.addIssue({
      code: "custom",
      message: "Only Single select and Multi select fields can define options.",
      path: ["options"],
    });
  }
}

const customFieldCreationFieldsWithDefaultsSchema =
  customFieldCreationFieldsSchema
    .superRefine(validateCustomFieldOptions)
    .transform((input) => ({
      ...input,
      options: input.options ?? [],
    }));

export const createCustomFieldInputSchema =
  customFieldCreationFieldsWithDefaultsSchema;

export const createCustomFieldMutationInputSchema = humanMutationEnvelopeSchema
  .extend(customFieldCreationFieldsSchema.shape)
  .superRefine(validateCustomFieldOptions)
  .transform((input) => ({
    ...input,
    options: input.options ?? [],
  }));

export type CreateCustomFieldInput = z.input<
  typeof createCustomFieldInputSchema
>;
export type ParsedCreateCustomFieldInput = z.output<
  typeof createCustomFieldInputSchema
>;
export type CreateCustomFieldMutationInput = z.input<
  typeof createCustomFieldMutationInputSchema
>;

export const customFieldDateValueSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use a calendar date (YYYY-MM-DD).");

/**
 * Closed value payloads for the six supported field kinds. A Date value is a
 * calendar date string and is never rewritten into a zoned instant.
 */
export const customFieldValuePayloadSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("boolean"), boolean: z.boolean() }).strict(),
  z
    .object({ kind: z.literal("date"), date: customFieldDateValueSchema })
    .strict(),
  z.object({ kind: z.literal("number"), number: z.number().finite() }).strict(),
  z
    .object({
      kind: z.literal("option"),
      option: z.string().trim().min(1).max(200),
    })
    .strict(),
  z
    .object({
      kind: z.literal("options"),
      options: customFieldOptionsSchema.min(
        1,
        "Choose at least one option or clear the field.",
      ),
    })
    .strict(),
  z
    .object({
      kind: z.literal("text"),
      text: z
        .string()
        .trim()
        .min(1, "Enter a value or clear the field.")
        .max(2000, "The value must be 2000 characters or fewer."),
    })
    .strict(),
]);

export type ParsedCustomFieldValuePayload = z.output<
  typeof customFieldValuePayloadSchema
>;

export const customFieldDefinitionSchema = z
  .object({
    createdAt: z.string().datetime({ offset: true }),
    id: identifierSchema,
    name: customFieldNameSchema,
    options: customFieldOptionsSchema,
    projectId: identifierSchema,
    recordTypes: customFieldRecordTypesSchema,
    revision: z.number().int().nonnegative().safe(),
    trashedAt: z.string().datetime({ offset: true }).nullable(),
    type: customFieldTypeSchema,
    updatedAt: z.string().datetime({ offset: true }),
  })
  .strict();

export type CustomFieldDefinition = z.infer<typeof customFieldDefinitionSchema>;

export function customFieldNameKey(name: string) {
  return name.trim().toLocaleLowerCase("en-US");
}

export function isSelectCustomFieldType(type: CustomFieldType) {
  return type === "Single select" || type === "Multi select";
}

export const setCustomFieldValueInputSchema = z
  .object({
    definitionId: identifierSchema,
    payload: customFieldValuePayloadSchema,
    recordId: identifierSchema,
    recordType: customFieldRecordTypeSchema,
  })
  .strict();

export const setCustomFieldValueMutationInputSchema =
  humanMutationEnvelopeSchema.extend(setCustomFieldValueInputSchema.shape);

export const clearCustomFieldValueInputSchema = z
  .object({
    definitionId: identifierSchema,
    recordId: identifierSchema,
    recordType: customFieldRecordTypeSchema,
  })
  .strict();

export const clearCustomFieldValueMutationInputSchema =
  humanMutationEnvelopeSchema.extend(clearCustomFieldValueInputSchema.shape);

export const customFieldValueRecordSchema = z
  .object({
    createdAt: z.string().datetime({ offset: true }),
    definitionId: identifierSchema,
    id: identifierSchema,
    recordId: identifierSchema,
    recordType: customFieldRecordTypeSchema,
    revision: z.number().int().nonnegative().safe(),
    updatedAt: z.string().datetime({ offset: true }),
    value: customFieldValuePayloadSchema,
  })
  .strict();

export type CustomFieldValueRecord = z.infer<
  typeof customFieldValueRecordSchema
>;

export const customFieldValuesInputSchema = z
  .object({
    projectId: identifierSchema,
    recordId: identifierSchema,
    recordType: customFieldRecordTypeSchema,
  })
  .strict();

export const customFieldSearchFieldsInputSchema = z
  .object({
    projectId: identifierSchema,
    recordType: customFieldRecordTypeSchema,
  })
  .strict();

export type CustomFieldSearchFieldsInput = z.input<
  typeof customFieldSearchFieldsInputSchema
>;

export const copyCustomFieldDefinitionsInputSchema = z
  .object({
    sourceProjectId: identifierSchema,
    targetProjectId: identifierSchema,
  })
  .strict()
  .refine((input) => input.sourceProjectId !== input.targetProjectId, {
    message: "Source and target Projects must be different.",
    path: ["targetProjectId"],
  });

export type CopyCustomFieldDefinitionsInput = z.input<
  typeof copyCustomFieldDefinitionsInputSchema
>;

export interface CustomFieldValueListItem {
  definition: CustomFieldDefinition;
  value: CustomFieldValueRecord | null;
}

export const updateCustomFieldInputSchema = z
  .object({
    name: customFieldNameSchema,
    options: customFieldOptionsSchema,
    recordTypes: customFieldRecordTypesSchema,
  })
  .strict();

export const updateCustomFieldMutationInputSchema =
  humanMutationEnvelopeSchema.extend({
    definitionId: identifierSchema,
    name: customFieldNameSchema,
    options: customFieldOptionsSchema,
    recordTypes: customFieldRecordTypesSchema,
  });

export type UpdateCustomFieldInput = z.input<
  typeof updateCustomFieldInputSchema
>;
export type ParsedUpdateCustomFieldInput = z.output<
  typeof updateCustomFieldInputSchema
>;

export const trashCustomFieldInputSchema = z
  .object({ definitionId: identifierSchema })
  .strict();

export const trashCustomFieldMutationInputSchema =
  humanMutationEnvelopeSchema.extend(trashCustomFieldInputSchema.shape);

export const restoreCustomFieldInputSchema = trashCustomFieldInputSchema;

export const restoreCustomFieldMutationInputSchema =
  trashCustomFieldMutationInputSchema;

export const deleteCustomFieldInputSchema = trashCustomFieldInputSchema;

export const deleteCustomFieldMutationInputSchema =
  trashCustomFieldMutationInputSchema;

export const previewCustomFieldOptionDeletionInputSchema = z
  .object({
    definitionId: identifierSchema,
    option: z.string().trim().min(1).max(200),
  })
  .strict();

export interface CustomFieldStore {
  copyDefinitions: (
    workspaceId: string,
    input: z.output<typeof copyCustomFieldDefinitionsInputSchema>,
  ) => Promise<CustomFieldDefinition[] | null>;
  countOptionUsage: (
    workspaceId: string,
    definitionId: string,
    option: string,
  ) => Promise<number | null>;
  create: (
    workspaceId: string,
    input: ParsedCreateCustomFieldInput,
  ) => Promise<CustomFieldDefinition>;
  findWorkspaceId: (accountId: string) => Promise<string | null>;
  list: (
    workspaceId: string,
    projectId: string,
  ) => Promise<CustomFieldDefinition[] | null>;
  listSearchFields: (
    workspaceId: string,
    projectId: string,
    recordType: CustomFieldRecordType,
  ) => Promise<CustomFieldDefinition[] | null>;
  listValues: (
    workspaceId: string,
    projectId: string,
    recordType: CustomFieldRecordType,
    recordId: string,
  ) => Promise<CustomFieldValueListItem[] | null>;
}

export interface CustomFieldsAccess {
  copyDefinitions: (
    accountId: string,
    input: CopyCustomFieldDefinitionsInput,
  ) => Promise<CustomFieldDefinition[] | null>;
  create: (
    accountId: string,
    input: CreateCustomFieldInput,
  ) => Promise<CustomFieldDefinition>;
  list: (
    accountId: string,
    projectId: string,
  ) => Promise<CustomFieldDefinition[] | null>;
  previewOptionDeletion: (
    accountId: string,
    input: z.output<typeof previewCustomFieldOptionDeletionInputSchema>,
  ) => Promise<{ affectedRecords: number }>;
  searchFields: (
    accountId: string,
    input: CustomFieldSearchFieldsInput,
  ) => Promise<CustomFieldDefinition[] | null>;
  values: (
    accountId: string,
    input: z.output<typeof customFieldValuesInputSchema>,
  ) => Promise<CustomFieldValueListItem[] | null>;
}

export interface CustomFieldMutationValue {
  field: CustomFieldDefinition | null;
}

export interface CustomFieldValueMutationValue {
  value: CustomFieldValueRecord | null;
}

export type CustomFieldMutationContract =
  MutationContract<CustomFieldMutationValue>;

export type CustomFieldValueMutationContract =
  MutationContract<CustomFieldValueMutationValue>;

export interface CustomFieldMutationContracts {
  clearValue: (accountId: string) => CustomFieldValueMutationContract;
  create: (accountId: string) => CustomFieldMutationContract;
  delete: (accountId: string) => CustomFieldMutationContract;
  restore: (accountId: string) => CustomFieldMutationContract;
  setValue: (accountId: string) => CustomFieldValueMutationContract;
  trash: (accountId: string) => CustomFieldMutationContract;
  update: (accountId: string) => CustomFieldMutationContract;
}
