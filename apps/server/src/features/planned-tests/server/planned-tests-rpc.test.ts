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
