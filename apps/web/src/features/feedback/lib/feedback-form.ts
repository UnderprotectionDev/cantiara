import {
  FEEDBACK_ATTACHMENT_LIMIT,
  feedbackChannelSchema,
  feedbackLinkSchema,
  feedbackOriginalMessageSchema,
  feedbackTitleSchema,
} from "@cantiara/api/feedback";
import { z } from "zod";

const REQUIRED_MESSAGE = "Enter a Title, an Original message and Occurred at.";

/** Browser-local `yyyy-MM-ddTHH:mm` value; the command input needs an instant. */
const localToInstant = z.string().transform((value, context) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    context.addIssue({ code: "custom", message: REQUIRED_MESSAGE });
    return z.NEVER;
  }
  return date.toISOString();
});

/** Empty strings map to the command's `null` before the contract rule runs. */
const optionalText = z.string().transform((value) => value.trim() || null);

const optionalId = z.string().transform((value) => value || null);

/**
 * `Create Feedback` form. A Title, an Original message and a valid Occurred at
 * are required; its output is the draft the create command sends. Field rules
 * reuse the API contract's exported field schemas, so they cannot drift from
 * `createFeedbackInputSchema`; `projectId` is added by the caller.
 */
export const createFeedbackFormSchema = z.object({
  attachmentIds: z.array(z.string()).max(FEEDBACK_ATTACHMENT_LIMIT),
  channel: optionalText.pipe(feedbackChannelSchema.nullable()),
  companyId: optionalId,
  contactId: optionalId,
  link: optionalText.pipe(feedbackLinkSchema.nullable()),
  occurredAt: localToInstant,
  originalMessage: z
    .string()
    .refine((value) => value.trim() !== "", REQUIRED_MESSAGE)
    .pipe(feedbackOriginalMessageSchema),
  title: z
    .string()
    .refine((value) => value.trim() !== "", REQUIRED_MESSAGE)
    .pipe(feedbackTitleSchema),
});
