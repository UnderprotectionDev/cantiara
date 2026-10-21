import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import {
  TestReviewBindingInvalidError,
  TestReviewPreviewStaleError,
  TestReviewProjectReadOnlyError,
  TestReviewRecordNotFoundError,
  TestReviewSupersedeCycleError,
  TestReviewSupersedeTypeMismatchError,
} from "./test-review";
import {
  accountId,
  archivedProjectId,
  createMemoryHarness,
  fixtureSession,
  projectId,
} from "./test-review-memory-store";

const SCENARIO: [string, number] = ["case-1", 2];
const FORBIDDEN_MEMBER = /gap|handoff|assessment|delete|trash|archive/i;

function setup() {
  return createMemoryHarness(
    [
      fixtureSession(
        "s1",
        [
          {
            id: "pass",
            normalized: "passed",
            raw: "ok",
            scenario: SCENARIO,
            title: "Checkout",
          },
        ],
        {
          context: { branch: "main", commit: "abc123" },
          executorName: "Codex",
          reportedAt: "2026-10-01T09:00:00.000Z",
        },
      ),
      fixtureSession(
        "s2",
        [
          {
            id: "fail",
            normalized: "failed",
            raw: "FAIL",
            scenario: SCENARIO,
            title: "Totally different words",
          },
        ],
        {
          context: { branch: "feature/refund", commit: "def456" },
          executorName: "Claude Code",
          reportedAt: "2026-10-02T09:00:00.000Z",
        },
      ),
      fixtureSession(
        "s3",
        [
          {
            id: "again",
            normalized: "passed",
            scenario: SCENARIO,
            title: "Checkout",
          },
          { id: "other", normalized: "failed", title: "Checkout" },
        ],
        { reportedAt: "2026-10-03T09:00:00.000Z" },
      ),
      fixtureSession("sa", [{ id: "a1", title: "Archived" }], {
        projectId: archivedProjectId,
      }),
    ],
    [
      {
        id: "work-1",
        key: "PRJ-1",
        status: "Not Started",
        title: "Fix checkout",
        type: "Bug",
      },
      {
        id: "feature-1",
        key: "PRJ-2",
        status: "Not Started",
        title: "Checkout",
        type: "Feature",
      },
    ],
  );
}

let clock = 0;

beforeEach(() => {
  vi.useFakeTimers();
  clock = Date.parse("2026-10-04T09:00:00.000Z");
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

function supersede(
  harness: ReturnType<typeof setup>,
  newer: string,
  older: string,
) {
  return harness.testReview.supersede(accountId, {
    newerSessionTestId: newer,
    olderSessionTestId: older,
    projectId,
  });
}

describe("Supersedes between exact Session Tests", () => {
  test("keeps both historical results and summarizes the technical context difference", async () => {
    const harness = setup();
    const receipt = await supersede(harness, "pass", "fail");
    expect(receipt.outcome).toBe("applied");
    expect(receipt.supersession.newer.normalizedResult).toBe("passed");
    expect(receipt.supersession.older.normalizedResult).toBe("failed");
    expect(receipt.supersession.older.rawResult).toBe("FAIL");
    expect(receipt.supersession.difference).toEqual([
      { key: "branch", newer: "main", older: "feature/refund" },
      { key: "commit", newer: "abc123", older: "def456" },
    ]);
    const list = await view(harness);
    const old = list.sessions
      .find((session) => session.id === "s2")
      ?.items.find((item) => item.id === "fail");
    expect(old?.normalizedResult).toBe("failed");
    expect(old?.rawResult).toBe("FAIL");
    expect(harness.writes).toEqual(["supersession"]);
  });

  test("a missing technical context is shown as unknown, not as a match", async () => {
    const harness = setup();
    const receipt = await supersede(harness, "again", "pass");
    expect(receipt.supersession.difference).toEqual([
      { key: "branch", newer: null, older: "main" },
      { key: "commit", newer: null, older: "abc123" },
    ]);
  });

  test("a repeat writes nothing", async () => {
    const harness = setup();
    await supersede(harness, "pass", "fail");
    const writes = harness.writes.length;
    const again = await supersede(harness, "pass", "fail");
    expect(again.outcome).toBe("unchanged");
    expect(harness.writes).toHaveLength(writes);
  });

  test("refuses a cycle, a self relation and the reverse of a chain", async () => {
    const harness = setup();
    await supersede(harness, "pass", "fail");
    await supersede(harness, "again", "pass");
    await expect(supersede(harness, "fail", "again")).rejects.toBeInstanceOf(
      TestReviewSupersedeCycleError,
    );
    await expect(supersede(harness, "fail", "pass")).rejects.toBeInstanceOf(
      TestReviewSupersedeCycleError,
    );
    await expect(supersede(harness, "pass", "pass")).rejects.toBeInstanceOf(
      TestReviewSupersedeCycleError,
    );
    expect(harness.supersessions).toHaveLength(2);
  });

  test("refuses a specialist type mismatch and unknown records", async () => {
    const harness = setup();
    await expect(
      harness.testReview.supersede(accountId, {
        newerRecordType: "Decision",
        newerSessionTestId: "pass",
        olderRecordType: "Session Test",
        olderSessionTestId: "fail",
        projectId,
      }),
    ).rejects.toBeInstanceOf(TestReviewSupersedeTypeMismatchError);
    await expect(supersede(harness, "pass", "nope")).rejects.toBeInstanceOf(
      TestReviewRecordNotFoundError,
    );
    expect(harness.writes).toEqual([]);
  });

  test("an archived Project is read-only", async () => {
    const harness = setup();
    await expect(
      harness.testReview.supersede(accountId, {
        newerSessionTestId: "a1",
        olderSessionTestId: "a1",
        projectId: archivedProjectId,
      }),
    ).rejects.toBeInstanceOf(TestReviewProjectReadOnlyError);
  });
});

describe("test-result-conflict", () => {
  test("differing results on the exact scenario version raise the signal and pick no winner", async () => {
    const harness = setup();
    const { conflicts } = await view(harness);
    expect(conflicts).toHaveLength(1);
    const [conflict] = conflicts;
    expect(conflict?.signalId).toBe("test-result-conflict:case-1:2");
    expect(conflict?.presentation).toBe("Action Required");
    expect(conflict?.members.map((member) => member.sessionTestId)).toEqual([
      "pass",
      "fail",
      "again",
    ]);
    expect(harness.writes).toEqual([]);
  });

  test("the newest report does not win: last-write-wins is absent", async () => {
    const harness = setup();
    const { conflicts, sessions } = await view(harness);
    expect(conflicts).toHaveLength(1);
    for (const session of sessions) {
      for (const item of session.items) {
        expect(item.current.source).toBe("Reported");
      }
    }
  });

  test("a similar title without the exact scenario version never matches", async () => {
    const harness = createMemoryHarness([
      fixtureSession("a", [
        { id: "x", normalized: "passed", title: "Checkout flow" },
      ]),
      fixtureSession("b", [
        { id: "y", normalized: "failed", title: "Checkout flow" },
      ]),
    ]);
    expect((await view(harness)).conflicts).toEqual([]);
  });

  test("a different scenario version is a different group", async () => {
    const harness = createMemoryHarness([
      fixtureSession("a", [
        {
          id: "x",
          normalized: "passed",
          scenario: ["case-1", 1],
          title: "Checkout",
        },
      ]),
      fixtureSession("b", [
        {
          id: "y",
          normalized: "failed",
          scenario: ["case-1", 2],
          title: "Checkout",
        },
      ]),
    ]);
    expect((await view(harness)).conflicts).toEqual([]);
  });

  test("an explicit Supersedes settles the older result", async () => {
    const harness = setup();
    await supersede(harness, "pass", "fail");
    expect((await view(harness)).conflicts).toEqual([]);
  });

  test("a superseding chain settles every older member but a new differing member reopens it", async () => {
    const harness = setup();
    await supersede(harness, "again", "pass");
    // "again" still disagrees with "fail".
    const { conflicts } = await view(harness);
    expect(conflicts[0]?.members.map((member) => member.sessionTestId)).toEqual(
      ["fail", "again"],
    );
    await supersede(harness, "again", "fail");
    expect((await view(harness)).conflicts).toEqual([]);
  });

  test("binding a valid result closes the signal and keeps every result", async () => {
    const harness = setup();
    tick();
    const { binding } = await harness.testReview.bindValidResult(accountId, {
      projectId,
      reason: "Refund branch was the target",
      scenarioId: SCENARIO[0],
      scenarioVersion: SCENARIO[1],
      sessionTestId: "fail",
    });
    expect(binding.judgedSessionTestIds.sort()).toEqual([
      "again",
      "fail",
      "pass",
    ]);
    const list = await view(harness);
    expect(list.conflicts).toEqual([]);
    expect(list.bindings).toHaveLength(1);
    const results = list.sessions.flatMap((session) =>
      session.items.map((item) => [item.id, item.normalizedResult]),
    );
    expect(results).toContainEqual(["pass", "passed"]);
    expect(results).toContainEqual(["fail", "failed"]);
    expect(harness.writes).toEqual(["binding"]);
  });

  test("a later differing result reopens a bound conflict", async () => {
    const later = createMemoryHarness([
      fixtureSession("a", [
        { id: "x", normalized: "passed", scenario: SCENARIO, title: "T" },
      ]),
      fixtureSession("b", [
        { id: "y", normalized: "failed", scenario: SCENARIO, title: "T" },
      ]),
    ]);
    await later.testReview.bindValidResult(accountId, {
      projectId,
      scenarioId: SCENARIO[0],
      scenarioVersion: SCENARIO[1],
      sessionTestId: "x",
    });
    expect((await view(later)).conflicts).toEqual([]);
    // A new, differing result arrives after the judgment.
    later.sessions.set(
      "c",
      fixtureSession("c", [
        { id: "z", normalized: "blocked", scenario: SCENARIO, title: "T" },
      ]),
    );
    expect((await view(later)).conflicts).toHaveLength(1);
  });

  test("a result from another scenario version cannot be bound", async () => {
    const harness = setup();
    await expect(
      harness.testReview.bindValidResult(accountId, {
        projectId,
        scenarioId: SCENARIO[0],
        scenarioVersion: 9,
        sessionTestId: "fail",
      }),
    ).rejects.toBeInstanceOf(TestReviewBindingInvalidError);
    await expect(
      harness.testReview.bindValidResult(accountId, {
        projectId,
        scenarioId: SCENARIO[0],
        scenarioVersion: SCENARIO[1],
        sessionTestId: "other",
      }),
    ).rejects.toBeInstanceOf(TestReviewBindingInvalidError);
  });

  test("a withdrawn result leaves the comparison", async () => {
    const harness = setup();
    await harness.testReview.recordWithdrawal(accountId, {
      projectId,
      reason: "Wrong build",
      sessionId: "s2",
      sessionTestId: "fail",
    });
    expect((await view(harness)).conflicts).toEqual([]);
  });

  test("a conflict, a failure or a context change never writes a Test Gap, Handoff or Work", async () => {
    const harness = setup();
    await view(harness);
    expect(harness.writes).toEqual([]);
    expect(harness.works.every((entry) => entry.origin === null)).toBe(true);
  });
});

describe("Context changed", () => {
  test("a recorded commit that differs from the target context shows the signal", async () => {
    const harness = createMemoryHarness([
      fixtureSession("a", [{ id: "x", title: "T" }], {
        context: { branch: "main", build: "b1", commit: "abc" },
        targetContext: { branch: "main", build: "b1", commit: "zzz" },
      }),
    ]);
    const { contextChanges, sessions } = await view(harness);
    expect(contextChanges).toHaveLength(1);
    expect(contextChanges[0]).toMatchObject({
      label: "Context changed",
      reasons: [
        {
          key: "commit",
          kind: "Technical context mismatch",
          recorded: "abc",
          target: "zzz",
        },
      ],
      sessionTestId: "x",
    });
    // The old result is not marked failed or stale.
    expect(sessions[0]?.items[0]?.current).toMatchObject({
      result: "Passed",
      source: "Reported",
      usable: true,
    });
    expect(harness.writes).toEqual([]);
  });

  test("a bound Primary spec revision that moved shows the signal", async () => {
    const harness = createMemoryHarness([
      fixtureSession("a", [
        {
          boundSpecs: [
            {
              boundRevision: 3,
              currentRevision: 5,
              documentId: "doc-1",
              title: "Checkout spec",
            },
          ],
          id: "x",
          title: "T",
        },
      ]),
    ]);
    const { contextChanges } = await view(harness);
    expect(contextChanges[0]?.reasons).toEqual([
      {
        boundRevision: 3,
        currentRevision: 5,
        documentId: "doc-1",
        kind: "Primary spec changed",
        title: "Checkout spec",
      },
    ]);
  });

  test("elapsed time, an unrelated commit or a missing context is not staleness", async () => {
    const harness = createMemoryHarness([
      fixtureSession("old", [{ id: "x", title: "T" }], {
        context: { branch: "main", commit: "abc" },
        reportedAt: "2020-01-01T00:00:00.000Z",
        targetContext: { branch: "main", commit: "abc" },
      }),
      fixtureSession("manual", [{ id: "m", title: "Manual" }], {
        context: null,
        targetContext: { commit: "zzz" },
      }),
      fixtureSession("same-spec", [
        {
          boundSpecs: [
            {
              boundRevision: 4,
              currentRevision: 4,
              documentId: "d",
              title: "S",
            },
          ],
          id: "y",
          title: "Y",
        },
      ]),
    ]);
    vi.setSystemTime(Date.parse("2030-01-01T00:00:00.000Z"));
    const { contextChanges, sessions } = await view(harness);
    expect(contextChanges).toEqual([]);
    expect(sessions.find((s) => s.id === "manual")?.context).toBeNull();
    expect(harness.writes).toEqual([]);
  });

  test("a superseded result stays quiet", async () => {
    const harness = createMemoryHarness([
      fixtureSession("a", [{ id: "old", title: "T" }], {
        context: { commit: "abc" },
        targetContext: { commit: "zzz" },
      }),
      fixtureSession("b", [{ id: "new", title: "T" }]),
    ]);
    expect((await view(harness)).contextChanges).toHaveLength(1);
    await harness.testReview.supersede(accountId, {
      newerSessionTestId: "new",
      olderSessionTestId: "old",
      projectId,
    });
    expect((await view(harness)).contextChanges).toEqual([]);
  });

  test("never changes a review state and never creates a gap or Handoff", async () => {
    const harness = createMemoryHarness([
      fixtureSession("a", [{ id: "x", title: "T" }], {
        context: { commit: "abc" },
        reviewState: "Closed",
        targetContext: { commit: "zzz" },
      }),
    ]);
    const { sessions } = await view(harness);
    expect(sessions[0]?.reviewState).toBe("Closed");
    expect(harness.writes).toEqual([]);
  });
});

describe("Create follow-up work", () => {
  const newTarget = { mode: "new" as const };

  test("a failed, blocked or inconclusive result creates nothing by itself", async () => {
    const harness = createMemoryHarness([
      fixtureSession("a", [
        { id: "f", normalized: "failed", title: "F" },
        { id: "b", normalized: "blocked", title: "B" },
        { id: "i", normalized: "inconclusive", title: "I" },
      ]),
    ]);
    await view(harness);
    expect(harness.writes).toEqual([]);
    expect(harness.works).toEqual([]);
    expect(harness.followUpLinks).toEqual([]);
  });

  test("the preview shows target, initial values, Originates from and Origin Location, and writes nothing", async () => {
    const harness = setup();
    const preview = await harness.testReview.previewFollowUp(accountId, {
      projectId,
      sessionTestIds: ["fail"],
      target: newTarget,
    });
    expect(preview.fingerprint).toHaveLength(64);
    expect(preview.plan).toMatchObject({
      automaticRecords: "None",
      originLocation: {
        id: "fail",
        recordType: "Session Test",
        sessionId: "s2",
      },
      originatesFrom: { id: "s2", recordType: "Test Session" },
      target: {
        mode: "new",
        project: { id: projectId, name: "Project One" },
        work: { startingStatus: "Not Started", type: "Task" },
      },
    });
    expect(harness.writes).toEqual([]);
    expect(harness.works).toHaveLength(2);
  });

  test("a Supersedes relation or follow-up link added after close is New context after close", async () => {
    const harness = setup();
    const close = async (sessionId: string, sessionTestId: string) => {
      await harness.testReview.setItemReviewState(accountId, {
        projectId,
        sessionId,
        sessionTestId,
        state: "Closed",
      });
      await harness.testReview.setSessionReviewState(accountId, {
        projectId,
        sessionId,
        state: "Closed",
      });
    };
    await close("s1", "pass");
    await close("s2", "fail");
    const flags = async () => {
      const list = await view(harness);
      const item = (sessionId: string, id: string) =>
        list.sessions
          .find((session) => session.id === sessionId)
          ?.items.find((entry) => entry.id === id)?.newContextAfterClose;
      return [
        list.sessions.find((session) => session.id === "s1")
          ?.newContextAfterClose,
        item("s1", "pass"),
        item("s2", "fail"),
      ];
    };
    expect(await flags()).toEqual([false, false, false]);
    tick();
    await supersede(harness, "fail", "pass");
    expect(await flags()).toEqual([true, true, true]);

    const linked = setup();
    await linked.testReview.setItemReviewState(accountId, {
      projectId,
      sessionId: "s2",
      sessionTestId: "fail",
      state: "Closed",
    });
    tick();
    const target = { mode: "existing" as const, workId: "work-1" };
    const preview = await linked.testReview.previewFollowUp(accountId, {
      projectId,
      sessionTestIds: ["fail"],
      target,
    });
    await linked.testReview.commitFollowUp(accountId, {
      previewFingerprint: preview.fingerprint,
      projectId,
      sessionTestIds: ["fail"],
      target,
      workId: "ignored",
    });
    const list = await view(linked);
    expect(
      list.sessions
        .find((session) => session.id === "s2")
        ?.items.find((entry) => entry.id === "fail")?.newContextAfterClose,
    ).toBe(true);
  });

  test("committing creates exactly the previewed Work with the exact origin", async () => {
    const harness = setup();
    const preview = await harness.testReview.previewFollowUp(accountId, {
      projectId,
      sessionTestIds: ["fail"],
      target: { mode: "new", title: "Refund fails", workType: "Bug" },
    });
    const receipt = await harness.testReview.commitFollowUp(accountId, {
      previewFingerprint: preview.fingerprint,
      projectId,
      sessionTestIds: ["fail"],
      target: { mode: "new", title: "Refund fails", workType: "Bug" },
      workId: "work-new",
    });
    expect(receipt.outcome).toBe("applied");
    expect(receipt.links[0]).toMatchObject({
      mode: "Created",
      sessionTestId: "fail",
      workId: "work-new",
      workTitle: "Refund fails",
    });
    const created = harness.works.find((entry) => entry.id === "work-new");
    expect(created?.origin).toMatchObject({
      originComponentId: "fail",
      originOwnerRecordId: "s2",
      originSourceVersion: "case-1@2",
      type: "Bug",
    });
    expect(harness.writes).toEqual(["work", "follow-up-link"]);
    // The reported result is unchanged.
    const list = await view(harness);
    expect(
      list.sessions.find((s) => s.id === "s2")?.items[0]?.normalizedResult,
    ).toBe("failed");
  });

  test("a stale preview is refused and writes nothing", async () => {
    const harness = setup();
    const preview = await harness.testReview.previewFollowUp(accountId, {
      projectId,
      sessionTestIds: ["fail"],
      target: newTarget,
    });
    await expect(
      harness.testReview.commitFollowUp(accountId, {
        previewFingerprint: preview.fingerprint,
        projectId,
        sessionTestIds: ["fail"],
        target: { mode: "new", title: "Edited after preview" },
        workId: "work-new",
      }),
    ).rejects.toBeInstanceOf(TestReviewPreviewStaleError);
    expect(harness.writes).toEqual([]);
  });

  test("a retry with the same Work id creates nothing new", async () => {
    const harness = setup();
    const preview = await harness.testReview.previewFollowUp(accountId, {
      projectId,
      sessionTestIds: ["fail"],
      target: newTarget,
    });
    const input = {
      previewFingerprint: preview.fingerprint,
      projectId,
      sessionTestIds: ["fail"],
      target: newTarget,
      workId: "work-new",
    };
    await harness.testReview.commitFollowUp(accountId, input);
    const again = await harness.testReview.commitFollowUp(accountId, input);
    expect(again.outcome).toBe("unchanged");
    expect(
      harness.works.filter((entry) => entry.id === "work-new"),
    ).toHaveLength(1);
  });

  test("new follow-up work originates from exactly one result", async () => {
    const harness = setup();
    await expect(
      harness.testReview.previewFollowUp(accountId, {
        projectId,
        sessionTestIds: ["fail", "pass"],
        target: newTarget,
      }),
    ).rejects.toThrow();
  });

  test("several results attach to one existing Work without writing Origin or results", async () => {
    const harness = setup();
    const target = { mode: "existing" as const, workId: "work-1" };
    const preview = await harness.testReview.previewFollowUp(accountId, {
      projectId,
      sessionTestIds: ["fail", "other"],
      target,
    });
    expect(preview.plan.originatesFrom).toBeNull();
    expect(preview.plan.originLocation).toBeNull();
    expect(preview.plan.results).toHaveLength(2);
    const receipt = await harness.testReview.commitFollowUp(accountId, {
      previewFingerprint: preview.fingerprint,
      projectId,
      sessionTestIds: ["fail", "other"],
      target,
      workId: "ignored",
    });
    expect(receipt.links.map((link) => link.mode)).toEqual([
      "Attached",
      "Attached",
    ]);
    expect(receipt.links.every((link) => link.workKey === "PRJ-1")).toBe(true);
    expect(harness.writes).toEqual(["follow-up-link"]);
    const list = await view(harness);
    expect(list.followUps).toHaveLength(2);
    // Closing that İş never rewrites the results: no result is ever written.
    expect(
      list.sessions.flatMap((s) => s.items).map((i) => i.normalizedResult),
    ).not.toContain("Passed");
  });

  test("a Feature or unknown Work cannot be attached", async () => {
    const harness = setup();
    await Promise.all(
      ["feature-1", "missing"].map((workId) =>
        expect(
          harness.testReview.previewFollowUp(accountId, {
            projectId,
            sessionTestIds: ["fail"],
            target: { mode: "existing", workId },
          }),
        ).rejects.toBeInstanceOf(TestReviewRecordNotFoundError),
      ),
    );
  });

  test("follow-up work never calls Test Gap, assessment or report acceptance writers", async () => {
    const harness = setup();
    const preview = await harness.testReview.previewFollowUp(accountId, {
      projectId,
      sessionTestIds: ["fail"],
      target: newTarget,
    });
    await harness.testReview.commitFollowUp(accountId, {
      previewFingerprint: preview.fingerprint,
      projectId,
      sessionTestIds: ["fail"],
      target: newTarget,
      workId: "work-new",
    });
    const kinds = new Set(harness.writes);
    expect([...kinds].sort()).toEqual(["follow-up-link", "work"]);
  });
});

describe("Test Review access surface", () => {
  test("has no gap, handoff, assessment or delete member", () => {
    const harness = setup();
    expect(Object.keys(harness.testReview).sort()).not.toContainEqual(
      expect.stringMatching(FORBIDDEN_MEMBER),
    );
  });
});
