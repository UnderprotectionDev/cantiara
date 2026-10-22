import {
  type RecordTestAssessmentInput,
  TEST_ASSESSMENT_CONTEXT_KINDS,
  TEST_ASSESSMENT_DECISIONS,
  type TestAssessmentContextKind,
  type TestAssessmentDecision,
} from "@cantiara/api/test-assessments";
import { z } from "zod";

export interface TestAssessmentFormValues {
  contextId: string;
  contextKind: TestAssessmentContextKind;
  decision: TestAssessmentDecision | "";
  followUpWorkIds: string;
  gapIds: string;
  knownLimits: string;
  sessionIds: string;
}

export const EMPTY_TEST_ASSESSMENT_FORM: TestAssessmentFormValues = {
  contextId: "",
  contextKind: TEST_ASSESSMENT_CONTEXT_KINDS[0],
  decision: "",
  followUpWorkIds: "",
  gapIds: "",
  knownLimits: "",
  sessionIds: "",
};

/** A recordable form: a chosen context and a decision; ids and limits stay free text. */
export const testAssessmentFormSchema = z.object({
  contextId: z.string().min(1),
  contextKind: z.enum(TEST_ASSESSMENT_CONTEXT_KINDS),
  decision: z.enum(TEST_ASSESSMENT_DECISIONS),
  followUpWorkIds: z.string(),
  gapIds: z.string(),
  knownLimits: z.string(),
  sessionIds: z.string(),
});

const ID_SEPARATOR = /[\n,]/;

/** One exact id per line or comma; blanks are dropped, order is kept. */
export function parseIdList(text: string) {
  return text
    .split(ID_SEPARATOR)
    .map((id) => id.trim())
    .filter(Boolean);
}

export function toRecordInput(
  projectId: string,
  values: TestAssessmentFormValues,
): RecordTestAssessmentInput | null {
  const parsed = testAssessmentFormSchema.safeParse(values);
  if (!parsed.success) {
    return null;
  }
  const form = parsed.data;
  return {
    context: { kind: form.contextKind, targetId: form.contextId },
    decision: form.decision,
    followUpWorkIds: parseIdList(form.followUpWorkIds),
    gapIds: parseIdList(form.gapIds),
    knownLimits: form.knownLimits.trim() || null,
    projectId,
    sessionIds: parseIdList(form.sessionIds),
  };
}
