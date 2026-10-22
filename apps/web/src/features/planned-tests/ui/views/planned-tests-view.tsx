// biome-ignore-all lint/performance/noJsxPropsBind: Controls bind to the selected Planned Test Case and form fields.
import type {
  PlannedTestCaseRecord,
  PlannedTestCaseVersionRecord,
} from "@cantiara/api/planned-tests";
import { Button } from "@cantiara/ui/components/button";
import { useRef, useState } from "react";
import {
  type CaseFormValues,
  EMPTY_CASE_FORM,
  formFromVersion,
  relationLabel,
} from "../../lib/planned-test-form";
import type { LoadRelationTargets } from "../components/planned-test-relations-field";
import { CaseForm, type SubmitCase } from "../forms/case-form";

export type SubmitCaseVersion = (
  record: PlannedTestCaseRecord,
  values: CaseFormValues,
) => Promise<unknown>;

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
