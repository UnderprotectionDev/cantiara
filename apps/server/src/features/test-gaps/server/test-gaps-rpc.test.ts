import type { Context } from "@cantiara/api/context";
import { appRouter } from "@cantiara/api/routers/index";
import { createRouterClient } from "@orpc/server";
import { describe, expect, test } from "vitest";

import {
  accountId,
  archivedProjectId,
  projectId,
} from "../../planned-tests/server/planned-tests-memory-store";
import { createGapHarness } from "./test-gaps-memory-store";

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
      "createTestGap",
      "projectTestGaps",
      "testGapRelationTargets",
    ]);
  });
});
