import { addDays, format, isValid, parseISO } from "date-fns";
import { z } from "zod";

import { customFieldOptionsSchema } from "./custom-fields";
import { humanMutationEnvelopeSchema } from "./mutation-and-undo";
import { workDescriptionSchema, workTypeSchema } from "./work-lifecycle";

const identifierSchema = z.string().trim().min(1).max(255);
const calendarDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must use YYYY-MM-DD.")
  .refine(
    (value) => {
      const parsed = parseISO(value);
      return isValid(parsed) && format(parsed, "yyyy-MM-dd") === value;
    },
    { message: "Date must be a real calendar day." },
  );

export const workTemplateNameSchema = z
  .string()
  .trim()
  .min(1, "Work Template name is required.")
  .max(200, "Work Template name must be 200 characters or fewer.");

export const workTemplateDescriptionSkeletonSchema =
  workDescriptionSchema.refine(
    (value) => value === null || !value.includes("{{"),
    {
      message:
        "Document placeholder syntax is not available in Work Templates.",
    },
  );

export const workTemplateChecklistItemSchema = z
  .object({
    id: identifierSchema,
    text: z.string().trim().min(1).max(1000),
  })
  .strict();

export const workTemplateChecklistSchema = z
  .array(workTemplateChecklistItemSchema)
  .max(500);

export const workTemplateCustomFieldValueSchema = z.discriminatedUnion("kind", [
  z.object({ boolean: z.boolean(), kind: z.literal("boolean") }).strict(),
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
      options: customFieldOptionsSchema.min(1),
    })
    .strict(),
  z
    .object({
      kind: z.literal("text"),
      text: z.string().trim().min(1).max(2000),
    })
    .strict(),
]);

export type WorkTemplateCustomFieldValue = z.infer<
  typeof workTemplateCustomFieldValueSchema
>;

export const workTemplateCustomFieldDefaultSchema = z
  .object({
    definitionId: identifierSchema,
    value: workTemplateCustomFieldValueSchema,
  })
  .strict();

const workTemplateCustomFieldDefaultsSchema = z
  .array(workTemplateCustomFieldDefaultSchema)
  .max(100)
  .superRefine((defaults, context) => {
    const seen = new Set<string>();
    for (const [index, item] of defaults.entries()) {
      if (seen.has(item.definitionId)) {
        context.addIssue({
          code: "custom",
          message: "A Custom field can have only one template default.",
          path: [index, "definitionId"],
        });
      }
      seen.add(item.definitionId);
    }
  });

export const workTemplateRelativeDateRuleSchema = z
  .object({ offsetDays: z.number().int().min(-3650).max(3650) })
  .strict();

export const workTemplateRelativeDatesSchema = z
  .object({
    plannedStart: workTemplateRelativeDateRuleSchema.optional(),
    target: workTemplateRelativeDateRuleSchema.optional(),
  })
  .strict();

export type WorkTemplateRelativeDates = z.infer<
  typeof workTemplateRelativeDatesSchema
>;

const workTemplateDefinitionFieldsSchema = z
  .object({
    checklist: workTemplateChecklistSchema,
    customFieldDefaults: workTemplateCustomFieldDefaultsSchema,
    descriptionSkeleton: workTemplateDescriptionSkeletonSchema,
    name: workTemplateNameSchema,
    relativeDates: workTemplateRelativeDatesSchema,
    type: workTypeSchema,
  })
  .strict();

export const createWorkTemplateInputSchema = workTemplateDefinitionFieldsSchema
  .extend({ projectId: identifierSchema })
  .strict();

export type CreateWorkTemplateInput = z.input<
  typeof createWorkTemplateInputSchema
>;
export type ParsedCreateWorkTemplateInput = z.output<
  typeof createWorkTemplateInputSchema
>;

export const createWorkTemplateMutationInputSchema =
  humanMutationEnvelopeSchema.extend(createWorkTemplateInputSchema.shape);

export const updateWorkTemplateInputSchema = workTemplateDefinitionFieldsSchema;

export type UpdateWorkTemplateInput = z.input<
  typeof updateWorkTemplateInputSchema
>;

export const updateWorkTemplateMutationInputSchema =
  humanMutationEnvelopeSchema.extend({
    templateId: identifierSchema,
    ...updateWorkTemplateInputSchema.shape,
  });

export const trashWorkTemplateMutationInputSchema =
  humanMutationEnvelopeSchema.extend({ templateId: identifierSchema });

export const workTemplatesInputSchema = z
  .object({ projectId: identifierSchema })
  .strict();

export const workTemplateSchema = workTemplateDefinitionFieldsSchema
  .extend({
    createdAt: z.string().datetime({ offset: true }),
    id: identifierSchema,
    projectId: identifierSchema,
    revision: z.number().int().nonnegative().safe(),
    trashedAt: z.string().datetime({ offset: true }).nullable(),
    updatedAt: z.string().datetime({ offset: true }),
  })
  .strict();

export type WorkTemplate = z.infer<typeof workTemplateSchema>;

function addCalendarDays(date: string, offsetDays: number) {
  const parsed = calendarDateSchema.parse(date);
  return format(addDays(parseISO(parsed), offsetDays), "yyyy-MM-dd");
}

export function resolveWorkTemplateDates(input: {
  createDate: string;
  relativeDates: WorkTemplateRelativeDates;
}) {
  const relativeDates = workTemplateRelativeDatesSchema.parse(
    input.relativeDates,
  );
  return {
    plannedStartDate: relativeDates.plannedStart
      ? addCalendarDays(input.createDate, relativeDates.plannedStart.offsetDays)
      : null,
    targetDate: relativeDates.target
      ? addCalendarDays(input.createDate, relativeDates.target.offsetDays)
      : null,
  };
}

export interface WorkTemplatesAccess {
  create: (
    accountId: string,
    input: ParsedCreateWorkTemplateInput,
  ) => Promise<WorkTemplate>;
  list: (
    accountId: string,
    projectId: string,
  ) => Promise<WorkTemplate[] | null>;
  trash: (
    accountId: string,
    templateId: string,
    baseRevision: number,
  ) => Promise<WorkTemplate | null>;
  update: (
    accountId: string,
    templateId: string,
    baseRevision: number,
    input: z.output<typeof updateWorkTemplateInputSchema>,
  ) => Promise<WorkTemplate | null>;
}
