import { z } from "zod";
import { pinEvidenceText, versionPinnedEvidenceSchema } from "./evidence";
import { humanMutationEnvelopeSchema } from "./mutation-and-undo";
import { brokenReferenceReasonSchema } from "./relations";
import {
  type ResearchSessionRecord,
  researchSessionConvertPreview,
} from "./research-sessions";

const id = z.string().trim().min(1).max(255);
export const RESEARCH_BINDING_TARGET_TYPES = [
  "Feedback",
  "Assumption",
  "Open Question",
  "Work",
  "Feature",
  "Decision",
] as const;
const type = z.enum(RESEARCH_BINDING_TARGET_TYPES);
export const researchBindingTargetSchema = z.discriminatedUnion("mode", [
  z
    .object({
      mode: z.literal("create"),
      type,
      projectId: id,
      title: z.string().trim().min(1).max(255),
      workType: z.enum(["Task", "Bug", "Research", "Improvement"]).optional(),
    })
    .strict()
    .refine(
      (target) =>
        target.type === "Work" ? !!target.workType : !target.workType,
      "Choose Work type only for Work.",
    ),
  z
    .object({ mode: z.literal("bind"), type, projectId: id, recordId: id })
    .strict(),
]);
export const previewResearchSessionBindingInputSchema =
  humanMutationEnvelopeSchema
    .extend({
      id,
      projectId: id,
      contentId: id,
      start: z.number().int().nonnegative().safe(),
      end: z.number().int().positive().safe(),
      target: researchBindingTargetSchema,
    })
    .strict();
export type PreviewResearchSessionBindingInput = z.infer<
  typeof previewResearchSessionBindingInputSchema
>;
export const researchBindingPlanSchema = z
  .object({
    pin: versionPinnedEvidenceSchema,
    target: researchBindingTargetSchema,
    fields: z.record(z.string(), z.string().nullable()),
    origin: z
      .object({ kind: z.literal("Origin"), sourceRecordId: id })
      .strict(),
  })
  .strict();
export type ResearchBindingPlan = z.infer<typeof researchBindingPlanSchema>;
export const researchBindingPreviewSchema = z
  .object({
    previewId: id,
    plan: researchBindingPlanSchema,
    targetProjectName: id,
    targetLabel: id,
  })
  .strict();
export type ResearchBindingPreview = z.infer<
  typeof researchBindingPreviewSchema
>;
export const confirmResearchSessionBindingInputSchema =
  humanMutationEnvelopeSchema
    .extend({ id, projectId: id, previewId: id })
    .strict();
export type ConfirmResearchSessionBindingInput = z.infer<
  typeof confirmResearchSessionBindingInputSchema
>;
export const researchEvidenceBindingSchema = z
  .object({
    id,
    pin: versionPinnedEvidenceSchema,
    target: z
      .object({
        recordId: id,
        projectId: id.nullable(),
        type,
        label: id.nullable(),
        brokenReason: brokenReferenceReasonSchema.nullable().default(null),
        canOpenSourceRecord: z.boolean().default(true),
      })
      .strict(),
    origin: z.boolean(),
    createdAt: z.iso.datetime({ offset: true }),
    actorId: id,
  })
  .strict();
export type ResearchEvidenceBinding = z.infer<
  typeof researchEvidenceBindingSchema
>;
export interface ResearchBindingTargets {
  projects: { id: string; name: string }[];
  records: {
    id: string;
    projectId: string;
    type: ResearchBindingPlan["target"]["type"];
    title: string;
  }[];
}
export const researchBindingFeedbackSchema = z
  .object({
    id,
    title: id,
    status: z.enum(["New", "Reviewed", "Archived"]),
    originalMessage: z.string(),
    channel: z.string().nullable(),
    occurredAt: z.iso.datetime({ offset: true }),
  })
  .strict();
export type ResearchBindingFeedback = z.infer<
  typeof researchBindingFeedbackSchema
>;
export interface ResearchSessionBindingsAccess {
  bindingTargets: (
    accountId: string,
    input: { id: string; projectId: string },
  ) => Promise<ResearchBindingTargets>;
  confirmBinding: (
    accountId: string,
    input: ConfirmResearchSessionBindingInput,
  ) => Promise<ResearchEvidenceBinding>;
  listBindings: (
    accountId: string,
    input: { id: string; projectId: string },
  ) => Promise<ResearchEvidenceBinding[]>;
  previewBinding: (
    accountId: string,
    input: PreviewResearchSessionBindingInput,
  ) => Promise<ResearchBindingPreview>;
  readBindingFeedback: (
    accountId: string,
    input: { id: string; projectId: string; bindingId: string },
  ) => Promise<ResearchBindingFeedback>;
}

export function previewResearchSessionBinding(
  session: ResearchSessionRecord,
  rawInput: PreviewResearchSessionBindingInput,
): ResearchBindingPlan {
  const input = previewResearchSessionBindingInputSchema.parse(rawInput);
  if (
    session.id !== input.id ||
    session.projectId !== input.projectId ||
    session.revision !== input.baseRevision
  ) {
    throw new Error("Research Session changed. Reopen the preview.");
  }
  const selected = researchSessionConvertPreview(session, input.contentId);
  if (!("text" in selected.content)) {
    throw new Error("Choose a research note or quote.");
  }
  const pin = pinEvidenceText(
    {
      recordType: "Research Session",
      recordId: session.id,
      projectId: session.projectId,
      revision: session.revision,
      componentId: input.contentId,
    },
    selected.content.text,
    input.start,
    input.end,
  );
  const { target } = input;
  const fields: Record<string, string | null> = {};
  if (target.mode === "create") {
    fields.title = target.title;
    switch (target.type) {
      case "Assumption":
        fields.statement = pin.excerpt;
        break;
      case "Open Question":
        fields.question = pin.excerpt;
        break;
      case "Decision":
        fields.decision = pin.excerpt;
        break;
      case "Feedback":
        fields.originalMessage = pin.excerpt;
        fields.channel = session.channel;
        fields.occurredAt = session.scheduledAt ?? session.createdAt;
        break;
      case "Work":
        fields.workType = target.workType ?? null;
        fields.description = pin.excerpt;
        break;
      case "Feature":
        fields.description = pin.excerpt;
        break;
      default:
        break;
    }
  }
  return structuredClone({
    pin,
    target,
    fields,
    origin: { kind: "Origin", sourceRecordId: session.id },
  });
}
