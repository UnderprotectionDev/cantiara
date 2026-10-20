import {
  type RecordTestAssessmentInput,
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

export function toRecordInput(
  projectId: string,
  values: TestAssessmentFormValues,
): RecordTestAssessmentInput | null {
  if (!(values.contextId && values.decision)) {
    return null;
  }
  return {
    context: { kind: values.contextKind, targetId: values.contextId },
    decision: values.decision,
    followUpWorkIds: parseIdList(values.followUpWorkIds),
    gapIds: parseIdList(values.gapIds),
    knownLimits: values.knownLimits.trim() || null,
    projectId,
    sessionIds: parseIdList(values.sessionIds),
  };
}
