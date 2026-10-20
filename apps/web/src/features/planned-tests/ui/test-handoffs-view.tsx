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
  describeContextRef,
  EMPTY_TEST_HANDOFF_FORM,
  formFromHandoff,
  type TestHandoffFormValues,
} from "../lib/test-handoff-form";
import {
  type LoadTestHandoffContextTargets,
  TestHandoffContextField,
} from "./test-handoff-context-field";
import {
  type LoadTestHandoffPackages,
  type PreviewTestHandoffPackage,
  type ProduceTestHandoffPackage,
  TestHandoffPackagePanel,
} from "./test-handoff-package-panel";

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

function HandoffForm({
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
      <AdHocScopeField
        disabled={pending}
        idPrefix={idPrefix}
        onChange={(adHocScope) =>
          setValues((current) => ({ ...current, adHocScope }))
        }
        value={values.adHocScope}
      />
      <TestHandoffContextField
        idPrefix={idPrefix}
        loadTargets={loadContextTargets}
        onChange={(contextRefs) =>
          setValues((current) => ({ ...current, contextRefs }))
        }
        value={values.contextRefs}
      />
      <div className="grid gap-2 text-sm">
        <label htmlFor={fieldId("preconditions")}>
          Environment preconditions
        </label>
        <Textarea
          disabled={pending}
          id={fieldId("preconditions")}
          onChange={(event) =>
            setText("environmentPreconditions")(event.target.value)
          }
          rows={3}
          value={values.environmentPreconditions}
        />
        <p className="text-muted-foreground text-xs">
          Typed by you. The product prepares no environment, account or test
          data. Do not enter secrets, tokens or credentials: the package refuses
          them.
        </p>
      </div>
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
  loadContextTargets,
  loadPackages,
  onLink,
  onPreviewPackage,
  onProducePackage,
  onTransition,
  onUpdate,
  readOnly,
  handoff,
}: {
  cases: PlannedTestCaseRecord[];
  handoff: TestHandoffRecord;
  linkable: TestHandoffRecord["sessionTests"];
  loadContextTargets: LoadTestHandoffContextTargets;
  loadPackages: LoadTestHandoffPackages;
  onLink: LinkTestHandoffSessionTest;
  onPreviewPackage: PreviewTestHandoffPackage;
  onProducePackage: ProduceTestHandoffPackage;
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
      {handoff.environmentPreconditions ? (
        <div className="space-y-1 text-sm">
          <p className="font-medium">Environment preconditions</p>
          <p className="whitespace-pre-wrap">
            {handoff.environmentPreconditions}
          </p>
        </div>
      ) : null}
      {handoff.adHocScope.length > 0 ? (
        <div className="space-y-1 text-sm">
          <p className="font-medium">Ad hoc scope</p>
          <ul aria-label={`Ad hoc scope of ${handoff.title}`}>
            {handoff.adHocScope.map((item) => (
              <li key={`${item.intent}:${item.expectedBehavior}`}>
                {`${item.intent} Expected: ${item.expectedBehavior}`}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {handoff.contextRefs.length > 0 ? (
        <div className="space-y-1 text-sm">
          <p className="font-medium">Package context</p>
          <ul aria-label={`Package context of ${handoff.title}`}>
            {handoff.contextRefs.map((ref) => (
              <li key={JSON.stringify(ref)}>
                {describeContextRef(ref, ref.label)}
                {ref.brokenReason
                  ? ` (${ref.brokenReason}: it cannot enter the package until you remove it)`
                  : ""}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
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
              loadContextTargets={loadContextTargets}
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
      <TestHandoffPackagePanel
        handoff={handoff}
        loadPackages={loadPackages}
        onPreview={onPreviewPackage}
        onProduce={onProducePackage}
        readOnly={readOnly}
      />
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
  loadContextTargets,
  loadPackages,
  onCreate,
  onLink,
  onPreviewPackage,
  onProducePackage,
  onTransition,
  onUpdate,
  readOnly,
  sessionTests,
}: {
  cases: PlannedTestCaseRecord[];
  handoffs: TestHandoffRecord[];
  loadContextTargets: LoadTestHandoffContextTargets;
  loadPackages: LoadTestHandoffPackages;
  onCreate: SubmitTestHandoff;
  onLink: LinkTestHandoffSessionTest;
  onPreviewPackage: PreviewTestHandoffPackage;
  onProducePackage: ProduceTestHandoffPackage;
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
          loadContextTargets={loadContextTargets}
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
                loadContextTargets={loadContextTargets}
                loadPackages={loadPackages}
                onLink={onLink}
                onPreviewPackage={onPreviewPackage}
                onProducePackage={onProducePackage}
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
