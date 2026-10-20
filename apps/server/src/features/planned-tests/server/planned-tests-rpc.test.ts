// biome-ignore-all lint/performance/noAwaitInLoops: Each move is driven in sequence against one Handoff.
import type { Context } from "@cantiara/api/context";
import { appRouter } from "@cantiara/api/routers/index";
import { createRouterClient } from "@orpc/server";
import { describe, expect, test } from "vitest";

import {
  accountId,
  createMemoryHarness,
  projectId,
} from "./planned-tests-memory-store";

function setup(authenticated = true) {
  const { plannedTests } = createMemoryHarness([
    { label: "Double charge", projectId, targetId: "r1", targetType: "Risk" },
  ]);
  const context = {
    plannedTests,
    session: authenticated
      ? { session: { id: "session" }, user: { id: accountId } }
      : null,
  } as Context;
  return { client: createRouterClient(appRouter, { context }) };
}

const definition = {
  expectedBehavior: "The order is confirmed.",
  preconditions: "A signed-in customer.",
  purpose: "Confirm checkout completes.",
  scope: "Card payment only.",
  title: "Checkout",
};

const PLANNED_TEST_PROCEDURE = /planned ?test/i;
const SECRET_WORD = /secret/i;

describe("Planned Tests RPC seam", () => {
  test("creates, versions and reads an exact version for the authenticated account", async () => {
    const { client } = setup();

    const created = await client.createPlannedTestCase({
      ...definition,
      projectId,
      relations: [{ targetId: "r1", targetType: "Risk" }],
    });
    const changed = await client.createPlannedTestCaseVersion({
      ...definition,
      caseId: created.id,
      changeKind: "Meaningful change",
      expectedVersion: 1,
      projectId,
      scope: "Card and wallet payment.",
    });
    const first = await client.plannedTestCaseVersion({
      caseId: created.id,
      projectId,
      version: 1,
    });

    expect(changed.current.version).toBe(2);
    expect(first).toMatchObject({ scope: "Card payment only.", version: 1 });
    expect(
      (await client.projectPlannedTestCases({ projectId })).cases,
    ).toHaveLength(1);
    expect(
      await client.plannedTestRelationTargets({
        projectId,
        targetType: "Risk",
      }),
    ).toMatchObject([{ targetId: "r1" }]);
  });

  test("pins a Session Test to an exact version and refuses to move the bind", async () => {
    const { client } = setup();
    const created = await client.createPlannedTestCase({
      ...definition,
      projectId,
    });
    const adHoc = await client.recordSessionTest({
      expectedBehavior: "Tax is shown.",
      projectId,
      purpose: "Check tax display.",
      title: "Tax line",
    });
    await client.createPlannedTestCaseVersion({
      ...definition,
      caseId: created.id,
      changeKind: "Editorial change",
      expectedVersion: 1,
      projectId,
      scope: "Card payment, reworded.",
    });

    const linked = await client.linkSessionTest({
      caseId: created.id,
      projectId,
      sessionTestId: adHoc.id,
      version: 1,
    });
    const listed = await client.projectSessionTests({ projectId });

    expect(linked.bind).toMatchObject({
      executedVersion: null,
      summary: "Linked later to v1, not executed against it, current v2",
    });
    expect(listed.sessionTests).toHaveLength(1);
    await expect(
      client.linkSessionTest({
        caseId: created.id,
        projectId,
        sessionTestId: adHoc.id,
        version: 2,
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(
      client.recordSessionTest({
        binding: { caseId: created.id, version: 9 },
        projectId,
        title: "x",
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(
      client.projectSessionTests({ projectId }),
    ).resolves.toBeTruthy();
  });

  test("blocks anonymous access", async () => {
    const { client } = setup(false);

    await expect(
      client.projectPlannedTestCases({ projectId }),
    ).rejects.toThrow();
    await expect(
      client.createPlannedTestCase({ ...definition, projectId }),
    ).rejects.toThrow();
  });

  test("maps domain refusals to RPC errors without leaking other records", async () => {
    const { client } = setup();
    const created = await client.createPlannedTestCase({
      ...definition,
      projectId,
    });

    await expect(
      client.projectPlannedTestCases({ projectId: "elsewhere" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(
      client.plannedTestCaseVersion({
        caseId: created.id,
        projectId,
        version: 9,
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(
      client.createPlannedTestCase({
        ...definition,
        projectId,
        relations: [{ targetId: "missing", targetType: "Risk" }],
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(
      client.createPlannedTestCaseVersion({
        ...definition,
        caseId: created.id,
        changeKind: "Editorial change",
        expectedVersion: 1,
        projectId,
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await client.createPlannedTestCaseVersion({
      ...definition,
      caseId: created.id,
      changeKind: "Meaningful change",
      expectedVersion: 1,
      projectId,
      purpose: "Changed.",
    });
    await expect(
      client.createPlannedTestCaseVersion({
        ...definition,
        caseId: created.id,
        changeKind: "Meaningful change",
        expectedVersion: 1,
        projectId,
        purpose: "Stale.",
      }),
    ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
  });

  test("exposes no run, start, result or package procedure", () => {
    const names = Object.keys(appRouter).filter((name) =>
      PLANNED_TEST_PROCEDURE.test(name),
    );

    expect(names.sort()).toEqual([
      "createPlannedTestCase",
      "createPlannedTestCaseVersion",
      "plannedTestCaseVersion",
      "plannedTestRelationTargets",
      "projectPlannedTestCases",
    ]);
  });
});

const EXTERNAL_WORD = /external/i;
const TEST_HANDOFF_PROCEDURE = /test ?handoff/i;
const RUNNER_VERB =
  /start|run|poll|schedul|execut|dispatch|trigger|cancel|deliver/i;

describe("Test Handoff RPC seam", () => {
  async function opened() {
    const { client } = setup();
    const created = await client.createPlannedTestCase({
      ...definition,
      projectId,
    });
    const handoff = await client.createTestHandoff({
      projectId,
      purpose: "Check checkout on staging.",
      scenarios: [{ caseId: created.id, version: 1 }],
      targetExecutor: "Codex",
      title: "Checkout round 1",
    });
    return { caseId: created.id, client, handoff };
  }

  test("opens, edits, moves and lists a Test Handoff for the authenticated account", async () => {
    const { client, handoff } = await opened();
    expect(handoff).toMatchObject({ packageVersion: 0, state: "Draft" });

    const edited = await client.updateTestHandoff({
      handoffId: handoff.id,
      projectId,
      purpose: "Narrowed.",
      title: "Checkout round 1",
    });
    const ready = await client.transitionTestHandoff({
      expectedState: "Draft",
      handoffId: handoff.id,
      projectId,
      to: "Ready to share",
    });

    expect(edited.purpose).toBe("Narrowed.");
    expect(ready.state).toBe("Ready to share");
    expect(
      (await client.projectTestHandoffs({ projectId })).handoffs,
    ).toMatchObject([{ id: handoff.id, state: "Ready to share" }]);
  });

  test("suggests Result received on a linked Session Test and never moves the Handoff", async () => {
    const { caseId, client, handoff } = await opened();
    for (const [expectedState, to] of [
      ["Draft", "Ready to share"],
      ["Ready to share", "Shared"],
    ] as const) {
      await client.transitionTestHandoff({
        expectedState,
        handoffId: handoff.id,
        projectId,
        to,
      });
    }
    const sessionTest = await client.recordSessionTest({
      binding: { caseId, version: 1 },
      projectId,
      title: "Pay with the saved card",
    });

    const linked = await client.linkTestHandoffSessionTest({
      handoffId: handoff.id,
      projectId,
      sessionTestId: sessionTest.id,
    });

    expect(linked.state).toBe("Shared");
    expect(linked.suggestion).toMatchObject({ state: "Result received" });
    await expect(
      client.linkTestHandoffSessionTest({
        handoffId: handoff.id,
        projectId,
        sessionTestId: sessionTest.id,
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  test("maps refusals to RPC errors", async () => {
    const { caseId, client, handoff } = await opened();

    await expect(
      client.transitionTestHandoff({
        expectedState: "Draft",
        handoffId: handoff.id,
        projectId,
        to: "Closed",
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(
      client.transitionTestHandoff({
        expectedState: "Shared",
        handoffId: handoff.id,
        projectId,
        to: "Closed",
      }),
    ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    await expect(
      client.transitionTestHandoff({
        expectedState: "Draft",
        handoffId: "missing",
        projectId,
        to: "Ready to share",
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(
      client.createTestHandoff({
        projectId,
        purpose: "p",
        scenarios: [{ caseId, version: 9 }],
        title: "t",
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(
      client.createTestHandoff({
        projectId,
        purpose: "p",
        scenarios: [{ caseId } as never],
        title: "t",
      }),
    ).rejects.toThrow();
  });

  test("blocks anonymous access", async () => {
    const { client } = setup(false);

    await expect(client.projectTestHandoffs({ projectId })).rejects.toThrow();
    await expect(
      client.createTestHandoff({ projectId, purpose: "p", title: "t" }),
    ).rejects.toThrow();
  });

  test("exposes no runner surface and shares no procedure with the Work external handoff", () => {
    const names = Object.keys(appRouter).filter((name) =>
      TEST_HANDOFF_PROCEDURE.test(name),
    );

    expect(names.sort()).toEqual([
      "createTestHandoff",
      "linkTestHandoffSessionTest",
      "previewTestHandoffPackage",
      "produceTestHandoffPackage",
      "projectTestHandoffPackages",
      "projectTestHandoffs",
      "testHandoffContextTargets",
      "transitionTestHandoff",
      "updateTestHandoff",
    ]);
    expect(names.filter((name) => RUNNER_VERB.test(name))).toEqual([]);
    // Work's external execution handoff (ADR-0015) is a different contract.
    expect(names.filter((name) => EXTERNAL_WORD.test(name))).toEqual([]);
  });
});

describe("Test Handoff package RPC seam", () => {
  async function ready() {
    const { client } = setup();
    const created = await client.createPlannedTestCase({
      ...definition,
      projectId,
    });
    const handoff = await client.createTestHandoff({
      projectId,
      purpose: "Check checkout on staging.",
      scenarios: [{ caseId: created.id, version: 1 }],
      title: "Checkout round 1",
    });
    return { client, handoff };
  }

  test("previews, produces and reads a package; produce moves no state", async () => {
    const { client, handoff } = await ready();
    await client.transitionTestHandoff({
      expectedState: "Draft",
      handoffId: handoff.id,
      projectId,
      to: "Ready to share",
    });

    const preview = await client.previewTestHandoffPackage({
      handoffId: handoff.id,
      projectId,
    });
    const produced = await client.produceTestHandoffPackage({
      expectedPackageVersion: preview.nextPackageVersion,
      handoffId: handoff.id,
      previewFingerprint: preview.fingerprint ?? "",
      projectId,
    });
    const listed = await client.projectTestHandoffPackages({
      handoffId: handoff.id,
      projectId,
    });

    expect(produced.package.schema_version).toBe("test-handoff-package/1");
    expect(produced.package.handoff_package_version).toBe(1);
    expect(listed.packages).toHaveLength(1);
    expect(
      (await client.projectTestHandoffs({ projectId })).handoffs[0],
    ).toMatchObject({ packageVersion: 1, state: "Ready to share" });
  });

  test("maps refusals to RPC errors without echoing a secret", async () => {
    const { client, handoff } = await ready();

    await expect(
      client.previewTestHandoffPackage({ handoffId: "missing", projectId }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(
      client.produceTestHandoffPackage({
        expectedPackageVersion: 1,
        handoffId: handoff.id,
        previewFingerprint: "a".repeat(64),
        projectId,
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await client.transitionTestHandoff({
      expectedState: "Draft",
      handoffId: handoff.id,
      projectId,
      to: "Ready to share",
    });
    await expect(
      client.produceTestHandoffPackage({
        expectedPackageVersion: 1,
        handoffId: handoff.id,
        previewFingerprint: "a".repeat(64),
        projectId,
      }),
    ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    const token = `ghp_${"x9Y8z7W6v5U4t3S2r1Q0".repeat(2)}`;
    const refused = client.updateTestHandoff({
      environmentPreconditions: `token ${token}`,
      handoffId: handoff.id,
      projectId,
      purpose: "p",
      title: "t",
    });
    await expect(refused).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await refused.catch((error: { data?: unknown; message: string }) => {
      const shown = JSON.stringify(error.data) + error.message;
      expect(shown).toMatch(SECRET_WORD);
      expect(shown).not.toContain(token);
    });
  });

  test("blocks anonymous access", async () => {
    const { client } = setup(false);

    await expect(
      client.previewTestHandoffPackage({ handoffId: "h", projectId }),
    ).rejects.toThrow();
    await expect(
      client.produceTestHandoffPackage({
        expectedPackageVersion: 1,
        handoffId: "h",
        previewFingerprint: "a".repeat(64),
        projectId,
      }),
    ).rejects.toThrow();
  });
});
