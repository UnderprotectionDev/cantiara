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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@cantiara/ui/components/collapsible";
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
import { useForm, useSelector } from "@tanstack/react-form";
import { useMutation, useQuery } from "@tanstack/react-query";
import { type SubmitEvent, useId, useRef } from "react";
import { submitForm } from "@/lib/submit-form";
import { useCollapsibleState } from "@/lib/use-collapsible-state";
import { orpc } from "@/utils/orpc";
import {
  type CloseFormValues,
  EMPTY_CLOSE_FORM,
  EMPTY_GAP_FORM,
  errorText,
  type GapFormValues,
  parseCloseForm,
  parseGapForm,
  parsePlanCase,
  parsePlanHandoff,
} from "../../lib/test-gap-form";
import {
  type LoadGapRelationTargets,
  TestGapRelationsField,
} from "./test-gap-relations-field-form";

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
  onCreateSuccess,
  onSubmit,
  projectId,
}: {
  loadTargets: LoadGapRelationTargets;
  onCreateSuccess?: () => Promise<unknown>;
  onSubmit: SubmitGap;
  projectId: string;
}) {
  const resetPicker = useRef<(() => void) | null>(null);
  const form = useForm({
    defaultValues: EMPTY_GAP_FORM,
    onSubmit: async ({ value, formApi }) => {
      form.setErrorMap({ onSubmit: undefined });
      const parsed = parseGapForm(value);
      if (!parsed.ok) {
        form.setErrorMap({ onSubmit: { form: parsed.message, fields: {} } });
        return;
      }
      try {
        await create.mutateAsync(value);
        formApi.reset(EMPTY_GAP_FORM);
        resetPicker.current?.();
      } catch {
        // The create observer presents write failures.
      }
    },
  });
  const validationError = useSelector(
    form.store,
    (state): string | undefined => state.errorMap.onSubmit,
  );
  let error = validationError;
  const create = useMutation({
    meta: { onlineWrite: true },
    mutationFn: (value: Parameters<SubmitGap>[0]) => onSubmit(value),
    onSuccess: onCreateSuccess,
  });
  if (!error && create.error) {
    error = errorText(create.error, `${TEST_GAP_LABEL} was not saved.`);
  }
  function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    event.stopPropagation();
    submitForm(form).catch(() => undefined);
  }
  return (
    <form
      aria-label={`File ${TEST_GAP_LABEL}`}
      className="space-y-4 rounded-lg border border-border/70 p-5"
      onSubmit={submit}
    >
      <h3 className="font-medium">{`File ${TEST_GAP_LABEL}`}</h3>
      {error ? (
        <p className="text-sm text-destructive" role="alert">
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
                  projectId={projectId}
                  resetRef={resetPicker}
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
type PlanCommand =
  | { kind: "plan-case" | "unplan-case"; ref: CaseVersionRef; title?: string }
  | {
      kind: "plan-handoff" | "unplan-handoff";
      handoffId: string;
      title?: string;
    };

export function PlanningControls({
  cases,
  handoffs,
  onPlanCase,
  onPlanningSuccess,
  onPlanHandoff,
  onUnplanCase,
  onUnplanHandoff,
  readOnly,
  record,
}: {
  cases: PlannedTestCaseRecord[];
  handoffs: TestHandoffRecord[];
  onPlanCase: PlanWithCase;
  onPlanningSuccess?: () => Promise<unknown>;
  onPlanHandoff: PlanWithHandoff;
  onUnplanCase: PlanWithCase;
  onUnplanHandoff: PlanWithHandoff;
  readOnly: boolean;
  record: TestGapRecord;
}) {
  const id = useId();
  const write = useMutation({
    meta: { onlineWrite: true },
    mutationFn: async (command: PlanCommand) => {
      switch (command.kind) {
        case "plan-case":
          await onPlanCase(record, command.ref);
          return "Linked to the Planned Test Case version.";
        case "plan-handoff":
          await onPlanHandoff(record, command.handoffId);
          return "Linked to the Test Handoff.";
        case "unplan-case":
          await onUnplanCase(record, command.ref);
          return `Link to ${command.title} removed.`;
        case "unplan-handoff":
          await onUnplanHandoff(record, command.handoffId);
          return `Link to ${command.title} removed.`;
        default:
          throw new Error("Unknown Test Gap planning command.");
      }
    },
    onSettled: onPlanningSuccess,
  });
  const error = write.isError
    ? errorText(write.error, `${TEST_GAP_LABEL} was not updated.`)
    : undefined;
  const versionForm = useForm({
    defaultValues: { version: "" },
    onSubmit: async ({ value }) => {
      const ref = parseVersion(value.version);
      const parsed = parsePlanCase(ref);
      if (!(parsed.ok && ref)) {
        return;
      }
      await write
        .mutateAsync({ kind: "plan-case", ref })
        .catch(() => undefined);
    },
  });
  const handoffForm = useForm({
    defaultValues: { handoffId: "" },
    onSubmit: async ({ value }) => {
      const parsed = parsePlanHandoff(value.handoffId);
      if (!parsed.ok) {
        return;
      }
      await write
        .mutateAsync({ kind: "plan-handoff", handoffId: value.handoffId })
        .catch(() => undefined);
    },
  });
  function submitPlan(form: { handleSubmit: () => Promise<void> }) {
    return (event: SubmitEvent<HTMLFormElement>) => {
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
                  disabled={write.isPending}
                  onClick={() =>
                    write.mutate({
                      kind: "unplan-case",
                      ref: { caseId: bind.caseId, version: bind.version },
                      title: bind.title,
                    })
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
                  disabled={write.isPending}
                  onClick={() =>
                    write.mutate({
                      kind: "unplan-handoff",
                      handoffId: bind.handoffId,
                      title: bind.title,
                    })
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
            onSubmit={submitPlan(versionForm)}
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
            onSubmit={submitPlan(handoffForm)}
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
                  disabled={!handoffId || write.isPending}
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
        {write.data}
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
  const [open, setOpen] = useCollapsibleState();

  const form = useForm({
    defaultValues: EMPTY_CLOSE_FORM,
    onSubmit: async ({ value, formApi }) => {
      form.setErrorMap({ onSubmit: undefined });
      const parsed = parseCloseForm(value);
      if (!parsed.ok) {
        form.setErrorMap({ onSubmit: { form: parsed.message, fields: {} } });
        return;
      }
      try {
        await onClose(record, value);
        setOpen(false);
        formApi.reset(EMPTY_CLOSE_FORM);
      } catch (caught) {
        form.setErrorMap({
          onSubmit: {
            form: errorText(caught, `${TEST_GAP_LABEL} was not closed.`),
            fields: {},
          },
        });
      }
    },
  });
  const error = useSelector(
    form.store,
    (state): string | undefined => state.errorMap.onSubmit,
  );
  const { data: decisions = [] } = useQuery({
    enabled: open,
    queryFn: loadDecisions,
    queryKey: orpc.testGapDecisionTargets.queryKey({
      input: { projectId: record.projectId },
    }),
  });
  function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    event.stopPropagation();
    submitForm(form).catch(() => undefined);
  }

  return (
    <Collapsible onOpenChange={setOpen} open={open}>
      {open ? null : (
        <CollapsibleTrigger
          aria-label={`Close ${record.title}`}
          render={<Button size="sm" variant="outline" />}
        >
          Close Test Gap
        </CollapsibleTrigger>
      )}
      <CollapsibleContent>
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
                            field.handleChange(
                              value as CloseFormValues["outcome"],
                            )
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
                                <RadioGroupItem
                                  id={`${id}-${item}`}
                                  value={item}
                                />
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
      </CollapsibleContent>
    </Collapsible>
  );
}
