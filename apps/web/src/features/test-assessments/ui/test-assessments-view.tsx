// biome-ignore-all lint/performance/noJsxPropsBind: Controls bind to the form fields and the chosen context kind.
import {
  TEST_ASSESSMENT_CONTEXT_KINDS,
  TEST_ASSESSMENT_DECISIONS,
  TEST_ASSESSMENT_LABEL,
  TEST_ASSESSMENT_NEW_CONTEXT_LABEL,
  TEST_ASSESSMENTS_SECTION_LABEL,
  type TestAssessmentContextCandidate,
  type TestAssessmentContextKind,
  type TestAssessmentDecision,
  type TestAssessmentRecord,
} from "@cantiara/api/test-assessments";
import { Button } from "@cantiara/ui/components/button";
import { Textarea } from "@cantiara/ui/components/textarea";
import { type FormEvent, useEffect, useState } from "react";
import {
  EMPTY_TEST_ASSESSMENT_FORM,
  type TestAssessmentFormValues,
} from "../lib/test-assessment-form";

export type SubmitTestAssessment = (
  values: TestAssessmentFormValues,
) => Promise<unknown>;
export type LoadContextTargets = (
  kind: TestAssessmentContextKind,
) => Promise<TestAssessmentContextCandidate[]>;

function errorText(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

const SELECT_CLASS =
  "h-9 rounded-md border border-input bg-background px-2 text-sm";

function RecordForm({
  loadContextTargets,
  onRecord,
}: {
  loadContextTargets: LoadContextTargets;
  onRecord: SubmitTestAssessment;
}) {
  const [values, setValues] = useState(EMPTY_TEST_ASSESSMENT_FORM);
  const [targets, setTargets] = useState<TestAssessmentContextCandidate[]>([]);
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);
  const set = (patch: Partial<TestAssessmentFormValues>) =>
    setValues((current) => ({ ...current, ...patch }));

  useEffect(() => {
    let current = true;
    loadContextTargets(values.contextKind)
      .then((loaded) => current && setTargets(loaded))
      .catch(() => current && setTargets([]));
    return () => {
      current = false;
    };
  }, [loadContextTargets, values.contextKind]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined);
    setPending(true);
    try {
      await onRecord(values);
      setValues(EMPTY_TEST_ASSESSMENT_FORM);
    } catch (caught) {
      setError(errorText(caught, `${TEST_ASSESSMENT_LABEL} was not saved.`));
    } finally {
      setPending(false);
    }
  }

  return (
    <form
      aria-label={`Record ${TEST_ASSESSMENT_LABEL}`}
      className="space-y-4 rounded-lg border border-border/70 p-5"
      onSubmit={submit}
    >
      <h3 className="font-medium">{`Record ${TEST_ASSESSMENT_LABEL}`}</h3>
      <p className="text-muted-foreground text-sm">
        A dated snapshot of how you read these test records. It is optional, is
        not a score or a release gate, and is never rewritten.
      </p>
      {error ? (
        <p className="text-destructive text-sm" role="alert">
          {error}
        </p>
      ) : null}
      <div className="grid gap-2 text-sm">
        <label htmlFor="test-assessment-context-kind">Context</label>
        <select
          className={SELECT_CLASS}
          disabled={pending}
          id="test-assessment-context-kind"
          onChange={(event) =>
            set({
              contextId: "",
              contextKind: event.target.value as TestAssessmentContextKind,
            })
          }
          value={values.contextKind}
        >
          {TEST_ASSESSMENT_CONTEXT_KINDS.map((kind) => (
            <option key={kind} value={kind}>
              {kind}
            </option>
          ))}
        </select>
      </div>
      <div className="grid gap-2 text-sm">
        <label htmlFor="test-assessment-context">{values.contextKind}</label>
        <select
          className={SELECT_CLASS}
          disabled={pending}
          id="test-assessment-context"
          onChange={(event) => set({ contextId: event.target.value })}
          required
          value={values.contextId}
        >
          <option value="">{`Choose a ${values.contextKind}`}</option>
          {targets.map((target) => (
            <option key={target.id} value={target.id}>
              {target.label}
            </option>
          ))}
        </select>
      </div>
      {(
        [
          ["sessionIds", "Test Session ids", false],
          ["gapIds", "Test Gap ids", false],
          ["followUpWorkIds", "Follow-up Work ids", false],
        ] as const
      ).map(([field, label, required]) => (
        <div className="grid gap-2 text-sm" key={field}>
          <label htmlFor={`test-assessment-${field}`}>{label}</label>
          <Textarea
            disabled={pending}
            id={`test-assessment-${field}`}
            onChange={(event) => set({ [field]: event.target.value })}
            placeholder="One id per line"
            required={required}
            rows={2}
            value={values[field]}
          />
        </div>
      ))}
      <div className="grid gap-2 text-sm">
        <label htmlFor="test-assessment-known-limits">Known limits</label>
        <Textarea
          disabled={pending}
          id="test-assessment-known-limits"
          onChange={(event) => set({ knownLimits: event.target.value })}
          rows={3}
          value={values.knownLimits}
        />
      </div>
      <div className="grid gap-2 text-sm">
        <label htmlFor="test-assessment-decision">Decision</label>
        <select
          className={SELECT_CLASS}
          disabled={pending}
          id="test-assessment-decision"
          onChange={(event) =>
            set({ decision: event.target.value as TestAssessmentDecision })
          }
          required
          value={values.decision}
        >
          <option value="">Choose a decision</option>
          {TEST_ASSESSMENT_DECISIONS.map((decision) => (
            <option key={decision} value={decision}>
              {decision}
            </option>
          ))}
        </select>
      </div>
      <Button disabled={pending} type="submit">
        {`Record ${TEST_ASSESSMENT_LABEL}`}
      </Button>
    </form>
  );
}

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

function AssessmentItem({ assessment }: { assessment: TestAssessmentRecord }) {
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
        {`Assessed ${new Date(assessment.assessedAt).toLocaleString()} by ${assessment.assessorAccountId}`}
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
                {`${source.kind}: ${source.sourceKind} ${source.sourceId}, ${new Date(source.recordedAt).toLocaleString()}`}
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
}: {
  assessments: TestAssessmentRecord[];
  loadContextTargets: LoadContextTargets;
  onRecord: SubmitTestAssessment;
}) {
  return (
    <section aria-labelledby="test-assessments-heading" className="space-y-4">
      <h2 className="font-semibold text-lg" id="test-assessments-heading">
        {TEST_ASSESSMENTS_SECTION_LABEL}
      </h2>
      <RecordForm loadContextTargets={loadContextTargets} onRecord={onRecord} />
      {assessments.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          No Test Assessments yet. Publishing never needs one.
        </p>
      ) : (
        <ul className="space-y-3">
          {assessments.map((assessment) => (
            <AssessmentItem assessment={assessment} key={assessment.id} />
          ))}
        </ul>
      )}
    </section>
  );
}
