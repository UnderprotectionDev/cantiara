import { TEST_REPORT_RESULTS } from "@cantiara/api/test-report";
import {
  recordCorrectionInputSchema,
  recordWithdrawalInputSchema,
  setSessionReviewStateInputSchema,
  type TestResultEventKind,
} from "@cantiara/api/test-review";
import { z } from "zod";

export interface TestResultEventDraft {
  correctedResult: (typeof TEST_REPORT_RESULTS)[number] | null;
  eventId: string | null;
  kind: TestResultEventKind;
  note: string;
  reason: string;
  sessionTestId: string | null;
}

/** `Close Test Session` form: the close reason is an optional note and never a gate. */
export const closeSessionFormSchema = setSessionReviewStateInputSchema.pick({
  reason: true,
});

/** The Project, Test Session and Session Test come from the surface. */
const STAND_IN_ID = "form";

const eventFormShape = z.object({
  note: z.string(),
  reason: z.string(),
  result: z.union([z.literal(""), z.enum(TEST_REPORT_RESULTS)]),
});

/**
 * Correction, Withdrawal and Redaction form: a reason is required; a
 * Correction of a Session Test also needs a corrected result, a Correction of
 * a Test Session a corrected summary. The rules are the procedures' own input
 * schemas (`recordCorrectionInputSchema`, `recordWithdrawalInputSchema`).
 */
export function testResultEventFormSchema({
  needsNote,
  needsResult,
}: {
  needsNote: boolean;
  needsResult: boolean;
}) {
  return eventFormShape.superRefine((value, context) => {
    const target = {
      projectId: STAND_IN_ID,
      reason: value.reason,
      sessionId: STAND_IN_ID,
      sessionTestId: needsResult ? STAND_IN_ID : null,
    };
    const result =
      needsResult || needsNote
        ? recordCorrectionInputSchema.safeParse({
            ...target,
            correctedResult: value.result === "" ? null : value.result,
            note: value.note,
          })
        : recordWithdrawalInputSchema.safeParse(target);
    if (!result.success) {
      for (const issue of result.error.issues) {
        context.addIssue({
          code: "custom",
          message: issue.message,
          path: issue.path,
        });
      }
    }
  });
}
