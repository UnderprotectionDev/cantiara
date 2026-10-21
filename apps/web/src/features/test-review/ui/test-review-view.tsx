// biome-ignore-all lint/performance/noJsxPropsBind: Handlers bind to the session and item being reviewed.
import {
  TEST_REVIEW_BULK_LABEL,
  TEST_REVIEW_SETTABLE_STATES,
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

function ItemRow({
  actions,
  checked,
  disabled,
  item,
  onToggle,
  sessionId,
  run,
}: {
  actions: TestReviewActions;
  checked: boolean;
  disabled: boolean;
  item: TestReviewItem;
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
        </span>
        <span className="rounded-full border border-border px-2 py-0.5 text-xs">
          {item.reviewState}
        </span>
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

type Panel =
  | { kind: "close"; preview: TestReviewClosePreview }
  | { ids: string[]; kind: "bulk"; preview: TestReviewBulkPreview };

function SessionReview({
  actions,
  readOnly,
  session,
}: {
  actions: TestReviewActions;
  readOnly: boolean;
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
      </div>
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
  sessions,
}: {
  actions: TestReviewActions;
  events: TestReviewEvent[];
  readOnly: boolean;
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
              session={session}
            />
          ))}
        </ul>
      )}
      <HistoryList events={events} sessions={sessions} />
    </section>
  );
}
