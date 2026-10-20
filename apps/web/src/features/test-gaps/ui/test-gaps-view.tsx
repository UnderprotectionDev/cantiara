// biome-ignore-all lint/performance/noJsxPropsBind: Controls bind to the form fields.
import type {
  PlannedTestCaseRecord,
  TestHandoffRecord,
} from "@cantiara/api/planned-tests";
import { TEST_GAP_LABEL, type TestGapRecord } from "@cantiara/api/test-gaps";
import { Button } from "@cantiara/ui/components/button";
import { Input } from "@cantiara/ui/components/input";
import { NativeSelect } from "@cantiara/ui/components/native-select";
import { Textarea } from "@cantiara/ui/components/textarea";
import { type FormEvent, useId, useState } from "react";
import {
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

function GapItem({
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
  return (
    <li className="space-y-2 rounded-lg border border-border/70 p-4">
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
              readOnly={readOnly}
              record={record}
            />
          </dd>
        </div>
      </dl>
    </li>
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
  loadTargets,
  onCreate,
  onPlanCase,
  onPlanHandoff,
  onUnplanCase,
  onUnplanHandoff,
  readOnly,
}: {
  cases: PlannedTestCaseRecord[];
  gaps: TestGapRecord[];
  handoffs: TestHandoffRecord[];
  loadTargets: LoadGapRelationTargets;
  onCreate: SubmitGap;
  onPlanCase: PlanWithCase;
  onPlanHandoff: PlanWithHandoff;
  onUnplanCase: PlanWithCase;
  onUnplanHandoff: PlanWithHandoff;
  readOnly: boolean;
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
      {gaps.length === 0 ? (
        <p className="text-muted-foreground text-sm">No Test Gaps filed.</p>
      ) : (
        <ul aria-label="Test Gaps" className="space-y-3">
          {gaps.map((record) => (
            <GapItem
              cases={cases}
              handoffs={handoffs}
              key={record.id}
              onPlanCase={onPlanCase}
              onPlanHandoff={onPlanHandoff}
              onUnplanCase={onUnplanCase}
              onUnplanHandoff={onUnplanHandoff}
              readOnly={readOnly}
              record={record}
            />
          ))}
        </ul>
      )}
    </section>
  );
}
