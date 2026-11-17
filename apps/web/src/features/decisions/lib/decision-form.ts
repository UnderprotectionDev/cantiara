import { decisionRecordSchema } from "@cantiara/api/project-source-records";
import { z } from "zod";

const DECISION_REQUIRED_MESSAGE =
  "Enter a Title and Decision text before saving.";

const requiredText = z.string().trim().min(1, DECISION_REQUIRED_MESSAGE);

/** Form schema for saving a Decision; the Withdraw form only carries a Rationale. */
export const decisionFormSchema = z.object({
  decision: requiredText.pipe(decisionRecordSchema.shape.decision),
  rationale: z.string(),
  title: requiredText.pipe(decisionRecordSchema.shape.title),
});

export const decisionWithdrawFormSchema = z.object({
  rationale: z.string(),
});
