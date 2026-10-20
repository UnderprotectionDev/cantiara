// biome-ignore-all lint/performance/noJsxPropsBind: Controls bind to the form fields and the draft Session Tests.
import {
  SESSION_TEST_REPORT_LABEL,
  TEST_REPORT_EXECUTOR_TYPE_LABELS,
  TEST_REPORT_EXECUTOR_TYPES,
  TEST_REPORT_RESULT_LABELS,
  TEST_SESSION_LABEL,
  type TestReportExecutorType,
  type TestReportResult,
  type TestSessionRecord,
} from "@cantiara/api/test-report";
import { Button } from "@cantiara/ui/components/button";
import { Input } from "@cantiara/ui/components/input";
import { Textarea } from "@cantiara/ui/components/textarea";
import { type FormEvent, useState } from "react";
import { refusalText } from "../lib/refusal-text";
import {
  EMPTY_SESSION_TEST,
  EMPTY_TEST_SESSION_FORM,
  RESULT_OPTIONS,
  reportFormatOf,
  type TestSessionFormValues,
} from "../lib/test-report-form";

export type RecordTestSession = (
  values: TestSessionFormValues,
) => Promise<unknown>;
export type ImportTestSessionFile = (file: {
  content: string;
  format: "json" | "markdown";
}) => Promise<unknown>;

const SELECT_CLASS =
  "h-9 rounded-md border border-input bg-background px-2 text-sm";

function RecordForm({ onRecord }: { onRecord: RecordTestSession }) {
  const [values, setValues] = useState(EMPTY_TEST_SESSION_FORM);
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);
  const patch = (next: Partial<TestSessionFormValues>) =>
    setValues((current) => ({ ...current, ...next }));
  const patchTest = (
    index: number,
    next: Partial<TestSessionFormValues["tests"][number]>,
  ) =>
    patch({
      tests: values.tests.map((test, at) =>
        at === index ? { ...test, ...next } : test,
      ),
    });
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined);
    setPending(true);
    try {
      await onRecord(values);
      setValues(EMPTY_TEST_SESSION_FORM);
    } catch (caught) {
      setError(refusalText(caught, `${TEST_SESSION_LABEL} was not saved.`));
    } finally {
      setPending(false);
    }
  }
  return (
    <form
      aria-label={`Record ${TEST_SESSION_LABEL}`}
      className="space-y-4 rounded-lg border border-border/70 p-5"
      onSubmit={submit}
    >
      <h3 className="font-medium">{`Record ${TEST_SESSION_LABEL}`}</h3>
      <p className="text-muted-foreground text-xs">
        Nothing is recorded until you save. A reported result is history, not
        verified product acceptance.
      </p>
      {error ? (
        <p className="text-destructive text-sm" role="alert">
          {error}
        </p>
      ) : null}
      <div className="grid gap-2 text-sm">
        <label htmlFor="test-session-executor-type">Executor type</label>
        <select
          className={SELECT_CLASS}
          disabled={pending}
          id="test-session-executor-type"
          onChange={(event) =>
            patch({
              executorType: event.target.value as TestReportExecutorType,
            })
          }
          value={values.executorType}
        >
          {TEST_REPORT_EXECUTOR_TYPES.map((type) => (
            <option key={type} value={type}>
              {TEST_REPORT_EXECUTOR_TYPE_LABELS[type]}
            </option>
          ))}
        </select>
      </div>
      <div className="grid gap-2 text-sm">
        <label htmlFor="test-session-executor-name">Executor</label>
        <Input
          disabled={pending}
          id="test-session-executor-name"
          maxLength={255}
          onChange={(event) => patch({ executorName: event.target.value })}
          required
          value={values.executorName}
        />
      </div>
      <div className="grid gap-2 text-sm">
        <label htmlFor="test-session-executor-version">Executor version</label>
        <Input
          disabled={pending}
          id="test-session-executor-version"
          maxLength={255}
          onChange={(event) => patch({ executorVersion: event.target.value })}
          value={values.executorVersion}
        />
      </div>
      <div className="grid gap-2 text-sm">
        <label htmlFor="test-session-reported-at">Reported at</label>
        <Input
          disabled={pending}
          id="test-session-reported-at"
          onChange={(event) => patch({ reportedAt: event.target.value })}
          type="datetime-local"
          value={values.reportedAt}
        />
      </div>
      <div className="grid gap-2 text-sm">
        <label htmlFor="test-session-summary">Summary</label>
        <Textarea
          disabled={pending}
          id="test-session-summary"
          onChange={(event) => patch({ summary: event.target.value })}
          rows={3}
          value={values.summary}
        />
      </div>
      {values.tests.map((test, index) => (
        <fieldset
          className="space-y-3 rounded-md border border-border/60 p-4"
          // biome-ignore lint/suspicious/noArrayIndexKey: Drafts have no id and keep their order.
          key={index}
        >
          <legend className="px-1 font-medium text-sm">{`${SESSION_TEST_REPORT_LABEL} ${index + 1}`}</legend>
          <div className="grid gap-2 text-sm">
            <label htmlFor={`test-session-test-${index}-title`}>
              {`${SESSION_TEST_REPORT_LABEL} ${index + 1} title`}
            </label>
            <Input
              disabled={pending}
              id={`test-session-test-${index}-title`}
              maxLength={255}
              onChange={(event) =>
                patchTest(index, { title: event.target.value })
              }
              required
              value={test.title}
            />
          </div>
          <div className="grid gap-2 text-sm">
            <label htmlFor={`test-session-test-${index}-result`}>
              {`${SESSION_TEST_REPORT_LABEL} ${index + 1} result`}
            </label>
            <select
              className={SELECT_CLASS}
              disabled={pending}
              id={`test-session-test-${index}-result`}
              onChange={(event) =>
                patchTest(index, {
                  result: event.target.value as TestReportResult,
                })
              }
              value={test.result}
            >
              {RESULT_OPTIONS.map((result) => (
                <option key={result} value={result}>
                  {TEST_REPORT_RESULT_LABELS[result]}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-2 text-sm">
            <label htmlFor={`test-session-test-${index}-notes`}>
              {`${SESSION_TEST_REPORT_LABEL} ${index + 1} notes`}
            </label>
            <Textarea
              disabled={pending}
              id={`test-session-test-${index}-notes`}
              onChange={(event) =>
                patchTest(index, { notes: event.target.value })
              }
              rows={2}
              value={test.notes}
            />
          </div>
          {values.tests.length > 1 ? (
            <Button
              disabled={pending}
              onClick={() =>
                patch({
                  tests: values.tests.filter((_test, at) => at !== index),
                })
              }
              size="sm"
              type="button"
              variant="outline"
            >
              {`Remove ${SESSION_TEST_REPORT_LABEL} ${index + 1}`}
            </Button>
          ) : null}
        </fieldset>
      ))}
      <div className="flex flex-wrap gap-2">
        <Button
          disabled={pending}
          onClick={() =>
            patch({ tests: [...values.tests, { ...EMPTY_SESSION_TEST }] })
          }
          type="button"
          variant="outline"
        >
          {`Add ${SESSION_TEST_REPORT_LABEL}`}
        </Button>
        <Button disabled={pending} type="submit">
          {`Record ${TEST_SESSION_LABEL}`}
        </Button>
      </div>
    </form>
  );
}

function ImportForm({ onImport }: { onImport: ImportTestSessionFile }) {
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file) {
      return;
    }
    const format = reportFormatOf(file.name);
    if (!format) {
      setError("Choose a .json, .md or .markdown file.");
      return;
    }
    setError(undefined);
    setPending(true);
    try {
      await onImport({ content: await file.text(), format });
      setFile(null);
    } catch (caught) {
      setError(refusalText(caught, `${TEST_SESSION_LABEL} was not imported.`));
    } finally {
      setPending(false);
    }
  }
  return (
    <form
      aria-label={`Import ${TEST_SESSION_LABEL} file`}
      className="space-y-3 rounded-lg border border-border/70 p-5"
      onSubmit={submit}
    >
      <h3 className="font-medium">{`Import ${TEST_SESSION_LABEL} file`}</h3>
      <p className="text-muted-foreground text-xs">
        A JSON file or a Markdown file with YAML frontmatter, using the
        test-report/1 contract. The file is checked as a whole; nothing is
        imported if any part is refused.
      </p>
      {error ? (
        <p className="text-destructive text-sm" role="alert">
          {error}
        </p>
      ) : null}
      <div className="grid gap-2 text-sm">
        <label htmlFor="test-session-file">Test report file</label>
        <input
          accept=".json,.md,.markdown"
          disabled={pending}
          id="test-session-file"
          onChange={(event) => setFile(event.target.files?.[0] ?? null)}
          type="file"
        />
      </div>
      <Button disabled={pending || !file} type="submit">
        {`Import ${TEST_SESSION_LABEL} file`}
      </Button>
    </form>
  );
}

const REPORTER_LABEL = { integration: "Integration", user: "User" } as const;

function TestSessionItem({ session }: { session: TestSessionRecord }) {
  const { executor } = session;
  return (
    <li
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
      <ul
        aria-label={`${SESSION_TEST_REPORT_LABEL}s`}
        className="space-y-1 text-sm"
      >
        {session.tests.map((test) => (
          <li key={test.id}>
            <span className="font-medium">{test.title}</span>
            {`: ${test.resultLabel}`}
            {test.notes ? (
              <span className="block text-muted-foreground">{test.notes}</span>
            ) : null}
          </li>
        ))}
      </ul>
    </li>
  );
}

/**
 * Test Sessions of a Project. Recording and importing both write the same
 * Test Session and Session Test model; a new session shows `Unreviewed`. There
 * is no review, approve, verify or release control here: a reported result is
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
      <h2 className="font-semibold text-lg">Test Sessions</h2>
      <p className="text-muted-foreground text-sm">
        A Test Session holds the Session Tests an executor reported. It starts
        Unreviewed and never counts as verified product acceptance.
      </p>
      {readOnly ? null : (
        <>
          <RecordForm onRecord={onRecord} />
          <ImportForm onImport={onImport} />
        </>
      )}
      {sessions.length === 0 ? (
        <p className="text-muted-foreground text-sm">No Test Sessions yet.</p>
      ) : (
        <ul className="space-y-3">
          {sessions.map((session) => (
            <TestSessionItem key={session.id} session={session} />
          ))}
        </ul>
      )}
    </section>
  );
}
