// biome-ignore-all lint/performance/noJsxPropsBind: Controls bind to the selected Session Test and form fields.
import type {
  PlannedTestCaseRecord,
  SessionTestRecord,
} from "@cantiara/api/planned-tests";
import {
  LinkScenarioVersionForm,
  type LinkSessionTest,
  RecordForm,
  type SubmitSessionTest,
} from "../forms/session-test-form";

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
        <LinkScenarioVersionForm
          cases={cases}
          onLink={onLink}
          sessionTest={sessionTest}
        />
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
