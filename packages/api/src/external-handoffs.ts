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

export const externalExecutionHandoffHistoryEventTypeSchema = z.enum([
  "external-execution-handoff-started",
  "external-execution-handoff-package-exported",
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

export const externalExecutionHandoffSchema = z
  .object({
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
    selectedWorkRevision: z.number().int().nonnegative().safe().nullable(),
    status: z.literal("Open"),
    workId: identifierSchema,
  })
  .strict();

export type ExternalExecutionHandoff = z.infer<
  typeof externalExecutionHandoffSchema
>;

export interface ExternalExecutionHandoffsAccess {
  list: (
    accountId: string,
    workId: string,
  ) => Promise<ExternalExecutionHandoff[] | null>;
  listHistory: (
    accountId: string,
    workId: string,
  ) => Promise<ExternalExecutionHandoffHistoryEvent[] | null>;
  recordPackageExport: (
    accountId: string,
    input: RecordExternalExecutionHandoffPackageExportInput,
  ) => Promise<ExternalExecutionHandoffHistoryEvent | null>;
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
