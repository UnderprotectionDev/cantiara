import {
  SESSION_TEST_REPORT_LABEL,
  TEST_REPORT_EXECUTOR_TYPE_LABELS,
  TEST_SESSION_LABEL,
  type TestSessionRecord,
} from "@cantiara/api/test-report";
import {
  VirtualList,
  type VirtualRowProps,
} from "@cantiara/ui/components/virtual-list";
import { virtualRowId } from "@cantiara/ui/lib/virtual-list-dom";
import TestSessionImportForm, {
  type ImportTestSessionFile,
} from "../forms/test-session-import-form";
import TestSessionRecordForm, {
  type RecordTestSession,
} from "../forms/test-session-record-form";

const REPORTER_LABEL = { integration: "Integration", user: "User" } as const;

function TestSessionItem({
  session,
  rowProps,
}: {
  session: TestSessionRecord;
  rowProps?: VirtualRowProps;
}) {
  const { executor } = session;
  return (
    <li
      {...rowProps}
      className="space-y-3 rounded-lg border border-border/70 p-4"
      id={`test-session-${session.id}`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <h4 className="font-medium">
          {session.summary ?? `${TEST_SESSION_LABEL} by ${executor.name}`}
        </h4>
        <span className="rounded-full border border-border px-2 py-0.5 text-xs">
          {session.reviewState}
        </span>
      </div>
      <dl className="grid gap-1 text-sm sm:grid-cols-2">
        <div>
          <dt className="font-medium">Executor type</dt>
          <dd>{TEST_REPORT_EXECUTOR_TYPE_LABELS[executor.type]}</dd>
        </div>
        <div>
          <dt className="font-medium">Executor</dt>
          <dd>
            {executor.version
              ? `${executor.name} ${executor.version}`
              : executor.name}
          </dd>
        </div>
        <div>
          <dt className="font-medium">Reporter</dt>
          <dd>{REPORTER_LABEL[session.reporter.kind]}</dd>
        </div>
        <div>
          <dt className="font-medium">Ingress</dt>
          <dd>{session.ingress}</dd>
        </div>
        <div>
          <dt className="font-medium">Reported at</dt>
          <dd>{session.reportedAtText}</dd>
        </div>
      </dl>
      <VirtualList
        aria-label={`${SESSION_TEST_REPORT_LABEL}s`}
        className="space-y-1 text-sm"
        estimateSize={140}
        gap={8}
        getKey={virtualRowId}
        rows={session.tests}
      >
        {(test, testRowProps) => (
          <li {...testRowProps}>
            <span className="font-medium">{test.title}</span>
            {`: ${test.resultLabel}`}
            {test.notes ? (
              <span className="block text-muted-foreground">{test.notes}</span>
            ) : null}
          </li>
        )}
      </VirtualList>
    </li>
  );
}

/**
 * Test Sessions of a Project. Recording and importing both write the same
 * Test Session and Session Test model; a new session shows `Unreviewed`. Review lives in
 * Test Review (spec 57). There is no approve, verify or release control here: a reported result is
 * history, not Product acceptance evidence.
 */
export function TestSessionsView({
  onImport,
  onRecord,
  readOnly,
  sessions,
}: {
  onImport: ImportTestSessionFile;
  onRecord: RecordTestSession;
  readOnly: boolean;
  sessions: TestSessionRecord[];
}) {
  return (
    <section
      aria-label="Test Sessions"
      className="space-y-6"
      id="test-sessions"
    >
      <h2 className="text-lg font-semibold">Test Sessions</h2>
      <p className="text-sm text-muted-foreground">
        A Test Session holds the Session Tests an executor reported. It starts
        Unreviewed and never counts as verified product acceptance.
      </p>
      {readOnly ? null : (
        <>
          <TestSessionRecordForm onRecord={onRecord} />
          <TestSessionImportForm onImport={onImport} />
        </>
      )}
      {sessions.length === 0 ? (
        <p className="text-sm text-muted-foreground">No Test Sessions yet.</p>
      ) : (
        <VirtualList
          className="space-y-3"
          estimateSize={140}
          gap={12}
          getKey={virtualRowId}
          rows={sessions}
        >
          {(session, rowProps) => (
            <TestSessionItem rowProps={rowProps} session={session} />
          )}
        </VirtualList>
      )}
    </section>
  );
}
