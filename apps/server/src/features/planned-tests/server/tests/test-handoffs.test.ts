// biome-ignore-all lint/performance/noAwaitInLoops: Each state is driven in sequence against one Handoff.
import {
  TEST_HANDOFF_STATES,
  TEST_HANDOFF_TRANSITIONS,
  type TestHandoffState,
} from "@cantiara/api/planned-tests";
import {
  testHandoff,
  testHandoffScenario,
  testHandoffSessionTest,
} from "@cantiara/db/schema/planned-test";
import { workExternalExecutionHandoff } from "@cantiara/db/schema/work-external-handoff";
import { getTableColumns, getTableName } from "drizzle-orm";
import { describe, expect, test } from "vitest";

import {
  PlannedTestCaseNotFoundError,
  PlannedTestProjectNotFoundError,
  PlannedTestProjectReadOnlyError,
  PlannedTestVersionNotFoundError,
  SessionTestAlreadyInHandoffError,
  SessionTestNotFoundError,
  TestHandoffLockedError,
  TestHandoffNotFoundError,
  TestHandoffScopeMismatchError,
  TestHandoffStateConflictError,
  TestHandoffTransitionError,
} from "../planned-tests";
import {
  accountId,
  archivedProjectId,
  createMemoryHarness,
  projectId,
} from "../planned-tests-memory-store";

const RESULT_WORDS =
  /\b(pass(ed)?|fail(ed)?|valid(ated)?|green|red|success)\b/i;
const RUNNER_VERBS =
  /start|run|poll|schedul|execut|dispatch|trigger|cancel|deliver|send|retry/i;
const HANDOFF_WORD = /handoff/i;
const WORK_HANDOFF_COLUMN = /work|return|reconcil|result|outcome|run|status/;
const HANDOFF_TABLE_PREFIX = /^project_test_handoff_/;

const definition = {
  expectedBehavior: "The order is confirmed and a receipt is shown.",
  preconditions: "A signed-in customer with one item in the cart.",
  purpose: "Confirm checkout completes.",
  scope: "Card payment only; no coupons.",
  title: "Checkout with a saved card",
};

async function setup() {
  const harness = createMemoryHarness();
  const created = await harness.plannedTests.create(accountId, {
    ...definition,
    projectId,
  });
  return { ...harness, caseId: created.id };
}

type Harness = Awaited<ReturnType<typeof setup>>;

function openHandoff(harness: Harness, overrides: object = {}) {
  return harness.plannedTests.createHandoff(accountId, {
    projectId,
    purpose: "Check the checkout flow on the staging build.",
    scenarios: [{ caseId: harness.caseId, version: 1 }],
    title: "Checkout regression, round 1",
    ...overrides,
  });
}

/** Walks the founder-driven path to a state. */
const PATH: Record<TestHandoffState, TestHandoffState[]> = {
  Canceled: ["Canceled"],
  Closed: ["Ready to share", "Shared", "Closed"],
  Draft: [],
  "Ready to share": ["Ready to share"],
  "Result received": ["Ready to share", "Shared", "Result received"],
  Shared: ["Ready to share", "Shared"],
};

async function reach(harness: Harness, target: TestHandoffState) {
  let handoff = await openHandoff(harness);
  for (const to of PATH[target]) {
    handoff = await harness.plannedTests.transitionHandoff(accountId, {
      expectedState: handoff.state,
      handoffId: handoff.id,
      projectId,
      to,
    });
  }
  if (handoff.state !== target) {
    throw new Error(`Expected ${target}, got ${handoff.state}.`);
  }
  return handoff;
}

function arrive(harness: Harness, bound = true) {
  return harness.plannedTests.recordSessionTest(
    accountId,
    bound
      ? {
          binding: { caseId: harness.caseId, version: 1 },
          projectId,
          title: "Pay with the saved card",
        }
      : {
          expectedBehavior: "Tax is shown.",
          projectId,
          purpose: "Check tax display.",
          title: "Tax line",
        },
  );
}

describe("Test Handoff carries the requested external test work", () => {
  test("opens as a Draft with the exact selected versions and founder-typed context", async () => {
    const harness = await setup();
    const handoff = await openHandoff(harness, {
      buildContext: {
        branch: "main",
        commit: "abc1234",
        repository: "https://github.com/acme/shop",
        targetEnvironment: "staging",
      },
      dueDate: "2026-11-02",
      targetExecutor: "Playwright cloud runner",
    });

    expect(handoff).toMatchObject({
      allowedTransitions: ["Ready to share", "Canceled"],
      buildContext: {
        branch: "main",
        build: null,
        commit: "abc1234",
        repository: "https://github.com/acme/shop",
        targetEnvironment: "staging",
      },
      dueDate: "2026-11-02",
      editable: true,
      packageVersion: 0,
      purpose: "Check the checkout flow on the staging build.",
      scenarios: [
        {
          caseId: harness.caseId,
          summary: "Pinned to v1, current",
          title: "Checkout with a saved card",
          version: 1,
        },
      ],
      sessionTests: [],
      state: "Draft",
      suggestion: null,
      targetExecutor: "Playwright cloud runner",
      title: "Checkout regression, round 1",
    });
    expect(
      (await harness.plannedTests.handoffs(accountId, projectId)).handoffs,
    ).toHaveLength(1);
  });

  test("a Document section deleted after the selection reads as gone while the reference stays exact", async () => {
    const harness = await setup();
    harness.catalog.set("Document:doc-1", {
      documentRevision: 2,
      label: "Checkout spec",
      projectId,
      sections: [{ id: "s1", label: "Payment" }],
      targetId: "doc-1",
      targetType: "Document",
    });
    await openHandoff(harness, {
      contextRefs: [
        {
          documentRevision: 2,
          kind: "Document",
          sectionId: "s1",
          targetId: "doc-1",
        },
      ],
    });

    const [pinned] = (await harness.plannedTests.handoffs(accountId, projectId))
      .handoffs;
    expect(pinned?.contextRefs[0]).toEqual({
      documentRevision: 2,
      kind: "Document",
      sectionId: "s1",
      targetId: "doc-1",
      brokenReason: null,
      label: "Checkout spec",
      sectionLabel: "Payment",
    });

    // The founder deletes the section, not the document.
    const entry = harness.catalog.get("Document:doc-1");
    if (entry) {
      entry.sections = [];
    }
    const [stillThere] = (
      await harness.plannedTests.handoffs(accountId, projectId)
    ).handoffs;
    expect(stillThere?.contextRefs[0]).toEqual({
      documentRevision: 2,
      kind: "Document",
      sectionId: "s1",
      targetId: "doc-1",
      brokenReason: null,
      label: "Checkout spec",
      sectionLabel: null,
    });
  });

  test("target executor is free text and optional, due date is optional", async () => {
    const harness = await setup();
    for (const executor of ["Me", "Codex", "Claude Code", "Conductor"]) {
      const handoff = await openHandoff(harness, { targetExecutor: executor });
      expect(handoff.targetExecutor).toBe(executor);
    }
    const bare = await openHandoff(harness, { scenarios: [] });
    expect(bare).toMatchObject({
      dueDate: null,
      scenarios: [],
      targetExecutor: null,
    });
  });

  test("a version difference stays visible when the case moves on", async () => {
    const harness = await setup();
    const handoff = await openHandoff(harness);
    await harness.plannedTests.createVersion(accountId, {
      ...definition,
      caseId: harness.caseId,
      changeKind: "Meaningful change",
      expectedVersion: 1,
      projectId,
      scope: "Card and wallet payment.",
    });

    const [listed] = (await harness.plannedTests.handoffs(accountId, projectId))
      .handoffs;
    expect(listed?.id).toBe(handoff.id);
    expect(listed?.scenarios[0]).toMatchObject({
      currentVersion: 2,
      summary: "Pinned to v1, current v2",
      version: 1,
    });
  });

  test("selects only exact existing versions of this Project, never latest", async () => {
    const harness = await setup();
    await expect(
      openHandoff(harness, {
        scenarios: [{ caseId: harness.caseId, version: 9 }],
      }),
    ).rejects.toBeInstanceOf(PlannedTestVersionNotFoundError);
    await expect(
      openHandoff(harness, { scenarios: [{ caseId: "unknown", version: 1 }] }),
    ).rejects.toBeInstanceOf(PlannedTestCaseNotFoundError);
    // A version-less selection has no "latest" meaning.
    await expect(
      openHandoff(harness, { scenarios: [{ caseId: harness.caseId }] }),
    ).rejects.toThrow();
    await expect(
      openHandoff(harness, {
        scenarios: [
          { caseId: harness.caseId, version: 1 },
          { caseId: harness.caseId, version: 1 },
        ],
      }),
    ).rejects.toThrow();
    expect(
      (await harness.plannedTests.handoffs(accountId, projectId)).handoffs,
    ).toHaveLength(0);
  });

  test("refuses a case version that belongs to another Project", async () => {
    const harness = await setup();
    const other = harness.cases.get(harness.caseId);
    if (!other) {
      throw new Error("missing case");
    }
    harness.cases.set(harness.caseId, { ...other, projectId: "elsewhere" });
    await expect(openHandoff(harness)).rejects.toBeInstanceOf(
      PlannedTestCaseNotFoundError,
    );
  });

  test("refuses unsafe build context and invalid dates", async () => {
    const harness = await setup();
    for (const buildContext of [
      { repository: "https://token@github.com/acme/shop" },
      { targetEnvironment: "https://staging.example.com/?token=abc" },
      { build: "ftp://example.com/build" },
    ]) {
      await expect(openHandoff(harness, { buildContext })).rejects.toThrow();
    }
    await expect(
      openHandoff(harness, { dueDate: "2026-02-31" }),
    ).rejects.toThrow();
    await expect(
      openHandoff(harness, { buildContext: { runner: "ci" } }),
    ).rejects.toThrow();
  });

  test("keeps Projects separate and read-only for an archived Project", async () => {
    const harness = await setup();
    await expect(
      harness.plannedTests.handoffs(accountId, "elsewhere"),
    ).rejects.toBeInstanceOf(PlannedTestProjectNotFoundError);
    await expect(
      harness.plannedTests.createHandoff(accountId, {
        projectId: archivedProjectId,
        purpose: "p",
        title: "t",
      }),
    ).rejects.toBeInstanceOf(PlannedTestProjectReadOnlyError);
    expect(
      (await harness.plannedTests.handoffs(accountId, archivedProjectId))
        .readOnly,
    ).toBe(true);
  });

  test("the same cases go to different executors as separate Handoffs", async () => {
    const harness = await setup();
    const first = await openHandoff(harness, { targetExecutor: "Codex" });
    const second = await openHandoff(harness, { targetExecutor: "Conductor" });
    await arrive(harness).then((sessionTest) =>
      harness.plannedTests.linkHandoffSessionTest(accountId, {
        handoffId: first.id,
        projectId,
        sessionTestId: sessionTest.id,
      }),
    );

    const listed = (await harness.plannedTests.handoffs(accountId, projectId))
      .handoffs;
    expect(listed.find(({ id }) => id === first.id)?.sessionTests).toHaveLength(
      1,
    );
    expect(
      listed.find(({ id }) => id === second.id)?.sessionTests,
    ).toHaveLength(0);
    expect(first.id).not.toBe(second.id);
  });
});

describe("Test Handoff states describe the process, not a test result", () => {
  test("the six process states are exactly the spec labels", () => {
    expect([...TEST_HANDOFF_STATES]).toEqual([
      "Draft",
      "Ready to share",
      "Shared",
      "Result received",
      "Closed",
      "Canceled",
    ]);
    expect(TEST_HANDOFF_STATES.some((state) => RESULT_WORDS.test(state))).toBe(
      false,
    );
  });

  test("every allowed move is accepted and every other move is refused", async () => {
    const harness = await setup();
    for (const from of TEST_HANDOFF_STATES) {
      for (const to of TEST_HANDOFF_STATES) {
        const handoff = await reach(harness, from);
        const attempt = harness.plannedTests.transitionHandoff(accountId, {
          expectedState: from,
          handoffId: handoff.id,
          projectId,
          to,
        });
        if (TEST_HANDOFF_TRANSITIONS[from].includes(to)) {
          await expect(attempt).resolves.toMatchObject({ state: to });
        } else {
          await expect(attempt).rejects.toBeInstanceOf(
            TestHandoffTransitionError,
          );
          expect(
            (
              await harness.plannedTests.handoffs(accountId, projectId)
            ).handoffs.find(({ id }) => id === handoff.id)?.state,
          ).toBe(from);
        }
      }
    }
  });

  test("the transition table matches the process", () => {
    expect(TEST_HANDOFF_TRANSITIONS).toEqual({
      Canceled: [],
      Closed: [],
      Draft: ["Ready to share", "Canceled"],
      "Ready to share": ["Draft", "Shared", "Canceled"],
      "Result received": ["Shared", "Closed"],
      Shared: ["Result received", "Closed", "Canceled"],
    });
  });

  test("Closed and Canceled are final", async () => {
    const harness = await setup();
    for (const final of ["Closed", "Canceled"] as const) {
      const handoff = await reach(harness, final);
      expect(handoff.allowedTransitions).toEqual([]);
      await expect(
        harness.plannedTests.transitionHandoff(accountId, {
          expectedState: final,
          handoffId: handoff.id,
          projectId,
          to: "Draft",
        }),
      ).rejects.toBeInstanceOf(TestHandoffTransitionError);
    }
  });

  test("a stale click is refused instead of overwriting a newer state", async () => {
    const harness = await setup();
    const handoff = await openHandoff(harness);
    await harness.plannedTests.transitionHandoff(accountId, {
      expectedState: "Draft",
      handoffId: handoff.id,
      projectId,
      to: "Ready to share",
    });
    await expect(
      harness.plannedTests.transitionHandoff(accountId, {
        expectedState: "Draft",
        handoffId: handoff.id,
        projectId,
        to: "Canceled",
      }),
    ).rejects.toBeInstanceOf(TestHandoffStateConflictError);
  });

  test("an unknown Handoff or a state outside the six is refused", async () => {
    const harness = await setup();
    await expect(
      harness.plannedTests.transitionHandoff(accountId, {
        expectedState: "Draft",
        handoffId: "missing",
        projectId,
        to: "Ready to share",
      }),
    ).rejects.toBeInstanceOf(TestHandoffNotFoundError);
    const handoff = await openHandoff(harness);
    await expect(
      harness.plannedTests.transitionHandoff(accountId, {
        expectedState: "Draft",
        handoffId: handoff.id,
        projectId,
        to: "Passed" as TestHandoffState,
      }),
    ).rejects.toThrow();
  });

  test("content is editable until shared, then it is history", async () => {
    const harness = await setup();
    const handoff = await openHandoff(harness);
    const edited = await harness.plannedTests.updateHandoff(accountId, {
      buildContext: { branch: "release/2" },
      dueDate: "2026-12-01",
      handoffId: handoff.id,
      projectId,
      purpose: "Narrowed scope.",
      scenarios: [],
      targetExecutor: "Codex",
      title: "Checkout regression, round 1",
    });
    expect(edited).toMatchObject({
      buildContext: { branch: "release/2", commit: null },
      dueDate: "2026-12-01",
      purpose: "Narrowed scope.",
      scenarios: [],
      state: "Draft",
      targetExecutor: "Codex",
    });

    await harness.plannedTests.transitionHandoff(accountId, {
      expectedState: "Draft",
      handoffId: handoff.id,
      projectId,
      to: "Ready to share",
    });
    await expect(
      harness.plannedTests.updateHandoff(accountId, {
        handoffId: handoff.id,
        projectId,
        purpose: "Still editable.",
        title: "Round 1",
      }),
    ).resolves.toMatchObject({ purpose: "Still editable." });

    await harness.plannedTests.transitionHandoff(accountId, {
      expectedState: "Ready to share",
      handoffId: handoff.id,
      projectId,
      to: "Shared",
    });
    await expect(
      harness.plannedTests.updateHandoff(accountId, {
        handoffId: handoff.id,
        projectId,
        purpose: "Rewritten after sharing.",
        title: "Round 1",
      }),
    ).rejects.toBeInstanceOf(TestHandoffLockedError);
  });

  test("editing never moves the package version counter", async () => {
    const harness = await setup();
    const handoff = await openHandoff(harness);
    await harness.plannedTests.updateHandoff(accountId, {
      handoffId: handoff.id,
      projectId,
      purpose: "Edited.",
      title: "Edited",
    });
    expect(
      (await harness.plannedTests.handoffs(accountId, projectId)).handoffs[0]
        ?.packageVersion,
    ).toBe(0);
  });
});

describe("a linked Session Test only suggests Result received", () => {
  test("a report on a Shared Handoff suggests Result received and changes nothing", async () => {
    const harness = await setup();
    const handoff = await reach(harness, "Shared");
    const sessionTest = await arrive(harness);

    const linked = await harness.plannedTests.linkHandoffSessionTest(
      accountId,
      { handoffId: handoff.id, projectId, sessionTestId: sessionTest.id },
    );

    expect(linked.state).toBe("Shared");
    expect(linked.stateChangedAt).toBe(handoff.stateChangedAt);
    expect(linked.sessionTests).toHaveLength(1);
    expect(linked.suggestion).toMatchObject({ state: "Result received" });
    expect(linked.suggestion?.reason).toContain("stays open");
  });

  test("no suggestion before sharing or without a linked report", async () => {
    const harness = await setup();
    const shared = await reach(harness, "Shared");
    expect(shared.suggestion).toBeNull();
    const draft = await openHandoff(harness);
    const sessionTest = await arrive(harness);
    const linked = await harness.plannedTests.linkHandoffSessionTest(
      accountId,
      { handoffId: draft.id, projectId, sessionTestId: sessionTest.id },
    );
    expect(linked.state).toBe("Draft");
    expect(linked.suggestion).toBeNull();
  });

  test("never auto-closes or auto-advances at any state, however many reports arrive", async () => {
    const harness = await setup();
    for (const target of TEST_HANDOFF_STATES) {
      const handoff = await reach(harness, target);
      for (const bound of [true, false, true]) {
        const sessionTest = await arrive(harness, bound);
        const linked = await harness.plannedTests.linkHandoffSessionTest(
          accountId,
          { handoffId: handoff.id, projectId, sessionTestId: sessionTest.id },
        );
        expect(linked.state).toBe(target);
        expect(linked.stateChangedAt).toBe(handoff.stateChangedAt);
      }
      const [reread] = (
        await harness.plannedTests.handoffs(accountId, projectId)
      ).handoffs.filter(({ id }) => id === handoff.id);
      expect(reread?.state).toBe(target);
      expect(reread?.sessionTests).toHaveLength(3);
      // The suggestion exists only as a suggestion on Shared.
      expect(reread?.suggestion !== null).toBe(target === "Shared");
    }
  });

  test("Result received is reached only by the founder's explicit move", async () => {
    const harness = await setup();
    const handoff = await reach(harness, "Shared");
    const sessionTest = await arrive(harness);
    await harness.plannedTests.linkHandoffSessionTest(accountId, {
      handoffId: handoff.id,
      projectId,
      sessionTestId: sessionTest.id,
    });
    const accepted = await harness.plannedTests.transitionHandoff(accountId, {
      expectedState: "Shared",
      handoffId: handoff.id,
      projectId,
      to: "Result received",
    });
    expect(accepted.state).toBe("Result received");
    expect(accepted.suggestion).toBeNull();
    expect(accepted.allowedTransitions).toEqual(["Shared", "Closed"]);
  });

  test("a late report on a Canceled Handoff is linked without reopening it", async () => {
    const harness = await setup();
    const handoff = await reach(harness, "Canceled");
    const sessionTest = await arrive(harness);
    const linked = await harness.plannedTests.linkHandoffSessionTest(
      accountId,
      { handoffId: handoff.id, projectId, sessionTestId: sessionTest.id },
    );
    expect(linked).toMatchObject({
      allowedTransitions: [],
      resultAfterCancel: true,
      state: "Canceled",
      suggestion: null,
    });
  });

  test("a bound Session Test must belong to a selected exact version", async () => {
    const harness = await setup();
    const second = await harness.plannedTests.create(accountId, {
      ...definition,
      projectId,
      title: "Refund",
    });
    const handoff = await openHandoff(harness);
    const stray = await harness.plannedTests.recordSessionTest(accountId, {
      binding: { caseId: second.id, version: 1 },
      projectId,
      title: "Refund path",
    });
    await harness.plannedTests.createVersion(accountId, {
      ...definition,
      caseId: harness.caseId,
      changeKind: "Meaningful change",
      expectedVersion: 1,
      projectId,
      scope: "Changed.",
    });
    const onV2 = await harness.plannedTests.recordSessionTest(accountId, {
      binding: { caseId: harness.caseId, version: 2 },
      projectId,
      title: "Checkout v2",
    });

    for (const sessionTest of [stray, onV2]) {
      await expect(
        harness.plannedTests.linkHandoffSessionTest(accountId, {
          handoffId: handoff.id,
          projectId,
          sessionTestId: sessionTest.id,
        }),
      ).rejects.toBeInstanceOf(TestHandoffScopeMismatchError);
    }
    const adHoc = await arrive(harness, false);
    await expect(
      harness.plannedTests.linkHandoffSessionTest(accountId, {
        handoffId: handoff.id,
        projectId,
        sessionTestId: adHoc.id,
      }),
    ).resolves.toMatchObject({ sessionTests: [{ id: adHoc.id }] });
  });

  test("a Session Test arrives on one Handoff only and unknown ids are refused", async () => {
    const harness = await setup();
    const first = await openHandoff(harness);
    const second = await openHandoff(harness);
    const sessionTest = await arrive(harness);
    const link = (handoffId: string, sessionTestId: string) =>
      harness.plannedTests.linkHandoffSessionTest(accountId, {
        handoffId,
        projectId,
        sessionTestId,
      });
    await link(first.id, sessionTest.id);

    await expect(link(second.id, sessionTest.id)).rejects.toBeInstanceOf(
      SessionTestAlreadyInHandoffError,
    );
    await expect(link(first.id, sessionTest.id)).rejects.toBeInstanceOf(
      SessionTestAlreadyInHandoffError,
    );
    await expect(link("missing", sessionTest.id)).rejects.toBeInstanceOf(
      TestHandoffNotFoundError,
    );
    await expect(link(first.id, "missing")).rejects.toBeInstanceOf(
      SessionTestNotFoundError,
    );
  });
});

describe("Test Handoff is not a runner and not an external execution handoff", () => {
  test("the access has no start, run, poll, schedule, cancel or deliver operation", async () => {
    const harness = await setup();
    const members = Object.keys(harness.plannedTests);
    expect(members.filter((name) => RUNNER_VERBS.test(name))).toEqual([]);
    expect(members.filter((name) => HANDOFF_WORD.test(name)).sort()).toEqual([
      "createHandoff",
      "handoffs",
      "linkHandoffSessionTest",
      "transitionHandoff",
      "updateHandoff",
    ]);
  });

  test("Canceled is a local process state and reaches no external tool", async () => {
    const harness = await setup();
    const handoff = await reach(harness, "Canceled");
    expect(handoff).toMatchObject({ editable: false, state: "Canceled" });
    expect(handoff).not.toHaveProperty("externalRunId");
  });

  test("a Test Handoff is not a Session Test and does not appear as one", async () => {
    const harness = await setup();
    await openHandoff(harness);
    expect(
      (await harness.plannedTests.sessionTests(accountId, projectId))
        .sessionTests,
    ).toEqual([]);
  });

  test("a Handoff holds no result column and no Work external handoff data", async () => {
    const harness = await setup();
    const handoff = await openHandoff(harness);
    for (const key of [
      "result",
      "results",
      "outcome",
      "status",
      "workId",
      "returnRecord",
      "reconciled",
    ]) {
      expect(handoff).not.toHaveProperty(key);
    }
  });
});

describe("Test Handoff storage is separate from Work's external handoff", () => {
  test("its tables carry no Work, return, reconcile or result column", () => {
    const columns = Object.values(getTableColumns(testHandoff)).map(
      ({ name }) => name,
    );
    expect(columns).toEqual(
      expect.arrayContaining([
        "package_version",
        "state",
        "target_executor",
        "due_date",
      ]),
    );
    expect(columns.filter((name) => WORK_HANDOFF_COLUMN.test(name))).toEqual(
      [],
    );
    expect(getTableName(testHandoff)).not.toBe(
      getTableName(workExternalExecutionHandoff),
    );
    for (const table of [testHandoffScenario, testHandoffSessionTest]) {
      expect(getTableName(table)).toMatch(HANDOFF_TABLE_PREFIX);
    }
  });
});
