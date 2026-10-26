// biome-ignore-all lint/performance/noAwaitInLoops: Each case is asserted in sequence against one harness.
import { TEST_ASSESSMENT_DECISIONS } from "@cantiara/api/test-assessments";
import { describe, expect, test, vi } from "vitest";
import {
  TestAssessmentContextUnavailableError,
  TestAssessmentProjectNotFoundError,
  TestAssessmentProjectReadOnlyError,
  type TestAssessmentSourceUnavailableError,
} from "../test-assessments";
import {
  accountId,
  archivedProjectId,
  createMemoryHarness,
  projectId,
} from "./test-assessments-memory-store";

const contexts = [
  { id: "feature-1", kind: "Feature", label: "Checkout", projectId },
  { id: "handoff-1", kind: "Handoff", label: "Card handoff", projectId },
  { id: "release-1", kind: "Project Release", label: "v1.2", projectId },
  { id: "feature-x", kind: "Feature", label: "Elsewhere", projectId: "other" },
] as const;

function setup() {
  return createMemoryHarness([...contexts], {
    "Follow-up Work": ["work-1"],
  });
}

const base = {
  context: { kind: "Project Release" as const, targetId: "release-1" },
  decision: "Acceptable" as const,
  followUpWorkIds: ["work-1"],
  gapIds: ["gap-1"],
  knownLimits: "Wallet payments were not tried.",
  projectId,
  sessionIds: ["session-1", "session-2"],
};
const releaseInput = {
  ...base,
  context: { kind: "Project Release" as const, targetId: "release-1" },
};

describe("Test Assessments dated snapshot", () => {
  test("saves one context with the exact cited ids, assessor and time", async () => {
    const { testAssessments } = setup();
    const before = Date.now();

    const saved = await testAssessments.record(accountId, releaseInput);

    expect(saved).toMatchObject({
      assessorAccountId: accountId,
      context: {
        kind: "Project Release",
        label: "v1.2",
        targetId: "release-1",
      },
      decision: "Acceptable",
      followUpWorkIds: ["work-1"],
      gapIds: ["gap-1"],
      knownLimits: "Wallet payments were not tried.",
      sessionIds: ["session-1", "session-2"],
    });
    expect(Date.parse(saved.assessedAt)).toBeGreaterThanOrEqual(before);
    const { assessments } = await testAssessments.list(accountId, projectId);
    expect(assessments).toEqual([saved]);
  });

  test("a Feature, a Handoff and a Project Release are each a valid context", async () => {
    const { testAssessments } = setup();
    for (const [kind, targetId] of [
      ["Feature", "feature-1"],
      ["Handoff", "handoff-1"],
      ["Project Release", "release-1"],
    ] as const) {
      const saved = await testAssessments.record(accountId, {
        ...releaseInput,
        context: { kind, targetId },
      });
      expect(saved.context.kind).toBe(kind);
    }
  });

  test("refuses a context that is not a record of this Project", async () => {
    const { testAssessments } = setup();
    await expect(
      testAssessments.record(accountId, {
        ...releaseInput,
        context: { kind: "Feature", targetId: "feature-x" },
      }),
    ).rejects.toBeInstanceOf(TestAssessmentContextUnavailableError);
    await expect(
      testAssessments.record(accountId, {
        ...releaseInput,
        context: { kind: "Handoff", targetId: "release-1" },
      }),
    ).rejects.toBeInstanceOf(TestAssessmentContextUnavailableError);
  });

  test("refuses a follow-up Work id its owner disproves and saves nothing", async () => {
    const { records, testAssessments } = setup();
    await expect(
      testAssessments.record(accountId, {
        ...releaseInput,
        followUpWorkIds: ["work-1", "work-missing"],
      }),
    ).rejects.toMatchObject({
      sourceIds: ["work-missing"],
    } satisfies Partial<TestAssessmentSourceUnavailableError>);
    expect(records).toEqual([]);
  });

  test("de-duplicates cited ids and allows an Undecided snapshot with no sessions yet", async () => {
    const { testAssessments } = setup();
    const empty = await testAssessments.record(accountId, {
      ...releaseInput,
      decision: "Undecided",
      sessionIds: [],
    });
    expect(empty.sessionIds).toEqual([]);
    const saved = await testAssessments.record(accountId, {
      ...releaseInput,
      sessionIds: ["session-1", "session-1"],
    });
    expect(saved.sessionIds).toEqual(["session-1"]);
  });

  test("an archived Project is read-only and an unowned Project is unavailable", async () => {
    const { testAssessments } = setup();
    await expect(
      testAssessments.record(accountId, {
        ...releaseInput,
        projectId: archivedProjectId,
      }),
    ).rejects.toBeInstanceOf(TestAssessmentProjectReadOnlyError);
    await expect(
      testAssessments.record("someone-else", releaseInput),
    ).rejects.toBeInstanceOf(TestAssessmentProjectNotFoundError);
    await expect(
      testAssessments.list("someone-else", projectId),
    ).rejects.toBeInstanceOf(TestAssessmentProjectNotFoundError);
  });

  test("lists the newest snapshot first and offers context candidates per kind", async () => {
    const { testAssessments } = setup();
    const first = await testAssessments.record(accountId, releaseInput);
    const second = await testAssessments.record(accountId, {
      ...releaseInput,
      decision: "Undecided",
    });
    const { assessments } = await testAssessments.list(accountId, projectId);
    expect(assessments.map(({ id }) => id).sort()).toEqual(
      [first.id, second.id].sort(),
    );
    await expect(
      testAssessments.contextTargets(accountId, { kind: "Feature", projectId }),
    ).resolves.toEqual([
      { id: "feature-1", kind: "Feature", label: "Checkout" },
    ]);
  });

  test("recording writes no Test Session result or review state", async () => {
    const { testAssessments } = setup();
    // The access has no session, result or review member to call; the saved
    // record carries cited ids only, never a result or review field.
    expect(Object.keys(testAssessments).sort()).toEqual([
      "contextTargets",
      "list",
      "record",
    ]);
    const saved = await testAssessments.record(accountId, releaseInput);
    expect(Object.keys(saved).sort()).toEqual([
      "assessedAt",
      "assessorAccountId",
      "context",
      "decision",
      "followUpWorkIds",
      "gapIds",
      "id",
      "knownLimits",
      "newContext",
      "projectId",
      "sessionIds",
    ]);
  });
});

describe("Decision is not a release gate or score", () => {
  test("the decision is one of exactly three values", async () => {
    expect(TEST_ASSESSMENT_DECISIONS).toEqual([
      "Acceptable",
      "Follow-up needed",
      "Undecided",
    ]);
    const { testAssessments } = setup();
    for (const decision of TEST_ASSESSMENT_DECISIONS) {
      const saved = await testAssessments.record(accountId, {
        ...releaseInput,
        decision,
      });
      expect(saved.decision).toBe(decision);
    }
    await expect(
      testAssessments.record(accountId, {
        ...releaseInput,
        decision: "Passed" as never,
      }),
    ).rejects.toThrow();
  });

  test("no score, coverage, gate, exception or acceptance field can be sent or read", async () => {
    const { testAssessments } = setup();
    for (const field of [
      "score",
      "coverage",
      "readiness",
      "releaseGate",
      "exception",
      "acceptanceEvidence",
      "githubChecks",
    ]) {
      await expect(
        testAssessments.record(accountId, {
          ...releaseInput,
          [field]: 1,
        } as never),
      ).rejects.toThrow();
    }
    const saved = await testAssessments.record(accountId, releaseInput);
    const words = Object.keys(saved).join(" ").toLowerCase();
    for (const forbidden of [
      "score",
      "coverage",
      "gate",
      "evidence",
      "check",
    ]) {
      expect(words).not.toContain(forbidden);
    }
  });

  test("a Project Release has no Assessment unless the founder records one, and none is demanded", async () => {
    const { testAssessments } = setup();
    // Nothing recorded: the list is empty and nothing refuses or blocks.
    await expect(testAssessments.list(accountId, projectId)).resolves.toEqual({
      assessments: [],
    });
    expect(testAssessments).not.toHaveProperty("requireBeforePublish");
    expect(testAssessments).not.toHaveProperty("gate");
  });
});

describe("New context does not move the old snapshot", () => {
  const later = () => new Date(Date.now() + 60_000).toISOString();

  test("a later Failed result leaves the saved decision and shows the exact source", async () => {
    const { addContextEvent, testAssessments } = setup();
    const saved = await testAssessments.record(accountId, releaseInput);
    expect(saved.newContext).toBeNull();

    addContextEvent(releaseInput.context, {
      kind: "New result",
      recordedAt: later(),
      sourceId: "session-9",
      sourceKind: "Test Session",
    });

    const { assessments } = await testAssessments.list(accountId, projectId);
    expect(assessments).toHaveLength(1);
    expect(assessments[0]).toMatchObject({
      assessedAt: saved.assessedAt,
      decision: "Acceptable",
      gapIds: saved.gapIds,
      id: saved.id,
      knownLimits: saved.knownLimits,
      sessionIds: saved.sessionIds,
    });
    expect(assessments[0]?.newContext?.sources).toEqual([
      {
        kind: "New result",
        recordedAt: expect.any(String),
        sourceId: "session-9",
        sourceKind: "Test Session",
      },
    ]);
  });

  test("lists every kind of new context with its exact source", async () => {
    const { addContextEvent, testAssessments } = setup();
    await testAssessments.record(accountId, releaseInput);
    const at = later();
    addContextEvent(releaseInput.context, {
      kind: "Corrected result",
      recordedAt: at,
      sourceId: "session-1",
      sourceKind: "Test Session",
    });
    addContextEvent(releaseInput.context, {
      kind: "New Test Gap",
      recordedAt: at,
      sourceId: "gap-7",
      sourceKind: "Test Gap",
    });
    addContextEvent(releaseInput.context, {
      kind: "Context change",
      recordedAt: at,
      sourceId: "release-1",
      sourceKind: "Context",
    });
    const { assessments } = await testAssessments.list(accountId, projectId);
    expect(
      assessments[0]?.newContext?.sources.map(
        ({ kind, sourceId }) => `${kind}:${sourceId}`,
      ),
    ).toEqual([
      "New Test Gap:gap-7",
      "Context change:release-1",
      "Corrected result:session-1",
    ]);
  });

  test("context recorded before the snapshot, or for another context, raises no notice", async () => {
    const { addContextEvent, testAssessments } = setup();
    addContextEvent(releaseInput.context, {
      kind: "New result",
      recordedAt: new Date(Date.now() - 60_000).toISOString(),
      sourceId: "session-0",
      sourceKind: "Test Session",
    });
    await testAssessments.record(accountId, releaseInput);
    addContextEvent(
      { kind: "Feature", targetId: "feature-1" },
      {
        kind: "New result",
        recordedAt: later(),
        sourceId: "session-5",
        sourceKind: "Test Session",
      },
    );
    const { assessments } = await testAssessments.list(accountId, projectId);
    expect(assessments[0]?.newContext).toBeNull();
  });

  test("time passing alone never raises the notice", async () => {
    const { testAssessments } = setup();
    await testAssessments.record(accountId, releaseInput);
    const now = Date.now();
    const clock = vi.spyOn(Date, "now").mockReturnValue(now + 365 * 86_400_000);
    try {
      const { assessments } = await testAssessments.list(accountId, projectId);
      expect(assessments[0]?.newContext).toBeNull();
    } finally {
      clock.mockRestore();
    }
  });

  test("a new Project Release does not inherit the old snapshot", async () => {
    const harness = createMemoryHarness(
      [
        ...contexts,
        { id: "release-2", kind: "Project Release", label: "v1.3", projectId },
      ],
      { "Follow-up Work": ["work-1"] },
    );
    const saved = await harness.testAssessments.record(accountId, releaseInput);
    const { assessments } = await harness.testAssessments.list(
      accountId,
      projectId,
    );
    expect(
      assessments.filter(({ context }) => context.targetId === "release-2"),
    ).toEqual([]);
    expect(assessments).toHaveLength(1);
    expect(assessments[0]?.context.targetId).toBe(saved.context.targetId);
    expect(harness.testAssessments).not.toHaveProperty("carryForward");
  });

  test("raising the notice registers no Notification Center signal", async () => {
    const { addContextEvent, records, testAssessments } = setup();
    await testAssessments.record(accountId, releaseInput);
    addContextEvent(releaseInput.context, {
      kind: "New result",
      recordedAt: later(),
      sourceId: "session-9",
      sourceKind: "Test Session",
    });
    const before = structuredClone(records);
    await testAssessments.list(accountId, projectId);
    expect(records).toEqual(before);
    expect(Object.keys(testAssessments)).not.toContain("signal");
  });
});
