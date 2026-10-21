import {
  TEST_REVIEW_SETTABLE_STATES,
  TEST_REVIEW_STATES,
  type TestReviewState,
} from "@cantiara/api/test-review";
import { describe, expect, test } from "vitest";

import {
  accountId,
  archivedProjectId,
  createMemoryHarness,
  fixtureSession,
  projectId,
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
