// biome-ignore-all lint/performance/noJsxPropsBind: Controls bind to the selected Session Test and form fields.
import {
  type PlannedTestCaseRecord,
  type PlannedTestCaseVersionRef,
  SESSION_TEST_LABEL,
  type SessionTestRecord,
} from "@cantiara/api/planned-tests";
import { Button } from "@cantiara/ui/components/button";
import { Input } from "@cantiara/ui/components/input";
import { Textarea } from "@cantiara/ui/components/textarea";
import { type FormEvent, useState } from "react";

export interface RecordSessionTestValues {
  binding: PlannedTestCaseVersionRef | null;
  expectedBehavior: string;
  purpose: string;
  title: string;
}

export type SubmitSessionTest = (
  values: RecordSessionTestValues,
) => Promise<unknown>;
export type LinkSessionTest = (
  sessionTestId: string,
  ref: PlannedTestCaseVersionRef,
) => Promise<unknown>;

const AD_HOC = "";

function errorText(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

function optionValue(ref: PlannedTestCaseVersionRef) {
  return `${ref.caseId}@${ref.version}`;
}

function parseOption(value: string): PlannedTestCaseVersionRef | null {
  const at = value.lastIndexOf("@");
  return at < 0
    ? null
    : { caseId: value.slice(0, at), version: Number(value.slice(at + 1)) };
}

/** Every exact version is its own option: there is no "latest" choice. */
function VersionOptions({ cases }: { cases: PlannedTestCaseRecord[] }) {
  return cases.map((record) => (
    <optgroup key={record.id} label={record.current.title}>
      {[...record.versions].reverse().map((version) => (
        <option
          key={version.id}
          value={optionValue({ caseId: record.id, version: version.version })}
        >
          {`${version.title}, version ${version.version}`}
        </option>
      ))}
    </optgroup>
  ));
}

function RecordForm({
  cases,
  onRecord,
}: {
  cases: PlannedTestCaseRecord[];
  onRecord: SubmitSessionTest;
}) {
  const [title, setTitle] = useState("");
  const [bound, setBound] = useState(AD_HOC);
  const [purpose, setPurpose] = useState("");
  const [expectedBehavior, setExpectedBehavior] = useState("");
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);
  const adHoc = bound === AD_HOC;
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined);
    setPending(true);
    try {
      await onRecord({
        binding: adHoc ? null : parseOption(bound),
        expectedBehavior,
        purpose,
        title,
      });
      setTitle("");
      setBound(AD_HOC);
      setPurpose("");
      setExpectedBehavior("");
    } catch (caught) {
      setError(errorText(caught, `${SESSION_TEST_LABEL} was not saved.`));
    } finally {
      setPending(false);
    }
  }
  return (
    <form
      aria-label={`Record ${SESSION_TEST_LABEL}`}
      className="space-y-4 rounded-lg border border-border/70 p-5"
      onSubmit={submit}
    >
      <h3 className="font-medium">{`Record ${SESSION_TEST_LABEL}`}</h3>
      {error ? (
        <p className="text-destructive text-sm" role="alert">
          {error}
        </p>
      ) : null}
      <div className="grid gap-2 text-sm">
        <label htmlFor="session-test-new-title">Title</label>
        <Input
          disabled={pending}
          id="session-test-new-title"
          maxLength={255}
          onChange={(event) => setTitle(event.target.value)}
          required
          value={title}
        />
      </div>
      <div className="grid gap-2 text-sm">
        <label htmlFor="session-test-new-bound">
          Planned Test Case version
        </label>
        <select
          className="h-9 rounded-md border border-input bg-background px-2"
          disabled={pending}
          id="session-test-new-bound"
          onChange={(event) => setBound(event.target.value)}
          value={bound}
        >
          <option value={AD_HOC}>None (ad hoc)</option>
          <VersionOptions cases={cases} />
        </select>
      </div>
      {adHoc ? (
        <>
          <div className="grid gap-2 text-sm">
            <label htmlFor="session-test-new-purpose">Purpose</label>
            <Textarea
              disabled={pending}
              id="session-test-new-purpose"
              onChange={(event) => setPurpose(event.target.value)}
              required
              rows={3}
              value={purpose}
            />
          </div>
          <div className="grid gap-2 text-sm">
            <label htmlFor="session-test-new-expected">Expected behavior</label>
            <Textarea
              disabled={pending}
              id="session-test-new-expected"
              onChange={(event) => setExpectedBehavior(event.target.value)}
              required
              rows={3}
              value={expectedBehavior}
            />
          </div>
        </>
      ) : null}
      <Button disabled={pending} type="submit">
        {`Record ${SESSION_TEST_LABEL}`}
      </Button>
    </form>
  );
}

function LinkForm({
  cases,
  onLink,
  sessionTest,
}: {
  cases: PlannedTestCaseRecord[];
  onLink: LinkSessionTest;
  sessionTest: SessionTestRecord;
}) {
  const [choice, setChoice] = useState(AD_HOC);
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);
  const selectId = `session-test-${sessionTest.id}-link`;
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const ref = parseOption(choice);
    if (!ref) {
      return;
    }
    setError(undefined);
    setPending(true);
    try {
      await onLink(sessionTest.id, ref);
    } catch (caught) {
      setError(errorText(caught, `${SESSION_TEST_LABEL} was not linked.`));
    } finally {
      setPending(false);
    }
  }
  if (cases.length === 0) {
    return null;
  }
  return (
    <form
      aria-label={`Link ${sessionTest.title} to a Planned Test Case`}
      className="space-y-2"
      onSubmit={submit}
    >
      {error ? (
        <p className="text-destructive text-sm" role="alert">
          {error}
        </p>
      ) : null}
      <label className="text-sm" htmlFor={selectId}>
        Link to Planned Test Case version
      </label>
      <p className="text-muted-foreground text-xs">
        Linking keeps what was recorded and does not mark the version as
        executed. A link does not move later.
      </p>
      <div className="flex flex-wrap gap-2">
        <select
          className="h-9 rounded-md border border-input bg-background px-2 text-sm"
          disabled={pending}
          id={selectId}
          onChange={(event) => setChoice(event.target.value)}
          value={choice}
        >
          <option value={AD_HOC}>Choose a version</option>
          <VersionOptions cases={cases} />
        </select>
        <Button
          disabled={pending || choice === AD_HOC}
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

function SessionTestItem({
  cases,
  onLink,
  readOnly,
  sessionTest,
}: {
  cases: PlannedTestCaseRecord[];
  onLink: LinkSessionTest;
  readOnly: boolean;
  sessionTest: SessionTestRecord;
}) {
  const { bind } = sessionTest;
  return (
    <li
      className="space-y-3 rounded-lg border border-border/70 p-4"
      id={`session-test-${sessionTest.id}`}
    >
      <h4 className="font-medium">{sessionTest.title}</h4>
      {bind ? (
        <div className="space-y-1 text-sm">
          <p>{bind.summary}</p>
          <p className="text-muted-foreground">{`Planned Test Case: ${bind.pinnedTitle}`}</p>
          {bind.changesSinceBound.length > 0 ? (
            <ul aria-label="Changes since the bound version">
              {bind.changesSinceBound.map((change) => (
                <li key={change.version}>
                  {`Version ${change.version}: ${change.changeKind}`}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : (
        <p className="text-sm">Ad hoc, not bound to a Planned Test Case.</p>
      )}
      {sessionTest.purpose ? (
        <dl className="grid gap-2 text-sm">
          <div>
            <dt className="font-medium">Purpose when recorded</dt>
            <dd className="whitespace-pre-wrap">{sessionTest.purpose}</dd>
          </div>
          <div>
            <dt className="font-medium">Expected behavior when recorded</dt>
            <dd className="whitespace-pre-wrap">
              {sessionTest.expectedBehavior}
            </dd>
          </div>
        </dl>
      ) : null}
      {bind || readOnly ? null : (
        <LinkForm cases={cases} onLink={onLink} sessionTest={sessionTest} />
      )}
    </li>
  );
}

/**
 * Session Tests bound to exact Planned Test Case versions. The bind shows the
 * version difference in words ("Bound to v1, current v3") and never offers to
 * move or rebind; there is no result, review or run control here.
 */
export function SessionTestsView({
  cases,
  onLink,
  onRecord,
  readOnly,
  sessionTests,
}: {
  cases: PlannedTestCaseRecord[];
  onLink: LinkSessionTest;
  onRecord: SubmitSessionTest;
  readOnly: boolean;
  sessionTests: SessionTestRecord[];
}) {
  return (
    <section
      aria-label="Session Tests"
      className="space-y-6"
      id="session-tests"
    >
      <h2 className="font-semibold text-lg">Session Tests</h2>
      <p className="text-muted-foreground text-sm">
        A Session Test is bound, if at all, to one exact Planned Test Case
        version. Editing the case later never moves the bind.
      </p>
      {readOnly ? null : <RecordForm cases={cases} onRecord={onRecord} />}
      {sessionTests.length === 0 ? (
        <p className="text-muted-foreground text-sm">No Session Tests yet.</p>
      ) : (
        <ul className="space-y-3">
          {sessionTests.map((sessionTest) => (
            <SessionTestItem
              cases={cases}
              key={sessionTest.id}
              onLink={onLink}
              readOnly={readOnly}
              sessionTest={sessionTest}
            />
          ))}
        </ul>
      )}
    </section>
  );
}
