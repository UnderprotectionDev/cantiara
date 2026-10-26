// biome-ignore-all lint/performance/noAwaitInLoops: Each scope is read after the previous one.
import {
  TEST_REVIEW_SETTABLE_STATES,
  TEST_REVIEW_STATES,
  type TestReviewState,
} from "@cantiara/api/test-review";
import type { TestSummary } from "@cantiara/api/test-review-summary";
import { describe, expect, test } from "vitest";
import { TestReviewSummaryScopeNotFoundError } from "../test-review";
import {
  accountId,
  archivedProjectId,
  createMemoryHarness,
  emptySummaryFacts,
  fixtureSession,
  projectId,
  summaryFactsKey,
} from "./test-review-memory-store";

function setup() {
  return createMemoryHarness([
    fixtureSession("s1", [
      { id: "t1", title: "Login works" },
      { id: "t2", normalized: "Failed", raw: "FAIL", title: "Logout works" },
      { id: "t3", title: "Reset works" },
    ]),
    fixtureSession("s2", [{ id: "u1", title: "Other session item" }]),
  ]);
}

function stateOf(
  harness: ReturnType<typeof setup>,
  sessionId: string,
  itemId?: string,
): TestReviewState | undefined {
  const session = harness.sessions.get(sessionId);
  return itemId
    ? session?.items.find((item) => item.id === itemId)?.reviewState
    : session?.reviewState;
}

const settable = TEST_REVIEW_SETTABLE_STATES;

describe("Test Review: independent session and item state", () => {
  test("a new session and every item start Unreviewed", async () => {
    const harness = setup();
    const { sessions } = await harness.testReview.list(accountId, projectId);
    expect(sessions).toHaveLength(2);
    for (const session of sessions) {
      expect(session.reviewState).toBe("Unreviewed");
      for (const item of session.items) {
        expect(item.reviewState).toBe("Unreviewed");
      }
    }
    expect(TEST_REVIEW_STATES).toEqual([
      "Unreviewed",
      "Reviewed",
      "Follow-up needed",
      "Closed",
    ]);
  });

  test.each(settable)(
    "session %s leaves every item as it was",
    async (next) => {
      const harness = setup();
      await harness.testReview.setItemReviewState(accountId, {
        projectId,
        sessionId: "s1",
        sessionTestId: "t2",
        state: "Follow-up needed",
      });
      await harness.testReview.setSessionReviewState(accountId, {
        projectId,
        sessionId: "s1",
        state: next,
      });
      expect(stateOf(harness, "s1")).toBe(next);
      expect(stateOf(harness, "s1", "t1")).toBe("Unreviewed");
      expect(stateOf(harness, "s1", "t2")).toBe("Follow-up needed");
      expect(stateOf(harness, "s1", "t3")).toBe("Unreviewed");
    },
  );

  test.each(settable)(
    "item %s leaves its session and siblings",
    async (next) => {
      const harness = setup();
      await harness.testReview.setItemReviewState(accountId, {
        projectId,
        sessionId: "s1",
        sessionTestId: "t1",
        state: next,
      });
      expect(stateOf(harness, "s1", "t1")).toBe(next);
      expect(stateOf(harness, "s1")).toBe("Unreviewed");
      expect(stateOf(harness, "s1", "t2")).toBe("Unreviewed");
      expect(stateOf(harness, "s2")).toBe("Unreviewed");
    },
  );

  test("closing the only item does not close the session, closing the session does not close items", async () => {
    const harness = setup();
    await harness.testReview.setItemReviewState(accountId, {
      projectId,
      sessionId: "s2",
      sessionTestId: "u1",
      state: "Closed",
    });
    expect(stateOf(harness, "s2")).toBe("Unreviewed");
    await harness.testReview.setSessionReviewState(accountId, {
      projectId,
      sessionId: "s1",
      state: "Closed",
    });
    expect(stateOf(harness, "s1", "t1")).toBe("Unreviewed");
  });

  test("an item moves independently of the session in the other direction too", async () => {
    const harness = setup();
    await harness.testReview.setSessionReviewState(accountId, {
      projectId,
      sessionId: "s1",
      state: "Reviewed",
    });
    await harness.testReview.setItemReviewState(accountId, {
      projectId,
      sessionId: "s1",
      sessionTestId: "t1",
      state: "Follow-up needed",
    });
    expect(stateOf(harness, "s1")).toBe("Reviewed");
  });

  test("a review never rewrites the reported raw or normalized result", async () => {
    const harness = setup();
    const before = structuredClone(
      (await harness.testReview.list(accountId, projectId)).sessions.map(
        (session) =>
          session.items.map(({ id, normalizedResult, rawResult, title }) => ({
            id,
            normalizedResult,
            rawResult,
            title,
          })),
      ),
    );
    await harness.testReview.setItemReviewState(accountId, {
      projectId,
      sessionId: "s1",
      sessionTestId: "t2",
      state: "Reviewed",
    });
    await harness.testReview.setSessionReviewState(accountId, {
      projectId,
      sessionId: "s1",
      state: "Closed",
    });
    const preview = await harness.testReview.previewBulkReview(accountId, {
      projectId,
      sessionId: "s2",
      sessionTestIds: ["u1"],
    });
    await harness.testReview.commitBulkReview(accountId, {
      previewFingerprint: preview.fingerprint,
      projectId,
      sessionId: "s2",
      sessionTestIds: ["u1"],
    });
    const after = (
      await harness.testReview.list(accountId, projectId)
    ).sessions.map((session) =>
      session.items.map(({ id, normalizedResult, rawResult, title }) => ({
        id,
        normalizedResult,
        rawResult,
        title,
      })),
    );
    expect(after).toEqual(before);
    expect(new Set(harness.writes)).toEqual(
      new Set(["session-state", "item-state", "event"]),
    );
  });

  test("a repeat of the same state writes nothing", async () => {
    const harness = setup();
    const input = {
      projectId,
      sessionId: "s1",
      state: "Reviewed" as const,
    };
    await expect(
      harness.testReview.setSessionReviewState(accountId, input),
    ).resolves.toMatchObject({ outcome: "applied" });
    const writesAfterFirst = harness.writes.length;
    await expect(
      harness.testReview.setSessionReviewState(accountId, input),
    ).resolves.toMatchObject({ outcome: "unchanged" });
    expect(harness.writes).toHaveLength(writesAfterFirst);
    expect(harness.events).toHaveLength(1);
  });

  test("an item of another session is not found and nothing is written", async () => {
    const harness = setup();
    await expect(
      harness.testReview.setItemReviewState(accountId, {
        projectId,
        sessionId: "s1",
        sessionTestId: "u1",
        state: "Reviewed",
      }),
    ).rejects.toMatchObject({ code: "TEST_REVIEW_RECORD_NOT_FOUND" });
    expect(harness.writes).toHaveLength(0);
  });

  test("Unreviewed is a start state, not a command", async () => {
    const harness = setup();
    await expect(
      harness.testReview.setSessionReviewState(accountId, {
        projectId,
        sessionId: "s1",
        state: "Unreviewed",
      } as never),
    ).rejects.toThrow();
  });

  test("unknown project, other account and archived project are refused", async () => {
    const harness = setup();
    await expect(
      harness.testReview.list(accountId, "nope"),
    ).rejects.toMatchObject({ code: "TEST_REVIEW_PROJECT_NOT_FOUND" });
    await expect(
      harness.testReview.list("someone-else", projectId),
    ).rejects.toMatchObject({ code: "TEST_REVIEW_PROJECT_NOT_FOUND" });
    await expect(
      harness.testReview.setSessionReviewState(accountId, {
        projectId: archivedProjectId,
        sessionId: "s1",
        state: "Reviewed",
      }),
    ).rejects.toMatchObject({ code: "TEST_REVIEW_PROJECT_READ_ONLY" });
  });
});

describe("Test Review: bulk Mark session and selected results as reviewed", () => {
  test("the preview names the exact records and writes nothing", async () => {
    const harness = setup();
    const preview = await harness.testReview.previewBulkReview(accountId, {
      projectId,
      sessionId: "s1",
      sessionTestIds: ["t1", "t2"],
    });
    expect(preview.changes).toEqual([
      {
        from: "Unreviewed",
        id: "s1",
        kind: "Test Session",
        label: expect.any(String),
      },
      {
        from: "Unreviewed",
        id: "t1",
        kind: "Session Test",
        label: "Login works",
      },
      {
        from: "Unreviewed",
        id: "t2",
        kind: "Session Test",
        label: "Logout works",
      },
    ]);
    expect(harness.writes).toHaveLength(0);
    expect(stateOf(harness, "s1")).toBe("Unreviewed");
  });

  test("the commit marks only the previewed session and selected items", async () => {
    const harness = setup();
    const selection = { sessionTestIds: ["t1", "t2"] };
    const preview = await harness.testReview.previewBulkReview(accountId, {
      projectId,
      sessionId: "s1",
      ...selection,
    });
    const receipt = await harness.testReview.commitBulkReview(accountId, {
      previewFingerprint: preview.fingerprint,
      projectId,
      sessionId: "s1",
      ...selection,
    });
    expect(receipt.outcome).toBe("applied");
    expect(receipt.changed).toHaveLength(3);
    expect(stateOf(harness, "s1")).toBe("Reviewed");
    expect(stateOf(harness, "s1", "t1")).toBe("Reviewed");
    expect(stateOf(harness, "s1", "t2")).toBe("Reviewed");
    expect(stateOf(harness, "s1", "t3")).toBe("Unreviewed");
    expect(stateOf(harness, "s2")).toBe("Unreviewed");
  });

  test("one mutation leaves one batch of history entries", async () => {
    const harness = setup();
    const selection = { sessionTestIds: ["t1"] };
    const preview = await harness.testReview.previewBulkReview(accountId, {
      projectId,
      sessionId: "s1",
      ...selection,
    });
    await harness.testReview.commitBulkReview(accountId, {
      previewFingerprint: preview.fingerprint,
      projectId,
      sessionId: "s1",
      ...selection,
    });
    expect(harness.events).toHaveLength(2);
    expect(new Set(harness.events.map((event) => event.batchId)).size).toBe(1);
    expect(
      harness.events.every((event) => event.action === "Bulk review"),
    ).toBe(true);
    expect(harness.events.map((event) => event.actorAccountId)).toEqual([
      accountId,
      accountId,
    ]);
  });

  test("a commit without a matching preview writes nothing", async () => {
    const harness = setup();
    await expect(
      harness.testReview.commitBulkReview(accountId, {
        previewFingerprint: "0".repeat(64),
        projectId,
        sessionId: "s1",
        sessionTestIds: ["t1"],
      }),
    ).rejects.toMatchObject({ code: "TEST_REVIEW_PREVIEW_STALE" });
    expect(harness.writes).toHaveLength(0);
    expect(stateOf(harness, "s1", "t1")).toBe("Unreviewed");
  });

  test("a state that moved since the preview makes the commit stale", async () => {
    const harness = setup();
    const selection = { sessionTestIds: ["t1"] };
    const preview = await harness.testReview.previewBulkReview(accountId, {
      projectId,
      sessionId: "s1",
      ...selection,
    });
    await harness.testReview.setItemReviewState(accountId, {
      projectId,
      sessionId: "s1",
      sessionTestId: "t1",
      state: "Follow-up needed",
    });
    const writes = harness.writes.length;
    await expect(
      harness.testReview.commitBulkReview(accountId, {
        previewFingerprint: preview.fingerprint,
        projectId,
        sessionId: "s1",
        ...selection,
      }),
    ).rejects.toMatchObject({ code: "TEST_REVIEW_PREVIEW_STALE" });
    expect(harness.writes).toHaveLength(writes);
    expect(stateOf(harness, "s1", "t1")).toBe("Follow-up needed");
  });

  test("a repeated commit is idempotent: no second write, no second history entry", async () => {
    const harness = setup();
    const selection = { sessionTestIds: ["t1", "t3"] };
    const preview = await harness.testReview.previewBulkReview(accountId, {
      projectId,
      sessionId: "s1",
      ...selection,
    });
    const input = {
      previewFingerprint: preview.fingerprint,
      projectId,
      sessionId: "s1",
      ...selection,
    };
    await harness.testReview.commitBulkReview(accountId, input);
    const writes = harness.writes.length;
    const events = harness.events.length;
    const again = await harness.testReview.commitBulkReview(accountId, input);
    expect(again).toEqual({ changed: [], outcome: "unchanged" });
    expect(harness.writes).toHaveLength(writes);
    expect(harness.events).toHaveLength(events);
  });

  test("a store failure after the item write rolls the whole mutation back", async () => {
    const harness = setup();
    const selection = { sessionTestIds: ["t1"] };
    const preview = await harness.testReview.previewBulkReview(accountId, {
      projectId,
      sessionId: "s1",
      ...selection,
    });
    harness.faults.failAfterItemWrite = true;
    await expect(
      harness.testReview.commitBulkReview(accountId, {
        previewFingerprint: preview.fingerprint,
        projectId,
        sessionId: "s1",
        ...selection,
      }),
    ).rejects.toThrow("Store failed");
    expect(stateOf(harness, "s1")).toBe("Unreviewed");
    expect(stateOf(harness, "s1", "t1")).toBe("Unreviewed");
    expect(harness.events).toHaveLength(0);
  });

  test("a Closed or Follow-up needed record is previewed with its own from state", async () => {
    const harness = setup();
    await harness.testReview.setItemReviewState(accountId, {
      projectId,
      sessionId: "s1",
      sessionTestId: "t1",
      state: "Follow-up needed",
    });
    const preview = await harness.testReview.previewBulkReview(accountId, {
      projectId,
      sessionId: "s1",
      sessionTestIds: ["t1"],
    });
    expect(preview.changes.find((change) => change.id === "t1")?.from).toBe(
      "Follow-up needed",
    );
  });

  test("an item outside the session cannot be selected", async () => {
    const harness = setup();
    await expect(
      harness.testReview.previewBulkReview(accountId, {
        projectId,
        sessionId: "s1",
        sessionTestIds: ["u1"],
      }),
    ).rejects.toMatchObject({ code: "TEST_REVIEW_RECORD_NOT_FOUND" });
  });
});

describe("Test Review: closing is never a gate", () => {
  test("the close preview lists the exact remaining records", async () => {
    const harness = setup();
    await harness.testReview.setItemReviewState(accountId, {
      projectId,
      sessionId: "s1",
      sessionTestId: "t1",
      state: "Reviewed",
    });
    await harness.testReview.setItemReviewState(accountId, {
      projectId,
      sessionId: "s1",
      sessionTestId: "t2",
      state: "Follow-up needed",
    });
    const preview = await harness.testReview.previewSessionClose(accountId, {
      projectId,
      sessionId: "s1",
    });
    expect(preview.remaining).toEqual([
      { id: "t2", state: "Follow-up needed", title: "Logout works" },
      { id: "t3", state: "Unreviewed", title: "Reset works" },
    ]);
  });

  test("a session closes with remaining open items; records and reason are kept", async () => {
    const harness = setup();
    const receipt = await harness.testReview.setSessionReviewState(accountId, {
      projectId,
      reason: "Rest is covered by the next session.",
      sessionId: "s1",
      state: "Closed",
    });
    expect(receipt.outcome).toBe("applied");
    expect(receipt.remaining.map((record) => record.id)).toEqual([
      "t1",
      "t2",
      "t3",
    ]);
    expect(stateOf(harness, "s1")).toBe("Closed");
    const [event] = harness.events;
    expect(event).toMatchObject({
      action: "Review state set",
      fromState: "Unreviewed",
      reason: "Rest is covered by the next session.",
      sessionId: "s1",
      sessionTestId: null,
      toState: "Closed",
    });
    expect(event?.remaining?.map((record) => record.id)).toEqual([
      "t1",
      "t2",
      "t3",
    ]);
    // The items stay exactly as they were.
    expect(stateOf(harness, "s1", "t1")).toBe("Unreviewed");
  });

  test("closing without a reason is allowed", async () => {
    const harness = setup();
    await expect(
      harness.testReview.setSessionReviewState(accountId, {
        projectId,
        sessionId: "s1",
        state: "Closed",
      }),
    ).resolves.toMatchObject({ outcome: "applied" });
    expect(harness.events[0]?.reason).toBeNull();
  });

  test("later history entries are appended, never edited", async () => {
    const harness = setup();
    await harness.testReview.setSessionReviewState(accountId, {
      projectId,
      sessionId: "s1",
      state: "Closed",
    });
    const first = structuredClone(harness.events[0]);
    await harness.testReview.setSessionReviewState(accountId, {
      projectId,
      sessionId: "s1",
      state: "Reviewed",
    });
    expect(harness.events).toHaveLength(2);
    expect(harness.events[0]).toEqual(first);
  });
});

describe("Test Review: what review never does", () => {
  test("the seam has no archive, trash, delete, gate, release, Handoff or Gap operation", () => {
    const { testReview } = setup();
    expect(Object.keys(testReview).sort()).toEqual([
      "bindValidResult",
      "commitBulkReview",
      "commitFollowUp",
      "list",
      "previewBulkReview",
      "previewFollowUp",
      "previewSessionClose",
      "recordCorrection",
      "recordRedaction",
      "recordWithdrawal",
      "setItemReviewState",
      "setSessionReviewState",
      "summary",
      "supersede",
    ]);
  });

  test("a review writes only review state and history, nothing else", async () => {
    const harness = setup();
    await harness.testReview.setSessionReviewState(accountId, {
      projectId,
      sessionId: "s1",
      state: "Closed",
    });
    await harness.testReview.setItemReviewState(accountId, {
      projectId,
      sessionId: "s1",
      sessionTestId: "t1",
      state: "Reviewed",
    });
    expect(new Set(harness.writes)).toEqual(
      new Set(["session-state", "item-state", "event"]),
    );
  });

  test("a review input cannot smuggle a gate, release, Handoff or result field", async () => {
    const harness = setup();
    const extras = [
      { releaseStatus: "Released" },
      { handoffState: "Closed" },
      { normalizedResult: "Passed" },
      { gate: true },
    ];
    await Promise.all(
      extras.map((extra) =>
        expect(
          harness.testReview.setSessionReviewState(accountId, {
            projectId,
            sessionId: "s1",
            state: "Reviewed",
            ...extra,
          } as never),
        ).rejects.toThrow(),
      ),
    );
    expect(harness.writes).toHaveLength(0);
  });
});

const FORBIDDEN_MEMBER =
  /gap|assessment|handoff|report|delete|trash|archive|gate|score/i;
const SCORE_OR_GATE =
  /score|coverage|quality|verdict|gate|waiver|passrate|percent|overall|readiness/i;

function sessionsFixture() {
  return [
    fixtureSession(
      "s-feature",
      [
        {
          id: "pass",
          normalized: "passed",
          raw: "ok",
          scenario: ["case-1", 1],
          title: "Checkout happy path",
        },
        {
          id: "fail",
          normalized: "failed",
          raw: "FAIL 500",
          scenario: ["case-2", 1],
          title: "Refund",
        },
        {
          id: "skip",
          normalized: "skipped",
          raw: "skip",
          title: "Coupon",
        },
      ],
      {
        context: { branch: "feature/checkout", commit: "abc" },
        executorName: "Codex",
        reportedAt: "2026-10-02T09:00:00.000Z",
        reporter: "Integration codex-ci",
        targetContext: { branch: "main" },
      },
    ),
    fixtureSession(
      "s-other",
      [{ id: "other", normalized: "failed", title: "Unrelated" }],
      { reportedAt: "2026-10-03T09:00:00.000Z" },
    ),
  ];
}

function setupTestReviewSummary(overrides: { assessedAt?: string } = {}) {
  const feature = emptySummaryFacts("Feature", "feature-1", "Checkout", {
    assessments: overrides.assessedAt
      ? [
          {
            assessedAt: overrides.assessedAt,
            decision: "Acceptable",
            id: "a1",
            label: "Checkout assessment",
          },
        ]
      : [],
    gaps: [
      {
        id: "g1",
        recordedAt: "2026-10-05T09:00:00.000Z",
        state: "Open",
        title: "No refund test",
      },
      {
        id: "g2",
        recordedAt: "2026-09-01T09:00:00.000Z",
        state: "Met by result",
        title: "Closed gap",
      },
    ],
    handoffs: [{ id: "h1", state: "Shared", title: "Checkout handoff" }],
    scenarios: [
      { id: "case-1", title: "Checkout", version: 1 },
      { id: "case-2", title: "Refund", version: 1 },
      { id: "case-3", title: "Never run", version: 1 },
    ],
    sessionTestIds: ["pass", "fail", "skip"],
  });
  const release = emptySummaryFacts(
    "Project Release",
    "release-1",
    "Release 1",
    { gaps: feature.gaps.slice(0, 1), sessionTestIds: ["fail"] },
  );
  const empty = emptySummaryFacts("Feature", "feature-empty", "Lonely");
  return createMemoryHarness(
    sessionsFixture(),
    [
      {
        id: "work-1",
        key: "PRJ-1",
        status: "Not Started",
        title: "Fix refund",
        type: "Task",
      },
    ],
    {
      [summaryFactsKey({ id: "feature-1", kind: "Feature" })]: feature,
      [summaryFactsKey({ id: "feature-empty", kind: "Feature" })]: empty,
      [summaryFactsKey({ id: "release-1", kind: "Project Release" })]: release,
    },
  );
}

function section(summary: TestSummary, key: string) {
  const found = [...summary.sections, ...summary.attention].find(
    (entry) => entry.key === key,
  );
  if (!found) {
    throw new Error(`No section ${key}`);
  }
  return found;
}

function ids(summary: TestSummary, key: string) {
  return section(summary, key).records.map((record) => record.id);
}

describe("Feature Test Summary", () => {
  test("shows only in-scope records and opens each as its exact set", async () => {
    const { testReview } = setupTestReviewSummary();
    const summary = await testReview.summary(accountId, {
      projectId,
      scope: { id: "feature-1", kind: "Feature" },
    });
    expect(summary.scope).toEqual({
      id: "feature-1",
      kind: "Feature",
      label: "Checkout",
    });
    expect(ids(summary, "scenarios")).toEqual(["case-1", "case-2", "case-3"]);
    expect(ids(summary, "handoffs")).toEqual(["h1"]);
    expect(ids(summary, "sessions")).toEqual(["s-feature"]);
    expect(ids(summary, "session-tests")).toEqual(["pass", "fail", "skip"]);
    expect(ids(summary, "open-gaps")).toEqual(["g1"]);
    expect(ids(summary, "latest-assessment")).toEqual([]);
    for (const entry of [...summary.sections, ...summary.attention]) {
      expect(entry.filters.length).toBeGreaterThan(0);
    }
  });

  test("keeps raw and normalized results, source session, executor, reporter, time and context", async () => {
    const { testReview } = setupTestReviewSummary();
    const summary = await testReview.summary(accountId, {
      projectId,
      scope: { id: "feature-1", kind: "Feature" },
    });
    const failed = section(summary, "session-tests").records.find(
      (record) => record.id === "fail",
    );
    expect(failed?.provenance).toEqual({
      context: { branch: "feature/checkout", commit: "abc" },
      currentResult: "failed",
      executorName: "Codex",
      normalizedResult: "failed",
      rawResult: "FAIL 500",
      reportedAt: "2026-10-02T09:00:00.000Z",
      reporter: "Integration codex-ci",
      reviewState: "Unreviewed",
      sessionId: "s-feature",
    });
  });

  test("lists attention as neutral source-linked records with no verdict", async () => {
    const { testReview } = setupTestReviewSummary();
    const summary = await testReview.summary(accountId, {
      projectId,
      scope: { id: "feature-1", kind: "Feature" },
    });
    expect(ids(summary, "failed-results")).toEqual(["fail"]);
    expect(ids(summary, "skipped-results")).toEqual(["skip"]);
    expect(ids(summary, "unreviewed-reports")).toEqual(["s-feature"]);
    expect(ids(summary, "open-gaps")).toEqual(["g1"]);
    expect(ids(summary, "context-changed")).toEqual(["pass", "fail", "skip"]);
    expect(ids(summary, "scenarios-without-results")).toEqual(["case-3"]);
    expect(summary.attention.map((entry) => entry.key)).not.toContain(
      "no-related-tests",
    );
  });

  test("derives conflict and context-changed attention from the review seam", async () => {
    const harness = createMemoryHarness(
      [
        ...sessionsFixture(),
        fixtureSession(
          "s-second",
          [
            {
              id: "pass-again",
              normalized: "passed",
              scenario: ["case-2", 1],
              title: "Refund again",
            },
          ],
          { reportedAt: "2026-10-04T09:00:00.000Z" },
        ),
      ],
      [],
      {
        "Feature:feature-1": emptySummaryFacts(
          "Feature",
          "feature-1",
          "Checkout",
          { sessionTestIds: ["fail", "pass-again"] },
        ),
      },
    );
    const summary = await harness.testReview.summary(accountId, {
      projectId,
      scope: { id: "feature-1", kind: "Feature" },
    });
    expect(ids(summary, "test-result-conflict")).toEqual([
      "fail",
      "pass-again",
    ]);
    expect(ids(summary, "context-changed")).toEqual(["fail"]);
    expect(harness.writes).toEqual([]);
    // Binding a valid result closes the signal; the summary follows live.
    await harness.testReview.bindValidResult(accountId, {
      projectId,
      scenarioId: "case-2",
      scenarioVersion: 1,
      sessionTestId: "pass-again",
    });
    const bound = await harness.testReview.summary(accountId, {
      projectId,
      scope: { id: "feature-1", kind: "Feature" },
    });
    expect(bound.attention.map((entry) => entry.key)).not.toContain(
      "test-result-conflict",
    );
  });

  test("an empty Feature names the missing tests with the Feature as its source", async () => {
    const { testReview } = setupTestReviewSummary();
    const summary = await testReview.summary(accountId, {
      projectId,
      scope: { id: "feature-empty", kind: "Feature" },
    });
    expect(summary.sections.every((entry) => entry.records.length === 0)).toBe(
      true,
    );
    expect(section(summary, "no-related-tests").records).toEqual([
      {
        detail: null,
        id: "feature-empty",
        kind: "Feature",
        label: "Lonely",
        provenance: null,
      },
    ]);
  });

  test("flags test context that arrived after the latest assessment", async () => {
    const { testReview } = setupTestReviewSummary({
      assessedAt: "2026-10-01T00:00:00.000Z",
    });
    const summary = await testReview.summary(accountId, {
      projectId,
      scope: { id: "feature-1", kind: "Feature" },
    });
    expect(ids(summary, "latest-assessment")).toEqual(["a1"]);
    expect(ids(summary, "new-context-after-assessment")).toEqual([
      "s-feature",
      "g1",
    ]);
    const later = setupTestReviewSummary({
      assessedAt: "2026-12-01T00:00:00.000Z",
    });
    const quiet = await later.testReview.summary(accountId, {
      projectId,
      scope: { id: "feature-1", kind: "Feature" },
    });
    expect(quiet.attention.map((entry) => entry.key)).not.toContain(
      "new-context-after-assessment",
    );
  });

  test("emits no score, coverage, verdict, waiver or gate field anywhere", async () => {
    const { testReview } = setupTestReviewSummary();
    for (const scope of [
      { id: "feature-1", kind: "Feature" },
      { id: "release-1", kind: "Project Release" },
      { kind: "Project" },
    ] as const) {
      const summary = await testReview.summary(accountId, {
        projectId,
        scope,
      });
      const keys = new Set<string>();
      JSON.stringify(summary, (key, value) => {
        keys.add(key);
        return value;
      });
      for (const key of keys) {
        expect(key).not.toMatch(SCORE_OR_GATE);
      }
      for (const entry of [...summary.sections, ...summary.attention]) {
        expect(Object.keys(entry).sort()).toEqual([
          "filters",
          "key",
          "label",
          "records",
        ]);
      }
    }
  });

  test("a GitHub check is never a Test Session and the summary writes nothing", async () => {
    const harness = setupTestReviewSummary();
    const before = structuredClone([...harness.sessions.keys()]);
    const summary = await harness.testReview.summary(accountId, {
      projectId,
      scope: { id: "feature-1", kind: "Feature" },
    });
    expect(ids(summary, "sessions")).toEqual(["s-feature"]);
    expect([...harness.sessions.keys()]).toEqual(before);
    // No Test Gap, assessment, report, review, event or Work writer ran.
    expect(harness.writes).toEqual([]);
  });

  test("refuses a Feature that is not in the Project", async () => {
    const { testReview } = setupTestReviewSummary();
    await expect(
      testReview.summary(accountId, {
        projectId,
        scope: { id: "missing", kind: "Feature" },
      }),
    ).rejects.toBeInstanceOf(TestReviewSummaryScopeNotFoundError);
  });

  test("a session Correction promotes the corrected summary into the Test Sessions section", async () => {
    const { testReview } = setupTestReviewSummary();
    await testReview.recordCorrection(accountId, {
      note: "Checkout run against the fixed build.",
      projectId,
      reason: "The summary described the wrong build.",
      sessionId: "s-feature",
    });
    const summary = await testReview.summary(accountId, {
      projectId,
      scope: { id: "feature-1", kind: "Feature" },
    });
    const record = section(summary, "sessions").records.find(
      (entry) => entry.id === "s-feature",
    );
    expect(record?.label).toBe("Checkout run against the fixed build.");
  });
});

describe("Project Release Test Summary", () => {
  test("uses the release's own scope plus direct links", async () => {
    const { testReview } = setupTestReviewSummary();
    const release = await testReview.summary(accountId, {
      projectId,
      scope: { id: "release-1", kind: "Project Release" },
    });
    expect(release.scope.kind).toBe("Project Release");
    expect(ids(release, "session-tests")).toEqual(["fail"]);
    expect(ids(release, "open-gaps")).toEqual(["g1"]);
    expect(ids(release, "failed-results")).toEqual(["fail"]);
  });
});

describe("Tests overview sections", () => {
  test("lists the derived sections as exact record sets", async () => {
    const harness = createMemoryHarness(sessionsFixture(), [], {
      Project: emptySummaryFacts("Project", null, "Project One", {
        assessments: [
          {
            assessedAt: "2026-10-04T00:00:00.000Z",
            decision: "Undecided",
            id: "a1",
            label: "Checkout",
          },
        ],
        gaps: [
          {
            id: "g1",
            recordedAt: "2026-10-01T00:00:00.000Z",
            state: "Open",
            title: "A",
          },
          {
            id: "g2",
            recordedAt: "2026-10-01T00:00:00.000Z",
            state: "Planned",
            title: "B",
          },
          {
            id: "g3",
            recordedAt: "2026-10-01T00:00:00.000Z",
            state: "Not needed",
            title: "C",
          },
        ],
        handoffs: [
          { id: "h1", state: "Draft", title: "Draft" },
          { id: "h2", state: "Shared", title: "Shared" },
          { id: "h3", state: "Closed", title: "Closed" },
        ],
      }),
    });
    const summary = await harness.testReview.summary(accountId, {
      projectId,
      scope: { kind: "Project" },
    });
    expect(summary.attention).toEqual([]);
    expect(summary.sections.map((entry) => entry.key)).toEqual([
      "unreviewed-reports",
      "follow-up-needed-results",
      "open-gaps",
      "conflicting-results",
      "context-changed-results",
      "active-handoffs",
      "recent-sessions",
      "recent-assessments",
    ]);
    expect(ids(summary, "unreviewed-reports")).toEqual([
      "s-other",
      "s-feature",
    ]);
    expect(ids(summary, "open-gaps")).toEqual(["g1", "g2"]);
    expect(ids(summary, "active-handoffs")).toEqual(["h2"]);
    expect(ids(summary, "recent-sessions")).toEqual(["s-other", "s-feature"]);
    expect(ids(summary, "recent-assessments")).toEqual(["a1"]);
    expect(harness.writes).toEqual([]);
  });

  test("follow-up needed results and context changes follow the review seam", async () => {
    const harness = createMemoryHarness(sessionsFixture());
    await harness.testReview.setItemReviewState(accountId, {
      projectId,
      sessionId: "s-feature",
      sessionTestId: "fail",
      state: "Follow-up needed",
    });
    const summary = await harness.testReview.summary(accountId, {
      projectId,
      scope: { kind: "Project" },
    });
    expect(ids(summary, "follow-up-needed-results")).toEqual(["fail"]);
    // Failed, conflict and context never open a Test Gap by themselves.
    expect(ids(summary, "open-gaps")).toEqual([]);
    expect(ids(summary, "context-changed-results")).toEqual([
      "pass",
      "fail",
      "skip",
    ]);
  });

  test("the contract has no write for gaps, assessments, handoffs or reports", () => {
    const { testReview } = setupTestReviewSummary();
    expect(Object.keys(testReview).join(" ")).not.toMatch(FORBIDDEN_MEMBER);
  });
});
