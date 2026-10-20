// biome-ignore-all lint/performance/noJsxPropsBind: Controls bind to the selected Planned Test Case and form fields.
import {
  PLANNED_TEST_CASE_LABEL,
  PLANNED_TEST_CHANGE_KINDS,
  type PlannedTestCaseRecord,
  type PlannedTestCaseVersionRecord,
  type PlannedTestChangeKind,
} from "@cantiara/api/planned-tests";
import { Button } from "@cantiara/ui/components/button";
import { Input } from "@cantiara/ui/components/input";
import { Textarea } from "@cantiara/ui/components/textarea";
import { useForm } from "@tanstack/react-form";
import { type FormEvent, useEffect, useRef, useState } from "react";
import {
  type CaseFormValues,
  EMPTY_CASE_FORM,
  formFromVersion,
  relationLabel,
} from "../lib/planned-test-form";
import {
  type LoadRelationTargets,
  PlannedTestRelationsField,
} from "./planned-test-relations-field";

export type SubmitCase = (values: CaseFormValues) => Promise<unknown>;
export type SubmitCaseVersion = (
  record: PlannedTestCaseRecord,
  values: CaseFormValues,
) => Promise<unknown>;

const TEXT_FIELDS = [
  { label: "Title", name: "title", rows: 1 },
  { label: "Purpose", name: "purpose", rows: 3 },
  { label: "Scope", name: "scope", rows: 3 },
  { label: "Preconditions", name: "preconditions", rows: 3 },
  { label: "Expected behavior", name: "expectedBehavior", rows: 3 },
  { label: "Notes (optional)", name: "notes", rows: 3 },
] as const;

function errorText(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

/**
 * One form for both the first version and every later one. A later version
 * carries the full definition plus how it changed, so the version difference
 * stays explainable; there is no result, status or step field to fill in.
 */
function CaseForm({
  focusOnMount,
  heading,
  idPrefix,
  initial,
  loadTargets,
  onCancel,
  onSubmit,
  showChangeKind,
  submitLabel,
}: {
  focusOnMount: boolean;
  heading: string;
  idPrefix: string;
  initial: CaseFormValues;
  loadTargets: LoadRelationTargets;
  onCancel?: () => void;
  onSubmit: SubmitCase;
  showChangeKind: boolean;
  submitLabel: string;
}) {
  const [error, setError] = useState<string>();
  const firstField = useRef<HTMLInputElement | HTMLTextAreaElement>(null);
  useEffect(() => {
    if (focusOnMount) {
      firstField.current?.focus();
    }
  }, [focusOnMount]);
  const form = useForm({
    defaultValues: initial,
    onSubmit: async ({ value, formApi }) => {
      setError(undefined);
      try {
        await onSubmit(value);
        formApi.reset();
      } catch (caught) {
        setError(
          errorText(caught, `${PLANNED_TEST_CASE_LABEL} was not saved.`),
        );
      }
    },
  });
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    form.handleSubmit().catch(() => undefined);
  }
  return (
    <form
      aria-label={heading}
      className="space-y-4 rounded-lg border border-border/70 p-5"
      onSubmit={submit}
    >
      <h3 className="font-medium">{heading}</h3>
      {error ? (
        <p className="text-destructive text-sm" role="alert">
          {error}
        </p>
      ) : null}
      <form.Subscribe selector={(state) => state.isSubmitting}>
        {(pending) => (
          <>
            {showChangeKind ? (
              <form.Field name="changeKind">
                {(field) => (
                  <fieldset className="space-y-2">
                    <legend className="text-sm">Change kind</legend>
                    {PLANNED_TEST_CHANGE_KINDS.map((kind) => (
                      <label
                        className="flex items-center gap-2 text-sm"
                        htmlFor={`${idPrefix}-kind-${kind}`}
                        key={kind}
                      >
                        <input
                          checked={field.state.value === kind}
                          disabled={pending}
                          id={`${idPrefix}-kind-${kind}`}
                          name={`${idPrefix}-change-kind`}
                          onChange={() =>
                            field.handleChange(kind as PlannedTestChangeKind)
                          }
                          type="radio"
                          value={kind}
                        />
                        {kind}
                      </label>
                    ))}
                  </fieldset>
                )}
              </form.Field>
            ) : null}
            {TEXT_FIELDS.map((spec, index) => (
              <form.Field key={spec.name} name={spec.name}>
                {(field) => (
                  <div className="grid gap-2 text-sm">
                    <label htmlFor={`${idPrefix}-${spec.name}`}>
                      {spec.label}
                    </label>
                    {spec.name === "title" ? (
                      <Input
                        disabled={pending}
                        id={`${idPrefix}-${spec.name}`}
                        maxLength={255}
                        onBlur={field.handleBlur}
                        onChange={(event) =>
                          field.handleChange(event.target.value)
                        }
                        ref={
                          index === 0
                            ? (firstField as React.Ref<HTMLInputElement>)
                            : undefined
                        }
                        required
                        value={field.state.value}
                      />
                    ) : (
                      <Textarea
                        disabled={pending}
                        id={`${idPrefix}-${spec.name}`}
                        onBlur={field.handleBlur}
                        onChange={(event) =>
                          field.handleChange(event.target.value)
                        }
                        required={spec.name !== "notes"}
                        rows={spec.rows}
                        value={field.state.value}
                      />
                    )}
                  </div>
                )}
              </form.Field>
            ))}
            <form.Field name="relations">
              {(field) => (
                <PlannedTestRelationsField
                  idPrefix={idPrefix}
                  loadTargets={loadTargets}
                  onChange={field.handleChange}
                  value={field.state.value}
                />
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
                  Cancel
                </Button>
              ) : null}
            </div>
          </>
        )}
      </form.Subscribe>
    </form>
  );
}

function VersionDetails({
  version,
}: {
  version: PlannedTestCaseVersionRecord;
}) {
  return (
    <dl className="grid gap-2 text-sm">
      {(
        [
          ["Purpose", version.purpose],
          ["Scope", version.scope],
          ["Preconditions", version.preconditions],
          ["Expected behavior", version.expectedBehavior],
          ["Notes", version.notes],
        ] as const
      ).map(([label, text]) =>
        text ? (
          <div key={label}>
            <dt className="font-medium">{label}</dt>
            <dd className="whitespace-pre-wrap">{text}</dd>
          </div>
        ) : null,
      )}
      <div>
        <dt className="font-medium">Relations</dt>
        <dd>
          {version.relations.length === 0 ? (
            "No relations."
          ) : (
            <ul>
              {version.relations.map((relation) => (
                <li key={relation.id}>{relationLabel(relation)}</li>
              ))}
            </ul>
          )}
        </dd>
      </div>
    </dl>
  );
}

function CaseItem({
  loadTargets,
  onCreateVersion,
  readOnly,
  record,
}: {
  loadTargets: LoadRelationTargets;
  onCreateVersion: SubmitCaseVersion;
  readOnly: boolean;
  record: PlannedTestCaseRecord;
}) {
  const [editing, setEditing] = useState(false);
  const [saved, setSaved] = useState<number>();
  const heading = useRef<HTMLHeadingElement>(null);
  const formId = `planned-test-${record.id}-version-form`;
  async function save(values: CaseFormValues) {
    await onCreateVersion(record, values);
    setSaved(record.current.version + 1);
    setEditing(false);
    heading.current?.focus();
  }
  return (
    <li
      className="space-y-3 rounded-lg border border-border/70 p-4"
      id={`planned-test-case-${record.id}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="font-medium" ref={heading} tabIndex={-1}>
          {record.current.title}
        </h4>
        <span className="text-muted-foreground text-xs">
          Version {record.current.version}
        </span>
      </div>
      <VersionDetails version={record.current} />
      {saved ? (
        <p className="text-sm" role="status">
          Version {saved} saved.
        </p>
      ) : null}
      {readOnly ? null : (
        <Button
          aria-controls={formId}
          aria-expanded={editing}
          onClick={() => setEditing((open) => !open)}
          size="sm"
          type="button"
          variant="outline"
        >
          {editing ? "Cancel new version" : "New version"}
        </Button>
      )}
      <div id={formId}>
        {editing && !readOnly ? (
          <CaseForm
            focusOnMount
            heading={`New version of ${record.current.title}`}
            idPrefix={`planned-test-${record.id}`}
            initial={formFromVersion(record.current)}
            loadTargets={loadTargets}
            onCancel={() => setEditing(false)}
            onSubmit={save}
            showChangeKind
            submitLabel="Save new version"
          />
        ) : null}
      </div>
      {record.versions.length > 1 ? (
        <details>
          <summary className="cursor-pointer text-sm">
            Version history ({record.versions.length})
          </summary>
          <ol className="mt-2 space-y-3">
            {[...record.versions].reverse().map((version) => (
              <li
                className="space-y-1 rounded-md border border-border/50 p-3"
                key={version.id}
              >
                <p className="font-medium text-sm">
                  Version {version.version}: {version.changeKind}
                </p>
                <p className="text-muted-foreground text-xs">
                  {version.createdAt}
                </p>
                <p className="text-sm">{version.title}</p>
                <VersionDetails version={version} />
              </li>
            ))}
          </ol>
        </details>
      ) : null}
    </li>
  );
}

export function PlannedTestsView({
  cases,
  loadTargets,
  onCreate,
  onCreateVersion,
  readOnly,
}: {
  cases: PlannedTestCaseRecord[];
  loadTargets: LoadRelationTargets;
  onCreate: SubmitCase;
  onCreateVersion: SubmitCaseVersion;
  readOnly: boolean;
}) {
  return (
    <section
      aria-label="Planned Test Cases"
      className="space-y-6"
      id="planned-test-cases"
    >
      <h2 className="font-semibold text-lg">Planned Test Cases</h2>
      <p className="text-muted-foreground text-sm">
        A Planned Test Case is versioned test intent. It does not run tests and
        carries no results.
      </p>
      {readOnly ? null : (
        <CaseForm
          focusOnMount={false}
          heading="Create Planned Test Case"
          idPrefix="planned-test-new"
          initial={EMPTY_CASE_FORM}
          loadTargets={loadTargets}
          onSubmit={onCreate}
          showChangeKind={false}
          submitLabel="Create Planned Test Case"
        />
      )}
      {cases.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          No Planned Test Cases yet.
        </p>
      ) : (
        <ul className="space-y-3">
          {cases.map((record) => (
            <CaseItem
              key={record.id}
              loadTargets={loadTargets}
              onCreateVersion={onCreateVersion}
              readOnly={readOnly}
              record={record}
            />
          ))}
        </ul>
      )}
    </section>
  );
}
