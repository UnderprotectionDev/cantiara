import { z } from "zod";

import { humanMutationEnvelopeSchema } from "./mutation-and-undo";
import { workStatusSchema, workTypeSchema } from "./work-lifecycle";

const identifierSchema = z.string().trim().min(1).max(255);
const textFieldSchema = z.string().trim().min(1).max(10_000);
const optionalTextFieldSchema = z.string().trim().max(10_000);
const githubRepositoryPathSegmentPattern = /^[a-z\d_.-]+$/i;
const githubIssueNumberPattern = /^\d+$/;
const githubCommitShaPattern = /^[a-f\d]{7,64}$/i;

function isPermittedGitHubIdentifier(value: string) {
  try {
    const url = new URL(value);
    if (
      url.protocol !== "https:" ||
      url.hostname !== "github.com" ||
      url.username ||
      url.password ||
      url.search ||
      url.hash
    ) {
      return false;
    }

    const path = url.pathname.split("/").filter(Boolean);
    if (path.length === 2) {
      return path.every((part) =>
        githubRepositoryPathSegmentPattern.test(part),
      );
    }

    if (path.length !== 4 || !path.every((part) => part.length > 0)) {
      return false;
    }
    const [, , resourceType, resourceId] = path;
    if (resourceType === "issues" || resourceType === "pull") {
      return githubIssueNumberPattern.test(resourceId ?? "");
    }
    return (
      resourceType === "commit" && githubCommitShaPattern.test(resourceId ?? "")
    );
  } catch {
    return false;
  }
}

const githubContextIdentifierSchema = z
  .string()
  .trim()
  .min(1)
  .max(500)
  .url()
  .refine(isPermittedGitHubIdentifier, {
    message: "Use a GitHub repository, issue, pull request, or commit URL.",
  });

const githubContextSchema = z
  .array(githubContextIdentifierSchema)
  .max(25)
  .superRefine((identifiers, context) => {
    const seen = new Set<string>();
    identifiers.forEach((identifier, index) => {
      if (seen.has(identifier)) {
        context.addIssue({
          code: "custom",
          message: "GitHub context can include an identifier only once.",
          path: [index],
        });
      }
      seen.add(identifier);
    });
  });

export const externalExecutionHandoffInputSchema = z
  .object({
    constraints: optionalTextFieldSchema,
    executor: textFieldSchema,
    expectedOutput: textFieldSchema,
    githubContext: githubContextSchema,
    includeWork: z.boolean(),
    purpose: textFieldSchema,
    workId: identifierSchema,
  })
  .strict();

export type ExternalExecutionHandoffInput = z.infer<
  typeof externalExecutionHandoffInputSchema
>;

export const externalExecutionHandoffStatusSchema = z.enum([
  "Open",
  "Result returned",
  "Reconciled",
  "Canceled",
]);

export type ExternalExecutionHandoffStatus = z.infer<
  typeof externalExecutionHandoffStatusSchema
>;

export function isTerminalExternalExecutionHandoffStatus(
  status: ExternalExecutionHandoffStatus,
) {
  return status === "Reconciled" || status === "Canceled";
}

export const startExternalExecutionHandoffMutationInputSchema =
  humanMutationEnvelopeSchema
    .extend(externalExecutionHandoffInputSchema.shape)
    .strict();

export type StartExternalExecutionHandoffMutationInput = z.infer<
  typeof startExternalExecutionHandoffMutationInputSchema
>;

export type ExternalExecutionHandoffStartCommand =
  StartExternalExecutionHandoffMutationInput;

export const listExternalExecutionHandoffsInputSchema = z
  .object({ workId: identifierSchema })
  .strict();

export const cancelExternalExecutionHandoffInputSchema = z
  .object({
    clientEventId: identifierSchema,
    handoffId: identifierSchema,
    reason: textFieldSchema,
  })
  .strict();

export type CancelExternalExecutionHandoffInput = z.infer<
  typeof cancelExternalExecutionHandoffInputSchema
>;

export const listExternalExecutionHandoffRelatedWorksInputSchema = z
  .object({ workId: identifierSchema })
  .strict();

export const externalExecutionHandoffHistoryEventTypeSchema = z.enum([
  "external-execution-handoff-started",
  "external-execution-handoff-package-produced",
  "external-execution-handoff-package-exported",
  "external-execution-handoff-canceled",
  "external-execution-handoff-return-recorded",
  "external-execution-handoff-reconciled",
]);

export const externalExecutionHandoffHistoryEventSchema = z
  .object({
    actorId: identifierSchema,
    eventId: identifierSchema,
    eventType: externalExecutionHandoffHistoryEventTypeSchema,
    handoffId: identifierSchema,
    occurredAt: z.string().datetime({ offset: true }),
  })
  .strict();

export type ExternalExecutionHandoffHistoryEvent = z.infer<
  typeof externalExecutionHandoffHistoryEventSchema
>;

export const listExternalExecutionHandoffHistoryInputSchema = z
  .object({ workId: identifierSchema })
  .strict();

export const recordExternalExecutionHandoffPackageExportInputSchema = z
  .object({
    clientEventId: identifierSchema,
    handoffId: identifierSchema,
  })
  .strict();

export type RecordExternalExecutionHandoffPackageExportInput = z.infer<
  typeof recordExternalExecutionHandoffPackageExportInputSchema
>;

export const externalExecutionHandoffWorkSnapshotSchema = z
  .object({
    description: z.string().nullable(),
    id: identifierSchema,
    key: identifierSchema,
    revision: z.number().int().nonnegative().safe(),
    status: workStatusSchema,
    targetDate: z.string().nullable(),
    title: textFieldSchema,
    type: workTypeSchema,
  })
  .strict();

export type ExternalExecutionHandoffWorkSnapshot = z.infer<
  typeof externalExecutionHandoffWorkSnapshotSchema
>;

export const externalExecutionHandoffSelectedVersionsSchema = z
  .object({
    githubContext: githubContextSchema,
    work: z
      .object({
        recordId: identifierSchema,
        revision: z.number().int().nonnegative().safe(),
        recordType: z.literal("Work"),
      })
      .strict()
      .nullable(),
  })
  .strict();

export type ExternalExecutionHandoffSelectedVersions = z.infer<
  typeof externalExecutionHandoffSelectedVersionsSchema
>;

const externalLinkSchema = z
  .string()
  .trim()
  .min(1)
  .max(2000)
  .url()
  .refine((value) => {
    try {
      const url = new URL(value);
      return url.protocol === "https:" && !url.username && !url.password;
    } catch {
      return false;
    }
  }, "Use an HTTPS link without embedded credentials.");

const returnTextListSchema = z.array(textFieldSchema).max(50);

export const externalExecutionHandoffResultInputSchema = z
  .object({
    changedAssumptions: returnTextListSchema,
    executorSummary: textFieldSchema,
    externalLinks: z.array(externalLinkSchema).max(25),
    openQuestions: returnTextListSchema,
    producedEvidence: returnTextListSchema,
  })
  .strict();

export const externalExecutionHandoffResultSchema =
  externalExecutionHandoffResultInputSchema
    .extend({ returnedAt: z.string().datetime({ offset: true }) })
    .strict();

export type ExternalExecutionHandoffResult = z.infer<
  typeof externalExecutionHandoffResultSchema
>;

export const recordExternalExecutionHandoffReturnInputSchema =
  externalExecutionHandoffResultInputSchema
    .extend({
      clientEventId: identifierSchema,
      handoffId: identifierSchema,
    })
    .strict();

export type RecordExternalExecutionHandoffReturnInput = z.infer<
  typeof recordExternalExecutionHandoffReturnInputSchema
>;

export const EXTERNAL_HANDOFF_RELATION_OPTIONS = [
  "Related",
  "Origin",
  "Blocks",
  "Blocked by",
] as const;

export const externalExecutionHandoffProposedRelationSchema = z
  .object({
    id: identifierSchema,
    kind: z.enum(EXTERNAL_HANDOFF_RELATION_OPTIONS),
    targetWorkId: identifierSchema,
  })
  .strict();

export const externalExecutionHandoffFollowUpWorkSchema = z
  .object({
    description: optionalTextFieldSchema.nullable(),
    id: identifierSchema,
    title: textFieldSchema.max(255),
    type: workTypeSchema,
  })
  .strict();

const reconcilePlanSchema = z
  .object({
    followUpWorks: z.array(externalExecutionHandoffFollowUpWorkSchema).max(25),
    proposedRelations: z
      .array(externalExecutionHandoffProposedRelationSchema)
      .max(25),
  })
  .strict()
  .superRefine((plan, context) => {
    for (const [field, items] of [
      ["followUpWorks", plan.followUpWorks],
      ["proposedRelations", plan.proposedRelations],
    ] as const) {
      const seen = new Set<string>();
      items.forEach((item, index) => {
        if (seen.has(item.id)) {
          context.addIssue({
            code: "custom",
            message: "Proposal identities must be unique.",
            path: [field, index, "id"],
          });
        }
        seen.add(item.id);
      });
    }
  });

export const previewExternalExecutionHandoffReconcileInputSchema =
  reconcilePlanSchema.extend({ handoffId: identifierSchema }).strict();

export type PreviewExternalExecutionHandoffReconcileInput = z.infer<
  typeof previewExternalExecutionHandoffReconcileInputSchema
>;

export const externalExecutionHandoffRelatedWorkSchema = z
  .object({
    id: identifierSchema,
    key: identifierSchema,
    status: workStatusSchema,
    title: textFieldSchema.max(255),
    type: workTypeSchema,
  })
  .strict();

export type ExternalExecutionHandoffRelatedWork = z.infer<
  typeof externalExecutionHandoffRelatedWorkSchema
>;

export const externalExecutionHandoffReconcileRelationPreviewSchema = z
  .object({
    id: identifierSchema,
    kind: z.enum(EXTERNAL_HANDOFF_RELATION_OPTIONS),
    sourceLabel: textFieldSchema.max(1000),
    sourceWorkId: identifierSchema,
    target: externalExecutionHandoffRelatedWorkSchema,
  })
  .strict();

export const externalExecutionHandoffFollowUpWorkPreviewSchema =
  externalExecutionHandoffFollowUpWorkSchema
    .extend({
      projectId: identifierSchema,
      projectName: textFieldSchema.max(255),
      relatedToWorkId: identifierSchema,
      relationKind: z.literal("Origin"),
    })
    .strict();

export const externalExecutionHandoffReconcilePreviewSchema = z
  .object({
    followUpWorks: z.array(externalExecutionHandoffFollowUpWorkPreviewSchema),
    handoffId: identifierSchema,
    previewId: identifierSchema,
    proposedRelations: z.array(
      externalExecutionHandoffReconcileRelationPreviewSchema,
    ),
  })
  .strict();

export type ExternalExecutionHandoffReconcilePreview = z.infer<
  typeof externalExecutionHandoffReconcilePreviewSchema
>;

export const confirmExternalExecutionHandoffReconcileInputSchema =
  reconcilePlanSchema
    .extend({
      clientEventId: identifierSchema,
      handoffId: identifierSchema,
      previewId: identifierSchema,
      selectedFollowUpWorkIds: z.array(identifierSchema).max(25),
      selectedRelationIds: z.array(identifierSchema).max(25),
    })
    .strict()
    .superRefine((input, context) => {
      const relationIds = new Set(input.proposedRelations.map(({ id }) => id));
      const workIds = new Set(input.followUpWorks.map(({ id }) => id));
      for (const [field, selectedIds, availableIds] of [
        ["selectedRelationIds", input.selectedRelationIds, relationIds],
        ["selectedFollowUpWorkIds", input.selectedFollowUpWorkIds, workIds],
      ] as const) {
        if (new Set(selectedIds).size !== selectedIds.length) {
          context.addIssue({
            code: "custom",
            message: "A proposal can be selected only once.",
            path: [field],
          });
        }
        selectedIds.forEach((id, index) => {
          if (!availableIds.has(id)) {
            context.addIssue({
              code: "custom",
              message: "Select only items shown in the reconcile preview.",
              path: [field, index],
            });
          }
        });
      }
    });

export type ConfirmExternalExecutionHandoffReconcileInput = z.infer<
  typeof confirmExternalExecutionHandoffReconcileInputSchema
>;

export const externalExecutionHandoffReconcileDecisionSchema = z
  .object({
    confirmedAt: z.string().datetime({ offset: true }),
    confirmedBy: identifierSchema,
    decisionId: identifierSchema,
    previewId: identifierSchema,
    selectedFollowUpWorkIds: z.array(identifierSchema),
    selectedRelationIds: z.array(identifierSchema),
    createdFollowUpWorks: z.array(
      z
        .object({
          id: identifierSchema,
          key: identifierSchema,
          title: textFieldSchema.max(255),
        })
        .strict(),
    ),
    createdRelations: z.array(
      z
        .object({
          id: identifierSchema,
          kind: z.enum(["Related", "Origin", "Blocks"]),
          sourceWorkId: identifierSchema,
          targetWorkId: identifierSchema,
        })
        .strict(),
    ),
  })
  .strict();

export type ExternalExecutionHandoffReconcileDecision = z.infer<
  typeof externalExecutionHandoffReconcileDecisionSchema
>;

export const externalExecutionHandoffSchema = z
  .object({
    cancellationReason: optionalTextFieldSchema.nullable(),
    constraints: optionalTextFieldSchema,
    createdAt: z.string().datetime({ offset: true }),
    executor: textFieldSchema,
    expectedOutput: textFieldSchema,
    githubContext: githubContextSchema,
    handoffId: identifierSchema,
    includeWork: z.boolean(),
    packageMarkdown: z.string().min(1),
    packageProducedAt: z.string().datetime({ offset: true }),
    purpose: textFieldSchema,
    reconcileDecision:
      externalExecutionHandoffReconcileDecisionSchema.nullable(),
    result: externalExecutionHandoffResultSchema.nullable(),
    selectedWorkRevision: z.number().int().nonnegative().safe().nullable(),
    status: externalExecutionHandoffStatusSchema,
    workId: identifierSchema,
  })
  .superRefine((handoff, context) => {
    if (handoff.status === "Canceled" && !handoff.cancellationReason) {
      context.addIssue({
        code: "custom",
        message: "Canceled handoffs require a reason.",
        path: ["cancellationReason"],
      });
    }
    if (handoff.status !== "Canceled" && handoff.cancellationReason !== null) {
      context.addIssue({
        code: "custom",
        message: "Only canceled handoffs can have a cancellation reason.",
        path: ["cancellationReason"],
      });
    }
  })
  .strict();

export type ExternalExecutionHandoff = z.infer<
  typeof externalExecutionHandoffSchema
>;

export interface ExternalExecutionHandoffsAccess {
  cancel: (
    accountId: string,
    input: CancelExternalExecutionHandoffInput,
  ) => Promise<ExternalExecutionHandoff | null>;
  confirmReconcile: (
    accountId: string,
    input: ConfirmExternalExecutionHandoffReconcileInput,
  ) => Promise<ExternalExecutionHandoff | null>;
  list: (
    accountId: string,
    workId: string,
  ) => Promise<ExternalExecutionHandoff[] | null>;
  listHistory: (
    accountId: string,
    workId: string,
  ) => Promise<ExternalExecutionHandoffHistoryEvent[] | null>;
  listRelatedWorks: (
    accountId: string,
    workId: string,
  ) => Promise<ExternalExecutionHandoffRelatedWork[] | null>;
  previewReconcile: (
    accountId: string,
    input: PreviewExternalExecutionHandoffReconcileInput,
  ) => Promise<ExternalExecutionHandoffReconcilePreview | null>;
  recordPackageExport: (
    accountId: string,
    input: RecordExternalExecutionHandoffPackageExportInput,
  ) => Promise<ExternalExecutionHandoffHistoryEvent | null>;
  recordReturn: (
    accountId: string,
    input: RecordExternalExecutionHandoffReturnInput,
  ) => Promise<ExternalExecutionHandoff | null>;
  start: (
    accountId: string,
    command: ExternalExecutionHandoffStartCommand,
  ) => Promise<ExternalExecutionHandoff | null>;
}

export interface RenderExternalExecutionHandoffPackageInput {
  handoffId: string;
  input: ExternalExecutionHandoffInput;
  producedAt: string;
  work: ExternalExecutionHandoffWorkSnapshot;
}

function markdownText(value: string) {
  return value.replaceAll("\r\n", "\n").trim();
}

export function renderExternalExecutionHandoffPackage({
  handoffId,
  input: rawInput,
  producedAt,
  work: rawWork,
}: RenderExternalExecutionHandoffPackageInput) {
  const input = externalExecutionHandoffInputSchema.parse(rawInput);
  const work = externalExecutionHandoffWorkSnapshotSchema.parse(rawWork);
  if (input.workId !== work.id) {
    throw new Error("The selected Work does not match the handoff owner.");
  }
  const timestamp = z.string().datetime({ offset: true }).parse(producedAt);
  const id = identifierSchema.parse(handoffId);

  const sections = [
    "# External Execution Handoff",
    `Produced at: ${timestamp}`,
    `Work: ${work.key}`,
    `Handoff ID: ${id}`,
    "Status: Open",
    "",
    "## Purpose",
    markdownText(input.purpose),
    "",
    "## Expected output",
    markdownText(input.expectedOutput),
    "",
    "## Executor",
    markdownText(input.executor),
    "",
    "## Constraints",
    input.constraints ? markdownText(input.constraints) : "None specified.",
    "",
    "## Selected versions",
    input.includeWork
      ? `- Work ${work.key} (${work.id}), revision ${work.revision}`
      : "- No Work version selected.",
  ];

  if (input.includeWork) {
    sections.push(
      "",
      "## Work",
      `- Title: ${work.title}`,
      `- Type: ${work.type}`,
      `- Status: ${work.status}`,
      ...(work.targetDate ? [`- Target date: ${work.targetDate}`] : []),
      ...(work.description ? ["", markdownText(work.description)] : []),
    );
  }

  sections.push("", "## GitHub context");
  sections.push(
    ...(input.githubContext.length > 0
      ? input.githubContext.map((identifier) => `- ${identifier}`)
      : ["- None selected."]),
  );
  sections.push("", "Source of truth is in the app");

  return `${sections.join("\n").trimEnd()}\n`;
}
