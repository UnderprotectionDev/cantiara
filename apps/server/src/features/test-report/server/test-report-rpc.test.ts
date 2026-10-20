import type { Context } from "@cantiara/api/context";
import { appRouter } from "@cantiara/api/routers/index";
import { createRouterClient } from "@orpc/server";
import { describe, expect, test } from "vitest";

import {
  accountId,
  createMemoryHarness,
  projectId,
} from "./test-report-memory-store";

const TEST_REPORT_PROCEDURE = /testreport|testsession/i;
const REVIEW_OR_GATE =
  /review.*(test|session)|(test|session).*(review|approve|verify|release)/i;

function setup() {
  const { testReports } = createMemoryHarness();
  const context = {
    session: { session: { id: "session" }, user: { id: accountId } },
    testReports,
  } as Context;
  return createRouterClient(appRouter, { context });
}

describe("Test Report Acceptance RPC seam", () => {
  test("the signed-in app records a manual report and lists it Unreviewed", async () => {
    const client = setup();
    const receipt = await client.acceptTestReport({
      executor: { name: "Me", type: "user" },
      ingress: "Application",
      projectId,
      tests: [{ result: "passed", title: "Login works" }],
    });
    if (receipt.outcome === "masked_review") {
      throw new Error("Unexpected masked review.");
    }
    const { session } = receipt;
    const listed = await client.projectTestSessions({ projectId });
    expect(listed.sessions.map(({ id }) => id)).toEqual([session.id]);
    expect(listed.sessions[0]).toMatchObject({
      ingress: "Application",
      reporter: { id: accountId, kind: "user" },
      reviewState: "Unreviewed",
    });
  });

  test("a refusal carries the closed code and a safe field path", async () => {
    const client = setup();
    await expect(
      client.acceptTestReport({
        content: JSON.stringify({ schema_version: "test-report/9" }),
        format: "json",
        ingress: "File import",
        projectId,
      }),
    ).rejects.toMatchObject({
      data: { code: "schema_unsupported", fieldPath: "schema_version" },
    });
  });

  test("the app cannot claim the MCP ingress and exposes no review or gate procedure", async () => {
    const client = setup();
    await expect(
      client.acceptTestReport({
        ingress: "MCP",
        report: {},
      } as never),
    ).rejects.toBeDefined();
    const procedures = Object.keys(appRouter).filter((name) =>
      TEST_REPORT_PROCEDURE.test(name),
    );
    expect(procedures.sort()).toEqual([
      "acceptTestReport",
      "projectTestSessions",
    ]);
    expect(procedures.filter((name) => REVIEW_OR_GATE.test(name))).toEqual([]);
  });
});
