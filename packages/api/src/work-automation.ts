import { z } from "zod";

import { humanMutationEnvelopeSchema } from "./mutation-and-undo";
import {
  workOpenStatusSchema,
  workStatusSchema,
  workTypeSchema,
} from "./work-lifecycle";

const identifierSchema = z.string().trim().min(1).max(255);
const timestampSchema = z.string().datetime({ offset: true });

export const WORK_AUTOMATION_UI_LABELS = {
  automationRule: "Automation rule",
  conflict: "Automation conflict",
  dryRun: "Dry run",
  markAsCompleted: "Mark as Completed",
  repeatingWork: "Create repeating Work",
  requiredPrMerge: "When required PRs merge, mark Work Completed",
} as const;

export const WORK_AUTOMATION_UNDO_WINDOW_MS = 10_000;

export const workAutomationRuleNameSchema = z
  .string()
  .trim()
  .min(1, "Automation rule name is required.")
  .max(200, "Automation rule name must be 200 characters or fewer.");

export const WORK_AUTOMATION_TRIGGER_KINDS = [
  "work-created",
  "work-status-changed",
  "recurring-schedule",
  "required-prs-merged",
] as const;

const workCreatedTriggerSchema = z
  .object({ kind: z.literal("work-created") })
  .strict();

const workStatusChangedTriggerSchema = z
  .object({
    kind: z.literal("work-status-changed"),
    to: workStatusSchema,
  })
  .strict();

const recurringScheduleTriggerSchema = z
  .object({
    everyDays: z.number().int().min(1).max(366),
    kind: z.literal("recurring-schedule"),
  })
  .strict();

/** Prepared trigger: only the prepared PR-merge rule may use it. */
const requiredPrsMergedTriggerSchema = z
  .object({ kind: z.literal("required-prs-merged") })
  .strict();

export const workAutomationTriggerSchema = z.discriminatedUnion("kind", [
  workCreatedTriggerSchema,
  workStatusChangedTriggerSchema,
  recurringScheduleTriggerSchema,
  requiredPrsMergedTriggerSchema,
]);

export type WorkAutomationTrigger = z.infer<typeof workAutomationTriggerSchema>;

export const workAutomationConditionSchema = z.discriminatedUnion("kind", [
  z
    .object({ kind: z.literal("work-status-is"), status: workStatusSchema })
    .strict(),
  z.object({ kind: z.literal("work-type-is"), type: workTypeSchema }).strict(),
]);

export type WorkAutomationCondition = z.infer<
  typeof workAutomationConditionSchema
>;

export const workAutomationActionSchema = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("set-work-status"),
      status: workOpenStatusSchema,
    })
    .strict(),
  z
    .object({
      kind: z.literal("create-work"),
      title: z.string().trim().min(1).max(500),
      type: workTypeSchema,
    })
    .strict(),
  z.object({ kind: z.literal("complete-work") }).strict(),
]);

export type WorkAutomationAction = z.infer<typeof workAutomationActionSchema>;

export const workAutomationDefinitionSchema = z
  .object({
    actions: z.array(workAutomationActionSchema).min(1).max(10),
    conditions: z.array(workAutomationConditionSchema).max(10),
    trigger: workAutomationTriggerSchema,
  })
  .strict()
  .superRefine((definition, context) => {
    const createsWork = definition.actions.some(
      (action) => action.kind === "create-work",
    );
    const isSchedule = definition.trigger.kind === "recurring-schedule";
    if (createsWork !== isSchedule) {
      context.addIssue({
        code: "custom",
        message:
          "Create repeating Work pairs only with the recurring schedule trigger.",
        path: ["actions"],
      });
    }
    if (isSchedule && definition.conditions.length > 0) {
      context.addIssue({
        code: "custom",
        message: "A recurring schedule rule has no Work to test conditions on.",
        path: ["conditions"],
      });
    }
    if (
      isSchedule &&
      definition.actions.some((action) => action.kind === "set-work-status")
    ) {
      context.addIssue({
        code: "custom",
        message: "A recurring schedule rule only creates Work.",
        path: ["actions"],
      });
    }
    const completes = definition.actions.some(
      (action) => action.kind === "complete-work",
    );
    const isPrMerge = definition.trigger.kind === "required-prs-merged";
    if (completes !== isPrMerge) {
      context.addIssue({
        code: "custom",
        message: `Only the prepared rule "${WORK_AUTOMATION_UI_LABELS.requiredPrMerge}" completes Work.`,
        path: ["actions"],
      });
    }
    if (
      isPrMerge &&
      (definition.actions.length !== 1 || definition.conditions.length > 0)
    ) {
      context.addIssue({
        code: "custom",
        message:
          "The prepared PR-merge rule has one fixed action and no conditions.",
        path: ["actions"],
      });
    }
  });

export const WORK_AUTOMATION_REQUIRED_PR_MERGE_DEFINITION: z.infer<
  typeof workAutomationDefinitionSchema
> = {
  actions: [{ kind: "complete-work" }],
  conditions: [],
  trigger: { kind: "required-prs-merged" },
};

function validatePreparedRuleName(
  input: { definition: { trigger: { kind: string } }; name: string },
  context: z.RefinementCtx,
) {
  const isPrepared = input.definition.trigger.kind === "required-prs-merged";
  const usesPreparedName =
    input.name === WORK_AUTOMATION_UI_LABELS.requiredPrMerge;
  if (isPrepared !== usesPreparedName) {
    context.addIssue({
      code: "custom",
      message: `Only the prepared PR-merge rule is named "${WORK_AUTOMATION_UI_LABELS.requiredPrMerge}".`,
      path: ["name"],
    });
  }
}

export type WorkAutomationDefinition = z.infer<
  typeof workAutomationDefinitionSchema
>;

export const workAutomationRuleSchema = z
  .object({
    createdAt: timestampSchema,
    definition: workAutomationDefinitionSchema,
    enabled: z.boolean(),
    id: identifierSchema,
    name: workAutomationRuleNameSchema,
    projectId: identifierSchema,
    revision: z.number().int().min(1).safe(),
    trashedAt: timestampSchema.nullable(),
    updatedAt: timestampSchema,
    version: z.number().int().min(1).safe(),
  })
  .strict();

export type WorkAutomationRule = z.infer<typeof workAutomationRuleSchema>;

export const workAutomationRuleVersionSchema = z
  .object({
    definition: workAutomationDefinitionSchema,
    name: workAutomationRuleNameSchema,
    ruleId: identifierSchema,
    savedAt: timestampSchema,
    version: z.number().int().min(1).safe(),
  })
  .strict();

export type WorkAutomationRuleVersion = z.infer<
  typeof workAutomationRuleVersionSchema
>;

export const workAutomationRulesInputSchema = z
  .object({ projectId: identifierSchema })
  .strict();

export const createWorkAutomationRuleInputSchema = z
  .object({
    definition: workAutomationDefinitionSchema,
    name: workAutomationRuleNameSchema,
    projectId: identifierSchema,
  })
  .strict()
  .superRefine(validatePreparedRuleName);

export type CreateWorkAutomationRuleInput = z.infer<
  typeof createWorkAutomationRuleInputSchema
>;

export const createWorkAutomationRuleMutationInputSchema =
  humanMutationEnvelopeSchema
    .extend(createWorkAutomationRuleInputSchema.shape)
    .strict()
    .superRefine(validatePreparedRuleName);

export const updateWorkAutomationRuleInputSchema = z
  .object({
    definition: workAutomationDefinitionSchema,
    name: workAutomationRuleNameSchema,
  })
  .strict()
  .superRefine(validatePreparedRuleName);

export type UpdateWorkAutomationRuleInput = z.infer<
  typeof updateWorkAutomationRuleInputSchema
>;

export const updateWorkAutomationRuleMutationInputSchema =
  humanMutationEnvelopeSchema
    .extend({ ruleId: identifierSchema })
    .extend(updateWorkAutomationRuleInputSchema.shape)
    .strict()
    .superRefine(validatePreparedRuleName);

export const createRequiredPrMergeRuleInputSchema = humanMutationEnvelopeSchema
  .extend({ projectId: identifierSchema })
  .strict();

export const setWorkAutomationRuleEnabledInputSchema =
  humanMutationEnvelopeSchema
    .extend({ enabled: z.boolean(), ruleId: identifierSchema })
    .strict();

export const trashWorkAutomationRuleInputSchema = humanMutationEnvelopeSchema
  .extend({ ruleId: identifierSchema })
  .strict();

export const restoreWorkAutomationRuleVersionInputSchema =
  humanMutationEnvelopeSchema
    .extend({
      ruleId: identifierSchema,
      version: z.number().int().min(1).safe(),
    })
    .strict();

export const workAutomationRuleVersionsInputSchema = z
  .object({ ruleId: identifierSchema })
  .strict();

export const workAutomationDryRunInputSchema = z
  .object({ ruleId: identifierSchema })
  .strict();

export const workAutomationUndoInputSchema = z
  .object({ receiptId: identifierSchema })
  .strict();

const workAutomationFieldValueSchema = z.union([
  z.object({ status: workStatusSchema }).strict(),
  z
    .object({
      closureResult: z.literal("Completed"),
      status: z.literal("Closed"),
    })
    .strict(),
]);

export type WorkAutomationFieldValue = z.infer<
  typeof workAutomationFieldValueSchema
>;

const workAutomationRuleAttributionSchema = z
  .object({
    action: workAutomationActionSchema,
    conditions: z.array(workAutomationConditionSchema),
    ruleId: identifierSchema,
    ruleName: workAutomationRuleNameSchema,
    ruleVersion: z.number().int().min(1).safe(),
    trigger: workAutomationTriggerSchema,
    triggerEventId: identifierSchema,
  })
  .strict();

export type WorkAutomationRuleAttribution = z.infer<
  typeof workAutomationRuleAttributionSchema
>;

export const workAutomationChangeSchema = z.discriminatedUnion("kind", [
  z
    .object({
      attributions: z.array(workAutomationRuleAttributionSchema).min(1),
      field: z.literal("status"),
      kind: z.literal("set-work-field"),
      value: workAutomationFieldValueSchema,
      workId: identifierSchema,
    })
    .strict(),
  z
    .object({
      attributions: z.array(workAutomationRuleAttributionSchema).min(1),
      kind: z.literal("create-work"),
      title: z.string().trim().min(1).max(500),
      type: workTypeSchema,
    })
    .strict(),
]);

export type WorkAutomationChange = z.infer<typeof workAutomationChangeSchema>;

export interface WorkAutomationConflictProposal {
  attribution: WorkAutomationRuleAttribution;
  value: WorkAutomationFieldValue;
}

export interface WorkAutomationConflict {
  field: "status";
  proposals: WorkAutomationConflictProposal[];
  resolution: string;
  workId: string;
}

export interface WorkAutomationReceipt {
  appliedAt: string;
  changes: WorkAutomationChange[];
  id: string;
  undoUntil: string;
}

export const WORK_AUTOMATION_SIGNAL_KINDS = [
  "automation-failed",
  "automation-conflict",
] as const;

export interface WorkAutomationSignal {
  failedStep: "action" | "condition" | "trigger";
  kind: (typeof WORK_AUTOMATION_SIGNAL_KINDS)[number];
  occurredAt: string;
  projectId: string;
  reason: string;
  ruleId: string;
  ruleName: string;
  ruleVersion: number;
  trigger: WorkAutomationTrigger;
  triggerEventId: string;
}

export interface WorkAutomationDryRunMatch {
  changes: WorkAutomationChange[];
  workId: string | null;
}

export interface WorkAutomationDryRunResult {
  matches: WorkAutomationDryRunMatch[];
  ruleId: string;
  written: false;
}

export interface WorkAutomationSuggestion {
  label: typeof WORK_AUTOMATION_UI_LABELS.markAsCompleted;
  workId: string;
}

export type WorkAutomationUndoResult =
  | { status: "undone" }
  | { fields: string[]; status: "conflict" }
  | { status: "not-undoable" | "not-found" };

export const workAutomationEventSchema = z.discriminatedUnion("kind", [
  z
    .object({
      id: identifierSchema,
      kind: z.literal("work-created"),
      occurredAt: timestampSchema,
      origin: z.enum(["user", "system"]),
      projectId: identifierSchema,
      workId: identifierSchema,
    })
    .strict(),
  z
    .object({
      id: identifierSchema,
      kind: z.literal("work-status-changed"),
      occurredAt: timestampSchema,
      origin: z.enum(["user", "system"]),
      projectId: identifierSchema,
      to: workStatusSchema,
      workId: identifierSchema,
    })
    .strict(),
  z
    .object({
      id: identifierSchema,
      kind: z.literal("recurring-schedule"),
      occurredAt: timestampSchema,
      origin: z.literal("system"),
      projectId: identifierSchema,
      ruleId: identifierSchema,
    })
    .strict(),
  z
    .object({
      id: identifierSchema,
      kind: z.literal("pull-request-merged"),
      occurredAt: timestampSchema,
      origin: z.literal("system"),
      projectId: identifierSchema,
      pullRequestId: identifierSchema,
      workId: identifierSchema,
    })
    .strict(),
]);

export type WorkAutomationEvent = z.infer<typeof workAutomationEventSchema>;

export type CreateWorkAutomationRuleMutationInput = z.infer<
  typeof createWorkAutomationRuleMutationInputSchema
>;

export interface WorkAutomationAccess {
  create: (
    accountId: string,
    input: CreateWorkAutomationRuleInput,
  ) => Promise<WorkAutomationRule>;
  createRequiredPrMergeRule: (
    accountId: string,
    projectId: string,
  ) => Promise<WorkAutomationRule>;
  dryRun: (
    accountId: string,
    ruleId: string,
  ) => Promise<WorkAutomationDryRunResult | null>;
  list: (
    accountId: string,
    projectId: string,
  ) => Promise<WorkAutomationRule[] | null>;
  restoreVersion: (
    accountId: string,
    input: { baseRevision: number; ruleId: string; version: number },
  ) => Promise<WorkAutomationRule | null>;
  setEnabled: (
    accountId: string,
    input: { baseRevision: number; enabled: boolean; ruleId: string },
  ) => Promise<WorkAutomationRule | null>;
  trash: (
    accountId: string,
    ruleId: string,
    baseRevision: number,
  ) => Promise<WorkAutomationRule | null>;
  undo: (
    accountId: string,
    receiptId: string,
  ) => Promise<WorkAutomationUndoResult>;
  update: (
    accountId: string,
    ruleId: string,
    baseRevision: number,
    input: UpdateWorkAutomationRuleInput,
  ) => Promise<WorkAutomationRule | null>;
  versions: (
    accountId: string,
    ruleId: string,
  ) => Promise<WorkAutomationRuleVersion[] | null>;
}
