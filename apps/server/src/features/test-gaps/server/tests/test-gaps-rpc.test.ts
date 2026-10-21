import type { Context } from "@cantiara/api/context";
import { appRouter } from "@cantiara/api/routers/index";
import { createRouterClient } from "@orpc/server";
import { describe, expect, test } from "vitest";

import {
  accountId,
  archivedProjectId,
  projectId,
} from "../../../planned-tests/server/planned-tests-memory-store";
import { createGapHarness } from "../test-gaps-memory-store";

function setup(authenticated = true) {
  const { testGaps } = createGapHarness([
    { label: "Double charge", projectId, targetId: "r1", targetType: "Risk" },
  ]);
  const context = {
    session: authenticated
      ? { session: { id: "session" }, user: { id: accountId } }
      : null,
    testGaps,
  } as Context;
  return { client: createRouterClient(appRouter, { context }) };
}

const gap = {
  projectId,
  rationale: "Refunds were never tried.",
  title: "Refund flow untested",
};

const TEST_GAP_PROCEDURE = /test ?gap/i;

describe("Test Gaps RPC seam", () => {
  test("files a Gap by hand, lists it and offers relation targets", async () => {
    const { client } = setup();

    const created = await client.createTestGap({
      ...gap,
      relations: [{ targetId: "r1", targetType: "Risk" }],
    });

    expect(created.relations).toMatchObject([
      { label: "Double charge", state: "resolved" },
    ]);
    expect((await client.projectTestGaps({ projectId })).gaps).toHaveLength(1);
    expect(
      await client.testGapRelationTargets({ projectId, targetType: "Risk" }),
    ).toMatchObject([{ targetId: "r1" }]);
  });

  test("plans a Gap with a case version and a Handoff, at most Planned", async () => {
    const harness = createGapHarness();
    const context = {
      session: { session: { id: "session" }, user: { id: accountId } },
      plannedTests: harness.planned.plannedTests,
      testGaps: harness.testGaps,
    } as Context;
    const client = createRouterClient(appRouter, { context });
    const scenario = await client.createPlannedTestCase({
      expectedBehavior: "The order is confirmed.",
      preconditions: "A signed-in customer.",
      projectId,
      purpose: "Confirm checkout completes.",
      scope: "Card payment only.",
      title: "Checkout",
    });
    const handoff = await client.createTestHandoff({
      projectId,
      purpose: "Mobile pass",
      scenarios: [{ caseId: scenario.id, version: 1 }],
      title: "Mobile pass",
    });
    const created = await client.createTestGap(gap);

    const withCase = await client.bindTestGapCase({
      caseId: scenario.id,
      gapId: created.id,
      projectId,
      version: 1,
    });
    const withHandoff = await client.bindTestGapHandoff({
      gapId: created.id,
      handoffId: handoff.id,
      projectId,
    });
    const unbound = await client.unbindTestGapCase({
      caseId: scenario.id,
      gapId: created.id,
      projectId,
      version: 1,
    });

    expect(withCase.state).toBe("Planned");
    expect(withHandoff.state).toBe("Planned");
    expect(unbound.state).toBe("Planned");
    await expect(
      client.bindTestGapCase({
        caseId: scenario.id,
        gapId: created.id,
        projectId,
        version: 9,
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(
      client.bindTestGapHandoff({
        gapId: "missing",
        handoffId: handoff.id,
        projectId,
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  test("closes a Gap only with the selected Session Tests or a rationale", async () => {
    const harness = createGapHarness();
    const context = {
      session: { session: { id: "session" }, user: { id: accountId } },
      plannedTests: harness.planned.plannedTests,
      testGaps: harness.testGaps,
    } as Context;
    const client = createRouterClient(appRouter, { context });
    const tried = await client.recordSessionTest({
      expectedBehavior: "Refund shown.",
      projectId,
      purpose: "Ad hoc refund try.",
      title: "Refund try",
    });
    const first = await client.createTestGap(gap);
    const second = await client.createTestGap({ ...gap, title: "Other gap" });

    const met = await client.closeTestGap({
      expectedState: "Open",
      gapId: first.id,
      outcome: "Met by result",
      projectId,
      sessionTestIds: [tried.id],
    });
    const declined = await client.closeTestGap({
      expectedState: "Open",
      gapId: second.id,
      outcome: "Not needed",
      projectId,
      rationale: "Out of scope.",
    });

    expect(met).toMatchObject({
      closure: { sessionTests: [{ id: tried.id }] },
      state: "Met by result",
    });
    expect(declined.state).toBe("Not needed");
    expect(await client.testGapDecisionTargets({ projectId })).toEqual([]);
    await expect(
      client.closeTestGap({
        expectedState: "Open",
        gapId: first.id,
        outcome: "Not needed",
        projectId,
        rationale: "Again.",
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(
      client.closeTestGap({
        expectedState: "Open",
        gapId: "missing",
        outcome: "Met by result",
        projectId,
        sessionTestIds: [tried.id],
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  test("maps refusals to named errors without leaking record content", async () => {
    const { client } = setup();

    await expect(
      client.createTestGap({
        ...gap,
        relations: [{ targetId: "missing", targetType: "Risk" }],
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(
      client.createTestGap({ ...gap, projectId: archivedProjectId }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(
      client.projectTestGaps({ projectId: "unknown-project" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  test("requires a session and exposes no automatic filing, coverage or result procedure", async () => {
    const { client } = setup(false);

    await expect(client.projectTestGaps({ projectId })).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
    const procedures = Object.keys(appRouter).filter((name) =>
      TEST_GAP_PROCEDURE.test(name),
    );
    expect(procedures.sort()).toEqual([
      "bindTestGapCase",
      "bindTestGapHandoff",
      "closeTestGap",
      "createTestGap",
      "projectTestGaps",
      "testGapDecisionTargets",
      "testGapRelationTargets",
      "unbindTestGapCase",
      "unbindTestGapHandoff",
    ]);
  });
});
