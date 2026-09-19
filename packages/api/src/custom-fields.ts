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

export const customFieldDefinitionSchema = z
  .object({
    createdAt: z.string().datetime({ offset: true }),
    id: identifierSchema,
    name: customFieldNameSchema,
    options: customFieldOptionsSchema,
    projectId: identifierSchema,
    recordTypes: customFieldRecordTypesSchema,
    revision: z.number().int().nonnegative().safe(),
    type: customFieldTypeSchema,
    updatedAt: z.string().datetime({ offset: true }),
  })
  .strict();

export type CustomFieldDefinition = z.infer<typeof customFieldDefinitionSchema>;

export function customFieldNameKey(name: string) {
  return name.trim().toLocaleLowerCase("en-US");
}

export interface CustomFieldStore {
  create: (
    workspaceId: string,
    input: ParsedCreateCustomFieldInput,
  ) => Promise<CustomFieldDefinition>;
  findWorkspaceId: (accountId: string) => Promise<string | null>;
  list: (
    workspaceId: string,
    projectId: string,
  ) => Promise<CustomFieldDefinition[] | null>;
}

export interface CustomFieldsAccess {
  create: (
    accountId: string,
    input: CreateCustomFieldInput,
  ) => Promise<CustomFieldDefinition>;
  list: (
    accountId: string,
    projectId: string,
  ) => Promise<CustomFieldDefinition[] | null>;
}

export interface CustomFieldMutationValue {
  field: CustomFieldDefinition | null;
}

export type CustomFieldMutationContract =
  MutationContract<CustomFieldMutationValue>;

export interface CustomFieldMutationContracts {
  create: (accountId: string) => CustomFieldMutationContract;
}
