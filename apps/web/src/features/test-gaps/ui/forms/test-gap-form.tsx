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
import { Checkbox } from "@cantiara/ui/components/checkbox";
import { Input } from "@cantiara/ui/components/input";
import {
  NativeSelect,
  NativeSelectOptGroup,
  NativeSelectOption,
} from "@cantiara/ui/components/native-select";
import {
  RadioGroup,
  RadioGroupItem,
} from "@cantiara/ui/components/radio-group";
import { Textarea } from "@cantiara/ui/components/textarea";
import { useForm } from "@tanstack/react-form";
import { useQuery } from "@tanstack/react-query";
import { type FormEvent, useId, useState } from "react";
import {
  type CloseFormValues,
  EMPTY_CLOSE_FORM,
  EMPTY_GAP_FORM,
  errorText,
  type GapFormValues,
} from "../../lib/test-gap-form";
import {
  type LoadGapRelationTargets,
  TestGapRelationsField,
} from "../components/test-gap-relations-field";

export type SubmitGap = (values: GapFormValues) => Promise<unknown>;

export type CloseGap = (
  gap: TestGapRecord,
  values: CloseFormValues,
) => Promise<unknown>;
export type LoadDecisions = () => Promise<TestGapDecisionTarget[]>;

interface CaseVersionRef {
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
export function GapForm({
  loadTargets,
  onSubmit,
}: {
  loadTargets: LoadGapRelationTargets;
  onSubmit: SubmitGap;
}) {
  const [error, setError] = useState<string>();
  const form = useForm({
    defaultValues: EMPTY_GAP_FORM,
    onSubmit: async ({ value, formApi }) => {
      setError(undefined);
      try {
        await onSubmit(value);
        formApi.reset(EMPTY_GAP_FORM);
      } catch (caught) {
        setError(errorText(caught, `${TEST_GAP_LABEL} was not saved.`));
      }
    },
  });
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    event.stopPropagation();
    form.handleSubmit().catch(() => undefined);
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
      <form.Subscribe selector={(state) => state.isSubmitting}>
        {(pending) => (
          <>
            <form.Field name="title">
              {(field) => (
                <div className="grid gap-2 text-sm">
                  <label htmlFor="test-gap-new-title">Title</label>
                  <Input
                    disabled={pending}
                    id="test-gap-new-title"
                    maxLength={255}
                    name={field.name}
                    onChange={(event) => field.handleChange(event.target.value)}
                    required
                    value={field.state.value}
                  />
                </div>
              )}
            </form.Field>
            <form.Field name="rationale">
              {(field) => (
                <div className="grid gap-2 text-sm">
                  <label htmlFor="test-gap-new-rationale">Rationale</label>
                  <Textarea
                    disabled={pending}
                    id="test-gap-new-rationale"
                    name={field.name}
                    onChange={(event) => field.handleChange(event.target.value)}
                    required
                    rows={3}
                    value={field.state.value}
                  />
                </div>
              )}
            </form.Field>
            <form.Field name="relations">
              {(field) => (
                <TestGapRelationsField
                  idPrefix="test-gap-new"
                  loadTargets={loadTargets}
                  onChange={field.handleChange}
                  value={field.state.value}
                />
              )}
            </form.Field>
            <Button disabled={pending} type="submit">
              {`File ${TEST_GAP_LABEL}`}
            </Button>
          </>
        )}
      </form.Subscribe>
    </form>
  );
}

/**
 * Planning controls. Linking a Planned Test Case version or a Test Handoff
 * plans the Gap, which lifts `Open` to at most `Planned`; closing a Gap is a
 * separate, explicit founder decision and nothing here offers it.
 */
export function PlanningControls({
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
  const versionForm = useForm({
    defaultValues: { version: "" },
    onSubmit: async ({ value }) => {
      const parsed = parseVersion(value.version);
      if (parsed) {
        await run(
          () => onPlanCase(record, parsed),
          "Linked to the Planned Test Case version.",
        );
      }
    },
  });
  const handoffForm = useForm({
    defaultValues: { handoffId: "" },
    onSubmit: async ({ value }) => {
      if (value.handoffId) {
        await run(
          () => onPlanHandoff(record, value.handoffId),
          "Linked to the Test Handoff.",
        );
      }
    },
  });
  function submitForm(form: { handleSubmit: () => Promise<void> }) {
    return (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      event.stopPropagation();
      form.handleSubmit().catch(() => undefined);
    };
  }
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
          <form
            className="grid gap-1"
            noValidate
            onSubmit={submitForm(versionForm)}
          >
            <label htmlFor={`${id}-version`}>Planned Test Case version</label>
            <versionForm.Field name="version">
              {(field) => (
                <NativeSelect
                  id={`${id}-version`}
                  name={field.name}
                  onChange={(event) => field.handleChange(event.target.value)}
                  value={field.state.value}
                >
                  <NativeSelectOption value="">
                    Choose a version
                  </NativeSelectOption>
                  {cases.map((scenario) => (
                    <NativeSelectOptGroup
                      key={scenario.id}
                      label={scenario.current.title}
                    >
                      {[...scenario.versions].reverse().map((item) => (
                        <NativeSelectOption
                          key={item.id}
                          value={versionValue({
                            caseId: scenario.id,
                            version: item.version,
                          })}
                        >
                          {`${item.title}, version ${item.version}`}
                        </NativeSelectOption>
                      ))}
                    </NativeSelectOptGroup>
                  ))}
                </NativeSelect>
              )}
            </versionForm.Field>
            <versionForm.Subscribe selector={(state) => state.values.version}>
              {(version) => (
                <Button
                  disabled={!parseVersion(version)}
                  size="sm"
                  type="submit"
                  variant="outline"
                >
                  Link Planned Test Case version
                </Button>
              )}
            </versionForm.Subscribe>
          </form>
          <form
            className="grid gap-1"
            noValidate
            onSubmit={submitForm(handoffForm)}
          >
            <label htmlFor={`${id}-handoff`}>Test Handoff</label>
            <handoffForm.Field name="handoffId">
              {(field) => (
                <NativeSelect
                  id={`${id}-handoff`}
                  name={field.name}
                  onChange={(event) => field.handleChange(event.target.value)}
                  value={field.state.value}
                >
                  <NativeSelectOption value="">
                    Choose a Test Handoff
                  </NativeSelectOption>
                  {handoffs.map((handoff) => (
                    <NativeSelectOption key={handoff.id} value={handoff.id}>
                      {`${handoff.title} (${handoff.state})`}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              )}
            </handoffForm.Field>
            <handoffForm.Subscribe selector={(state) => state.values.handoffId}>
              {(handoffId) => (
                <Button
                  disabled={!handoffId}
                  size="sm"
                  type="submit"
                  variant="outline"
                >
                  Link Test Handoff
                </Button>
              )}
            </handoffForm.Subscribe>
          </form>
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
export function CloseForm({
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
  const [error, setError] = useState<string>();
  const form = useForm({
    defaultValues: EMPTY_CLOSE_FORM,
    onSubmit: async ({ value, formApi }) => {
      setError(undefined);
      try {
        await onClose(record, value);
        setOpen(false);
        formApi.reset(EMPTY_CLOSE_FORM);
      } catch (caught) {
        setError(errorText(caught, `${TEST_GAP_LABEL} was not closed.`));
      }
    },
  });
  const { data: decisions = [] } = useQuery({
    enabled: open,
    queryFn: loadDecisions,
    queryKey: ["test-gap-decision-targets", record.id],
  });
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    event.stopPropagation();
    form.handleSubmit().catch(() => undefined);
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
      <form.Subscribe
        selector={(state) => ({
          outcome: state.values.outcome,
          pending: state.isSubmitting,
          selectedCount: state.values.sessionTestIds.length,
        })}
      >
        {({ outcome, pending, selectedCount }) => {
          const met = outcome === "Met by result";
          return (
            <>
              <form.Field name="outcome">
                {(field) => (
                  <fieldset className="space-y-1">
                    <legend>Close as</legend>
                    <RadioGroup
                      disabled={pending}
                      name={`${id}-outcome`}
                      onValueChange={(value) =>
                        field.handleChange(value as CloseFormValues["outcome"])
                      }
                      value={field.state.value}
                    >
                      {(["Met by result", "Not needed"] as const).map(
                        (item) => (
                          <label
                            className="flex items-center gap-2"
                            htmlFor={`${id}-${item}`}
                            key={item}
                          >
                            <RadioGroupItem id={`${id}-${item}`} value={item} />
                            {item}
                          </label>
                        ),
                      )}
                    </RadioGroup>
                  </fieldset>
                )}
              </form.Field>
              {met ? (
                <form.Field name="sessionTestIds">
                  {(field) => (
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
                            <Checkbox
                              checked={field.state.value.includes(item.id)}
                              disabled={pending}
                              id={`${id}-st-${item.id}`}
                              onCheckedChange={(checked) =>
                                field.handleChange(
                                  checked
                                    ? [...field.state.value, item.id]
                                    : field.state.value.filter(
                                        (selected) => selected !== item.id,
                                      ),
                                )
                              }
                            />
                            {item.title}
                          </label>
                        ))
                      )}
                    </fieldset>
                  )}
                </form.Field>
              ) : (
                <form.Field name="decisionId">
                  {(field) => (
                    <div className="grid gap-1">
                      <label htmlFor={`${id}-decision`}>
                        Decision (optional)
                      </label>
                      <NativeSelect
                        disabled={pending}
                        id={`${id}-decision`}
                        name={field.name}
                        onChange={(event) =>
                          field.handleChange(event.target.value)
                        }
                        value={field.state.value}
                      >
                        <NativeSelectOption value="">
                          No Decision
                        </NativeSelectOption>
                        {decisions.map((item) => (
                          <NativeSelectOption
                            key={item.targetId}
                            value={item.targetId}
                          >
                            {item.label}
                          </NativeSelectOption>
                        ))}
                      </NativeSelect>
                    </div>
                  )}
                </form.Field>
              )}
              <form.Field name="rationale">
                {(field) => (
                  <div className="grid gap-1">
                    <label htmlFor={`${id}-rationale`}>
                      {met ? "Rationale (optional)" : "Rationale"}
                    </label>
                    <Textarea
                      disabled={pending}
                      id={`${id}-rationale`}
                      name={field.name}
                      onChange={(event) =>
                        field.handleChange(event.target.value)
                      }
                      required={!met}
                      rows={3}
                      value={field.state.value}
                    />
                  </div>
                )}
              </form.Field>
              <div className="flex flex-wrap gap-2">
                <Button
                  disabled={pending || (met && selectedCount === 0)}
                  type="submit"
                >
                  {`Mark as ${outcome}`}
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
            </>
          );
        }}
      </form.Subscribe>
    </form>
  );
}
