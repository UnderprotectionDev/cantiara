import { z } from "zod";

import { customFieldValuePayloadSchema } from "./custom-fields";
import { humanMutationEnvelopeSchema } from "./mutation-and-undo";
import { workOpenStatusSchema } from "./work-lifecycle";

const identifierSchema = z.string().trim().min(1).max(255);

export const recordActionNameSchema = z
  .string()
  .trim()
  .min(1, "Record Action name is required.")
  .max(200, "Record Action name must be 200 characters or fewer.");

const workStatusStepSchema = z
  .object({
    kind: z.literal("work-status"),
    status: workOpenStatusSchema,
  })
  .strict();

const dailyFocusMembershipStepSchema = z
  .object({
    kind: z.literal("daily-focus-membership"),
    operation: z.enum(["add", "remove"]),
  })
  .strict();

const setCustomFieldValueStepSchema = z
  .object({
    definitionId: identifierSchema,
    kind: z.literal("custom-field-value"),
    operation: z.literal("set"),
    value: customFieldValuePayloadSchema,
  })
  .strict();

export const recordActionStepSchema = z.union([
  workStatusStepSchema,
  dailyFocusMembershipStepSchema,
  setCustomFieldValueStepSchema,
]);

export type RecordActionStep = z.infer<typeof recordActionStepSchema>;

const recordActionStepsSchema = z
  .array(recordActionStepSchema)
  .min(1, "Choose at least one step.")
  .max(102, "A Record Action can have at most 102 steps.")
  .superRefine((steps, context) => {
    const targets = new Set<string>();
    for (const [index, step] of steps.entries()) {
      const target =
        step.kind === "custom-field-value"
          ? `${step.kind}:${step.definitionId}`
          : step.kind;
      if (targets.has(target)) {
        context.addIssue({
          code: "custom",
          message: "A Record Action can change each target only once.",
          path: [index],
        });
      }
      targets.add(target);
    }
  });

const recordActionDefinitionFields = z
  .object({
    name: recordActionNameSchema,
    steps: recordActionStepsSchema,
  })
  .strict();

function validateRecordActionDefinition(
  input: { name: string; steps: RecordActionStep[] },
  context: z.RefinementCtx,
) {
  if (input.name.toLocaleLowerCase("en-US") !== "start work") {
    return;
  }
  const startsWork = input.steps.some(
    (step) => step.kind === "work-status" && step.status === "In Progress",
  );
  const addsToDailyFocus = input.steps.some(
    (step) =>
      step.kind === "daily-focus-membership" && step.operation === "add",
  );
  if (!(startsWork && addsToDailyFocus)) {
    context.addIssue({
      code: "custom",
      message:
        "Start Work must set Work status to In Progress and add it to Daily Focus.",
      path: ["steps"],
    });
  }
}

const createRecordActionInputFields = recordActionDefinitionFields
  .extend({ projectId: identifierSchema })
  .strict();

export const createRecordActionInputSchema =
  createRecordActionInputFields.superRefine(validateRecordActionDefinition);

export type CreateRecordActionInput = z.input<
  typeof createRecordActionInputSchema
>;
export type ParsedCreateRecordActionInput = z.output<
  typeof createRecordActionInputSchema
>;

export const createRecordActionMutationInputSchema = humanMutationEnvelopeSchema
  .extend(createRecordActionInputFields.shape)
  .strict()
  .superRefine(validateRecordActionDefinition);

const updateRecordActionInputFields = recordActionDefinitionFields;

export const updateRecordActionInputSchema =
  updateRecordActionInputFields.superRefine(validateRecordActionDefinition);

export type UpdateRecordActionInput = z.input<
  typeof updateRecordActionInputSchema
>;
export type ParsedUpdateRecordActionInput = z.output<
  typeof updateRecordActionInputSchema
>;

export const updateRecordActionMutationInputSchema = humanMutationEnvelopeSchema
  .extend({
    actionId: identifierSchema,
    ...updateRecordActionInputFields.shape,
  })
  .strict()
  .superRefine(validateRecordActionDefinition);

export const trashRecordActionMutationInputSchema = humanMutationEnvelopeSchema
  .extend({ actionId: identifierSchema })
  .strict();

export const recordActionsInputSchema = z
  .object({ projectId: identifierSchema })
  .strict();

export const recordActionSchema = recordActionDefinitionFields
  .extend({
    createdAt: z.string().datetime({ offset: true }),
    id: identifierSchema,
    projectId: identifierSchema,
    revision: z.number().int().min(1).safe(),
    trashedAt: z.string().datetime({ offset: true }).nullable(),
    updatedAt: z.string().datetime({ offset: true }),
  })
  .strict()
  .superRefine(validateRecordActionDefinition);

export type RecordAction = z.infer<typeof recordActionSchema>;

export interface RecordActionsAccess {
  create: (
    accountId: string,
    input: ParsedCreateRecordActionInput,
  ) => Promise<RecordAction>;
  list: (
    accountId: string,
    projectId: string,
  ) => Promise<RecordAction[] | null>;
  trash: (
    accountId: string,
    actionId: string,
    baseRevision: number,
  ) => Promise<RecordAction | null>;
  update: (
    accountId: string,
    actionId: string,
    baseRevision: number,
    input: ParsedUpdateRecordActionInput,
  ) => Promise<RecordAction | null>;
}
