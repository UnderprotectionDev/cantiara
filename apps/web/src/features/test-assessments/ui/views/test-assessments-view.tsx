// biome-ignore-all lint/performance/noJsxPropsBind: Controls bind to the form fields and the chosen context kind.
import type { AccountPreferences } from "@cantiara/api/account-preferences";
import {
  TEST_ASSESSMENT_NEW_CONTEXT_LABEL,
  TEST_ASSESSMENTS_SECTION_LABEL,
  type TestAssessmentRecord,
} from "@cantiara/api/test-assessments";
import { accountDateTimeFormatter } from "@/features/account-preferences/lib/account-preferences-format";
import {
  type LoadContextTargets,
  RecordTestAssessmentForm,
  type SubmitTestAssessment,
} from "../forms/record-test-assessment-form";

function IdList({ ids, label }: { ids: string[]; label: string }) {
  if (ids.length === 0) {
    return null;
  }
  return (
    <p>
      <span className="text-muted-foreground">{`${label}: `}</span>
      {ids.join(", ")}
    </p>
  );
}

function AssessmentItem({
  assessment,
  formatDateTime,
}: {
  assessment: TestAssessmentRecord;
  formatDateTime: (value: string) => string;
}) {
  const { context, newContext } = assessment;
  return (
    <li
      className="space-y-2 rounded-lg border border-border/70 p-4 text-sm"
      id={`test-assessment-${assessment.id}`}
    >
      <h4 className="font-medium">
        {`${context.kind}: ${context.label ?? "Unavailable record"}`}
      </h4>
      <p>
        <span className="text-muted-foreground">Decision at the time: </span>
        {assessment.decision}
      </p>
      <p className="text-muted-foreground">
        {`Assessed ${formatDateTime(assessment.assessedAt)} by ${assessment.assessorAccountId}`}
      </p>
      <IdList ids={assessment.sessionIds} label="Test Session ids" />
      <IdList ids={assessment.gapIds} label="Test Gap ids" />
      <IdList ids={assessment.followUpWorkIds} label="Follow-up Work ids" />
      {assessment.knownLimits ? (
        <p>
          <span className="text-muted-foreground">Known limits: </span>
          {assessment.knownLimits}
        </p>
      ) : null}
      {newContext ? (
        <section
          aria-label={TEST_ASSESSMENT_NEW_CONTEXT_LABEL}
          className="space-y-1 rounded-md border border-amber-500/50 p-3"
        >
          <h5 className="font-medium">{TEST_ASSESSMENT_NEW_CONTEXT_LABEL}</h5>
          <p className="text-muted-foreground">
            This snapshot is unchanged and may no longer describe the current
            tests.
          </p>
          <ul>
            {newContext.sources.map((source) => (
              <li
                key={`${source.kind}:${source.sourceKind}:${source.sourceId}`}
              >
                {`${source.kind}: ${source.sourceKind} ${source.sourceId}, ${formatDateTime(source.recordedAt)}`}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </li>
  );
}

/** Recent Test Assessments: dated snapshot records, never a score or a gate. */
export function TestAssessmentsView({
  assessments,
  loadContextTargets,
  onRecord,
  preferences,
}: {
  assessments: TestAssessmentRecord[];
  loadContextTargets: LoadContextTargets;
  onRecord: SubmitTestAssessment;
  preferences?: AccountPreferences;
}) {
  const formatDateTime = accountDateTimeFormatter(preferences);
  return (
    <section aria-labelledby="test-assessments-heading" className="space-y-4">
      <h2 className="font-semibold text-lg" id="test-assessments-heading">
        {TEST_ASSESSMENTS_SECTION_LABEL}
      </h2>
      <RecordTestAssessmentForm
        loadContextTargets={loadContextTargets}
        onRecord={onRecord}
      />
      {assessments.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          No Test Assessments yet. Publishing never needs one.
        </p>
      ) : (
        <ul className="space-y-3">
          {assessments.map((assessment) => (
            <AssessmentItem
              assessment={assessment}
              formatDateTime={formatDateTime}
              key={assessment.id}
            />
          ))}
        </ul>
      )}
    </section>
  );
}
