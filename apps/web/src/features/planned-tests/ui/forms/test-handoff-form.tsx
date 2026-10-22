// biome-ignore-all lint/performance/noJsxPropsBind: Controls bind to the selected Test Handoff and form fields.
import {
  type PlannedTestCaseRecord,
  SESSION_TEST_LABEL,
  TEST_HANDOFF_EXECUTOR_SUGGESTIONS,
  TEST_HANDOFF_LABEL,
  type TestHandoffRecord,
} from "@cantiara/api/planned-tests";
import { Button } from "@cantiara/ui/components/button";
import { Checkbox } from "@cantiara/ui/components/checkbox";
import { Input } from "@cantiara/ui/components/input";
import {
  NativeSelect,
  NativeSelectOption,
} from "@cantiara/ui/components/native-select";
import { Textarea } from "@cantiara/ui/components/textarea";
import { useForm } from "@tanstack/react-form";
import { type FormEvent, useState } from "react";
import { DatePicker } from "@/components/date-picker";
import { errorText } from "../../lib/error-text";
import {
  EMPTY_TEST_HANDOFF_FORM,
  type TestHandoffFormValues,
} from "../../lib/test-handoff-form";
import {
  type LoadTestHandoffContextTargets,
  TestHandoffContextField,
} from "../components/test-handoff-context-field";

export type SubmitTestHandoff = (
  values: TestHandoffFormValues,
) => Promise<unknown>;
export type LinkTestHandoffSessionTest = (
  handoff: TestHandoffRecord,
  sessionTestId: string,
) => Promise<unknown>;

type TextField = Exclude<
  keyof TestHandoffFormValues,
  "adHocScope" | "contextRefs" | "selected"
>;

function TextControl({
  disabled,
  id,
  label,
  maxLength,
  onChange,
  required,
  type = "text",
  value,
  list,
}: {
  disabled: boolean;
  id: string;
  label: string;
  list?: string;
  maxLength?: number;
  onChange: (value: string) => void;
  required?: boolean;
  type?: "date" | "text";
  value: string;
}) {
  return (
    <div className="grid gap-2 text-sm">
      <label htmlFor={id}>{label}</label>
      {type === "date" ? (
        <DatePicker
          ariaLabel={label}
          disabled={disabled}
          id={id}
          onChange={onChange}
          required={required}
          value={value}
        />
      ) : (
        <Input
          disabled={disabled}
          id={id}
          list={list}
          maxLength={maxLength}
          onChange={(event) => onChange(event.target.value)}
          required={required}
          type="text"
          value={value}
        />
      )}
    </div>
  );
}

function ScenarioPicker({
  cases,
  disabled,
  idPrefix,
  onChange,
  selected,
}: {
  cases: PlannedTestCaseRecord[];
  disabled: boolean;
  idPrefix: string;
  onChange: (selected: Record<string, number>) => void;
  selected: Record<string, number>;
}) {
  if (cases.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        No Planned Test Cases yet. Add a Planned Test Case to select versions.
      </p>
    );
  }
  return (
    <ul className="space-y-2">
      {cases.map((record) => {
        const chosen = selected[record.id];
        const checkId = `${idPrefix}-case-${record.id}`;
        const versionId = `${idPrefix}-version-${record.id}`;
        return (
          <li className="flex flex-wrap items-center gap-3" key={record.id}>
            <Checkbox
              checked={chosen !== undefined}
              disabled={disabled}
              id={checkId}
              onCheckedChange={(checked) => {
                const next = { ...selected };
                if (checked) {
                  next[record.id] = record.current.version;
                } else {
                  delete next[record.id];
                }
                onChange(next);
              }}
            />
            <label className="text-sm" htmlFor={checkId}>
              {`Include ${record.current.title}`}
            </label>
            <label className="sr-only" htmlFor={versionId}>
              {`Version of ${record.current.title}`}
            </label>
            <NativeSelect
              disabled={disabled || chosen === undefined}
              id={versionId}
              onChange={(event) =>
                onChange({
                  ...selected,
                  [record.id]: Number(event.target.value),
                })
              }
              value={chosen ?? record.current.version}
            >
              {[...record.versions].reverse().map((version) => (
                <NativeSelectOption key={version.id} value={version.version}>
                  {`Version ${version.version}`}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </li>
        );
      })}
    </ul>
  );
}

function AdHocScopeField({
  disabled,
  idPrefix,
  onChange,
  value,
}: {
  disabled: boolean;
  idPrefix: string;
  onChange: (items: TestHandoffFormValues["adHocScope"]) => void;
  value: TestHandoffFormValues["adHocScope"];
}) {
  const update = (
    index: number,
    field: "expectedBehavior" | "intent",
    text: string,
  ) =>
    onChange(
      value.map((item, position) =>
        position === index ? { ...item, [field]: text } : item,
      ),
    );
  return (
    <fieldset className="space-y-3 rounded-md border border-border/70 p-3">
      <legend className="px-1 font-medium text-sm">Ad hoc scope</legend>
      <p className="text-muted-foreground text-xs">
        Test intent you write here without a Planned Test Case. It gets no case
        id and no version.
      </p>
      {value.map((item, index) => (
        <div
          className="space-y-2 rounded-md border border-border/50 p-3"
          // biome-ignore lint/suspicious/noArrayIndexKey: Items have no identity and are edited in place by position.
          key={index}
        >
          <div className="grid gap-1 text-sm">
            <label htmlFor={`${idPrefix}-adhoc-intent-${index}`}>
              {`Ad hoc intent ${index + 1}`}
            </label>
            <Textarea
              disabled={disabled}
              id={`${idPrefix}-adhoc-intent-${index}`}
              onChange={(event) => update(index, "intent", event.target.value)}
              required
              rows={2}
              value={item.intent}
            />
          </div>
          <div className="grid gap-1 text-sm">
            <label htmlFor={`${idPrefix}-adhoc-expected-${index}`}>
              {`Ad hoc expected behavior ${index + 1}`}
            </label>
            <Textarea
              disabled={disabled}
              id={`${idPrefix}-adhoc-expected-${index}`}
              onChange={(event) =>
                update(index, "expectedBehavior", event.target.value)
              }
              required
              rows={2}
              value={item.expectedBehavior}
            />
          </div>
          <Button
            disabled={disabled}
            onClick={() =>
              onChange(value.filter((_, position) => position !== index))
            }
            size="sm"
            type="button"
            variant="outline"
          >
            {`Remove ad hoc item ${index + 1}`}
          </Button>
        </div>
      ))}
      <Button
        disabled={disabled}
        onClick={() =>
          onChange([...value, { expectedBehavior: "", intent: "" }])
        }
        size="sm"
        type="button"
        variant="outline"
      >
        Add ad hoc item
      </Button>
    </fieldset>
  );
}

export function HandoffForm({
  cases,
  idPrefix,
  initial,
  loadContextTargets,
  label,
  onCancel,
  onSubmit,
  submitLabel,
}: {
  cases: PlannedTestCaseRecord[];
  idPrefix: string;
  initial: TestHandoffFormValues;
  label: string;
  loadContextTargets: LoadTestHandoffContextTargets;
  onCancel?: () => void;
  onSubmit: SubmitTestHandoff;
  submitLabel: string;
}) {
  const [error, setError] = useState<string>();
  const form = useForm({
    defaultValues: initial,
    onSubmit: async ({ value, formApi }) => {
      setError(undefined);
      try {
        await onSubmit(value);
        if (!onCancel) {
          formApi.reset(EMPTY_TEST_HANDOFF_FORM);
        }
      } catch (caught) {
        setError(errorText(caught, `${TEST_HANDOFF_LABEL} was not saved.`));
      }
    },
  });
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    event.stopPropagation();
    form.handleSubmit().catch(() => undefined);
  }
  const fieldId = (name: string) => `${idPrefix}-${name}`;
  const textField = (
    name: TextField,
    pending: boolean,
    props: Omit<
      Parameters<typeof TextControl>[0],
      "disabled" | "onChange" | "value"
    >,
  ) => (
    <form.Field name={name}>
      {(field) => (
        <TextControl
          {...props}
          disabled={pending}
          onChange={field.handleChange}
          value={field.state.value}
        />
      )}
    </form.Field>
  );
  return (
    <form
      aria-label={label}
      className="space-y-4 rounded-lg border border-border/70 p-5"
      onSubmit={submit}
    >
      <h3 className="font-medium">{label}</h3>
      {error ? (
        <p className="text-destructive text-sm" role="alert">
          {error}
        </p>
      ) : null}
      <form.Subscribe selector={(state) => state.isSubmitting}>
        {(pending) => (
          <>
            {textField("title", pending, {
              id: fieldId("title"),
              label: "Title",
              maxLength: 255,
              required: true,
            })}
            <form.Field name="purpose">
              {(field) => (
                <div className="grid gap-2 text-sm">
                  <label htmlFor={fieldId("purpose")}>Purpose and scope</label>
                  <Textarea
                    disabled={pending}
                    id={fieldId("purpose")}
                    name={field.name}
                    onChange={(event) => field.handleChange(event.target.value)}
                    required
                    rows={3}
                    value={field.state.value}
                  />
                </div>
              )}
            </form.Field>
            {textField("dueDate", pending, {
              id: fieldId("due"),
              label: "Due date",
              type: "date",
            })}
            {textField("targetExecutor", pending, {
              id: fieldId("executor"),
              label: "Target executor",
              list: fieldId("executors"),
              maxLength: 120,
            })}
            <datalist id={fieldId("executors")}>
              {TEST_HANDOFF_EXECUTOR_SUGGESTIONS.map((name) => (
                <option key={name} value={name} />
              ))}
            </datalist>
            <fieldset className="space-y-3">
              <legend className="font-medium text-sm">Technical context</legend>
              <p className="text-muted-foreground text-xs">
                Typed by you. The product does not read GitHub or CI. Do not
                enter secrets, tokens or credentials.
              </p>
              {textField("repository", pending, {
                id: fieldId("repository"),
                label: "Repository",
                maxLength: 255,
              })}
              {textField("branch", pending, {
                id: fieldId("branch"),
                label: "Branch",
                maxLength: 255,
              })}
              {textField("commit", pending, {
                id: fieldId("commit"),
                label: "Commit",
                maxLength: 255,
              })}
              {textField("build", pending, {
                id: fieldId("build"),
                label: "Build",
                maxLength: 255,
              })}
              {textField("targetEnvironment", pending, {
                id: fieldId("environment"),
                label: "Target environment",
                maxLength: 255,
              })}
            </fieldset>
            <fieldset className="space-y-3">
              <legend className="font-medium text-sm">
                Planned Test Case versions
              </legend>
              <form.Field name="selected">
                {(field) => (
                  <ScenarioPicker
                    cases={cases}
                    disabled={pending}
                    idPrefix={idPrefix}
                    onChange={field.handleChange}
                    selected={field.state.value}
                  />
                )}
              </form.Field>
            </fieldset>
            <form.Field name="adHocScope">
              {(field) => (
                <AdHocScopeField
                  disabled={pending}
                  idPrefix={idPrefix}
                  onChange={field.handleChange}
                  value={field.state.value}
                />
              )}
            </form.Field>
            <form.Field name="contextRefs">
              {(field) => (
                <TestHandoffContextField
                  idPrefix={idPrefix}
                  loadTargets={loadContextTargets}
                  onChange={field.handleChange}
                  value={field.state.value}
                />
              )}
            </form.Field>
            <form.Field name="environmentPreconditions">
              {(field) => (
                <div className="grid gap-2 text-sm">
                  <label htmlFor={fieldId("preconditions")}>
                    Environment preconditions
                  </label>
                  <Textarea
                    disabled={pending}
                    id={fieldId("preconditions")}
                    name={field.name}
                    onChange={(event) => field.handleChange(event.target.value)}
                    rows={3}
                    value={field.state.value}
                  />
                  <p className="text-muted-foreground text-xs">
                    Typed by you. The product prepares no environment, account
                    or test data. Do not enter secrets, tokens or credentials:
                    the package refuses them.
                  </p>
                </div>
              )}
            </form.Field>
            <div className="flex flex-wrap gap-2">
              <Button disabled={pending} type="submit">
                {submitLabel}
              </Button>
              {onCancel ? (
                <Button
                  disabled={pending}
                  onClick={onCancel}
                  type="button"
                  variant="outline"
                >
                  Discard changes
                </Button>
              ) : null}
            </div>
          </>
        )}
      </form.Subscribe>
    </form>
  );
}

export function LinkArrivingSessionTestForm({
  candidates,
  handoff,
  onLink,
}: {
  candidates: TestHandoffRecord["sessionTests"];
  handoff: TestHandoffRecord;
  onLink: LinkTestHandoffSessionTest;
}) {
  const [error, setError] = useState<string>();
  const selectId = `test-handoff-${handoff.id}-link`;
  const form = useForm({
    defaultValues: { choice: "" },
    onSubmit: async ({ value, formApi }) => {
      if (!value.choice) {
        return;
      }
      setError(undefined);
      try {
        await onLink(handoff, value.choice);
        formApi.reset();
      } catch (caught) {
        setError(errorText(caught, `${SESSION_TEST_LABEL} was not linked.`));
      }
    },
  });
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    event.stopPropagation();
    form.handleSubmit().catch(() => undefined);
  }
  if (candidates.length === 0) {
    return null;
  }
  return (
    <form
      aria-label={`Link ${SESSION_TEST_LABEL} to ${handoff.title}`}
      className="space-y-2"
      onSubmit={submit}
    >
      {error ? (
        <p className="text-destructive text-sm" role="alert">
          {error}
        </p>
      ) : null}
      <label className="text-sm" htmlFor={selectId}>
        {`Link arriving ${SESSION_TEST_LABEL}`}
      </label>
      <form.Subscribe
        selector={(state) => ({
          choice: state.values.choice,
          pending: state.isSubmitting,
        })}
      >
        {({ choice, pending }) => (
          <div className="flex flex-wrap gap-2">
            <form.Field name="choice">
              {(field) => (
                <NativeSelect
                  disabled={pending}
                  id={selectId}
                  name={field.name}
                  onChange={(event) => field.handleChange(event.target.value)}
                  value={field.state.value}
                >
                  <NativeSelectOption value="">{`Choose a ${SESSION_TEST_LABEL}`}</NativeSelectOption>
                  {candidates.map((candidate) => (
                    <NativeSelectOption key={candidate.id} value={candidate.id}>
                      {candidate.title}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              )}
            </form.Field>
            <Button
              disabled={pending || !choice}
              size="sm"
              type="submit"
              variant="outline"
            >
              Link
            </Button>
          </div>
        )}
      </form.Subscribe>
    </form>
  );
}
