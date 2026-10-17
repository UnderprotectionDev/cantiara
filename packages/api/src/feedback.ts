import { z } from "zod";

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
 * Everything a founder can say when creating Feedback in the app. Contact,
 * Company, Work and Source ids are deliberately absent (later tickets), and
 * `.strict()` rejects a summary, Work status, priority or Kanban membership.
 * An unknown sender needs nothing beyond the message.
 */
export const createFeedbackInputSchema = z
  .object({
    attachmentIds: z
      .array(identifierSchema)
      .max(FEEDBACK_ATTACHMENT_LIMIT)
      .optional(),
    channel: feedbackChannelSchema.nullable().optional(),
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

/** `originalMessage` is stored and returned verbatim; there is no summary field. */
export const feedbackRecordSchema = z
  .object({
    attachments: z.array(feedbackAttachmentSchema),
    channel: feedbackChannelSchema.nullable(),
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
  })
  .strict();

export type FeedbackRecord = z.infer<typeof feedbackRecordSchema>;

export const feedbackListSchema = z
  .object({ readOnly: z.boolean(), records: z.array(feedbackRecordSchema) })
  .strict();

export type FeedbackList = z.infer<typeof feedbackListSchema>;

/** Persistence port. `null` means the Project is not owned or does not exist. */
export interface FeedbackStore {
  create: (
    accountId: string,
    input: ParsedCreateFeedbackInput,
  ) => Promise<FeedbackRecord | null>;
  list: (accountId: string, projectId: string) => Promise<FeedbackList | null>;
  setStatus: (
    accountId: string,
    input: ParsedSetFeedbackStatusInput,
  ) => Promise<FeedbackRecord | null>;
}

export interface FeedbackAccess {
  create: (
    accountId: string,
    input: CreateFeedbackInput,
  ) => Promise<FeedbackRecord>;
  list: (accountId: string, projectId: string) => Promise<FeedbackList>;
  setStatus: (
    accountId: string,
    input: SetFeedbackStatusInput,
  ) => Promise<FeedbackRecord>;
}
