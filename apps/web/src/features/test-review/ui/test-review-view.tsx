// biome-ignore-all lint/performance/noJsxPropsBind: Handlers bind to the session and item being reviewed.

import {
  TEST_REPORT_RESULT_LABELS,
  TEST_REPORT_RESULTS,
} from "@cantiara/api/test-report";
import {
  TEST_REVIEW_BULK_LABEL,
  TEST_REVIEW_NEW_CONTEXT_LABEL,
  TEST_REVIEW_SETTABLE_STATES,
  type TestResultEvent,
  type TestResultEventKind,
  type TestReviewBulkPreview,
  type TestReviewClosePreview,
  type TestReviewEvent,
  type TestReviewItem,
  type TestReviewSession,
  type TestReviewSettableState,
} from "@cantiara/api/test-review";
import { Button } from "@cantiara/ui/components/button";
import { Textarea } from "@cantiara/ui/components/textarea";
import { useEffect, useRef, useState } from "react";

export interface TestResultEventDraft {
  correctedResult: (typeof TEST_REPORT_RESULTS)[number] | null;
  eventId: string | null;
  kind: TestResultEventKind;
  note: string;
  reason: string;
  sessionTestId: string | null;
}

export interface TestReviewActions {
  commitBulk: (
    sessionId: string,
    sessionTestIds: string[],
    preview: TestReviewBulkPreview,
  ) => Promise<unknown>;
  previewBulk: (
    sessionId: string,
    sessionTestIds: string[],
  ) => Promise<TestReviewBulkPreview>;
  previewClose: (sessionId: string) => Promise<TestReviewClosePreview>;
  recordEvent: (
    sessionId: string,
    draft: TestResultEventDraft,
  ) => Promise<unknown>;
  setItem: (
    sessionId: string,
    sessionTestId: string,
    state: TestReviewSettableState,
  ) => Promise<unknown>;
  setSession: (
    sessionId: string,
    state: TestReviewSettableState,
    reason: string,
  ) => Promise<unknown>;
}

function errorText(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

function sessionTitle(session: TestReviewSession) {
  return session.summary ?? `Test Session by ${session.executorName}`;
}

/** Moves focus to the heading of a panel that just opened, for keyboard and screen readers. */
function usePanelFocus(open: boolean) {
  const ref = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (open) {
      ref.current?.focus();
    }
  }, [open]);
  return ref;
}

function StateButtons({
  current,
  disabled,
  label,
  onPick,
}: {
  current: string;
  disabled: boolean;
  label: string;
  onPick: (state: TestReviewSettableState) => void;
}) {
  return (
    <fieldset className="m-0 flex min-w-0 flex-wrap gap-2 border-0 p-0">
      <legend className="sr-only">{label}</legend>
      {TEST_REVIEW_SETTABLE_STATES.map((state) => (
        <Button
          aria-label={`${label}: ${state}`}
          aria-pressed={current === state}
          className="h-8 px-3 text-xs"
          disabled={disabled}
          key={state}
          onClick={() => onPick(state)}
          type="button"
          variant={current === state ? "default" : "outline"}
        >
          {state}
        </Button>
      ))}
    </fieldset>
  );
}

function ClosePanel({
  onCancel,
  onConfirm,
  pending,
  preview,
}: {
  onCancel: () => void;
  onConfirm: (reason: string) => void;
  pending: boolean;
  preview: TestReviewClosePreview;
}) {
  const [reason, setReason] = useState("");
  const headingRef = usePanelFocus(true);
  return (
    <section
      aria-labelledby="test-review-close-heading"
      className="space-y-3 rounded-md border border-border p-3 text-sm"
    >
      <h5
        className="font-medium outline-none"
        id="test-review-close-heading"
        ref={headingRef}
        tabIndex={-1}
      >
        Close this Test Session
      </h5>
      {preview.remaining.length === 0 ? (
        <p>Every Session Test has been reviewed or closed.</p>
      ) : (
        <>
          <p>
            These Session Tests stay exactly as they are. Closing is not blocked
            by them.
          </p>
          <ul aria-label="Remaining Session Tests" className="list-disc pl-5">
            {preview.remaining.map((record) => (
              <li key={record.id}>{`${record.title}: ${record.state}`}</li>
            ))}
          </ul>
        </>
      )}
      <div className="grid gap-2">
        <label htmlFor="test-review-close-reason">
          Close reason (optional)
        </label>
        <Textarea
          disabled={pending}
          id="test-review-close-reason"
          onChange={(event) => setReason(event.target.value)}
          rows={2}
          value={reason}
        />
      </div>
      <div className="flex gap-2">
        <Button
          disabled={pending}
          onClick={() => onConfirm(reason)}
          type="button"
        >
          Close Test Session
        </Button>
        <Button
          disabled={pending}
          onClick={onCancel}
          type="button"
          variant="outline"
        >
          Cancel
        </Button>
      </div>
    </section>
  );
}

function BulkPanel({
  onCancel,
  onConfirm,
  pending,
  preview,
}: {
  onCancel: () => void;
  onConfirm: () => void;
  pending: boolean;
  preview: TestReviewBulkPreview;
}) {
  const headingRef = usePanelFocus(true);
  return (
    <section
      aria-labelledby="test-review-bulk-heading"
      className="space-y-3 rounded-md border border-border p-3 text-sm"
    >
      <h5
        className="font-medium outline-none"
        id="test-review-bulk-heading"
        ref={headingRef}
        tabIndex={-1}
      >
        {`Preview: ${TEST_REVIEW_BULK_LABEL}`}
      </h5>
      {preview.changes.length === 0 ? (
        <p>Everything selected is already Reviewed. Nothing would change.</p>
      ) : (
        <>
          <p>These exact records become Reviewed in one step:</p>
          <ul aria-label="Records to change" className="list-disc pl-5">
            {preview.changes.map((change) => (
              <li key={`${change.kind}:${change.id}`}>
                {`${change.kind} ${change.label}: ${change.from} to Reviewed`}
              </li>
            ))}
          </ul>
        </>
      )}
      <p className="text-muted-foreground">
        Reported results are not changed. This is not a release gate.
      </p>
      <div className="flex gap-2">
        <Button
          disabled={pending || preview.changes.length === 0}
          onClick={onConfirm}
          type="button"
        >
          Apply review
        </Button>
        <Button
          disabled={pending}
          onClick={onCancel}
          type="button"
          variant="outline"
        >
          Cancel
        </Button>
      </div>
    </section>
  );
}

function resultLabel(result: string | null) {
  if (result === null) {
    return "No result";
  }
  return (
    (TEST_REPORT_RESULT_LABELS as Record<string, string>)[result] ?? result
  );
}

function CurrentResult({ item }: { item: TestReviewItem }) {
  const { current } = item;
  if (current.source === "Reported" && !item.rawResultRedacted) {
    return null;
  }
  let text = `Current result: ${resultLabel(current.result)} (${current.source})`;
  if (current.source === "Withdrawal") {
    text = "Current result: withdrawn (Withdrawal)";
  }
  return (
    <p className="text-sm">
      {text}
      {current.usable ? "" : ". Not usable as current evidence or export."}
    </p>
  );
}

function ItemRow({
  actions,
  checked,
  disabled,
  item,
  onEvent,
  onToggle,
  sessionId,
  run,
}: {
  actions: TestReviewActions;
  checked: boolean;
  disabled: boolean;
  item: TestReviewItem;
  onEvent: (kind: TestResultEventKind) => void;
  onToggle: () => void;
  run: (work: () => Promise<unknown>) => void;
  sessionId: string;
}) {
  return (
    <li className="space-y-2 rounded-md border border-border/60 p-3">
      <div className="flex flex-wrap items-center gap-3">
        <input
          aria-label={`Select ${item.title}`}
          checked={checked}
          disabled={disabled}
          onChange={onToggle}
          type="checkbox"
        />
        <span className="font-medium">{item.title}</span>
        <span className="text-muted-foreground">
          {`Reported: ${item.normalizedResult ?? "Not reported"}`}
          {item.rawResult ? ` (${item.rawResult})` : ""}
          {item.rawResultRedacted ? " (value redacted)" : ""}
        </span>
        <span className="rounded-full border border-border px-2 py-0.5 text-xs">
          {item.reviewState}
        </span>
        {item.newContextAfterClose ? (
          <span className="rounded-full border border-amber-600 px-2 py-0.5 text-xs">
            {TEST_REVIEW_NEW_CONTEXT_LABEL}
          </span>
        ) : null}
      </div>
      <CurrentResult item={item} />
      <div className="flex flex-wrap gap-2">
        <Button
          aria-label={`Correction for ${item.title}`}
          className="h-8 px-3 text-xs"
          disabled={disabled}
          onClick={() => onEvent("Correction")}
          type="button"
          variant="outline"
        >
          Correction
        </Button>
        <Button
          aria-label={`Withdrawal for ${item.title}`}
          className="h-8 px-3 text-xs"
          disabled={disabled || item.current.source === "Withdrawal"}
          onClick={() => onEvent("Withdrawal")}
          type="button"
          variant="outline"
        >
          Withdrawal
        </Button>
        <Button
          aria-label={`Redact reported result of ${item.title}`}
          className="h-8 px-3 text-xs"
          disabled={disabled || item.rawResultRedacted}
          onClick={() => onEvent("Redaction")}
          type="button"
          variant="outline"
        >
          Redact value
        </Button>
      </div>
      <StateButtons
        current={item.reviewState}
        disabled={disabled}
        label={`Review ${item.title}`}
        onPick={(state) =>
          run(() => actions.setItem(sessionId, item.id, state))
        }
      />
    </li>
  );
}

const EVENT_COPY: Record<TestResultEventKind, { done: string; title: string }> =
  {
    Correction: {
      done: "Correction recorded. The original report stays in history.",
      title: "Correction",
    },
    Redaction: {
      done: "Redaction mark recorded. The value was replaced.",
      title: "Redact a sensitive value",
    },
    Withdrawal: {
      done: "Withdrawal recorded. The original report stays in history.",
      title: "Withdrawal",
    },
  };

function EventPanel({
  eventId,
  kind,
  onCancel,
  onConfirm,
  pending,
  sessionTestId,
  title,
}: {
  eventId: string | null;
  kind: TestResultEventKind;
  onCancel: () => void;
  onConfirm: (draft: TestResultEventDraft) => void;
  pending: boolean;
  sessionTestId: string | null;
  title: string;
}) {
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [result, setResult] = useState<
    (typeof TEST_REPORT_RESULTS)[number] | ""
  >("");
  const headingRef = usePanelFocus(true);
  const needsResult = kind === "Correction" && sessionTestId !== null;
  const needsNote = kind === "Correction" && sessionTestId === null;
  const ready =
    reason.trim() !== "" &&
    (!needsResult || result !== "") &&
    (!needsNote || note.trim() !== "");
  return (
    <section
      aria-labelledby="test-review-event-heading"
      className="space-y-3 rounded-md border border-border p-3 text-sm"
    >
      <h5
        className="font-medium outline-none"
        id="test-review-event-heading"
        ref={headingRef}
        tabIndex={-1}
      >
        {title}
      </h5>
      <p className="text-muted-foreground">
        {kind === "Redaction"
          ? "The value is replaced by a mark with time, reason and actor. It cannot be used as current evidence or export. This is not Trash."
          : "This adds a new event. The original report is not edited or deleted."}
      </p>
      {needsResult ? (
        <div className="grid gap-2">
          <label htmlFor="test-review-event-result">Corrected result</label>
          <select
            className="h-9 rounded-md border border-border bg-background px-2"
            disabled={pending}
            id="test-review-event-result"
            onChange={(event) =>
              setResult(
                event.target.value as (typeof TEST_REPORT_RESULTS)[number],
              )
            }
            value={result}
          >
            <option value="">Choose a result</option>
            {TEST_REPORT_RESULTS.map((value) => (
              <option key={value} value={value}>
                {TEST_REPORT_RESULT_LABELS[value]}
              </option>
            ))}
          </select>
        </div>
      ) : null}
      {kind === "Correction" ? (
        <div className="grid gap-2">
          <label htmlFor="test-review-event-note">
            {needsNote ? "Corrected summary" : "Note (optional)"}
          </label>
          <Textarea
            disabled={pending}
            id="test-review-event-note"
            onChange={(event) => setNote(event.target.value)}
            rows={2}
            value={note}
          />
        </div>
      ) : null}
      <div className="grid gap-2">
        <label htmlFor="test-review-event-reason">Reason (required)</label>
        <Textarea
          disabled={pending}
          id="test-review-event-reason"
          onChange={(event) => setReason(event.target.value)}
          rows={2}
          value={reason}
        />
      </div>
      <div className="flex gap-2">
        <Button
          disabled={pending || !ready}
          onClick={() =>
            onConfirm({
              correctedResult: result === "" ? null : result,
              eventId,
              kind,
              note,
              reason,
              sessionTestId,
            })
          }
          type="button"
        >
          {`Record ${kind === "Redaction" ? "redaction" : kind}`}
        </Button>
        <Button
          disabled={pending}
          onClick={onCancel}
          type="button"
          variant="outline"
        >
          Cancel
        </Button>
      </div>
    </section>
  );
}

function eventLine(entry: TestResultEvent, session: TestReviewSession) {
  const item = session.items.find(({ id }) => id === entry.sessionTestId);
  const target = item ? `Session Test ${item.title}` : "Test Session";
  const when = new Date(entry.recordedAt).toLocaleString();
  if (entry.kind === "Redaction") {
    return `${when}: Redaction of ${entry.redactedField?.toLowerCase()} on ${target}. Value replaced. Reason: ${entry.reason ?? "none"}. Actor: ${entry.actorAccountId}`;
  }
  if (entry.redacted) {
    return `${when}: ${entry.kind} on ${target}. Content redacted.`;
  }
  const result =
    entry.correctedResult === null
      ? ""
      : ` to ${resultLabel(entry.correctedResult)}`;
  const note = entry.note ? `. Note: ${entry.note}` : "";
  return `${when}: ${entry.kind}${result} on ${target}. Reason: ${entry.reason}${note}`;
}

function ResultChain({
  disabled,
  events,
  onRedact,
  session,
}: {
  disabled: boolean;
  events: TestResultEvent[];
  onRedact: (eventId: string) => void;
  session: TestReviewSession;
}) {
  if (events.length === 0) {
    return null;
  }
  return (
    <section aria-label="Correction history" className="space-y-1 text-sm">
      <h5 className="font-medium">Correction history</h5>
      <ul className="space-y-1">
        {events.map((entry) => (
          <li className="flex flex-wrap items-center gap-2" key={entry.id}>
            <span>{eventLine(entry, session)}</span>
            {entry.kind !== "Redaction" && !entry.redacted ? (
              <Button
                aria-label={`Redact content of ${entry.kind} ${new Date(entry.recordedAt).toLocaleString()}`}
                className="h-7 px-2 text-xs"
                disabled={disabled}
                onClick={() => onRedact(entry.id)}
                type="button"
                variant="outline"
              >
                Redact value
              </Button>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}

type Panel =
  | {
      eventId: string | null;
      kind: "event";
      mode: TestResultEventKind;
      sessionTestId: string | null;
    }
  | { kind: "close"; preview: TestReviewClosePreview }
  | { ids: string[]; kind: "bulk"; preview: TestReviewBulkPreview };

function SessionReview({
  actions,
  readOnly,
  resultEvents,
  session,
}: {
  actions: TestReviewActions;
  readOnly: boolean;
  resultEvents: TestResultEvent[];
  session: TestReviewSession;
}) {
  const [selected, setSelected] = useState<string[]>([]);
  const [panel, setPanel] = useState<Panel | null>(null);
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const [pending, setPending] = useState(false);
  const disabled = readOnly || pending;

  async function run(work: () => Promise<unknown>, done?: string) {
    setError(undefined);
    setNotice(undefined);
    setPending(true);
    try {
      await work();
      setPanel(null);
      setNotice(done ?? "Review saved.");
    } catch (caught) {
      setError(errorText(caught, "The review was not saved."));
    } finally {
      setPending(false);
    }
  }

  async function openPanel(load: () => Promise<Panel>) {
    setError(undefined);
    setNotice(undefined);
    setPending(true);
    try {
      setPanel(await load());
    } catch (caught) {
      setError(errorText(caught, "The preview is unavailable."));
    } finally {
      setPending(false);
    }
  }

  return (
    <li
      className="space-y-3 rounded-lg border border-border/70 p-4"
      id={`test-review-${session.id}`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <h4 className="font-medium">{sessionTitle(session)}</h4>
        <span className="rounded-full border border-border px-2 py-0.5 text-xs">
          {`Session review state: ${session.reviewState}`}
        </span>
        {session.newContextAfterClose ? (
          <span className="rounded-full border border-amber-600 px-2 py-0.5 text-xs">
            {TEST_REVIEW_NEW_CONTEXT_LABEL}
          </span>
        ) : null}
        {session.withdrawn ? (
          <span className="rounded-full border border-border px-2 py-0.5 text-xs">
            Withdrawal
          </span>
        ) : null}
      </div>
      {session.summaryRedacted ? (
        <p className="text-muted-foreground text-sm">
          The summary was redacted.
        </p>
      ) : null}
      <p className="text-muted-foreground text-sm">
        Session and Session Test states are separate. Changing one never changes
        the other.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        {(["Reviewed", "Follow-up needed"] as const).map((state) => (
          <Button
            aria-label={`Session review: ${state}`}
            aria-pressed={session.reviewState === state}
            className="h-8 px-3 text-xs"
            disabled={disabled}
            key={state}
            onClick={() => run(() => actions.setSession(session.id, state, ""))}
            type="button"
            variant={session.reviewState === state ? "default" : "outline"}
          >
            {state}
          </Button>
        ))}
        <Button
          aria-label="Session review: Closed"
          aria-pressed={session.reviewState === "Closed"}
          className="h-8 px-3 text-xs"
          disabled={disabled}
          onClick={() =>
            openPanel(async () => ({
              kind: "close",
              preview: await actions.previewClose(session.id),
            }))
          }
          type="button"
          variant={session.reviewState === "Closed" ? "default" : "outline"}
        >
          Closed
        </Button>
      </div>
      {session.items.length === 0 ? (
        <p className="text-muted-foreground text-sm">No Session Tests.</p>
      ) : (
        <ul aria-label="Session Tests" className="space-y-2 text-sm">
          {session.items.map((item) => (
            <ItemRow
              actions={actions}
              checked={selected.includes(item.id)}
              disabled={disabled}
              item={item}
              key={item.id}
              onEvent={(mode) =>
                setPanel({
                  eventId: null,
                  kind: "event",
                  mode,
                  sessionTestId: item.id,
                })
              }
              onToggle={() =>
                setSelected((current) =>
                  current.includes(item.id)
                    ? current.filter((id) => id !== item.id)
                    : [...current, item.id],
                )
              }
              run={(work) => {
                run(work);
              }}
              sessionId={session.id}
            />
          ))}
        </ul>
      )}
      <div className="flex flex-wrap gap-2">
        {(["Correction", "Withdrawal"] as const).map((mode) => (
          <Button
            aria-label={`${mode} for this Test Session`}
            className="h-8 px-3 text-xs"
            disabled={disabled || (mode === "Withdrawal" && session.withdrawn)}
            key={mode}
            onClick={() =>
              setPanel({
                eventId: null,
                kind: "event",
                mode,
                sessionTestId: null,
              })
            }
            type="button"
            variant="outline"
          >
            {mode}
          </Button>
        ))}
        <Button
          aria-label="Redact the summary of this Test Session"
          className="h-8 px-3 text-xs"
          disabled={disabled || session.summaryRedacted}
          onClick={() =>
            setPanel({
              eventId: null,
              kind: "event",
              mode: "Redaction",
              sessionTestId: null,
            })
          }
          type="button"
          variant="outline"
        >
          Redact value
        </Button>
      </div>
      <ResultChain
        disabled={disabled}
        events={resultEvents}
        onRedact={(eventId) =>
          setPanel({
            eventId,
            kind: "event",
            mode: "Redaction",
            sessionTestId: null,
          })
        }
        session={session}
      />
      <Button
        disabled={disabled}
        onClick={() =>
          openPanel(async () => ({
            ids: selected,
            kind: "bulk",
            preview: await actions.previewBulk(session.id, selected),
          }))
        }
        type="button"
        variant="outline"
      >
        {TEST_REVIEW_BULK_LABEL}
      </Button>
      {panel?.kind === "event" ? (
        <EventPanel
          eventId={panel.eventId}
          kind={panel.mode}
          onCancel={() => setPanel(null)}
          onConfirm={(draft) =>
            run(
              () => actions.recordEvent(session.id, draft),
              EVENT_COPY[panel.mode].done,
            )
          }
          pending={pending}
          sessionTestId={panel.sessionTestId}
          title={EVENT_COPY[panel.mode].title}
        />
      ) : null}
      {panel?.kind === "close" ? (
        <ClosePanel
          onCancel={() => setPanel(null)}
          onConfirm={(reason) =>
            run(
              () => actions.setSession(session.id, "Closed", reason),
              "Test Session closed.",
            )
          }
          pending={pending}
          preview={panel.preview}
        />
      ) : null}
      {panel?.kind === "bulk" ? (
        <BulkPanel
          onCancel={() => setPanel(null)}
          onConfirm={() =>
            run(
              () => actions.commitBulk(session.id, panel.ids, panel.preview),
              "Marked as reviewed.",
            )
          }
          pending={pending}
          preview={panel.preview}
        />
      ) : null}
      {error ? (
        <p className="text-destructive text-sm" role="alert">
          {error}
        </p>
      ) : null}
      {notice ? (
        <p className="text-sm" role="status">
          {notice}
        </p>
      ) : null}
    </li>
  );
}

function HistoryList({
  events,
  sessions,
}: {
  events: TestReviewEvent[];
  sessions: TestReviewSession[];
}) {
  if (events.length === 0) {
    return null;
  }
  const titles = new Map(sessions.map((session) => [session.id, session]));
  return (
    <section aria-labelledby="test-review-history" className="space-y-2">
      <h3 className="font-medium" id="test-review-history">
        Review history
      </h3>
      <ul className="space-y-1 text-sm">
        {events.map((entry) => {
          const session = titles.get(entry.sessionId);
          const item = session?.items.find(
            ({ id }) => id === entry.sessionTestId,
          );
          return (
            <li key={entry.id}>
              {`${new Date(entry.recordedAt).toLocaleString()}: ${
                item ? `Session Test ${item.title}` : "Test Session"
              }${session ? ` of ${sessionTitle(session)}` : ""} ${entry.fromState} to ${entry.toState}`}
              {entry.reason ? `. Reason: ${entry.reason}` : ""}
              {entry.remaining && entry.remaining.length > 0
                ? `. Left open: ${entry.remaining
                    .map((record) => `${record.title} (${record.state})`)
                    .join(", ")}`
                : ""}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/**
 * Test Review: the session and each Session Test carry their own review
 * state. Nothing here archives or trashes a single Session Test, gates a
 * release, or edits a reported result.
 */
export function TestReviewView({
  actions,
  events,
  readOnly,
  resultEvents,
  sessions,
}: {
  actions: TestReviewActions;
  events: TestReviewEvent[];
  readOnly: boolean;
  resultEvents: TestResultEvent[];
  sessions: TestReviewSession[];
}) {
  return (
    <section
      aria-labelledby="test-review-heading"
      className="space-y-4"
      id="test-review"
    >
      <h2 className="font-semibold text-lg" id="test-review-heading">
        Test Review
      </h2>
      <p className="text-muted-foreground text-sm">
        Review is your management decision on top of a reported result. It does
        not change the result, gate a release, or touch a Handoff.
      </p>
      {sessions.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          No Test Sessions to review.
        </p>
      ) : (
        <ul className="space-y-3">
          {sessions.map((session) => (
            <SessionReview
              actions={actions}
              key={session.id}
              readOnly={readOnly}
              resultEvents={resultEvents.filter(
                (entry) => entry.sessionId === session.id,
              )}
              session={session}
            />
          ))}
        </ul>
      )}
      <HistoryList events={events} sessions={sessions} />
    </section>
  );
}
