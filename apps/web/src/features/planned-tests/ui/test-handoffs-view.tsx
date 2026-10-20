// biome-ignore-all lint/performance/noJsxPropsBind: Controls bind to the selected Test Handoff and form fields.
import {
  type PlannedTestCaseRecord,
  SESSION_TEST_LABEL,
  TEST_HANDOFF_EXECUTOR_SUGGESTIONS,
  TEST_HANDOFF_LABEL,
  type TestHandoffRecord,
  type TestHandoffState,
} from "@cantiara/api/planned-tests";
import { Button } from "@cantiara/ui/components/button";
import { Input } from "@cantiara/ui/components/input";
import { Textarea } from "@cantiara/ui/components/textarea";
import { type FormEvent, useState } from "react";
import {
  EMPTY_TEST_HANDOFF_FORM,
  formFromHandoff,
  type TestHandoffFormValues,
} from "../lib/test-handoff-form";

export type SubmitTestHandoff = (
  values: TestHandoffFormValues,
) => Promise<unknown>;
export type TransitionTestHandoff = (
  handoff: TestHandoffRecord,
  to: TestHandoffState,
) => Promise<unknown>;
export type LinkTestHandoffSessionTest = (
  handoff: TestHandoffRecord,
  sessionTestId: string,
) => Promise<unknown>;

function errorText(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

type TextField = Exclude<keyof TestHandoffFormValues, "selected">;

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
      <Input
        disabled={disabled}
        id={id}
        list={list}
        maxLength={maxLength}
        onChange={(event) => onChange(event.target.value)}
        required={required}
        type={type}
        value={value}
      />
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
            <input
              checked={chosen !== undefined}
              disabled={disabled}
              id={checkId}
              onChange={(event) => {
                const next = { ...selected };
                if (event.target.checked) {
                  next[record.id] = record.current.version;
                } else {
                  delete next[record.id];
                }
                onChange(next);
              }}
              type="checkbox"
            />
            <label className="text-sm" htmlFor={checkId}>
              {`Include ${record.current.title}`}
            </label>
            <label className="sr-only" htmlFor={versionId}>
              {`Version of ${record.current.title}`}
            </label>
            <select
              className="h-9 rounded-md border border-input bg-background px-2 text-sm"
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
                <option key={version.id} value={version.version}>
                  {`Version ${version.version}`}
                </option>
              ))}
            </select>
          </li>
        );
      })}
    </ul>
  );
}

function HandoffForm({
  cases,
  idPrefix,
  initial,
  label,
  onCancel,
  onSubmit,
  submitLabel,
}: {
  cases: PlannedTestCaseRecord[];
  idPrefix: string;
  initial: TestHandoffFormValues;
  label: string;
  onCancel?: () => void;
  onSubmit: SubmitTestHandoff;
  submitLabel: string;
}) {
  const [values, setValues] = useState(initial);
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);
  const setText = (field: TextField) => (value: string) =>
    setValues((current) => ({ ...current, [field]: value }));
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined);
    setPending(true);
    try {
      await onSubmit(values);
      if (!onCancel) {
        setValues(EMPTY_TEST_HANDOFF_FORM);
      }
    } catch (caught) {
      setError(errorText(caught, `${TEST_HANDOFF_LABEL} was not saved.`));
    } finally {
      setPending(false);
    }
  }
  const fieldId = (name: string) => `${idPrefix}-${name}`;
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
      <TextControl
        disabled={pending}
        id={fieldId("title")}
        label="Title"
        maxLength={255}
        onChange={setText("title")}
        required
        value={values.title}
      />
      <div className="grid gap-2 text-sm">
        <label htmlFor={fieldId("purpose")}>Purpose and scope</label>
        <Textarea
          disabled={pending}
          id={fieldId("purpose")}
          onChange={(event) => setText("purpose")(event.target.value)}
          required
          rows={3}
          value={values.purpose}
        />
      </div>
      <TextControl
        disabled={pending}
        id={fieldId("due")}
        label="Due date"
        onChange={setText("dueDate")}
        type="date"
        value={values.dueDate}
      />
      <TextControl
        disabled={pending}
        id={fieldId("executor")}
        label="Target executor"
        list={fieldId("executors")}
        maxLength={120}
        onChange={setText("targetExecutor")}
        value={values.targetExecutor}
      />
      <datalist id={fieldId("executors")}>
        {TEST_HANDOFF_EXECUTOR_SUGGESTIONS.map((name) => (
          <option key={name} value={name} />
        ))}
      </datalist>
      <fieldset className="space-y-3">
        <legend className="font-medium text-sm">Technical context</legend>
        <p className="text-muted-foreground text-xs">
          Typed by you. The product does not read GitHub or CI. Do not enter
          secrets, tokens or credentials.
        </p>
        <TextControl
          disabled={pending}
          id={fieldId("repository")}
          label="Repository"
          maxLength={255}
          onChange={setText("repository")}
          value={values.repository}
        />
        <TextControl
          disabled={pending}
          id={fieldId("branch")}
          label="Branch"
          maxLength={255}
          onChange={setText("branch")}
          value={values.branch}
        />
        <TextControl
          disabled={pending}
          id={fieldId("commit")}
          label="Commit"
          maxLength={255}
          onChange={setText("commit")}
          value={values.commit}
        />
        <TextControl
          disabled={pending}
          id={fieldId("build")}
          label="Build"
          maxLength={255}
          onChange={setText("build")}
          value={values.build}
        />
        <TextControl
          disabled={pending}
          id={fieldId("environment")}
          label="Target environment"
          maxLength={255}
          onChange={setText("targetEnvironment")}
          value={values.targetEnvironment}
        />
      </fieldset>
      <fieldset className="space-y-3">
        <legend className="font-medium text-sm">
          Planned Test Case versions
        </legend>
        <ScenarioPicker
          cases={cases}
          disabled={pending}
          idPrefix={idPrefix}
          onChange={(selected) =>
            setValues((current) => ({ ...current, selected }))
          }
          selected={values.selected}
        />
      </fieldset>
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
    </form>
  );
}

const CONTEXT_LABELS = [
  ["repository", "Repository"],
  ["branch", "Branch"],
  ["commit", "Commit"],
  ["build", "Build"],
  ["targetEnvironment", "Target environment"],
] as const;

function LinkForm({
  candidates,
  handoff,
  onLink,
}: {
  candidates: TestHandoffRecord["sessionTests"];
  handoff: TestHandoffRecord;
  onLink: LinkTestHandoffSessionTest;
}) {
  const [choice, setChoice] = useState("");
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);
  const selectId = `test-handoff-${handoff.id}-link`;
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!choice) {
      return;
    }
    setError(undefined);
    setPending(true);
    try {
      await onLink(handoff, choice);
      setChoice("");
    } catch (caught) {
      setError(errorText(caught, `${SESSION_TEST_LABEL} was not linked.`));
    } finally {
      setPending(false);
    }
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
      <div className="flex flex-wrap gap-2">
        <select
          className="h-9 rounded-md border border-input bg-background px-2 text-sm"
          disabled={pending}
          id={selectId}
          onChange={(event) => setChoice(event.target.value)}
          value={choice}
        >
          <option value="">{`Choose a ${SESSION_TEST_LABEL}`}</option>
          {candidates.map((candidate) => (
            <option key={candidate.id} value={candidate.id}>
              {candidate.title}
            </option>
          ))}
        </select>
        <Button
          disabled={pending || !choice}
          size="sm"
          type="submit"
          variant="outline"
        >
          Link
        </Button>
      </div>
    </form>
  );
}

function TransitionControls({
  handoff,
  onTransition,
}: {
  handoff: TestHandoffRecord;
  onTransition: TransitionTestHandoff;
}) {
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);
  async function move(to: TestHandoffState) {
    setError(undefined);
    setPending(true);
    try {
      await onTransition(handoff, to);
    } catch (caught) {
      setError(errorText(caught, `${TEST_HANDOFF_LABEL} did not change.`));
    } finally {
      setPending(false);
    }
  }
  const suggested = handoff.suggestion?.state;
  return (
    <div className="space-y-2">
      {error ? (
        <p className="text-destructive text-sm" role="alert">
          {error}
        </p>
      ) : null}
      {handoff.allowedTransitions.length > 0 ? (
        <>
          <ul
            aria-label={`Change the state of ${handoff.title}`}
            className="flex flex-wrap gap-2"
          >
            {handoff.allowedTransitions.map((to) => (
              <li key={to}>
                <Button
                  disabled={pending}
                  onClick={() => move(to)}
                  size="sm"
                  type="button"
                  variant={to === suggested ? "default" : "outline"}
                >
                  {`Mark as ${to}`}
                </Button>
              </li>
            ))}
          </ul>
          <p className="text-muted-foreground text-xs">
            Changes only this record. Nothing outside the product is started,
            stopped or contacted.
          </p>
        </>
      ) : null}
    </div>
  );
}

function HandoffItem({
  cases,
  linkable,
  onLink,
  onTransition,
  onUpdate,
  readOnly,
  handoff,
}: {
  cases: PlannedTestCaseRecord[];
  handoff: TestHandoffRecord;
  linkable: TestHandoffRecord["sessionTests"];
  onLink: LinkTestHandoffSessionTest;
  onTransition: TransitionTestHandoff;
  onUpdate: (
    handoff: TestHandoffRecord,
    values: TestHandoffFormValues,
  ) => Promise<unknown>;
  readOnly: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const filled = CONTEXT_LABELS.filter(
    ([key]) => handoff.buildContext[key] !== null,
  );
  return (
    <li
      className="space-y-3 rounded-lg border border-border/70 p-4"
      id={`test-handoff-${handoff.id}`}
    >
      <h4 className="font-medium">{handoff.title}</h4>
      <p className="text-sm">
        <span className="font-medium">State: </span>
        {handoff.state}
      </p>
      {handoff.suggestion ? (
        <p
          className="rounded-md border border-border/70 bg-muted/40 p-3 text-sm"
          role="status"
        >
          {handoff.suggestion.reason}
        </p>
      ) : null}
      {handoff.resultAfterCancel ? (
        <p
          className="rounded-md border border-border/70 bg-muted/40 p-3 text-sm"
          role="status"
        >
          Result arrived after cancel. The Test Handoff stays Canceled.
        </p>
      ) : null}
      <dl className="grid gap-2 text-sm">
        <div>
          <dt className="font-medium">Purpose and scope</dt>
          <dd className="whitespace-pre-wrap">{handoff.purpose}</dd>
        </div>
        {handoff.dueDate ? (
          <div>
            <dt className="font-medium">Due date</dt>
            <dd>{handoff.dueDate}</dd>
          </div>
        ) : null}
        {handoff.targetExecutor ? (
          <div>
            <dt className="font-medium">Target executor</dt>
            <dd>{handoff.targetExecutor}</dd>
          </div>
        ) : null}
        {filled.map(([key, name]) => (
          <div key={key}>
            <dt className="font-medium">{name}</dt>
            <dd>{handoff.buildContext[key]}</dd>
          </div>
        ))}
        <div>
          <dt className="font-medium">Package version</dt>
          <dd>
            {handoff.packageVersion === 0
              ? "No package produced yet"
              : handoff.packageVersion}
          </dd>
        </div>
      </dl>
      <div className="space-y-1 text-sm">
        <p className="font-medium">Planned Test Case versions</p>
        {handoff.scenarios.length === 0 ? (
          <p className="text-muted-foreground">None selected.</p>
        ) : (
          <ul aria-label={`Versions in ${handoff.title}`}>
            {handoff.scenarios.map((scenario) => (
              <li key={scenario.caseId}>
                {`${scenario.title}: ${scenario.summary}`}
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="space-y-1 text-sm">
        <p className="font-medium">{`Linked ${SESSION_TEST_LABEL}s`}</p>
        {handoff.sessionTests.length === 0 ? (
          <p className="text-muted-foreground">None arrived yet.</p>
        ) : (
          <ul aria-label={`Session Tests in ${handoff.title}`}>
            {handoff.sessionTests.map((sessionTest) => (
              <li key={sessionTest.id}>
                {sessionTest.bind
                  ? `${sessionTest.title}, ${sessionTest.bind.summary}`
                  : `${sessionTest.title}, ad hoc`}
              </li>
            ))}
          </ul>
        )}
      </div>
      {readOnly ? null : (
        <>
          <TransitionControls handoff={handoff} onTransition={onTransition} />
          <LinkForm candidates={linkable} handoff={handoff} onLink={onLink} />
          {handoff.editable && !editing ? (
            <Button
              onClick={() => setEditing(true)}
              size="sm"
              type="button"
              variant="outline"
            >
              {`Edit ${handoff.title}`}
            </Button>
          ) : null}
          {editing ? (
            <HandoffForm
              cases={cases}
              idPrefix={`test-handoff-${handoff.id}-edit`}
              initial={formFromHandoff(handoff)}
              label={`Edit ${TEST_HANDOFF_LABEL}`}
              onCancel={() => setEditing(false)}
              onSubmit={async (values) => {
                await onUpdate(handoff, values);
                setEditing(false);
              }}
              submitLabel="Save changes"
            />
          ) : null}
        </>
      )}
    </li>
  );
}

/**
 * Test Handoffs: requested external test work and the Session Tests that come
 * back. States are process labels, never results. The only controls are the
 * founder's own state moves and links; there is no start, run, poll, schedule
 * or remote cancel control, and a linked Session Test only shows a suggestion.
 */
export function TestHandoffsView({
  cases,
  handoffs,
  onCreate,
  onLink,
  onTransition,
  onUpdate,
  readOnly,
  sessionTests,
}: {
  cases: PlannedTestCaseRecord[];
  handoffs: TestHandoffRecord[];
  onCreate: SubmitTestHandoff;
  onLink: LinkTestHandoffSessionTest;
  onTransition: TransitionTestHandoff;
  onUpdate: (
    handoff: TestHandoffRecord,
    values: TestHandoffFormValues,
  ) => Promise<unknown>;
  readOnly: boolean;
  /** Every Session Test of the Project, as candidates to link. */
  sessionTests: TestHandoffRecord["sessionTests"];
}) {
  const arrivedIds = new Set(
    handoffs.flatMap((handoff) => handoff.sessionTests.map(({ id }) => id)),
  );
  return (
    <section
      aria-label={`${TEST_HANDOFF_LABEL}s`}
      className="space-y-6"
      id="test-handoffs"
    >
      <h2 className="font-semibold text-lg">{`${TEST_HANDOFF_LABEL}s`}</h2>
      <p className="text-muted-foreground text-sm">
        A Test Handoff records external test work you asked for and the Session
        Tests that came back. It does not run tests, and it never closes itself.
      </p>
      {readOnly ? null : (
        <HandoffForm
          cases={cases}
          idPrefix="test-handoff-new"
          initial={EMPTY_TEST_HANDOFF_FORM}
          label={`Create ${TEST_HANDOFF_LABEL}`}
          onSubmit={onCreate}
          submitLabel={`Create ${TEST_HANDOFF_LABEL}`}
        />
      )}
      {handoffs.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          {`No ${TEST_HANDOFF_LABEL}s yet.`}
        </p>
      ) : (
        <ul className="space-y-3">
          {handoffs.map((handoff) => {
            const selected = new Set(
              handoff.scenarios.map(
                ({ caseId, version }) => `${caseId}@${version}`,
              ),
            );
            return (
              <HandoffItem
                cases={cases}
                handoff={handoff}
                key={handoff.id}
                linkable={sessionTests.filter(
                  (candidate) =>
                    !arrivedIds.has(candidate.id) &&
                    (candidate.bind === null ||
                      selected.has(
                        `${candidate.bind.caseId}@${candidate.bind.pinnedVersion}`,
                      )),
                )}
                onLink={onLink}
                onTransition={onTransition}
                onUpdate={onUpdate}
                readOnly={readOnly}
              />
            );
          })}
        </ul>
      )}
    </section>
  );
}
