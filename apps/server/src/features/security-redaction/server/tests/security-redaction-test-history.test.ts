import {
  type TestResultStoredEvent,
  type TestReviewStoredSession,
  viewSession,
} from "@cantiara/api/test-review";
import {
  resultEnd,
  type SignalSession,
} from "@cantiara/api/test-review-signals";
import { describe, expect, test } from "vitest";

/**
 * Test history counter-case (spec 78 #506, owner spec 57 #414): a Security
 * Redaction mark makes evidence unusable for the current Test assessment and
 * export helpers, while a Correction is not a redaction and keeps the
 * original report in history.
 */

const SECRET = "ghp_SuperSecretToken123";

const stored: TestReviewStoredSession = {
  context: null,
  executorName: "Agent",
  id: "s1",
  items: [
    {
      boundSpecs: [],
      id: "t1",
      normalizedResult: "failed",
      position: 1,
      rawResult: `FAIL token ${SECRET}`,
      reviewState: "Unreviewed",
      scenarioId: null,
      scenarioVersion: null,
      title: "Login works",
    },
  ],
  projectId: "project-1",
  reportedAt: "2026-10-01T09:00:00.000Z",
  reviewState: "Unreviewed",
  summary: "Run 1",
  targetContext: null,
};

function event(
  fields: Partial<TestResultStoredEvent> &
    Pick<TestResultStoredEvent, "id" | "kind">,
): TestResultStoredEvent {
  return {
    actorAccountId: "account-1",
    correctedResult: null,
    note: null,
    previousEventId: null,
    reason: "reason",
    recordedAt: "2026-10-02T09:00:00.000Z",
    redactedEventId: null,
    redactedField: null,
    sessionId: "s1",
    sessionTestId: "t1",
    ...fields,
  };
}

function assessmentHelperInput(viewed: ReturnType<typeof viewSession>) {
  const session: SignalSession = {
    context: viewed.context,
    executorName: viewed.executorName,
    id: viewed.id,
    items: viewed.items,
    reportedAt: viewed.reportedAt,
    targetContext: viewed.targetContext,
  };
  const [item] = session.items;
  if (!item) {
    throw new Error("No item");
  }
  return resultEnd(session, item);
}

describe("Security Redaction test history counter-case", () => {
  test("a redacted reported result is not usable by the evaluation helper", () => {
    const viewed = viewSession(
      stored,
      [],
      [
        event({
          id: "r1",
          kind: "Redaction",
          redactedField: "Reported result",
        }),
      ],
    );
    const [item] = viewed.items;

    expect(item?.rawResultRedacted).toBe(true);
    expect(item?.rawResult).toBeNull();
    expect(item?.current.usable).toBe(false);
    expect(assessmentHelperInput(viewed).currentResult).toBeNull();
    expect(JSON.stringify(viewed)).not.toContain(SECRET);
  });

  test("a redacted Correction is not usable", () => {
    const viewed = viewSession(
      stored,
      [],
      [
        event({
          correctedResult: "passed",
          id: "c1",
          kind: "Correction",
          note: "fixed",
        }),
        event({
          id: "r1",
          kind: "Redaction",
          redactedEventId: "c1",
          redactedField: "Event content",
          sessionTestId: null,
        }),
      ],
    );

    expect(viewed.items[0]?.current).toMatchObject({
      result: null,
      source: "Correction",
      usable: false,
    });
    expect(assessmentHelperInput(viewed).currentResult).toBeNull();
  });

  test("a Correction is not a redaction: the corrected result is usable and the original stays", () => {
    const viewed = viewSession(
      stored,
      [],
      [
        event({
          correctedResult: "passed",
          id: "c1",
          kind: "Correction",
          reason: "Ran against the wrong build.",
        }),
      ],
    );
    const [item] = viewed.items;

    expect(item?.current).toMatchObject({
      result: "passed",
      source: "Correction",
      usable: true,
    });
    expect(assessmentHelperInput(viewed).currentResult).toBe("passed");
    expect(item?.rawResultRedacted).toBe(false);
    expect(item?.rawResult).toBe(`FAIL token ${SECRET}`);
  });
});
