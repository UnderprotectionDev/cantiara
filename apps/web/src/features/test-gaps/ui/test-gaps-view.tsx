// biome-ignore-all lint/performance/noJsxPropsBind: Controls bind to the form fields.
import type {
  PlannedTestCaseRecord,
  SessionTestRecord,
  TestHandoffRecord,
} from "@cantiara/api/planned-tests";
import {
  TEST_GAP_LABEL,
  type TestGapDecisionTarget,
  type TestGapRecord,
} from "@cantiara/api/test-gaps";
import { Button } from "@cantiara/ui/components/button";
import { Input } from "@cantiara/ui/components/input";
import { NativeSelect } from "@cantiara/ui/components/native-select";
import { Textarea } from "@cantiara/ui/components/textarea";
import { type FormEvent, useEffect, useId, useState } from "react";
import {
  type CloseFormValues,
  EMPTY_CLOSE_FORM,
  EMPTY_GAP_FORM,
  errorText,
  type GapFormValues,
  relationLabel,
} from "../lib/test-gap-form";
import {
  type LoadGapRelationTargets,
  TestGapRelationsField,
} from "./test-gap-relations-field";

export type SubmitGap = (values: GapFormValues) => Promise<unknown>;

export type CloseGap = (
  gap: TestGapRecord,
  values: CloseFormValues,
) => Promise<unknown>;
export type LoadDecisions = () => Promise<TestGapDecisionTarget[]>;

export interface CaseVersionRef {
  caseId: string;
  version: number;
}
export type PlanWithCase = (
  gap: TestGapRecord,
  ref: CaseVersionRef,
) => Promise<unknown>;
export type PlanWithHandoff = (
  gap: TestGapRecord,
  handoffId: string,
) => Promise<unknown>;

function versionValue(ref: CaseVersionRef) {
  return `${ref.caseId}@${ref.version}`;
}

function parseVersion(value: string): CaseVersionRef | null {
  const at = value.lastIndexOf("@");
  return at < 0
    ? null
    : { caseId: value.slice(0, at), version: Number(value.slice(at + 1)) };
}

/**
 * Filing form. The founder writes the title, the rationale and the support
 * relations; there is no coverage, score, status or result field to fill in.
 */
function GapForm({
  loadTargets,
  onSubmit,
}: {
  loadTargets: LoadGapRelationTargets;
  onSubmit: SubmitGap;
}) {
  const [values, setValues] = useState<GapFormValues>(EMPTY_GAP_FORM);
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined);
    setPending(true);
    try {
      await onSubmit(values);
      setValues(EMPTY_GAP_FORM);
    } catch (caught) {
      setError(errorText(caught, `${TEST_GAP_LABEL} was not saved.`));
    } finally {
      setPending(false);
    }
  }
  return (
    <form
      aria-label={`File ${TEST_GAP_LABEL}`}
      className="space-y-4 rounded-lg border border-border/70 p-5"
      onSubmit={submit}
    >
      <h3 className="font-medium">{`File ${TEST_GAP_LABEL}`}</h3>
      {error ? (
        <p className="text-destructive text-sm" role="alert">
          {error}
        </p>
      ) : null}
      <div className="grid gap-2 text-sm">
        <label htmlFor="test-gap-new-title">Title</label>
        <Input
          disabled={pending}
          id="test-gap-new-title"
          maxLength={255}
          onChange={(event) =>
            setValues({ ...values, title: event.target.value })
          }
          required
          value={values.title}
        />
      </div>
      <div className="grid gap-2 text-sm">
        <label htmlFor="test-gap-new-rationale">Rationale</label>
        <Textarea
          disabled={pending}
          id="test-gap-new-rationale"
          onChange={(event) =>
            setValues({ ...values, rationale: event.target.value })
          }
          required
          rows={3}
          value={values.rationale}
        />
      </div>
      <TestGapRelationsField
        idPrefix="test-gap-new"
        loadTargets={loadTargets}
        onChange={(relations) => setValues({ ...values, relations })}
        value={values.relations}
      />
      <Button disabled={pending} type="submit">
        {`File ${TEST_GAP_LABEL}`}
      </Button>
    </form>
  );
}

/**
 * Planning controls. Linking a Planned Test Case version or a Test Handoff
 * plans the Gap, which lifts `Open` to at most `Planned`; closing a Gap is a
 * separate, explicit founder decision and nothing here offers it.
 */
function PlanningControls({
  cases,
  handoffs,
  onPlanCase,
  onPlanHandoff,
  onUnplanCase,
  onUnplanHandoff,
  readOnly,
  record,
}: {
  cases: PlannedTestCaseRecord[];
  handoffs: TestHandoffRecord[];
  onPlanCase: PlanWithCase;
  onPlanHandoff: PlanWithHandoff;
  onUnplanCase: PlanWithCase;
  onUnplanHandoff: PlanWithHandoff;
  readOnly: boolean;
  record: TestGapRecord;
}) {
  const id = useId();
  const [version, setVersion] = useState("");
  const [handoffId, setHandoffId] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string>();
  async function run(action: () => Promise<unknown>, done: string) {
    setError(undefined);
    setMessage("");
    try {
      await action();
      setMessage(done);
    } catch (caught) {
      setError(errorText(caught, `${TEST_GAP_LABEL} was not updated.`));
    }
  }
  const parsed = parseVersion(version);
  return (
    <div className="space-y-3 text-sm">
      {record.caseBinds.length + record.handoffBinds.length === 0 ? (
        <p className="text-muted-foreground">Not linked to any test plan.</p>
      ) : (
        <ul aria-label={`Planning for ${record.title}`} className="space-y-1">
          {record.caseBinds.map((bind) => (
            <li
              className="flex flex-wrap items-center justify-between gap-2"
              key={`${bind.caseId}@${bind.version}`}
            >
              <span>{`Planned Test Case: ${bind.title}, version ${bind.version}`}</span>
              {readOnly ? null : (
                <Button
                  aria-label={`Remove link to Planned Test Case ${bind.title}, version ${bind.version}`}
                  onClick={() =>
                    run(
                      () =>
                        onUnplanCase(record, {
                          caseId: bind.caseId,
                          version: bind.version,
                        }),
                      `Link to ${bind.title} removed.`,
                    )
                  }
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  Remove link
                </Button>
              )}
            </li>
          ))}
          {record.handoffBinds.map((bind) => (
            <li
              className="flex flex-wrap items-center justify-between gap-2"
              key={bind.handoffId}
            >
              <span>{`Test Handoff: ${bind.title} (${bind.handoffState})`}</span>
              {readOnly ? null : (
                <Button
                  aria-label={`Remove link to Test Handoff ${bind.title}`}
                  onClick={() =>
                    run(
                      () => onUnplanHandoff(record, bind.handoffId),
                      `Link to ${bind.title} removed.`,
                    )
                  }
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  Remove link
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
      {readOnly ? null : (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="grid gap-1">
            <label htmlFor={`${id}-version`}>Planned Test Case version</label>
            <NativeSelect
              id={`${id}-version`}
              onChange={(event) => setVersion(event.target.value)}
              value={version}
            >
              <option value="">Choose a version</option>
              {cases.map((scenario) => (
                <optgroup key={scenario.id} label={scenario.current.title}>
                  {[...scenario.versions].reverse().map((item) => (
                    <option
                      key={item.id}
                      value={versionValue({
                        caseId: scenario.id,
                        version: item.version,
                      })}
                    >
                      {`${item.title}, version ${item.version}`}
                    </option>
                  ))}
                </optgroup>
              ))}
            </NativeSelect>
            <Button
              disabled={!parsed}
              onClick={() => {
                if (parsed) {
                  run(
                    () => onPlanCase(record, parsed),
                    "Linked to the Planned Test Case version.",
                  ).catch(() => undefined);
                }
              }}
              size="sm"
              type="button"
              variant="outline"
            >
              Link Planned Test Case version
            </Button>
          </div>
          <div className="grid gap-1">
            <label htmlFor={`${id}-handoff`}>Test Handoff</label>
            <NativeSelect
              id={`${id}-handoff`}
              onChange={(event) => setHandoffId(event.target.value)}
              value={handoffId}
            >
              <option value="">Choose a Test Handoff</option>
              {handoffs.map((handoff) => (
                <option key={handoff.id} value={handoff.id}>
                  {`${handoff.title} (${handoff.state})`}
                </option>
              ))}
            </NativeSelect>
            <Button
              disabled={!handoffId}
              onClick={() =>
                run(
                  () => onPlanHandoff(record, handoffId),
                  "Linked to the Test Handoff.",
                ).catch(() => undefined)
              }
              size="sm"
              type="button"
              variant="outline"
            >
              Link Test Handoff
            </Button>
          </div>
        </div>
      )}
      {error ? (
        <p className="text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      <p aria-live="polite" className="text-muted-foreground" role="status">
        {message}
      </p>
    </div>
  );
}

/**
 * Closing is the founder's explicit decision. `Met by result` is only possible
 * with the Session Tests the founder ticks; `Not needed` needs a rationale.
 * Nothing here is derived from a result count, so no figure can close a Gap.
 */
function CloseForm({
  loadDecisions,
  onClose,
  record,
  sessionTests,
}: {
  loadDecisions: LoadDecisions;
  onClose: CloseGap;
  record: TestGapRecord;
  sessionTests: SessionTestRecord[];
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<CloseFormValues>(EMPTY_CLOSE_FORM);
  const [decisions, setDecisions] = useState<TestGapDecisionTarget[]>([]);
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);
  const met = values.outcome === "Met by result";
  useEffect(() => {
    if (open) {
      loadDecisions()
        .then(setDecisions)
        .catch(() => setDecisions([]));
    }
  }, [open, loadDecisions]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined);
    setPending(true);
    try {
      await onClose(record, values);
      setOpen(false);
      setValues(EMPTY_CLOSE_FORM);
    } catch (caught) {
      setError(errorText(caught, `${TEST_GAP_LABEL} was not closed.`));
    } finally {
      setPending(false);
    }
  }
  if (!open) {
    return (
      <Button
        aria-label={`Close ${record.title}`}
        onClick={() => setOpen(true)}
        size="sm"
        type="button"
        variant="outline"
      >
        Close Test Gap
      </Button>
    );
  }
  return (
    <form
      aria-label={`Close ${record.title}`}
      className="space-y-3 rounded-md border border-border/70 p-3 text-sm"
      onSubmit={submit}
    >
      {error ? (
        <p className="text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      <fieldset className="space-y-1">
        <legend>Close as</legend>
        {(["Met by result", "Not needed"] as const).map((outcome) => (
          <label
            className="flex items-center gap-2"
            htmlFor={`${id}-${outcome}`}
            key={outcome}
          >
            <input
              checked={values.outcome === outcome}
              disabled={pending}
              id={`${id}-${outcome}`}
              name={`${id}-outcome`}
              onChange={() => setValues({ ...values, outcome })}
              type="radio"
              value={outcome}
            />
            {outcome}
          </label>
        ))}
      </fieldset>
      {met ? (
        <fieldset className="space-y-1">
          <legend>Session Tests that meet this Test Gap</legend>
          {sessionTests.length === 0 ? (
            <p className="text-muted-foreground">
              This Project has no Session Tests to select yet.
            </p>
          ) : (
            sessionTests.map((item) => (
              <label
                className="flex items-center gap-2"
                htmlFor={`${id}-st-${item.id}`}
                key={item.id}
              >
                <input
                  checked={values.sessionTestIds.includes(item.id)}
                  disabled={pending}
                  id={`${id}-st-${item.id}`}
                  onChange={(event) =>
                    setValues({
                      ...values,
                      sessionTestIds: event.target.checked
                        ? [...values.sessionTestIds, item.id]
                        : values.sessionTestIds.filter(
                            (selected) => selected !== item.id,
                          ),
                    })
                  }
                  type="checkbox"
                />
                {item.title}
              </label>
            ))
          )}
        </fieldset>
      ) : (
        <div className="grid gap-1">
          <label htmlFor={`${id}-decision`}>Decision (optional)</label>
          <NativeSelect
            disabled={pending}
            id={`${id}-decision`}
            onChange={(event) =>
              setValues({ ...values, decisionId: event.target.value })
            }
            value={values.decisionId}
          >
            <option value="">No Decision</option>
            {decisions.map((item) => (
              <option key={item.targetId} value={item.targetId}>
                {item.label}
              </option>
            ))}
          </NativeSelect>
        </div>
      )}
      <div className="grid gap-1">
        <label htmlFor={`${id}-rationale`}>
          {met ? "Rationale (optional)" : "Rationale"}
        </label>
        <Textarea
          disabled={pending}
          id={`${id}-rationale`}
          onChange={(event) =>
            setValues({ ...values, rationale: event.target.value })
          }
          required={!met}
          rows={3}
          value={values.rationale}
        />
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          disabled={pending || (met && values.sessionTestIds.length === 0)}
          type="submit"
        >
          {`Mark as ${values.outcome}`}
        </Button>
        <Button
          disabled={pending}
          onClick={() => setOpen(false)}
          type="button"
          variant="outline"
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}

function ClosureDetails({ record }: { record: TestGapRecord }) {
  const { closure } = record;
  if (!closure) {
    return null;
  }
  return (
    <div>
      <dt className="font-medium">Closure</dt>
      <dd className="space-y-1">
        <p>{closure.outcome}</p>
        {closure.rationale ? (
          <p className="whitespace-pre-wrap">{closure.rationale}</p>
        ) : null}
        {closure.sessionTests.length > 0 ? (
          <ul aria-label="Session Tests that met this Test Gap">
            {closure.sessionTests.map((item) => (
              <li key={item.id}>{`Session Test: ${item.title}`}</li>
            ))}
          </ul>
        ) : null}
        {closure.decision ? (
          <p>
            {closure.decision.state === "resolved"
              ? `Decision: ${closure.decision.label}`
              : `Decision: unavailable (${closure.decision.brokenReason ?? "No access"})`}
          </p>
        ) : null}
      </dd>
    </div>
  );
}

function GapItem({
  cases,
  handoffs,
  loadDecisions,
  onClose,
  onPlanCase,
  onPlanHandoff,
  onUnplanCase,
  onUnplanHandoff,
  readOnly,
  record,
  sessionTests,
}: {
  cases: PlannedTestCaseRecord[];
  handoffs: TestHandoffRecord[];
  loadDecisions: LoadDecisions;
  onClose: CloseGap;
  onPlanCase: PlanWithCase;
  onPlanHandoff: PlanWithHandoff;
  onUnplanCase: PlanWithCase;
  onUnplanHandoff: PlanWithHandoff;
  readOnly: boolean;
  record: TestGapRecord;
  sessionTests: SessionTestRecord[];
}) {
  return (
    <li
      className="space-y-2 rounded-lg border border-border/70 p-4"
      id={`source-test-gap-${record.id}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="font-medium">{record.title}</h4>
        <span className="rounded-md border border-border/70 px-2 py-0.5 text-sm">
          {record.state}
        </span>
      </div>
      <dl className="grid gap-2 text-sm">
        <div>
          <dt className="font-medium">Rationale</dt>
          <dd className="whitespace-pre-wrap">{record.rationale}</dd>
        </div>
        <div>
          <dt className="font-medium">Support relations</dt>
          <dd>
            {record.relations.length === 0 ? (
              "No support relations."
            ) : (
              <ul>
                {record.relations.map((relation) => (
                  <li key={relation.id}>{relationLabel(relation)}</li>
                ))}
              </ul>
            )}
          </dd>
        </div>
        <div>
          <dt className="font-medium">Planning</dt>
          <dd>
            <PlanningControls
              cases={cases}
              handoffs={handoffs}
              onPlanCase={onPlanCase}
              onPlanHandoff={onPlanHandoff}
              onUnplanCase={onUnplanCase}
              onUnplanHandoff={onUnplanHandoff}
              readOnly={readOnly || record.closure !== null}
              record={record}
            />
          </dd>
        </div>
        <ClosureDetails record={record} />
      </dl>
      {readOnly || record.closure ? null : (
        <CloseForm
          loadDecisions={loadDecisions}
          onClose={onClose}
          record={record}
          sessionTests={sessionTests}
        />
      )}
    </li>
  );
}

/**
 * The Tests area's derived count (spec 55 story 17). The number is read from
 * the same records the list shows, and opening the count reveals exactly the
 * `Open`/`Planned` records that produced it — never a coverage figure.
 */
function OpenAndPlannedGaps({ gaps }: { gaps: TestGapRecord[] }) {
  const openAndPlanned = gaps.filter(
    (gap) => gap.state === "Open" || gap.state === "Planned",
  );
  return (
    <details className="rounded-md border border-border/70 p-3">
      <summary className="cursor-pointer font-medium">
        {`Open and planned Test Gaps: ${openAndPlanned.length}`}
      </summary>
      {openAndPlanned.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          No open or planned Test Gaps.
        </p>
      ) : (
        <ul aria-label="Test Gaps in this count" className="space-y-1 text-sm">
          {openAndPlanned.map((gap) => (
            <li key={gap.id}>
              <a
                aria-label={`Open ${gap.title}`}
                className="underline"
                href={`#source-test-gap-${gap.id}`}
              >
                {gap.title}
              </a>
              {` (${gap.state})`}
            </li>
          ))}
        </ul>
      )}
    </details>
  );
}

/**
 * The Tests area's Test Gap list. A management view of records the founder
 * filed: not a phase, a runner or a coverage figure, and nothing here files a
 * Gap on its own.
 */
export function TestGapsView({
  cases,
  gaps,
  handoffs,
  loadDecisions,
  loadTargets,
  onClose,
  onCreate,
  onPlanCase,
  onPlanHandoff,
  onUnplanCase,
  onUnplanHandoff,
  readOnly,
  sessionTests,
}: {
  cases: PlannedTestCaseRecord[];
  gaps: TestGapRecord[];
  handoffs: TestHandoffRecord[];
  loadDecisions: LoadDecisions;
  loadTargets: LoadGapRelationTargets;
  onClose: CloseGap;
  onCreate: SubmitGap;
  onPlanCase: PlanWithCase;
  onPlanHandoff: PlanWithHandoff;
  onUnplanCase: PlanWithCase;
  onUnplanHandoff: PlanWithHandoff;
  readOnly: boolean;
  sessionTests: SessionTestRecord[];
}) {
  return (
    <section aria-labelledby="test-gaps-heading" className="space-y-4">
      <h2 className="font-semibold text-lg" id="test-gaps-heading">
        Test Gaps
      </h2>
      {readOnly ? (
        <p className="text-muted-foreground text-sm">
          This Project is archived. Test Gaps are read-only.
        </p>
      ) : (
        <GapForm loadTargets={loadTargets} onSubmit={onCreate} />
      )}
      <OpenAndPlannedGaps gaps={gaps} />
      {gaps.length === 0 ? (
        <p className="text-muted-foreground text-sm">No Test Gaps filed.</p>
      ) : (
        <ul aria-label="Test Gaps" className="space-y-3">
          {gaps.map((record) => (
            <GapItem
              cases={cases}
              handoffs={handoffs}
              key={record.id}
              loadDecisions={loadDecisions}
              onClose={onClose}
              onPlanCase={onPlanCase}
              onPlanHandoff={onPlanHandoff}
              onUnplanCase={onUnplanCase}
              onUnplanHandoff={onUnplanHandoff}
              readOnly={readOnly}
              record={record}
              sessionTests={sessionTests}
            />
          ))}
        </ul>
      )}
    </section>
  );
}
