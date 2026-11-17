import {
  type RecordTestAssessmentInput,
  recordTestAssessmentInputSchema,
  TEST_ASSESSMENT_CONTEXT_KINDS,
  type TestAssessmentContextKind,
  type TestAssessmentDecision,
} from "@cantiara/api/test-assessments";

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

const ID_SEPARATOR = /[\n,]/;

/** One exact id per line or comma; blanks are dropped, order is kept. */
export function parseIdList(text: string) {
  return text
    .split(ID_SEPARATOR)
    .map((id) => id.trim())
    .filter(Boolean);
}

/**
 * A recordable form: a chosen context and a decision; ids and limits stay free
 * text. The rules are the procedure's own input schema; the surface passes the
 * Project, the form checks with a stand-in.
 */
export function parseTestAssessmentForm(
  values: TestAssessmentFormValues,
  projectId = "form",
) {
  return recordTestAssessmentInputSchema.safeParse({
    context: { kind: values.contextKind, targetId: values.contextId },
    decision: values.decision,
    followUpWorkIds: parseIdList(values.followUpWorkIds),
    gapIds: parseIdList(values.gapIds),
    knownLimits: values.knownLimits.trim() || null,
    projectId,
    sessionIds: parseIdList(values.sessionIds),
  });
}

export function toRecordInput(
  projectId: string,
  values: TestAssessmentFormValues,
): RecordTestAssessmentInput | null {
  const parsed = parseTestAssessmentForm(values, projectId);
  return parsed.success ? parsed.data : null;
}
