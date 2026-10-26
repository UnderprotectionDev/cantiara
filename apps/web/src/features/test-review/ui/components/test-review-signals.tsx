// biome-ignore-all lint/performance/noJsxPropsBind: Handlers bind to the result being related.

import type { AccountPreferences } from "@cantiara/api/account-preferences";
import type { TestReviewSession } from "@cantiara/api/test-review";
import {
  TEST_REVIEW_CONTEXT_CHANGED_LABEL,
  type TestReviewContextChangeReason,
} from "@cantiara/api/test-review-signals";
import { Button } from "@cantiara/ui/components/button";
import { useState } from "react";
import { errorText } from "../../lib/test-review-panel";
import { endLine } from "../../lib/test-review-signal-lines";
import type {
  TestReviewSignalActions,
  TestReviewSignalData,
} from "../../lib/test-review-signal-types";
import TestReviewFollowUpForm from "../forms/test-review-follow-up-form";
import TestReviewSupersedesForm from "../forms/test-review-supersedes-form";

export type {
  TestReviewSignalActions,
  TestReviewSignalData,
} from "../../lib/test-review-signal-types";

function reasonLine(reason: TestReviewContextChangeReason) {
  if (reason.kind === "Primary spec changed") {
    return `Primary spec ${reason.title} changed from revision ${reason.boundRevision} to ${reason.currentRevision}`;
  }
  return `Recorded ${reason.key} ${reason.recorded} differs from target ${reason.target}`;
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

/**
 * Superseding, conflict, `Context changed` and `Create follow-up work` of Test
 * Review. Nothing here picks a winner, marks a result stale, or creates a Test
 * Gap or Handoff.
 */
export function TestReviewSignals({
  actions,
  data,
  preferences,
  readOnly,
  sessions,
}: {
  actions: TestReviewSignalActions;
  data: TestReviewSignalData;
  preferences?: AccountPreferences;
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
      <TestReviewSupersedesForm
        disabled={readOnly}
        onSupersede={actions.supersede}
        preferences={preferences}
        sessions={sessions}
        supersessions={data.supersessions}
      />
      <TestReviewFollowUpForm
        actions={actions}
        disabled={readOnly}
        followUps={data.followUps}
        preferences={preferences}
        sessions={sessions}
      />
    </div>
  );
}
