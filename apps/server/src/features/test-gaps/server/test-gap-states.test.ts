// biome-ignore-all lint/performance/noAwaitInLoops: Each Handoff move is driven in sequence against one Handoff.
import { describe, expect, test } from "vitest";

import {
  accountId,
  archivedProjectId,
  projectId,
} from "../../planned-tests/server/planned-tests-memory-store";
import {
  TestGapCaseVersionNotFoundError,
  TestGapHandoffNotFoundError,
  TestGapNotFoundError,
  TestGapProjectNotFoundError,
  TestGapProjectReadOnlyError,
} from "./test-gaps";
import { createGapHarness } from "./test-gaps-memory-store";

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
      label: "Release 1.0",
      projectId,
      targetId: "pr1",
      targetType: "Project Release",
    },
  ]);
  const { plannedTests } = harness.planned;
  const scenario = await plannedTests.create(accountId, {
    ...definition,
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

type Harness = Awaited<ReturnType<typeof setup>>;

async function stateOf(harness: Harness) {
  const { gaps } = await harness.testGaps.list(accountId, projectId);
  return gaps.find(({ id }) => id === harness.gapId);
}

function bindCase(harness: Harness, version = 1) {
  return harness.testGaps.bindCase(accountId, {
    caseId: harness.caseId,
    gapId: harness.gapId,
    projectId,
    version,
  });
}

function bindHandoff(harness: Harness) {
  return harness.testGaps.bindHandoff(accountId, {
    gapId: harness.gapId,
    handoffId: harness.handoffId,
    projectId,
  });
}

describe("Test Gap planning is at most Planned", () => {
  test("a new Gap is Open", async () => {
    const harness = await setup();

    expect(await stateOf(harness)).toMatchObject({
      caseBinds: [],
      handoffBinds: [],
      state: "Open",
    });
  });

  test("binding an exact Planned Test Case version makes the Gap Planned, not met", async () => {
    const harness = await setup();

    const planned = await bindCase(harness);

    expect(planned.state).toBe("Planned");
    expect(planned.caseBinds).toEqual([
      { caseId: harness.caseId, title: "Stack coupons", version: 1 },
    ]);
  });

  test("binding a Test Handoff makes the Gap Planned and leaves the Handoff alone", async () => {
    const harness = await setup();
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
    const harness = await setup();
    await harness.planned.plannedTests.createVersion(accountId, {
      ...definition,
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
    const harness = await setup();

    await bindCase(harness);
    const again = await bindCase(harness);

    expect(again.caseBinds).toHaveLength(1);
    expect(again.state).toBe("Planned");
  });

  test("removing the last bind returns a Planned Gap to Open; one bind left keeps it Planned", async () => {
    const harness = await setup();
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
    const harness = await setup();

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
    const harness = await setup();

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
    const harness = await setup();

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
    const harness = await setup();
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
    const harness = await setup();
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
