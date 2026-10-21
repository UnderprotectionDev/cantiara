import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import {
  TestReviewAlreadyRedactedError,
  TestReviewAlreadyWithdrawnError,
  TestReviewProjectReadOnlyError,
  TestReviewRecordNotFoundError,
} from "../test-review";
import {
  accountId,
  archivedProjectId,
  createMemoryHarness,
  fixtureSession,
  projectId,
} from "../test-review-memory-store";

const FORBIDDEN_NAME = /delete|archive|trash/i;
const SECRET = "ghp_SuperSecretToken123";

function setup() {
  return createMemoryHarness([
    fixtureSession("s1", [
      { id: "t1", raw: "FAIL", normalized: "failed", title: "Login works" },
      { id: "t2", title: "Logout works" },
    ]),
    fixtureSession("sa", [{ id: "a1", title: "Archived item" }], {
      projectId: archivedProjectId,
    }),
  ]);
}

let clock = 0;

beforeEach(() => {
  vi.useFakeTimers();
  clock = Date.parse("2026-10-02T09:00:00.000Z");
  vi.setSystemTime(clock);
});

afterEach(() => {
  vi.useRealTimers();
});

function tick() {
  clock += 60_000;
  vi.setSystemTime(clock);
}

async function view(harness: ReturnType<typeof setup>) {
  return await harness.testReview.list(accountId, projectId);
}

function itemOf(
  list: Awaited<ReturnType<typeof view>>,
  sessionId: string,
  itemId: string,
) {
  const found = list.sessions
    .find((session) => session.id === sessionId)
    ?.items.find((item) => item.id === itemId);
  if (!found) {
    throw new Error(`No item ${itemId}`);
  }
  return found;
}

describe("Test Review: Correction and Withdrawal", () => {
  test("a Correction promotes the corrected result and keeps the original report", async () => {
    const harness = setup();
    const { event } = await harness.testReview.recordCorrection(accountId, {
      correctedResult: "passed",
      projectId,
      reason: "Ran against the wrong build.",
      sessionId: "s1",
      sessionTestId: "t1",
    });
    expect(event).toMatchObject({
      actorAccountId: accountId,
      kind: "Correction",
      previousEventId: null,
      reason: "Ran against the wrong build.",
      redacted: false,
      sessionTestId: "t1",
    });
    const item = itemOf(await view(harness), "s1", "t1");
    expect(item.current).toEqual({
      eventId: event.id,
      result: "passed",
      source: "Correction",
      usable: true,
    });
    // The reported raw and normalized result are untouched.
    expect(item.rawResult).toBe("FAIL");
    expect(item.normalizedResult).toBe("failed");
    expect(harness.sessions.get("s1")?.items[0]).toMatchObject({
      normalizedResult: "failed",
      rawResult: "FAIL",
    });
    expect(harness.writes).toEqual(["result-event"]);
  });

  test("a second Correction extends the chain and both stay readable", async () => {
    const harness = setup();
    const first = await harness.testReview.recordCorrection(accountId, {
      correctedResult: "passed",
      projectId,
      reason: "Wrong build.",
      sessionId: "s1",
      sessionTestId: "t1",
    });
    tick();
    const second = await harness.testReview.recordCorrection(accountId, {
      correctedResult: "blocked",
      projectId,
      reason: "Environment was down.",
      sessionId: "s1",
      sessionTestId: "t1",
    });
    expect(second.event.previousEventId).toBe(first.event.id);
    const list = await view(harness);
    expect(itemOf(list, "s1", "t1").current).toMatchObject({
      eventId: second.event.id,
      result: "blocked",
    });
    expect(list.resultEvents.map((entry) => entry.id)).toEqual([
      second.event.id,
      first.event.id,
    ]);
    expect(list.resultEvents.map((entry) => entry.reason)).toEqual([
      "Environment was down.",
      "Wrong build.",
    ]);
  });

  test("a Withdrawal makes the result not current evidence and the original stays", async () => {
    const harness = setup();
    const { event } = await harness.testReview.recordWithdrawal(accountId, {
      projectId,
      reason: "Duplicate of another run.",
      sessionId: "s1",
      sessionTestId: "t2",
    });
    expect(event.kind).toBe("Withdrawal");
    const item = itemOf(await view(harness), "s1", "t2");
    expect(item.current).toEqual({
      eventId: event.id,
      result: null,
      source: "Withdrawal",
      usable: false,
    });
    expect(item.normalizedResult).toBe("Passed");
    await expect(
      harness.testReview.recordWithdrawal(accountId, {
        projectId,
        reason: "Again.",
        sessionId: "s1",
        sessionTestId: "t2",
      }),
    ).rejects.toBeInstanceOf(TestReviewAlreadyWithdrawnError);
    // A Correction may follow a Withdrawal and then becomes current.
    tick();
    await harness.testReview.recordCorrection(accountId, {
      correctedResult: "skipped",
      projectId,
      reason: "It was skipped after all.",
      sessionId: "s1",
      sessionTestId: "t2",
    });
    expect(itemOf(await view(harness), "s1", "t2").current).toMatchObject({
      result: "skipped",
      source: "Correction",
    });
  });

  test("a Withdrawal of the whole Test Session marks it withdrawn", async () => {
    const harness = setup();
    await harness.testReview.recordWithdrawal(accountId, {
      projectId,
      reason: "Report belonged to another project.",
      sessionId: "s1",
    });
    const list = await view(harness);
    expect(list.sessions.find(({ id }) => id === "s1")?.withdrawn).toBe(true);
    expect(itemOf(list, "s1", "t1").current.source).toBe("Reported");
  });

  test("a session Correction promotes the corrected summary and keeps the original", async () => {
    const harness = createMemoryHarness([
      fixtureSession("s1", [{ id: "t1", title: "Login works" }], {
        summary: "Checkout run",
      }),
    ]);
    const { event } = await harness.testReview.recordCorrection(accountId, {
      note: "Checkout run against the fixed build.",
      projectId,
      reason: "The summary described the wrong build.",
      sessionId: "s1",
    });
    const list = await view(harness);
    const session = list.sessions.find(({ id }) => id === "s1");
    expect(session?.currentSummary).toBe(
      "Checkout run against the fixed build.",
    );
    // The original report stays beside the promoted correction.
    expect(session?.summary).toBe("Checkout run");
    expect(event.note).toBe("Checkout run against the fixed build.");
  });

  test("redacting the session Correction note drops it from the current view", async () => {
    const harness = createMemoryHarness([
      fixtureSession("s1", [{ id: "t1", title: "Login works" }], {
        summary: "Checkout run",
      }),
    ]);
    const { event } = await harness.testReview.recordCorrection(accountId, {
      note: "Checkout run containing a secret",
      projectId,
      reason: "Wrong build.",
      sessionId: "s1",
    });
    await harness.testReview.recordRedaction(accountId, {
      eventId: event.id,
      projectId,
      reason: "Secret in the corrected summary.",
      sessionId: "s1",
    });
    const list = await view(harness);
    const session = list.sessions.find(({ id }) => id === "s1");
    expect(session?.currentSummary).toBeNull();
    expect(session?.summary).toBe("Checkout run");
  });

  test("a reason is required and a Session Test Correction needs a result", async () => {
    const harness = setup();
    await expect(
      harness.testReview.recordCorrection(accountId, {
        correctedResult: "passed",
        projectId,
        reason: "   ",
        sessionId: "s1",
        sessionTestId: "t1",
      }),
    ).rejects.toThrow();
    await expect(
      harness.testReview.recordCorrection(accountId, {
        projectId,
        reason: "Why.",
        sessionId: "s1",
        sessionTestId: "t1",
      }),
    ).rejects.toThrow();
    await expect(
      harness.testReview.recordWithdrawal(accountId, {
        projectId,
        reason: "",
        sessionId: "s1",
        sessionTestId: "t1",
      }),
    ).rejects.toThrow();
    expect(harness.writes).toEqual([]);
  });

  test("a Session Test of another session or an archived Project is refused", async () => {
    const harness = setup();
    await expect(
      harness.testReview.recordWithdrawal(accountId, {
        projectId,
        reason: "Nope.",
        sessionId: "s1",
        sessionTestId: "a1",
      }),
    ).rejects.toBeInstanceOf(TestReviewRecordNotFoundError);
    await expect(
      harness.testReview.recordWithdrawal(accountId, {
        projectId: archivedProjectId,
        reason: "Read only.",
        sessionId: "sa",
        sessionTestId: "a1",
      }),
    ).rejects.toBeInstanceOf(TestReviewProjectReadOnlyError);
    expect(harness.writes).toEqual([]);
  });

  test("the access offers no delete, archive or Trash for a single Session Test", () => {
    const names = Object.keys(setup().testReview);
    expect(names.filter((name) => FORBIDDEN_NAME.test(name))).toEqual([]);
  });
});

describe("Test Review: security redaction", () => {
  test("redacting a reported result replaces it with a mark and makes it unusable", async () => {
    const harness = createMemoryHarness([
      fixtureSession("s1", [
        { id: "t1", raw: `FAIL token ${SECRET}`, title: "Login works" },
      ]),
    ]);
    tick();
    const { event } = await harness.testReview.recordRedaction(accountId, {
      projectId,
      reason: "Token pasted into the raw result.",
      sessionId: "s1",
      sessionTestId: "t1",
    });
    expect(event).toMatchObject({
      actorAccountId: accountId,
      kind: "Redaction",
      reason: "Token pasted into the raw result.",
      recordedAt: new Date(clock).toISOString(),
      redactedField: "Reported result",
    });
    const list = await harness.testReview.list(accountId, projectId);
    const item = itemOf(list, "s1", "t1");
    expect(item.rawResult).toBeNull();
    expect(item.rawResultRedacted).toBe(true);
    expect(item.current.usable).toBe(false);
    // The secret never leaves the seam in any list output.
    expect(JSON.stringify(list)).not.toContain(SECRET);
    await expect(
      harness.testReview.recordRedaction(accountId, {
        projectId,
        reason: "Again.",
        sessionId: "s1",
        sessionTestId: "t1",
      }),
    ).rejects.toBeInstanceOf(TestReviewAlreadyRedactedError);
  });

  test("redacting a Correction erases its content, keeps the event and mark, and drops it from evidence", async () => {
    const harness = setup();
    const corrected = await harness.testReview.recordCorrection(accountId, {
      correctedResult: "passed",
      note: `Used ${SECRET} to retest`,
      projectId,
      reason: `Key ${SECRET}`,
      sessionId: "s1",
      sessionTestId: "t1",
    });
    tick();
    const mark = await harness.testReview.recordRedaction(accountId, {
      eventId: corrected.event.id,
      projectId,
      reason: "Secret in the note.",
      sessionId: "s1",
    });
    expect(mark.event).toMatchObject({
      redactedEventId: corrected.event.id,
      redactedField: "Event content",
      sessionTestId: "t1",
    });
    expect(JSON.stringify(harness.resultEvents)).not.toContain(SECRET);
    const list = await view(harness);
    expect(JSON.stringify(list)).not.toContain(SECRET);
    const shown = list.resultEvents.find(({ id }) => id === corrected.event.id);
    expect(shown).toMatchObject({
      actorAccountId: accountId,
      correctedResult: null,
      kind: "Correction",
      note: null,
      reason: null,
      redacted: true,
    });
    expect(itemOf(list, "s1", "t1").current).toMatchObject({
      result: null,
      source: "Correction",
      usable: false,
    });
    await expect(
      harness.testReview.recordRedaction(accountId, {
        eventId: corrected.event.id,
        projectId,
        reason: "Again.",
        sessionId: "s1",
      }),
    ).rejects.toBeInstanceOf(TestReviewAlreadyRedactedError);
  });

  test("redacting the Test Session summary shows no summary and keeps the mark", async () => {
    const harness = createMemoryHarness([
      fixtureSession("s1", [{ id: "t1", title: "Login works" }], {
        summary: `Notes with ${SECRET}`,
      }),
    ]);
    await harness.testReview.recordRedaction(accountId, {
      projectId,
      reason: "Secret in the summary.",
      sessionId: "s1",
    });
    const list = await harness.testReview.list(accountId, projectId);
    expect(list.sessions[0]).toMatchObject({
      summary: null,
      summaryRedacted: true,
    });
    expect(JSON.stringify(list)).not.toContain(SECRET);
  });

  test("a redacted value appears in no derived output", async () => {
    const SUMMARY = "SUMMARY-SECRET-ghp_111";
    const RESULT = "NORMALIZED-SECRET-ghp_222";
    const harness = createMemoryHarness(
      [
        fixtureSession(
          "s1",
          [
            {
              id: "t1",
              normalized: RESULT,
              raw: RESULT,
              scenario: ["case-1", 1],
              title: "Login works",
            },
            {
              id: "t2",
              normalized: "failed",
              scenario: ["case-1", 1],
              title: "Login again",
            },
            {
              id: "t3",
              normalized: "passed",
              scenario: ["case-1", 1],
              title: "Login third",
            },
          ],
          { summary: SUMMARY },
        ),
      ],
      [
        {
          id: "work-1",
          key: "PRJ-1",
          status: "Not Started",
          title: "Existing",
          type: "Task",
        },
      ],
    );
    const redact = (sessionTestId: string | null) =>
      harness.testReview.recordRedaction(accountId, {
        projectId,
        reason: "Secret.",
        sessionId: "s1",
        sessionTestId,
      });
    await redact(null);
    await redact("t1");
    const leaks = (value: unknown) => {
      const text = JSON.stringify(value);
      return [SUMMARY, RESULT].filter((secret) => text.includes(secret));
    };
    const newTarget = { mode: "new" as const };
    const bulkInput = {
      projectId,
      sessionId: "s1",
      sessionTestIds: ["t1", "t2"],
    };
    const bulk = await harness.testReview.previewBulkReview(
      accountId,
      bulkInput,
    );
    const preview = await harness.testReview.previewFollowUp(accountId, {
      projectId,
      sessionTestIds: ["t1"],
      target: newTarget,
    });
    const existing = await harness.testReview.previewFollowUp(accountId, {
      projectId,
      sessionTestIds: ["t1", "t2"],
      target: { mode: "existing", workId: "work-1" },
    });
    await harness.testReview.commitFollowUp(accountId, {
      previewFingerprint: preview.fingerprint,
      projectId,
      sessionTestIds: ["t1"],
      target: newTarget,
      workId: "work-new",
    });
    const committed = await harness.testReview.commitBulkReview(accountId, {
      ...bulkInput,
      previewFingerprint: bulk.fingerprint,
    });
    expect([
      leaks(await harness.testReview.list(accountId, projectId)),
      leaks(
        await harness.testReview.summary(accountId, {
          projectId,
          scope: { kind: "Project" },
        }),
      ),
      leaks(bulk),
      leaks(committed),
      leaks(preview),
      leaks(existing),
      leaks(harness.works),
    ]).toEqual([[], [], [], [], [], [], []]);
  });

  test("redaction is not Trash: it deletes no record and changes no review state", async () => {
    const harness = setup();
    await harness.testReview.setItemReviewState(accountId, {
      projectId,
      sessionId: "s1",
      sessionTestId: "t1",
      state: "Follow-up needed",
    });
    await harness.testReview.recordRedaction(accountId, {
      projectId,
      reason: "Secret.",
      sessionId: "s1",
      sessionTestId: "t1",
    });
    const list = await view(harness);
    expect(list.sessions.find(({ id }) => id === "s1")?.items).toHaveLength(2);
    expect(itemOf(list, "s1", "t1").reviewState).toBe("Follow-up needed");
  });

  test("naming both an event and a Session Test is refused", async () => {
    const harness = setup();
    await expect(
      harness.testReview.recordRedaction(accountId, {
        eventId: "e",
        projectId,
        reason: "Both.",
        sessionId: "s1",
        sessionTestId: "t1",
      }),
    ).rejects.toThrow();
  });
});

describe("Test Review: later events never rewind a review state", () => {
  test("a Correction after close keeps Closed and shows New context after close", async () => {
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
      state: "Closed",
    });
    let list = await view(harness);
    expect(list.sessions.find(({ id }) => id === "s1")).toMatchObject({
      newContextAfterClose: false,
    });
    tick();
    await harness.testReview.recordCorrection(accountId, {
      correctedResult: "passed",
      projectId,
      reason: "Wrong build.",
      sessionId: "s1",
      sessionTestId: "t1",
    });
    list = await view(harness);
    const session = list.sessions.find(({ id }) => id === "s1");
    expect(session?.reviewState).toBe("Closed");
    expect(session?.newContextAfterClose).toBe(true);
    expect(itemOf(list, "s1", "t1")).toMatchObject({
      newContextAfterClose: true,
      reviewState: "Closed",
    });
    // The other item was not closed and received nothing.
    expect(itemOf(list, "s1", "t2")).toMatchObject({
      newContextAfterClose: false,
      reviewState: "Unreviewed",
    });
    expect(harness.sessions.get("s1")?.reviewState).toBe("Closed");
  });

  test.each([
    ["Withdrawal", "withdraw"],
    ["Redaction", "redact"],
  ])(
    "a %s after close shows the signal and keeps the state",
    async (_name, action) => {
      const harness = setup();
      await harness.testReview.setSessionReviewState(accountId, {
        projectId,
        sessionId: "s1",
        state: "Closed",
      });
      tick();
      if (action === "withdraw") {
        await harness.testReview.recordWithdrawal(accountId, {
          projectId,
          reason: "Wrong report.",
          sessionId: "s1",
          sessionTestId: "t1",
        });
      } else {
        await harness.testReview.recordRedaction(accountId, {
          projectId,
          reason: "Secret.",
          sessionId: "s1",
          sessionTestId: "t1",
        });
      }
      const session = (await view(harness)).sessions.find(
        ({ id }) => id === "s1",
      );
      expect(session).toMatchObject({
        newContextAfterClose: true,
        reviewState: "Closed",
      });
    },
  );

  test("events before close and on a not-Closed session raise no signal; review states are never written", async () => {
    const harness = setup();
    await harness.testReview.recordCorrection(accountId, {
      correctedResult: "passed",
      projectId,
      reason: "Early fix.",
      sessionId: "s1",
      sessionTestId: "t1",
    });
    tick();
    await harness.testReview.setSessionReviewState(accountId, {
      projectId,
      sessionId: "s1",
      state: "Closed",
    });
    expect(
      (await view(harness)).sessions.find(({ id }) => id === "s1")
        ?.newContextAfterClose,
    ).toBe(false);
    await harness.testReview.setSessionReviewState(accountId, {
      projectId,
      sessionId: "s1",
      state: "Reviewed",
    });
    tick();
    await harness.testReview.recordWithdrawal(accountId, {
      projectId,
      reason: "Late.",
      sessionId: "s1",
      sessionTestId: "t2",
    });
    const session = (await view(harness)).sessions.find(
      ({ id }) => id === "s1",
    );
    expect(session).toMatchObject({
      newContextAfterClose: false,
      reviewState: "Reviewed",
    });
    expect(harness.writes).not.toContain("item-state");
  });

  test("an event writes no result, Handoff, Release or Gap (history only)", async () => {
    const harness = setup();
    await harness.testReview.recordCorrection(accountId, {
      correctedResult: "passed",
      projectId,
      reason: "Wrong build.",
      sessionId: "s1",
      sessionTestId: "t1",
    });
    await harness.testReview.recordWithdrawal(accountId, {
      projectId,
      reason: "Duplicate.",
      sessionId: "s1",
      sessionTestId: "t2",
    });
    expect(new Set(harness.writes)).toEqual(new Set(["result-event"]));
    expect(harness.events).toEqual([]);
  });
});
