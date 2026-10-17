import { z } from "zod";
import {
  canonicalizeMutationPayload,
  humanMutationEnvelopeSchema,
} from "./mutation-and-undo";
import {
  workDescriptionSchema,
  workTitleSchema,
  workTypeSchema,
} from "./work-lifecycle";

const identifierSchema = z.string().trim().min(1).max(255);
const revisionSchema = z.number().int().nonnegative().safe();
const timestampSchema = z.string().datetime({ offset: true });

/** Closed lifecycle; none of these values is a Work status or a Source version. */
export const FEEDBACK_STATUSES = ["New", "Reviewed", "Archived"] as const;
export const feedbackStatusSchema = z.enum(FEEDBACK_STATUSES);
export type FeedbackStatus = z.infer<typeof feedbackStatusSchema>;

export const FEEDBACK_ATTACHMENT_LIMIT = 20;

export const feedbackTitleSchema = z
  .string()
  .trim()
  .min(1, "Title is required.")
  .max(255, "Title must be 255 characters or fewer.");

export const feedbackOriginalMessageSchema = z
  .string()
  .trim()
  .min(1, "Original message is required.")
  .max(20_000, "Original message must be 20000 characters or fewer.");

export const feedbackChannelSchema = z
  .string()
  .trim()
  .min(1, "Channel is required when provided.")
  .max(100, "Channel must be 100 characters or fewer.");

export const feedbackLinkSchema = z
  .string()
  .trim()
  .max(2048, "Link must be 2048 characters or fewer.")
  .refine((value) => {
    try {
      const { protocol } = new URL(value);
      return protocol === "http:" || protocol === "https:";
    } catch {
      return false;
    }
  }, "Enter an http or https link.");

/**
 * Everything a founder can say when creating Feedback in the app. Contact and
 * Company are optional references to existing identity records: an unknown
 * sender needs nothing beyond the message and no Contact is ever created here.
 * Work and Source ids are deliberately absent, and `.strict()` rejects a
 * summary, Work status, priority or Kanban membership.
 */
export const createFeedbackInputSchema = z
  .object({
    attachmentIds: z
      .array(identifierSchema)
      .max(FEEDBACK_ATTACHMENT_LIMIT)
      .optional(),
    channel: feedbackChannelSchema.nullable().optional(),
    companyId: identifierSchema.nullable().optional(),
    contactId: identifierSchema.nullable().optional(),
    link: feedbackLinkSchema.nullable().optional(),
    occurredAt: timestampSchema,
    originalMessage: feedbackOriginalMessageSchema,
    projectId: identifierSchema,
    title: feedbackTitleSchema,
  })
  .strict();

export type CreateFeedbackInput = z.input<typeof createFeedbackInputSchema>;
export type ParsedCreateFeedbackInput = z.output<
  typeof createFeedbackInputSchema
>;

/**
 * The status command carries a status and nothing else: it cannot name a Work,
 * a Work status, a priority or a Kanban column, so it cannot write them.
 */
export const setFeedbackStatusInputSchema = z
  .object({
    expectedRevision: revisionSchema.optional(),
    feedbackId: identifierSchema,
    projectId: identifierSchema,
    status: feedbackStatusSchema,
  })
  .strict();

export type SetFeedbackStatusInput = z.input<
  typeof setFeedbackStatusInputSchema
>;
export type ParsedSetFeedbackStatusInput = z.output<
  typeof setFeedbackStatusInputSchema
>;

export const feedbackProjectInputSchema = z
  .object({ projectId: identifierSchema })
  .strict();

export type FeedbackProjectInput = z.infer<typeof feedbackProjectInputSchema>;

export const feedbackAttachmentSchema = z
  .object({ id: identifierSchema, name: z.string().min(1) })
  .strict();

export type FeedbackAttachment = z.infer<typeof feedbackAttachmentSchema>;

/**
 * Identity is set or cleared on its own; it carries no message, status or Work
 * field. `null` clears, so Feedback stays valid for an unknown sender.
 */
export const setFeedbackIdentityInputSchema = z
  .object({
    companyId: identifierSchema.nullable(),
    contactId: identifierSchema.nullable(),
    expectedRevision: revisionSchema.optional(),
    feedbackId: identifierSchema,
    projectId: identifierSchema,
  })
  .strict();

export type SetFeedbackIdentityInput = z.input<
  typeof setFeedbackIdentityInputSchema
>;
export type ParsedSetFeedbackIdentityInput = z.output<
  typeof setFeedbackIdentityInputSchema
>;

export const feedbackContactSchema = z
  .object({
    displayName: z.string().nullable(),
    id: identifierSchema,
  })
  .strict();

export const feedbackCompanySchema = z
  .object({ id: identifierSchema, name: z.string().min(1) })
  .strict();

/**
 * One `Origin` link from this Feedback to a Work. Each Feedback is its own
 * origin: the list is provenance, never a vote count or priority.
 */
export const feedbackWorkOriginSchema = z
  .object({
    createdAt: timestampSchema,
    id: identifierSchema,
    workId: identifierSchema,
    workKey: identifierSchema,
    workTitle: z.string().min(1),
  })
  .strict();

export type FeedbackWorkOrigin = z.infer<typeof feedbackWorkOriginSchema>;

/** `originalMessage` is stored and returned verbatim; there is no summary field. */
export const feedbackRecordSchema = z
  .object({
    attachments: z.array(feedbackAttachmentSchema),
    channel: feedbackChannelSchema.nullable(),
    company: feedbackCompanySchema.nullable(),
    contact: feedbackContactSchema.nullable(),
    createdAt: timestampSchema,
    id: identifierSchema,
    link: feedbackLinkSchema.nullable(),
    occurredAt: timestampSchema,
    originalMessage: z.string().min(1),
    projectId: identifierSchema,
    revision: revisionSchema,
    status: feedbackStatusSchema,
    title: z.string().min(1),
    updatedAt: timestampSchema,
    workOrigins: z.array(feedbackWorkOriginSchema),
  })
  .strict();

export type FeedbackRecord = z.infer<typeof feedbackRecordSchema>;

export const feedbackListSchema = z
  .object({ readOnly: z.boolean(), records: z.array(feedbackRecordSchema) })
  .strict();

export type FeedbackList = z.infer<typeof feedbackListSchema>;

/** Work types a Feedback can start; `Feature` is a Work-owned shape, not a message mapping. */
export const FEEDBACK_WORK_TYPES = [
  "Task",
  "Bug",
  "Research",
  "Improvement",
] as const;
export const feedbackWorkTypeSchema = z.enum(FEEDBACK_WORK_TYPES);
export type FeedbackWorkType = z.infer<typeof feedbackWorkTypeSchema>;

export const previewFeedbackWorkInputSchema = z
  .object({
    feedbackId: identifierSchema,
    projectId: identifierSchema,
    workType: feedbackWorkTypeSchema.default("Task"),
  })
  .strict();

export type PreviewFeedbackWorkInput = z.input<
  typeof previewFeedbackWorkInputSchema
>;
export type ParsedPreviewFeedbackWorkInput = z.output<
  typeof previewFeedbackWorkInputSchema
>;

/**
 * Read-only `Convert to Work` preview: exactly one Work in the Feedback's own
 * Project, started from the original message, plus the `Origin` relation.
 * Nothing exists until the founder confirms the exact plan.
 */
export const feedbackWorkPlanSchema = z
  .object({
    feedbackId: identifierSchema,
    feedbackRevision: revisionSchema,
    projectId: identifierSchema,
    recordCount: z.literal(1),
    relation: z.literal("Origin"),
    targetProject: z
      .object({ id: identifierSchema, name: z.string().min(1) })
      .strict(),
    work: z
      .object({
        description: workDescriptionSchema,
        title: workTitleSchema,
        type: feedbackWorkTypeSchema,
      })
      .strict(),
  })
  .strict();

export type FeedbackWorkPlan = z.infer<typeof feedbackWorkPlanSchema>;

export const convertFeedbackToWorkInputSchema = humanMutationEnvelopeSchema
  .extend({
    feedbackId: identifierSchema,
    /** Identity of the `Origin` link; the Mutation Contract target. */
    id: identifierSchema,
    plan: feedbackWorkPlanSchema,
    projectId: identifierSchema,
    /** Identity of the single new Work. */
    workId: identifierSchema,
  })
  .strict();

export type ConvertFeedbackToWorkInput = z.input<
  typeof convertFeedbackToWorkInputSchema
>;
export type ParsedConvertFeedbackToWorkInput = z.output<
  typeof convertFeedbackToWorkInputSchema
>;

export const feedbackConversionSchema = z
  .object({
    feedback: feedbackRecordSchema,
    origin: feedbackWorkOriginSchema,
  })
  .strict();

export type FeedbackConversion = z.infer<typeof feedbackConversionSchema>;

/** What the preview needs from storage; the mapping itself is a product rule below. */
export interface FeedbackConversionSource {
  projectName: string;
  record: FeedbackRecord;
}

/**
 * The one mapping rule: the Feedback title and the verbatim original message
 * start the Work. No AI, no summary and no extra records. Work field rules
 * (title/description length, type catalog) are the Work Lifecycle schemas.
 */
export function buildFeedbackWorkPlan(
  source: FeedbackConversionSource,
  workType: FeedbackWorkType,
): FeedbackWorkPlan {
  const { record } = source;
  return feedbackWorkPlanSchema.parse({
    feedbackId: record.id,
    feedbackRevision: record.revision,
    projectId: record.projectId,
    recordCount: 1,
    relation: "Origin",
    targetProject: { id: record.projectId, name: source.projectName },
    work: {
      description: record.originalMessage,
      title: record.title,
      type: workTypeSchema.parse(workType),
    },
  });
}

/** A confirmed plan must equal the plan re-derived from the current record. */
export function isSameFeedbackWorkPlan(
  left: FeedbackWorkPlan,
  right: FeedbackWorkPlan,
) {
  return (
    canonicalizeMutationPayload(left as never) ===
    canonicalizeMutationPayload(right as never)
  );
}

/** Persistence port. `null` means the Project is not owned or does not exist. */
export interface FeedbackStore {
  /** Atomic Work + `Origin` creation; `null` when the Feedback is unavailable. */
  convertToWork: (
    accountId: string,
    input: ParsedConvertFeedbackToWorkInput,
  ) => Promise<FeedbackConversion | null>;
  create: (
    accountId: string,
    input: ParsedCreateFeedbackInput,
  ) => Promise<FeedbackRecord | null>;
  list: (accountId: string, projectId: string) => Promise<FeedbackList | null>;
  /** Read-only; writes nothing. */
  readConversionSource: (
    accountId: string,
    projectId: string,
    feedbackId: string,
  ) => Promise<FeedbackConversionSource | null>;
  setIdentity: (
    accountId: string,
    input: ParsedSetFeedbackIdentityInput,
  ) => Promise<FeedbackRecord | null>;
  setStatus: (
    accountId: string,
    input: ParsedSetFeedbackStatusInput,
  ) => Promise<FeedbackRecord | null>;
}

export interface FeedbackAccess {
  convertToWork: (
    accountId: string,
    input: ConvertFeedbackToWorkInput,
  ) => Promise<FeedbackConversion>;
  create: (
    accountId: string,
    input: CreateFeedbackInput,
  ) => Promise<FeedbackRecord>;
  list: (accountId: string, projectId: string) => Promise<FeedbackList>;
  previewConvertToWork: (
    accountId: string,
    input: PreviewFeedbackWorkInput,
  ) => Promise<FeedbackWorkPlan>;
  setIdentity: (
    accountId: string,
    input: SetFeedbackIdentityInput,
  ) => Promise<FeedbackRecord>;
  setStatus: (
    accountId: string,
    input: SetFeedbackStatusInput,
  ) => Promise<FeedbackRecord>;
}
