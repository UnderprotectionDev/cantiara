import { z } from "zod";

import { customFieldValuePayloadSchema } from "./custom-fields";
import {
  humanMutationEnvelopeSchema,
  type MutationPayload,
} from "./mutation-and-undo";
import {
  type WorkChecklistItem,
  type WorkProfile,
  type WorkType,
  workChecklistSchema,
  workDescriptionSchema,
  workTypeSchema,
} from "./work-lifecycle";

const identifierSchema = z.string().trim().min(1).max(255);

/**
 * Custom field values carried as Draft form state (workflow 10 owns the
 * schema; the Draft never writes Custom field value rows until `Create`).
 */
export const customFieldDraftValuesSchema = z.record(
  identifierSchema,
  customFieldValuePayloadSchema.nullable(),
);

export type CustomFieldDraftValues = z.output<
  typeof customFieldDraftValuesSchema
>;

export const workDraftTitleSchema = z
  .string()
  .max(255, "Draft title must be 255 characters or fewer.");

const workDraftFormObjectSchema = z
  .object({
    checklist: workChecklistSchema.default([]),
    customFieldValues: customFieldDraftValuesSchema.default({}),
    description: workDescriptionSchema.default(null),
    projectId: identifierSchema,
    title: workDraftTitleSchema,
    type: workTypeSchema.default("Task"),
  })
  .strict();

export const workDraftFormSchema = workDraftFormObjectSchema;

export const saveWorkDraftInputSchema = humanMutationEnvelopeSchema
  .extend({
    draftId: identifierSchema,
    ...workDraftFormObjectSchema.shape,
  })
  .strict();

export const workDraftInputSchema = z
  .object({ draftId: identifierSchema })
  .strict();

export const workDraftsInputSchema = z
  .object({ projectId: identifierSchema.optional() })
  .strict();

export const deleteWorkDraftInputSchema = humanMutationEnvelopeSchema
  .extend(workDraftInputSchema.shape)
  .strict();

export const finalizeWorkDraftInputSchema = humanMutationEnvelopeSchema
  .extend(workDraftInputSchema.shape)
  .strict();

export type WorkDraftForm = z.output<typeof workDraftFormSchema>;
export type WorkDraftFormInput = z.input<typeof workDraftFormSchema>;
export type SaveWorkDraftInput = z.input<typeof saveWorkDraftInputSchema>;
export type DeleteWorkDraftInput = z.input<typeof deleteWorkDraftInputSchema>;
export type FinalizeWorkDraftInput = z.input<
  typeof finalizeWorkDraftInputSchema
>;

export interface WorkDraft {
  checklist: WorkChecklistItem[];
  createdAt: string;
  customFieldValues: CustomFieldDraftValues;
  description: string | null;
  id: string;
  projectId: string;
  revision: number;
  title: string;
  type: WorkType;
  updatedAt: string;
}

export interface WorkDraftsAccess {
  delete: (
    accountId: string,
    input: DeleteWorkDraftInput,
  ) => Promise<{ deleted: boolean }>;
  finalize: (
    accountId: string,
    input: FinalizeWorkDraftInput,
  ) => Promise<WorkProfile>;
  find: (accountId: string, draftId: string) => Promise<WorkDraft | null>;
  list: (accountId: string, projectId?: string) => Promise<WorkDraft[]>;
  save: (accountId: string, input: SaveWorkDraftInput) => Promise<WorkDraft>;
}

export type WorkDraftMutationPayload = WorkDraftForm & {
  draftId: string;
};

export interface WorkDraftDeleteMutationPayload
  extends Record<string, MutationPayload> {
  draftId: string;
}

export interface WorkDraftMutationValue {
  draft: WorkDraft | null;
}

export function workDraftMutationPayload(
  input: SaveWorkDraftInput,
): WorkDraftMutationPayload {
  const parsed = saveWorkDraftInputSchema.parse(input);
  return {
    checklist: parsed.checklist,
    customFieldValues: parsed.customFieldValues,
    description: parsed.description,
    draftId: parsed.draftId,
    projectId: parsed.projectId,
    title: parsed.title,
    type: parsed.type,
  };
}

export function workDraftMutationTarget(
  accountId: string,
  draftId: string,
): string {
  return `work-draft:${accountId}:${draftId}`;
}

export function workDraftDeleteMutationPayload(
  input: DeleteWorkDraftInput,
): WorkDraftDeleteMutationPayload {
  const parsed = deleteWorkDraftInputSchema.parse(input);
  return { draftId: parsed.draftId };
}
