// biome-ignore-all lint/performance/noJsxPropsBind: Handlers bind to the result being related.

import type {
  TestReviewList,
  TestReviewSession,
} from "@cantiara/api/test-review";
import {
  FOLLOW_UP_STARTING_STATUS,
  type FollowUpTargetInput,
  resultLabel,
  TEST_REVIEW_CONTEXT_CHANGED_LABEL,
  TEST_REVIEW_FOLLOW_UP_LABEL,
  TEST_REVIEW_SUPERSEDES_LABEL,
  type TestFollowUpPreview,
  type TestReviewContextChangeReason,
  type TestReviewResultEnd,
  WORK_FOLLOW_UP_TYPES,
} from "@cantiara/api/test-review-signals";
import { Button } from "@cantiara/ui/components/button";
import { Input } from "@cantiara/ui/components/input";
import {
  NativeSelect,
  NativeSelectOption,
} from "@cantiara/ui/components/native-select";
import { useState } from "react";
import { errorText, usePanelFocus } from "./test-review-panel";

export interface TestReviewSignalActions {
  bindResult: (
    scenarioId: string,
    scenarioVersion: number,
    sessionTestId: string,
  ) => Promise<unknown>;
  commitFollowUp: (
    sessionTestIds: string[],
    target: FollowUpTargetInput,
    preview: TestFollowUpPreview,
  ) => Promise<unknown>;
  previewFollowUp: (
    sessionTestIds: string[],
    target: FollowUpTargetInput,
  ) => Promise<TestFollowUpPreview>;
  supersede: (newerId: string, olderId: string) => Promise<unknown>;
}

export type TestReviewSignalData = Pick<
  TestReviewList,
  "bindings" | "conflicts" | "contextChanges" | "followUps" | "supersessions"
>;

function endLine(end: TestReviewResultEnd) {
  const reported = end.normalizedResult
    ? resultLabel(end.normalizedResult)
    : "Not reported";
  const raw = end.rawResult ? ` (${end.rawResult})` : "";
  const current =
    end.currentResult && end.currentResult !== end.normalizedResult
      ? `, current ${resultLabel(end.currentResult)}`
      : "";
  return `${end.title} by ${end.executorName}: ${reported}${raw}${current}`;
}

function reasonLine(reason: TestReviewContextChangeReason) {
  if (reason.kind === "Primary spec changed") {
    return `Primary spec ${reason.title} changed from revision ${reason.boundRevision} to ${reason.currentRevision}`;
  }
  return `Recorded ${reason.key} ${reason.recorded} differs from target ${reason.target}`;
}

function allItems(sessions: TestReviewSession[]) {
  return sessions.flatMap((session) =>
    session.items.map((item) => ({
      id: item.id,
      label: `${item.title} (${session.executorName}, ${new Date(session.reportedAt).toLocaleDateString()})`,
    })),
  );
}

function SupersedesPanel({
  disabled,
  onSupersede,
  sessions,
  supersessions,
}: {
  disabled: boolean;
  onSupersede: (newerId: string, olderId: string) => Promise<unknown>;
  sessions: TestReviewSession[];
  supersessions: TestReviewSignalData["supersessions"];
}) {
  const items = allItems(sessions);
  const [newer, setNewer] = useState("");
  const [older, setOlder] = useState("");
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const [pending, setPending] = useState(false);
  const byId = new Map(
    sessions.flatMap((session) =>
      session.items.map((item) => [item.id, { item, session }] as const),
    ),
  );
  const newerRecord = byId.get(newer);
  const olderRecord = byId.get(older);

  async function submit() {
    setError(undefined);
    setNotice(undefined);
    setPending(true);
    try {
      await onSupersede(newer, older);
      setNotice("Supersedes saved. Both historical results are kept.");
      setNewer("");
      setOlder("");
    } catch (caught) {
      setError(errorText(caught, "Supersedes was not saved."));
    } finally {
      setPending(false);
    }
  }

  return (
    <section
      aria-labelledby="test-review-supersedes-heading"
      className="space-y-3"
    >
      <h3 className="font-medium" id="test-review-supersedes-heading">
        {TEST_REVIEW_SUPERSEDES_LABEL}
      </h3>
      <p className="text-muted-foreground text-sm">
        A newer Session Test supersedes an older one of the same type. The
        relation is directed and acyclic; neither result is changed or deleted.
      </p>
      {items.length < 2 ? (
        <p className="text-muted-foreground text-sm">
          Two Session Tests are needed to relate them.
        </p>
      ) : (
        <div className="grid gap-2 text-sm">
          <label htmlFor="test-review-supersedes-newer">Newer result</label>
          <NativeSelect
            disabled={disabled || pending}
            id="test-review-supersedes-newer"
            onChange={(event) => setNewer(event.target.value)}
            value={newer}
          >
            <NativeSelectOption value="">Choose a result</NativeSelectOption>
            {items.map((item) => (
              <NativeSelectOption key={item.id} value={item.id}>
                {item.label}
              </NativeSelectOption>
            ))}
          </NativeSelect>
          <label htmlFor="test-review-supersedes-older">
            Older result it supersedes
          </label>
          <NativeSelect
            disabled={disabled || pending}
            id="test-review-supersedes-older"
            onChange={(event) => setOlder(event.target.value)}
            value={older}
          >
            <NativeSelectOption value="">Choose a result</NativeSelectOption>
            {items.map((item) => (
              <NativeSelectOption key={item.id} value={item.id}>
                {item.label}
              </NativeSelectOption>
            ))}
          </NativeSelect>
          {newerRecord && olderRecord ? (
            <p aria-live="polite">
              {`${newerRecord.item.title} (${newerRecord.item.normalizedResult ?? "Not reported"}) will supersede ${olderRecord.item.title} (${olderRecord.item.normalizedResult ?? "Not reported"}). Both stay in history.`}
            </p>
          ) : null}
          <div>
            <Button
              disabled={
                disabled || pending || !newer || !older || newer === older
              }
              onClick={submit}
              type="button"
            >
              {TEST_REVIEW_SUPERSEDES_LABEL}
            </Button>
          </div>
          {error ? <p role="alert">{error}</p> : null}
          {notice ? <p role="status">{notice}</p> : null}
        </div>
      )}
      {supersessions.length > 0 ? (
        <ul aria-label="Supersedes chain" className="space-y-2 text-sm">
          {supersessions.map((entry) => (
            <li
              className="rounded-md border border-border/60 p-3"
              key={entry.id}
            >
              <p>{`Supersedes: ${endLine(entry.newer)}`}</p>
              <p>{`Superseded: ${endLine(entry.older)}`}</p>
              {entry.difference.length > 0 ? (
                <ul aria-label="Technical context difference">
                  {entry.difference.map((difference) => (
                    <li key={difference.key}>
                      {`${difference.key}: ${difference.newer ?? "unknown"} (newer) vs ${difference.older ?? "unknown"} (older)`}
                    </li>
                  ))}
                </ul>
              ) : (
                <p>No recorded technical context difference.</p>
              )}
              {entry.reason ? <p>{`Reason: ${entry.reason}`}</p> : null}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

function ConflictPanel({
  conflicts,
  disabled,
  onBind,
}: {
  conflicts: TestReviewSignalData["conflicts"];
  disabled: boolean;
  onBind: TestReviewSignalActions["bindResult"];
}) {
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);
  if (conflicts.length === 0) {
    return null;
  }
  async function bind(
    scenarioId: string,
    scenarioVersion: number,
    sessionTestId: string,
  ) {
    setError(undefined);
    setPending(true);
    try {
      await onBind(scenarioId, scenarioVersion, sessionTestId);
    } catch (caught) {
      setError(errorText(caught, "The result was not bound."));
    } finally {
      setPending(false);
    }
  }
  return (
    <section
      aria-labelledby="test-review-conflict-heading"
      className="space-y-2"
    >
      <h3 className="font-medium" id="test-review-conflict-heading">
        Conflicting results
      </h3>
      <p className="text-muted-foreground text-sm">
        The same exact scenario version has differing results and no Supersedes
        relation. The product picks no winner: bind the valid result to close
        the signal.
      </p>
      <ul aria-label="test-result-conflict" className="space-y-2 text-sm">
        {conflicts.map((conflict) => (
          <li
            className="space-y-2 rounded-md border border-amber-600 p-3"
            key={conflict.signalId}
          >
            <p className="font-medium">
              {`test-result-conflict: scenario ${conflict.scenarioId} version ${conflict.scenarioVersion} (${conflict.presentation})`}
            </p>
            <ul>
              {conflict.members.map((member) => (
                <li
                  className="flex flex-wrap items-center gap-2"
                  key={member.sessionTestId}
                >
                  <span>{endLine(member)}</span>
                  <Button
                    aria-label={`Bind valid result: ${member.title} by ${member.executorName}`}
                    className="h-8 px-3 text-xs"
                    disabled={disabled || pending}
                    onClick={() =>
                      bind(
                        conflict.scenarioId,
                        conflict.scenarioVersion,
                        member.sessionTestId,
                      )
                    }
                    type="button"
                    variant="outline"
                  >
                    Bind valid result
                  </Button>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
      {error ? <p role="alert">{error}</p> : null}
    </section>
  );
}

function ContextPanel({
  changes,
}: {
  changes: TestReviewSignalData["contextChanges"];
}) {
  if (changes.length === 0) {
    return null;
  }
  return (
    <section
      aria-labelledby="test-review-context-heading"
      className="space-y-2"
    >
      <h3 className="font-medium" id="test-review-context-heading">
        {TEST_REVIEW_CONTEXT_CHANGED_LABEL}
      </h3>
      <p className="text-muted-foreground text-sm">
        A bound Primary spec revision or a recorded branch, commit or build
        changed. The old result is not marked failed or stale, and no Test Gap
        or Handoff is created.
      </p>
      <ul aria-label={TEST_REVIEW_CONTEXT_CHANGED_LABEL} className="text-sm">
        {changes.map((change) => (
          <li
            className="rounded-md border border-border/60 p-3"
            key={change.sessionTestId}
          >
            <p className="font-medium">{`${TEST_REVIEW_CONTEXT_CHANGED_LABEL}: ${change.title}`}</p>
            <ul className="list-disc pl-5">
              {change.reasons.map((reason) => (
                <li key={reasonLine(reason)}>{reasonLine(reason)}</li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </section>
  );
}

function FollowUpPanel({
  actions,
  disabled,
  followUps,
  sessions,
}: {
  actions: TestReviewSignalActions;
  disabled: boolean;
  followUps: TestReviewSignalData["followUps"];
  sessions: TestReviewSession[];
}) {
  const items = allItems(sessions);
  const [selected, setSelected] = useState<string[]>([]);
  const [mode, setMode] = useState<"existing" | "new">("new");
  const [title, setTitle] = useState("");
  const [workType, setWorkType] =
    useState<(typeof WORK_FOLLOW_UP_TYPES)[number]>("Task");
  const [workId, setWorkId] = useState("");
  const [preview, setPreview] = useState<TestFollowUpPreview | null>(null);
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const [pending, setPending] = useState(false);
  const headingRef = usePanelFocus(preview !== null);

  function target(): FollowUpTargetInput {
    return mode === "new"
      ? {
          mode: "new",
          ...(title.trim() ? { title: title.trim() } : {}),
          workType,
        }
      : { mode: "existing", workId: workId.trim() };
  }

  async function run(work: () => Promise<void>, fallback: string) {
    setError(undefined);
    setNotice(undefined);
    setPending(true);
    try {
      await work();
    } catch (caught) {
      setError(errorText(caught, fallback));
    } finally {
      setPending(false);
    }
  }

  const needsOne = mode === "new" && selected.length !== 1;
  const missingWork = mode === "existing" && !workId.trim();

  return (
    <section
      aria-labelledby="test-review-follow-up-heading"
      className="space-y-3"
    >
      <h3 className="font-medium" id="test-review-follow-up-heading">
        {TEST_REVIEW_FOLLOW_UP_LABEL}
      </h3>
      <p className="text-muted-foreground text-sm">
        A Failed, Blocked or Inconclusive result creates no Bug, İş, Risk, Open
        Question, Decision, notification or priority by itself. Choose results,
        preview the target and origin, then confirm.
      </p>
      {items.length === 0 ? (
        <p className="text-muted-foreground text-sm">No Session Tests yet.</p>
      ) : (
        <fieldset className="m-0 min-w-0 space-y-1 border-0 p-0 text-sm">
          <legend className="font-medium">Results for follow-up</legend>
          {items.map((item) => (
            <label className="flex items-center gap-2" key={item.id}>
              <input
                checked={selected.includes(item.id)}
                disabled={disabled || pending}
                onChange={() => {
                  setPreview(null);
                  setSelected((current) =>
                    current.includes(item.id)
                      ? current.filter((id) => id !== item.id)
                      : [...current, item.id],
                  );
                }}
                type="checkbox"
              />
              {item.label}
            </label>
          ))}
        </fieldset>
      )}
      <fieldset className="m-0 min-w-0 space-y-2 border-0 p-0 text-sm">
        <legend className="font-medium">Target</legend>
        <label className="flex items-center gap-2">
          <input
            checked={mode === "new"}
            name="test-review-follow-up-mode"
            onChange={() => {
              setPreview(null);
              setMode("new");
            }}
            type="radio"
          />
          New İş from one result
        </label>
        <label className="flex items-center gap-2">
          <input
            checked={mode === "existing"}
            name="test-review-follow-up-mode"
            onChange={() => {
              setPreview(null);
              setMode("existing");
            }}
            type="radio"
          />
          Attach results to an existing İş
        </label>
        {mode === "new" ? (
          <div className="grid gap-2">
            <label htmlFor="test-review-follow-up-title">
              Title (optional)
            </label>
            <Input
              disabled={disabled || pending}
              id="test-review-follow-up-title"
              onChange={(event) => {
                setPreview(null);
                setTitle(event.target.value);
              }}
              value={title}
            />
            <label htmlFor="test-review-follow-up-type">Work type</label>
            <NativeSelect
              disabled={disabled || pending}
              id="test-review-follow-up-type"
              onChange={(event) => {
                setPreview(null);
                setWorkType(
                  event.target.value as (typeof WORK_FOLLOW_UP_TYPES)[number],
                );
              }}
              value={workType}
            >
              {WORK_FOLLOW_UP_TYPES.map((type) => (
                <NativeSelectOption key={type} value={type}>
                  {type}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>
        ) : (
          <div className="grid gap-2">
            <label htmlFor="test-review-follow-up-work">
              Existing İş id or key
            </label>
            <Input
              disabled={disabled || pending}
              id="test-review-follow-up-work"
              onChange={(event) => {
                setPreview(null);
                setWorkId(event.target.value);
              }}
              value={workId}
            />
          </div>
        )}
      </fieldset>
      <Button
        disabled={
          disabled ||
          pending ||
          selected.length === 0 ||
          needsOne ||
          missingWork
        }
        onClick={() =>
          run(async () => {
            setPreview(await actions.previewFollowUp(selected, target()));
          }, "The preview is unavailable.")
        }
        type="button"
        variant="outline"
      >
        {`Preview: ${TEST_REVIEW_FOLLOW_UP_LABEL}`}
      </Button>
      {preview ? (
        <section
          aria-labelledby="test-review-follow-up-preview-heading"
          className="space-y-2 rounded-md border border-border p-3 text-sm"
        >
          <h4
            className="font-medium outline-none"
            id="test-review-follow-up-preview-heading"
            ref={headingRef}
            tabIndex={-1}
          >
            {`Preview: ${TEST_REVIEW_FOLLOW_UP_LABEL}`}
          </h4>
          {preview.plan.target.mode === "new" ? (
            <ul aria-label="Follow-up work preview" className="list-disc pl-5">
              <li>{`Target: new ${preview.plan.target.work.type} in Project ${preview.plan.target.project.name}`}</li>
              <li>{`Title: ${preview.plan.target.work.title}`}</li>
              <li>{`Starting status: ${preview.plan.target.work.startingStatus}`}</li>
              <li>{`Originates from: Test Session ${preview.plan.originatesFrom?.label ?? ""}`}</li>
              <li>{`Origin Location: Session Test ${preview.plan.originLocation?.title ?? ""} (immutable)`}</li>
            </ul>
          ) : (
            <ul aria-label="Follow-up work preview" className="list-disc pl-5">
              <li>{`Target: existing ${preview.plan.target.work.key} ${preview.plan.target.work.title} (${preview.plan.target.work.status})`}</li>
              <li>The İş keeps its own Origin; only the results are linked.</li>
            </ul>
          )}
          <ul aria-label="Results to link" className="list-disc pl-5">
            {preview.plan.results.map((result) => (
              <li key={result.sessionTestId}>
                {`${result.title}: ${result.normalizedResult ? resultLabel(result.normalizedResult) : "Not reported"}`}
              </li>
            ))}
          </ul>
          <p className="text-muted-foreground">
            {`Nothing else is created (${FOLLOW_UP_STARTING_STATUS} status, no Bug, Risk, Test Gap, notification or priority). Closing the İş never changes these results; verifying a fix needs a new Test Session and, if you choose, Supersedes.`}
          </p>
          <div className="flex gap-2">
            <Button
              disabled={disabled || pending}
              onClick={() =>
                run(async () => {
                  await actions.commitFollowUp(selected, target(), preview);
                  setPreview(null);
                  setSelected([]);
                  setNotice("Follow-up work saved.");
                }, "The follow-up work was not saved.")
              }
              type="button"
            >
              {TEST_REVIEW_FOLLOW_UP_LABEL}
            </Button>
            <Button
              disabled={pending}
              onClick={() => setPreview(null)}
              type="button"
              variant="outline"
            >
              Cancel
            </Button>
          </div>
        </section>
      ) : null}
      {error ? <p role="alert">{error}</p> : null}
      {notice ? <p role="status">{notice}</p> : null}
      {followUps.length > 0 ? (
        <ul aria-label="Follow-up links" className="text-sm">
          {followUps.map((link) => {
            const item = sessions
              .flatMap((session) => session.items)
              .find(({ id }) => id === link.sessionTestId);
            return (
              <li key={link.id}>
                {`${item?.title ?? link.sessionTestId}: ${link.mode} ${link.workKey ?? "unavailable İş"}${link.workTitle ? ` ${link.workTitle}` : ""}${link.workStatus ? ` (${link.workStatus})` : ""}`}
              </li>
            );
          })}
        </ul>
      ) : null}
    </section>
  );
}

/**
 * Superseding, conflict, `Context changed` and `Create follow-up work` of Test
 * Review. Nothing here picks a winner, marks a result stale, or creates a Test
 * Gap or Handoff.
 */
export function TestReviewSignals({
  actions,
  data,
  readOnly,
  sessions,
}: {
  actions: TestReviewSignalActions;
  data: TestReviewSignalData;
  readOnly: boolean;
  sessions: TestReviewSession[];
}) {
  return (
    <div className="space-y-6">
      <ConflictPanel
        conflicts={data.conflicts}
        disabled={readOnly}
        onBind={actions.bindResult}
      />
      <ContextPanel changes={data.contextChanges} />
      <SupersedesPanel
        disabled={readOnly}
        onSupersede={actions.supersede}
        sessions={sessions}
        supersessions={data.supersessions}
      />
      <FollowUpPanel
        actions={actions}
        disabled={readOnly}
        followUps={data.followUps}
        sessions={sessions}
      />
    </div>
  );
}
