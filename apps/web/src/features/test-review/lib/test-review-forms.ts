import { TEST_REPORT_RESULTS } from "@cantiara/api/test-report";
import type { TestResultEventKind } from "@cantiara/api/test-review";
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
export const closeSessionFormSchema = z.object({ reason: z.string() });

/**
 * Correction, Withdrawal and Redaction form: a reason is required; a
 * Correction of a Session Test also needs a corrected result, a Correction of
 * a Test Session a corrected summary.
 */
export function testResultEventFormSchema({
  needsNote,
  needsResult,
}: {
  needsNote: boolean;
  needsResult: boolean;
}) {
  return z
    .object({
      note: z.string(),
      reason: z.string().trim().min(1),
      result: z.union([z.literal(""), z.enum(TEST_REPORT_RESULTS)]),
    })
    .refine((value) => !needsResult || value.result !== "")
    .refine((value) => !needsNote || value.note.trim() !== "");
}
