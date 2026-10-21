// biome-ignore-all lint/performance/noAwaitInLoops: Each refusal case is asserted in sequence against one store.
import { describe, expect, test } from "vitest";
import { ZodError } from "zod";

import {
  accountId,
  archivedProjectId,
  projectId,
} from "../../../planned-tests/server/planned-tests-memory-store";
import {
  TestGapClosedError,
  TestGapDecisionUnavailableError,
  TestGapProjectNotFoundError,
  TestGapProjectReadOnlyError,
  TestGapSessionTestNotFoundError,
  TestGapStateConflictError,
} from "../test-gaps";
import { createGapHarness } from "../test-gaps-memory-store";

const definition = {
  expectedBehavior: "The coupon applies once.",
  preconditions: "Signed-in customer.",
  purpose: "Check coupon stacking.",
  scope: "Mobile.",
  title: "Stack coupons",
};

async function setup() {
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
    ...definition,
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

type Harness = Awaited<ReturnType<typeof setup>>;

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
    const harness = await setup();

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
    const harness = await setup();

    const closed = await meet(harness, [harness.android]);

    expect(closed.closure?.rationale).toBeNull();
  });

  test("is refused without a selected Session Test, with a repeat, or with an unknown one", async () => {
    const harness = await setup();

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
    const harness = await setup();
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
    const harness = await setup();

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
    const harness = await setup();
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
    const harness = await setup();

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
    const harness = await setup();

    expect((await decline(harness)).closure?.decision).toBeNull();
  });

  test("requires a rationale and rejects a Session Test selection", async () => {
    const harness = await setup();

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
    const harness = await setup();

    await expect(decline(harness, { decisionId: "d9" })).rejects.toBeInstanceOf(
      TestGapDecisionUnavailableError,
    );
    await expect(
      decline(harness, { decisionId: "missing" }),
    ).rejects.toBeInstanceOf(TestGapDecisionUnavailableError);
    expect((await only(harness))?.state).toBe("Open");
  });

  test("a Decision that later goes away reads as broken and the closure stays", async () => {
    const harness = await setup();
    await decline(harness, { decisionId: "d1" });

    harness.setState("Decision", "d1", "trashed");

    expect((await only(harness))?.closure).toMatchObject({
      decision: { brokenReason: "In Trash", id: "d1", state: "broken" },
      rationale: "Wallet payments are out of scope for the beta.",
    });
  });

  test("offers the active Decisions of this Project", async () => {
    const harness = await setup();

    expect(
      await harness.testGaps.decisionTargets(accountId, projectId),
    ).toEqual([{ label: "Skip wallet tests", targetId: "d1" }]);
  });
});

describe("Closing never deletes and is explicit", () => {
  test("a closed Gap stays listed with its history and cannot be closed again, replanned or rewritten", async () => {
    const harness = await setup();
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
    const harness = await setup();
    const closed = await meet(harness, [harness.android]);

    await harness.planned.plannedTests.recordSessionTest(accountId, {
      binding: { caseId: harness.caseId, version: 1 },
      projectId,
      title: "Late result",
    });

    expect(await only(harness)).toEqual(closed);
  });

  test("refuses a stale view of the state", async () => {
    const harness = await setup();
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
    const harness = await setup();

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
    const harness = await setup();

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
