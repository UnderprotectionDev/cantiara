// biome-ignore-all lint/performance/noAwaitInLoops: Each refusal case is asserted in sequence against one store.
import { describe, expect, test } from "vitest";
import { ZodError } from "zod";
import {
  accountId,
  archivedProjectId,
  projectId,
} from "../../../planned-tests/server/planned-tests-memory-store";
import {
  TestGapCaseVersionNotFoundError,
  TestGapClosedError,
  TestGapDecisionUnavailableError,
  TestGapHandoffNotFoundError,
  TestGapNotFoundError,
  TestGapProjectNotFoundError,
  TestGapProjectReadOnlyError,
  TestGapRelationTargetError,
  TestGapSessionTestNotFoundError,
  TestGapStateConflictError,
} from "../test-gaps";
import { createGapHarness } from "../test-gaps-memory-store";

const catalog = [
  {
    label: "Coupon redemption",
    projectId,
    targetId: "f1",
    targetType: "Feature",
  },
  { label: "Fix tax rounding", projectId, targetId: "w1", targetType: "Work" },
  { label: "Double charge", projectId, targetId: "r1", targetType: "Risk" },
  {
    documentRevision: 3,
    label: "Checkout spec",
    projectId,
    sections: [{ id: "s1", label: "Coupons" }],
    targetId: "d1",
    targetType: "Document",
  },
  {
    label: "Release 1.0",
    projectId,
    targetId: "pr1",
    targetType: "Project Release",
  },
  {
    label: "Other project Risk",
    projectId: "project-other",
    targetId: "r9",
    targetType: "Risk",
  },
] as const;

function setup() {
  return createGapHarness(structuredClone([...catalog]) as never);
}

const gapFixture = {
  projectId,
  rationale: "Coupon stacking was never tried on mobile.",
  title: "Mobile coupon stacking untested",
};

describe("Test Gap record", () => {
  test("is filed by hand with title, rationale and support relations of every family", async () => {
    const { testGaps } = setup();

    const created = await testGaps.create(accountId, {
      ...gapFixture,
      relations: [
        { targetId: "f1", targetType: "Feature" },
        { targetId: "w1", targetType: "Work" },
        { targetId: "r1", targetType: "Risk" },
        {
          documentRevision: 3,
          sectionId: "s1",
          targetId: "d1",
          targetType: "Document",
        },
        { targetId: "pr1", targetType: "Project Release" },
      ],
    });

    expect(created).toMatchObject({
      projectId,
      rationale: gapFixture.rationale,
      title: gapFixture.title,
    });
    expect(
      created.relations.map(({ label, state, targetType }) => [
        targetType,
        label,
        state,
      ]),
    ).toEqual([
      ["Feature", "Coupon redemption", "resolved"],
      ["Work", "Fix tax rounding", "resolved"],
      ["Risk", "Double charge", "resolved"],
      ["Document", "Checkout spec", "resolved"],
      ["Project Release", "Release 1.0", "resolved"],
    ]);
    expect(created.relations[3]).toMatchObject({
      documentRevision: 3,
      sectionLabel: "Coupons",
    });
    expect((await testGaps.list(accountId, projectId)).gaps).toEqual([created]);
  });

  test("can be filed with no relations and lists newest records from this Project only", async () => {
    const { testGaps } = setup();

    const created = await testGaps.create(accountId, gapFixture);

    expect(created.relations).toEqual([]);
    expect((await testGaps.list(accountId, archivedProjectId)).gaps).toEqual(
      [],
    );
  });

  test("refuses a relation that is not an existing, active record of this Project", async () => {
    const harness = setup();
    harness.setState("Risk", "r1", "trashed");

    for (const relation of [
      { targetId: "missing", targetType: "Feature" },
      { targetId: "r9", targetType: "Risk" },
      { targetId: "r1", targetType: "Risk" },
      { documentRevision: 2, targetId: "d1", targetType: "Document" },
      {
        documentRevision: 3,
        sectionId: "gone",
        targetId: "d1",
        targetType: "Document",
      },
      // A Work id never lands in the Feature family.
      { targetId: "w1", targetType: "Feature" },
    ] as const) {
      await expect(
        harness.testGaps.create(accountId, {
          ...gapFixture,
          relations: [relation],
        }),
      ).rejects.toBeInstanceOf(TestGapRelationTargetError);
    }
    await expect(
      harness.testGaps.create(accountId, {
        ...gapFixture,
        relations: [
          { targetId: "f1", targetType: "Feature" },
          { targetId: "f1", targetType: "Feature" },
        ],
      }),
    ).rejects.toBeInstanceOf(TestGapRelationTargetError);
    expect(harness.gaps.size).toBe(0);
  });

  test("reports a support record that went away as broken and keeps the Gap", async () => {
    const harness = setup();
    const created = await harness.testGaps.create(accountId, {
      ...gapFixture,
      relations: [{ targetId: "r1", targetType: "Risk" }],
    });

    harness.setState("Risk", "r1", "trashed");

    const [listed] = (await harness.testGaps.list(accountId, projectId)).gaps;
    expect(listed?.id).toBe(created.id);
    expect(listed?.relations[0]).toMatchObject({
      brokenReason: "In Trash",
      label: null,
      state: "broken",
      targetId: "r1",
    });
  });

  test("binding a support relation never writes the target", async () => {
    const harness = setup();
    const before = structuredClone([...harness.catalog.values()]);

    await harness.testGaps.create(accountId, {
      ...gapFixture,
      relations: [
        { targetId: "f1", targetType: "Feature" },
        { targetId: "pr1", targetType: "Project Release" },
      ],
    });

    expect([...harness.catalog.values()]).toEqual(before);
  });

  test("offers only live Project records as relation targets", async () => {
    const harness = setup();

    expect(
      await harness.testGaps.relationTargets(accountId, {
        projectId,
        targetType: "Risk",
      }),
    ).toMatchObject([{ targetId: "r1" }]);
    expect(
      await harness.testGaps.relationTargets(accountId, {
        projectId,
        targetType: "Document",
      }),
    ).toMatchObject([
      { documentRevision: 3, sections: [{ id: "s1", label: "Coupons" }] },
    ]);
  });

  test("an archived Project stays readable but takes no new Gap", async () => {
    const { testGaps } = setup();

    await expect(
      testGaps.create(accountId, {
        ...gapFixture,
        projectId: archivedProjectId,
      }),
    ).rejects.toBeInstanceOf(TestGapProjectReadOnlyError);
    expect(await testGaps.list(accountId, archivedProjectId)).toMatchObject({
      readOnly: true,
    });
  });

  test("another account does not see or file Gaps in this Project", async () => {
    const { testGaps } = setup();

    await expect(
      testGaps.create("someone-else", gapFixture),
    ).rejects.toBeInstanceOf(TestGapProjectNotFoundError);
    await expect(
      testGaps.list("someone-else", projectId),
    ).rejects.toBeInstanceOf(TestGapProjectNotFoundError);
  });

  test("validates the record text", async () => {
    const { testGaps } = setup();

    await expect(
      testGaps.create(accountId, { ...gapFixture, title: "  " }),
    ).rejects.toBeInstanceOf(ZodError);
    await expect(
      testGaps.create(accountId, { ...gapFixture, rationale: "" }),
    ).rejects.toBeInstanceOf(ZodError);
  });
});

describe("Test Gap is not a coverage figure, a Bug, a Risk or a Product Gap", () => {
  test("refuses coverage, score, status, severity and record-type fields", async () => {
    const { testGaps } = setup();

    for (const extra of [
      { coverage: 40 },
      { score: 3 },
      { severity: "High" },
      { status: "Met by result" },
      { state: "Planned" },
      { kind: "Bug" },
      { type: "Product Gap" },
      { result: "Failed" },
    ]) {
      await expect(
        testGaps.create(accountId, { ...gapFixture, ...extra } as never),
      ).rejects.toBeInstanceOf(ZodError);
    }
  });

  test("refuses Bug and Product Gap as support relation families", async () => {
    const { testGaps } = setup();

    for (const targetType of [
      "Bug",
      "Product Gap",
      "Test Gap",
      "Session Test",
    ]) {
      await expect(
        testGaps.create(accountId, {
          ...gapFixture,
          relations: [{ targetId: "x", targetType }] as never,
        }),
      ).rejects.toBeInstanceOf(ZodError);
    }
  });

  test("stores nothing but the founder's own text and relations", async () => {
    const harness = setup();
    await harness.testGaps.create(accountId, gapFixture);

    expect(Object.keys([...harness.gaps.values()][0] ?? {}).sort()).toEqual([
      "caseBinds",
      "closure",
      "createdAt",
      "handoffBinds",
      "id",
      "projectId",
      "rationale",
      "relations",
      "state",
      "stateChangedAt",
      "title",
      "updatedAt",
    ]);
  });
});

describe("The product never files a Test Gap on its own", () => {
  test("a failed, reported or unbound Session Test, a spec change and a new case version leave no Gap", async () => {
    const harness = setup();
    const { planned } = harness;
    const definition = {
      expectedBehavior: "The coupon applies once.",
      preconditions: "Signed-in customer.",
      purpose: "Check coupon stacking.",
      scope: "Mobile.",
      title: "Stack coupons",
    };
    const scenario = await planned.plannedTests.create(accountId, {
      ...definition,
      projectId,
    });
    await planned.plannedTests.createVersion(accountId, {
      ...definition,
      caseId: scenario.id,
      changeKind: "Meaningful change",
      expectedVersion: 1,
      projectId,
      scope: "Mobile and web.",
    });
    await planned.plannedTests.recordSessionTest(accountId, {
      binding: { caseId: scenario.id, version: 1 },
      projectId,
      title: "Stacked coupons on Android",
    });
    await planned.plannedTests.recordSessionTest(accountId, {
      expectedBehavior: "Refund shown.",
      projectId,
      purpose: "Ad hoc refund try.",
      title: "Refund try",
    });
    const handoff = await planned.plannedTests.createHandoff(accountId, {
      projectId,
      purpose: "Mobile pass",
      scenarios: [{ caseId: scenario.id, version: 1 }],
      title: "Mobile pass",
    });
    const [recorded] = (
      await planned.plannedTests.sessionTests(accountId, projectId)
    ).sessionTests;
    if (!recorded) {
      throw new Error("Expected a recorded Session Test.");
    }
    await planned.plannedTests.transitionHandoff(accountId, {
      expectedState: "Draft",
      handoffId: handoff.id,
      projectId,
      to: "Ready to share",
    });
    await planned.plannedTests.transitionHandoff(accountId, {
      expectedState: "Ready to share",
      handoffId: handoff.id,
      projectId,
      to: "Shared",
    });
    await planned.plannedTests.linkHandoffSessionTest(accountId, {
      handoffId: handoff.id,
      projectId,
      sessionTestId: recorded.id,
    });

    expect(harness.gaps.size).toBe(0);
    expect((await harness.testGaps.list(accountId, projectId)).gaps).toEqual(
      [],
    );
  });

  test("the seam exposes a manual create, reads and manual planning, and no automatic filing operation", () => {
    const { testGaps } = setup();

    expect(Object.keys(testGaps).sort()).toEqual([
      "bindCase",
      "bindHandoff",
      "close",
      "create",
      "decisionTargets",
      "list",
      "relationTargets",
      "unbindCase",
      "unbindHandoff",
    ]);
  });
});

const definitionFixture = {
  expectedBehavior: "The coupon applies once.",
  preconditions: "Signed-in customer.",
  purpose: "Check coupon stacking.",
  scope: "Mobile.",
  title: "Stack coupons",
};

async function setupTestGapClosure() {
  const harness = createGapHarness([
    {
      label: "Skip wallet tests",
      projectId,
      targetId: "d1",
      targetType: "Decision",
    },
    {
      label: "Other project decision",
      projectId: "project-other",
      targetId: "d9",
      targetType: "Decision",
    },
  ]);
  const { plannedTests } = harness.planned;
  const scenario = await plannedTests.create(accountId, {
    ...definitionFixture,
    projectId,
  });
  const android = await plannedTests.recordSessionTest(accountId, {
    binding: { caseId: scenario.id, version: 1 },
    projectId,
    title: "Stacked coupons on Android",
  });
  const ios = await plannedTests.recordSessionTest(accountId, {
    binding: { caseId: scenario.id, version: 1 },
    projectId,
    title: "Stacked coupons on iOS",
  });
  const failed = await plannedTests.recordSessionTest(accountId, {
    expectedBehavior: "Refund shown.",
    projectId,
    purpose: "Ad hoc refund try.",
    title: "Failed refund try",
  });
  const gap = await harness.testGaps.create(accountId, {
    projectId,
    rationale: "Coupon stacking was never tried on mobile.",
    title: "Mobile coupon stacking untested",
  });
  return {
    ...harness,
    android: android.id,
    caseId: scenario.id,
    failed: failed.id,
    gapId: gap.id,
    ios: ios.id,
  };
}

type Harness = Awaited<ReturnType<typeof setupTestGapClosure>>;

function meet(harness: Harness, sessionTestIds: string[], rationale?: string) {
  return harness.testGaps.close(accountId, {
    expectedState: "Open",
    gapId: harness.gapId,
    outcome: "Met by result",
    projectId,
    rationale,
    sessionTestIds,
  });
}

async function only(harness: Harness) {
  const { gaps } = await harness.testGaps.list(accountId, projectId);
  return gaps.find(({ id }) => id === harness.gapId);
}

describe("Met by result cites the selected Session Tests", () => {
  test("closes with exactly the selected Session Tests and an optional rationale", async () => {
    const harness = await setupTestGapClosure();

    const closed = await meet(
      harness,
      [harness.android, harness.ios],
      "Both mobile platforms stacked correctly.",
    );

    expect(closed.state).toBe("Met by result");
    expect(closed.closure).toMatchObject({
      decision: null,
      outcome: "Met by result",
      rationale: "Both mobile platforms stacked correctly.",
      sessionTests: [
        { id: harness.android, title: "Stacked coupons on Android" },
        { id: harness.ios, title: "Stacked coupons on iOS" },
      ],
    });
    expect(await only(harness)).toEqual(closed);
  });

  test("the rationale is optional", async () => {
    const harness = await setupTestGapClosure();

    const closed = await meet(harness, [harness.android]);

    expect(closed.closure?.rationale).toBeNull();
  });

  test("is refused without a selected Session Test, with a repeat, or with an unknown one", async () => {
    const harness = await setupTestGapClosure();

    await expect(meet(harness, [])).rejects.toBeInstanceOf(ZodError);
    await expect(
      meet(harness, [harness.android, harness.android]),
    ).rejects.toBeInstanceOf(ZodError);
    await expect(meet(harness, ["missing"])).rejects.toBeInstanceOf(
      TestGapSessionTestNotFoundError,
    );
    await expect(
      harness.testGaps.close(accountId, {
        expectedState: "Open",
        gapId: harness.gapId,
        outcome: "Met by result",
        projectId,
      } as never),
    ).rejects.toBeInstanceOf(ZodError);
    expect((await only(harness))?.state).toBe("Open");
    expect((await only(harness))?.closure).toBeNull();
  });

  test("refuses a Session Test of another Project", async () => {
    const harness = await setupTestGapClosure();
    const original = harness.planned.sessionTests.get(harness.android);
    if (!original) {
      throw new Error("Expected a recorded Session Test.");
    }
    harness.planned.sessionTests.set("foreign", {
      ...original,
      id: "foreign",
      projectId: "project-other",
    });

    await expect(meet(harness, ["foreign"])).rejects.toBeInstanceOf(
      TestGapSessionTestNotFoundError,
    );
  });

  test("a coverage figure, a ratio or a count cannot close a Gap", async () => {
    const harness = await setupTestGapClosure();

    for (const extra of [
      { coverage: 100 },
      { percent: 100 },
      { passed: 2, total: 2 },
      { score: 1 },
    ]) {
      await expect(
        harness.testGaps.close(accountId, {
          expectedState: "Open",
          gapId: harness.gapId,
          outcome: "Met by result",
          projectId,
          sessionTestIds: [harness.android],
          ...extra,
        } as never),
      ).rejects.toBeInstanceOf(ZodError);
    }
    expect((await only(harness))?.state).toBe("Open");
  });

  test("closing a Planned Gap keeps its binds in history", async () => {
    const harness = await setupTestGapClosure();
    await harness.testGaps.bindCase(accountId, {
      caseId: harness.caseId,
      gapId: harness.gapId,
      projectId,
      version: 1,
    });

    const closed = await harness.testGaps.close(accountId, {
      expectedState: "Planned",
      gapId: harness.gapId,
      outcome: "Met by result",
      projectId,
      sessionTestIds: [harness.android],
    });

    expect(closed.state).toBe("Met by result");
    expect(closed.caseBinds).toEqual([
      { caseId: harness.caseId, title: "Stack coupons", version: 1 },
    ]);
  });
});

describe("Not needed keeps the rationale and the Decision", () => {
  function decline(harness: Harness, overrides: Record<string, unknown> = {}) {
    return harness.testGaps.close(accountId, {
      expectedState: "Open",
      gapId: harness.gapId,
      outcome: "Not needed",
      projectId,
      rationale: "Wallet payments are out of scope for the beta.",
      ...overrides,
    } as never);
  }

  test("keeps the rationale and an optional Decision, without a Session Test", async () => {
    const harness = await setupTestGapClosure();

    const closed = await decline(harness, { decisionId: "d1" });

    expect(closed.state).toBe("Not needed");
    expect(closed.closure).toMatchObject({
      decision: { id: "d1", label: "Skip wallet tests", state: "resolved" },
      outcome: "Not needed",
      rationale: "Wallet payments are out of scope for the beta.",
      sessionTests: [],
    });
  });

  test("works without a Decision", async () => {
    const harness = await setupTestGapClosure();

    expect((await decline(harness)).closure?.decision).toBeNull();
  });

  test("requires a rationale and rejects a Session Test selection", async () => {
    const harness = await setupTestGapClosure();

    await expect(decline(harness, { rationale: "  " })).rejects.toBeInstanceOf(
      ZodError,
    );
    await expect(
      decline(harness, { rationale: undefined }),
    ).rejects.toBeInstanceOf(ZodError);
    await expect(
      decline(harness, { sessionTestIds: [harness.android] }),
    ).rejects.toBeInstanceOf(ZodError);
  });

  test("refuses a Decision that is not an active Decision of this Project", async () => {
    const harness = await setupTestGapClosure();

    await expect(decline(harness, { decisionId: "d9" })).rejects.toBeInstanceOf(
      TestGapDecisionUnavailableError,
    );
    await expect(
      decline(harness, { decisionId: "missing" }),
    ).rejects.toBeInstanceOf(TestGapDecisionUnavailableError);
    expect((await only(harness))?.state).toBe("Open");
  });

  test("a Decision that later goes away reads as broken and the closure stays", async () => {
    const harness = await setupTestGapClosure();
    await decline(harness, { decisionId: "d1" });

    harness.setState("Decision", "d1", "trashed");

    expect((await only(harness))?.closure).toMatchObject({
      decision: { brokenReason: "In Trash", id: "d1", state: "broken" },
      rationale: "Wallet payments are out of scope for the beta.",
    });
  });

  test("offers the active Decisions of this Project", async () => {
    const harness = await setupTestGapClosure();

    expect(
      await harness.testGaps.decisionTargets(accountId, projectId),
    ).toEqual([{ label: "Skip wallet tests", targetId: "d1" }]);
  });
});

describe("Closing never deletes and is explicit", () => {
  test("a closed Gap stays listed with its history and cannot be closed again, replanned or rewritten", async () => {
    const harness = await setupTestGapClosure();
    await meet(harness, [harness.android], "Done on Android.");

    await expect(
      harness.testGaps.close(accountId, {
        expectedState: "Open",
        gapId: harness.gapId,
        outcome: "Not needed",
        projectId,
        rationale: "Changed my mind.",
      }),
    ).rejects.toBeInstanceOf(TestGapClosedError);
    await expect(
      harness.testGaps.bindCase(accountId, {
        caseId: harness.caseId,
        gapId: harness.gapId,
        projectId,
        version: 1,
      }),
    ).rejects.toBeInstanceOf(TestGapClosedError);
    await expect(
      harness.testGaps.unbindHandoff(accountId, {
        gapId: harness.gapId,
        handoffId: "any",
        projectId,
      }),
    ).rejects.toBeInstanceOf(TestGapClosedError);

    expect(harness.gaps.size).toBe(1);
    expect(await only(harness)).toMatchObject({
      closure: {
        outcome: "Met by result",
        rationale: "Done on Android.",
        sessionTests: [{ id: harness.android }],
      },
      state: "Met by result",
    });
  });

  test("a result arriving after closure, or a failed Session Test, changes nothing", async () => {
    const harness = await setupTestGapClosure();
    const closed = await meet(harness, [harness.android]);

    await harness.planned.plannedTests.recordSessionTest(accountId, {
      binding: { caseId: harness.caseId, version: 1 },
      projectId,
      title: "Late result",
    });

    expect(await only(harness)).toEqual(closed);
  });

  test("refuses a stale view of the state", async () => {
    const harness = await setupTestGapClosure();
    await harness.testGaps.bindCase(accountId, {
      caseId: harness.caseId,
      gapId: harness.gapId,
      projectId,
      version: 1,
    });

    await expect(meet(harness, [harness.android])).rejects.toBeInstanceOf(
      TestGapStateConflictError,
    );
    expect((await only(harness))?.state).toBe("Planned");
  });

  test("an archived Project takes no closure and another account sees nothing", async () => {
    const harness = await setupTestGapClosure();

    await expect(
      harness.testGaps.close(accountId, {
        expectedState: "Open",
        gapId: harness.gapId,
        outcome: "Not needed",
        projectId: archivedProjectId,
        rationale: "No.",
      }),
    ).rejects.toBeInstanceOf(TestGapProjectReadOnlyError);
    await expect(
      harness.testGaps.close("someone-else", {
        expectedState: "Open",
        gapId: harness.gapId,
        outcome: "Not needed",
        projectId,
        rationale: "No.",
      }),
    ).rejects.toBeInstanceOf(TestGapProjectNotFoundError);
  });

  test("the seam has no delete, reopen, auto-close or coverage operation", async () => {
    const harness = await setupTestGapClosure();

    expect(Object.keys(harness.testGaps).sort()).toEqual([
      "bindCase",
      "bindHandoff",
      "close",
      "create",
      "decisionTargets",
      "list",
      "relationTargets",
      "unbindCase",
      "unbindHandoff",
    ]);
  });
});

async function setupTestGapStates() {
  const harness = createGapHarness([
    {
      label: "Release 1.0",
      projectId,
      targetId: "pr1",
      targetType: "Project Release",
    },
  ]);
  const { plannedTests } = harness.planned;
  const scenario = await plannedTests.create(accountId, {
    ...definitionFixture,
    projectId,
  });
  const handoff = await plannedTests.createHandoff(accountId, {
    projectId,
    purpose: "Mobile pass",
    scenarios: [{ caseId: scenario.id, version: 1 }],
    title: "Mobile pass",
  });
  const gap = await harness.testGaps.create(accountId, {
    projectId,
    rationale: "Coupon stacking was never tried on mobile.",
    relations: [{ targetId: "pr1", targetType: "Project Release" }],
    title: "Mobile coupon stacking untested",
  });
  return {
    ...harness,
    caseId: scenario.id,
    gapId: gap.id,
    handoffId: handoff.id,
  };
}

type HarnessTestGapStates = Awaited<ReturnType<typeof setupTestGapStates>>;

async function stateOf(harness: HarnessTestGapStates) {
  const { gaps } = await harness.testGaps.list(accountId, projectId);
  return gaps.find(({ id }) => id === harness.gapId);
}

function bindCase(harness: HarnessTestGapStates, version = 1) {
  return harness.testGaps.bindCase(accountId, {
    caseId: harness.caseId,
    gapId: harness.gapId,
    projectId,
    version,
  });
}

function bindHandoff(harness: HarnessTestGapStates) {
  return harness.testGaps.bindHandoff(accountId, {
    gapId: harness.gapId,
    handoffId: harness.handoffId,
    projectId,
  });
}

describe("Test Gap planning is at most Planned", () => {
  test("a new Gap is Open", async () => {
    const harness = await setupTestGapStates();

    expect(await stateOf(harness)).toMatchObject({
      caseBinds: [],
      handoffBinds: [],
      state: "Open",
    });
  });

  test("binding an exact Planned Test Case version makes the Gap Planned, not met", async () => {
    const harness = await setupTestGapStates();

    const planned = await bindCase(harness);

    expect(planned.state).toBe("Planned");
    expect(planned.caseBinds).toEqual([
      { caseId: harness.caseId, title: "Stack coupons", version: 1 },
    ]);
  });

  test("binding a Test Handoff makes the Gap Planned and leaves the Handoff alone", async () => {
    const harness = await setupTestGapStates();
    const before = structuredClone(
      harness.planned.handoffs.get(harness.handoffId),
    );

    const planned = await bindHandoff(harness);

    expect(planned.state).toBe("Planned");
    expect(planned.handoffBinds).toEqual([
      {
        handoffId: harness.handoffId,
        handoffState: "Draft",
        title: "Mobile pass",
      },
    ]);
    expect(harness.planned.handoffs.get(harness.handoffId)).toEqual(before);
  });

  test("more binds never move a Gap past Planned", async () => {
    const harness = await setupTestGapStates();
    await harness.planned.plannedTests.createVersion(accountId, {
      ...definitionFixture,
      caseId: harness.caseId,
      changeKind: "Meaningful change",
      expectedVersion: 1,
      projectId,
      scope: "Mobile and web.",
    });

    await bindCase(harness, 1);
    await bindCase(harness, 2);
    const planned = await bindHandoff(harness);

    expect(planned.state).toBe("Planned");
    expect(planned.caseBinds.map(({ version }) => version)).toEqual([1, 2]);
  });

  test("binding the same target twice changes nothing", async () => {
    const harness = await setupTestGapStates();

    await bindCase(harness);
    const again = await bindCase(harness);

    expect(again.caseBinds).toHaveLength(1);
    expect(again.state).toBe("Planned");
  });

  test("removing the last bind returns a Planned Gap to Open; one bind left keeps it Planned", async () => {
    const harness = await setupTestGapStates();
    await bindCase(harness);
    await bindHandoff(harness);

    const afterCase = await harness.testGaps.unbindCase(accountId, {
      caseId: harness.caseId,
      gapId: harness.gapId,
      projectId,
      version: 1,
    });
    expect(afterCase.state).toBe("Planned");

    const afterHandoff = await harness.testGaps.unbindHandoff(accountId, {
      gapId: harness.gapId,
      handoffId: harness.handoffId,
      projectId,
    });
    expect(afterHandoff.state).toBe("Open");
    expect(afterHandoff.stateChangedAt >= afterCase.stateChangedAt).toBe(true);
  });

  test("a bind to a version, Handoff or Gap that does not exist in this Project is refused and the Gap stays Open", async () => {
    const harness = await setupTestGapStates();

    await expect(bindCase(harness, 9)).rejects.toBeInstanceOf(
      TestGapCaseVersionNotFoundError,
    );
    await expect(
      harness.testGaps.bindCase(accountId, {
        caseId: "missing",
        gapId: harness.gapId,
        projectId,
        version: 1,
      }),
    ).rejects.toBeInstanceOf(TestGapCaseVersionNotFoundError);
    await expect(
      harness.testGaps.bindHandoff(accountId, {
        gapId: harness.gapId,
        handoffId: "missing",
        projectId,
      }),
    ).rejects.toBeInstanceOf(TestGapHandoffNotFoundError);
    await expect(
      harness.testGaps.bindCase(accountId, {
        caseId: harness.caseId,
        gapId: "missing",
        projectId,
        version: 1,
      }),
    ).rejects.toBeInstanceOf(TestGapNotFoundError);
    expect((await stateOf(harness))?.state).toBe("Open");
  });

  test("an archived Project takes no bind and another account sees nothing", async () => {
    const harness = await setupTestGapStates();

    await expect(
      harness.testGaps.bindHandoff(accountId, {
        gapId: harness.gapId,
        handoffId: harness.handoffId,
        projectId: archivedProjectId,
      }),
    ).rejects.toBeInstanceOf(TestGapProjectReadOnlyError);
    await expect(
      harness.testGaps.bindHandoff("someone-else", {
        gapId: harness.gapId,
        handoffId: harness.handoffId,
        projectId,
      }),
    ).rejects.toBeInstanceOf(TestGapProjectNotFoundError);
  });

  test("binds are strict: a state, result or coverage field is not accepted", async () => {
    const harness = await setupTestGapStates();

    await expect(
      harness.testGaps.bindCase(accountId, {
        caseId: harness.caseId,
        gapId: harness.gapId,
        projectId,
        state: "Met by result",
        version: 1,
      } as never),
    ).rejects.toThrow();
    expect(Object.keys(harness.testGaps).sort()).toEqual([
      "bindCase",
      "bindHandoff",
      "close",
      "create",
      "decisionTargets",
      "list",
      "relationTargets",
      "unbindCase",
      "unbindHandoff",
    ]);
  });
});

describe("A result never closes a Test Gap", () => {
  test("recording, linking and receiving Session Tests leaves an Open Gap Open and a Planned Gap Planned", async () => {
    const harness = await setupTestGapStates();
    const open = await stateOf(harness);
    const { plannedTests } = harness.planned;

    const bound = await plannedTests.recordSessionTest(accountId, {
      binding: { caseId: harness.caseId, version: 1 },
      projectId,
      title: "Stacked coupons on Android",
    });
    await plannedTests.recordSessionTest(accountId, {
      expectedBehavior: "Refund shown.",
      projectId,
      purpose: "Ad hoc refund try.",
      title: "Failed refund try",
    });
    expect(await stateOf(harness)).toEqual(open);

    await bindCase(harness);
    await bindHandoff(harness);
    for (const [expectedState, to] of [
      ["Draft", "Ready to share"],
      ["Ready to share", "Shared"],
    ] as const) {
      await plannedTests.transitionHandoff(accountId, {
        expectedState,
        handoffId: harness.handoffId,
        projectId,
        to,
      });
    }
    await plannedTests.linkHandoffSessionTest(accountId, {
      handoffId: harness.handoffId,
      projectId,
      sessionTestId: bound.id,
    });
    await plannedTests.transitionHandoff(accountId, {
      expectedState: "Shared",
      handoffId: harness.handoffId,
      projectId,
      to: "Result received",
    });
    await plannedTests.transitionHandoff(accountId, {
      expectedState: "Result received",
      handoffId: harness.handoffId,
      projectId,
      to: "Closed",
    });

    const after = await stateOf(harness);
    expect(after?.state).toBe("Planned");
    expect(after?.handoffBinds[0]?.handoffState).toBe("Closed");
  });

  test("a Planned Gap does not block or write a Project Release or the planned case", async () => {
    const harness = await setupTestGapStates();
    const catalogBefore = structuredClone([...harness.catalog.values()]);
    const caseBefore = structuredClone(
      harness.planned.cases.get(harness.caseId),
    );

    await bindCase(harness);
    await bindHandoff(harness);

    expect([...harness.catalog.values()]).toEqual(catalogBefore);
    expect(harness.planned.cases.get(harness.caseId)).toEqual(caseBefore);
    expect(Object.keys(harness.testGaps)).not.toContain("block");
  });
});
