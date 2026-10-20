import type { Context } from "@cantiara/api/context";
import { appRouter } from "@cantiara/api/routers/index";
import { createRouterClient } from "@orpc/server";
import { describe, expect, test } from "vitest";

import {
  accountId,
  createMemoryHarness,
  projectId,
} from "./test-assessments-memory-store";

function setup(authenticated = true) {
  const { testAssessments } = createMemoryHarness([
    { id: "r1", kind: "Project Release", label: "v1.2", projectId },
  ]);
  const context = {
    session: authenticated
      ? { session: { id: "session" }, user: { id: accountId } }
      : null,
    testAssessments,
  } as Context;
  return createRouterClient(appRouter, { context });
}

const input = {
  context: { kind: "Project Release" as const, targetId: "r1" },
  decision: "Undecided" as const,
  projectId,
  sessionIds: ["s1"],
};

const ASSESSMENT_PROCEDURE = /assessment/i;

describe("Test Assessments RPC seam", () => {
  test("records and lists a snapshot for the authenticated account", async () => {
    const client = setup();
    const saved = await client.recordTestAssessment(input);
    const listed = await client.projectTestAssessments({ projectId });
    expect(listed.assessments).toEqual([saved]);
    await expect(
      client.testAssessmentContextTargets({
        kind: "Project Release",
        projectId,
      }),
    ).resolves.toEqual([{ id: "r1", kind: "Project Release", label: "v1.2" }]);
  });

  test("requires a signed-in account and maps refusals to defined errors", async () => {
    await expect(
      setup(false).recordTestAssessment(input),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(
      setup().recordTestAssessment({
        ...input,
        context: { kind: "Feature", targetId: "nope" },
      }),
    ).rejects.toMatchObject({
      data: { code: "TEST_ASSESSMENT_CONTEXT_UNAVAILABLE" },
    });
  });

  test("exposes no score, gate, update or carry-forward procedure", () => {
    const names = Object.keys(appRouter).filter((name) =>
      ASSESSMENT_PROCEDURE.test(name),
    );
    expect(names.sort()).toEqual([
      "projectTestAssessments",
      "recordTestAssessment",
      "testAssessmentContextTargets",
    ]);
  });
});
