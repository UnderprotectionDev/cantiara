import { z } from "zod";

const requiredText = (message: string) => z.string().trim().min(1, message);

const ASSUMPTION_REQUIRED_MESSAGE =
  "Enter a Title and Statement before saving.";

/** Form schema for editing an Assumption; an outcome (life change) needs no text. */
export const assumptionFormSchema = z.object({
  rationale: z.string(),
  statement: requiredText(ASSUMPTION_REQUIRED_MESSAGE),
  title: requiredText(ASSUMPTION_REQUIRED_MESSAGE),
});

export const openQuestionCreateFormSchema = z.object({
  question: requiredText("Enter a Title and Question before saving."),
  title: requiredText("Enter a Title and Question before saving."),
});

export const openQuestionAnswerFormSchema = z.object({
  answer: requiredText("Enter an Answer before saving."),
});
