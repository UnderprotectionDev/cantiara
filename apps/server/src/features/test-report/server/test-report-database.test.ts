import {
  type TestReportCaller,
  TestReportRejectedError,
} from "@cantiara/api/test-report";
import { createDb } from "@cantiara/db";
import { user, workspace } from "@cantiara/db/schema/auth";
import {
  plannedTestCase,
  plannedTestCaseVersion,
  sessionTest,
  testReportAttentionSignal,
  testSession,
} from "@cantiara/db/schema/planned-test";
import { project } from "@cantiara/db/schema/project";
import { eq } from "drizzle-orm";
import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  test,
} from "vitest";

import { createDatabaseTestReports } from "./test-report-database";

const databaseUrl = process.env.ACCOUNT_ACCESS_DATABASE_URL;
const describeDatabase = databaseUrl ? describe : describe.skip;

describeDatabase("Test Report Acceptance PostgreSQL integration", () => {
  const database = databaseUrl
    ? createDb({ DATABASE_URL: databaseUrl })
    : undefined;
  const suffix = crypto.randomUUID().slice(0, 8);
  const accountId = `test-report-${suffix}`;
  const otherAccountId = `test-report-other-${suffix}`;
  const workspaceId = `workspace-${suffix}`;
  const otherWorkspaceId = `workspace-other-${suffix}`;
  const projectId = `project-${suffix}`;
  const otherProjectId = `project-other-${suffix}`;
  const caseId = `case-${suffix}`;
  const caller: TestReportCaller = {
    accountId,
    reporter: { id: accountId, kind: "user" },
  };

  function requireDatabase() {
    if (!database) {
      throw new Error("ACCOUNT_ACCESS_DATABASE_URL is required");
    }
    return database;
  }

  function report(overrides: Record<string, unknown> = {}) {
    return {
      executor: { name: "Codex", type: "ai_agent" },
      external_session_id: `run-${crypto.randomUUID()}`,
      project_id: projectId,
      reported_at: "2026-08-06T15:30:00+03:00",
      schema_version: "test-report/1",
      tests: [
        { external_test_id: "a", normalized_result: "passed", title: "A" },
        { external_test_id: "b", title: "B" },
      ],
      ...overrides,
    };
  }

  beforeEach(async () => {
    const db = requireDatabase();
    await db.insert(user).values([
      { email: `${accountId}@example.invalid`, id: accountId, name: "Founder" },
      {
        email: `${otherAccountId}@example.invalid`,
        id: otherAccountId,
        name: "Other",
      },
    ]);
    await db.insert(workspace).values([
      { id: workspaceId, ownerAccountId: accountId },
      { id: otherWorkspaceId, ownerAccountId: otherAccountId },
    ]);
    const base = { starterConfiguration: "Blank Project" as const };
    await db.insert(project).values([
      {
        ...base,
        id: projectId,
        name: "Tests",
        shortCode: `TRP-${suffix.toUpperCase()}`,
        workspaceId,
      },
      {
        ...base,
        id: otherProjectId,
        name: "Other",
        shortCode: `TRO-${suffix.toUpperCase()}`,
        workspaceId: otherWorkspaceId,
      },
    ]);
    await db.insert(plannedTestCase).values({ id: caseId, projectId });
    await db.insert(plannedTestCaseVersion).values({
      caseId,
      changeKind: "Initial version",
      expectedBehavior: "Works.",
      id: `version-${suffix}`,
      preconditions: "None.",
      purpose: "Check.",
      scope: "All.",
      title: "Case",
      version: 1,
    });
  });

  afterEach(async () => {
    const db = requireDatabase();
    await db.delete(user).where(eq(user.id, accountId));
    await db.delete(user).where(eq(user.id, otherAccountId));
  });

  afterAll(async () => {
    await database?.$client.end();
  });

  test("a report stores one Test Session with its Session Tests and lists them", async () => {
    const access = createDatabaseTestReports(requireDatabase());
    const { session } = await access.accept(caller, {
      ingress: "MCP",
      report: report({
        tests: [
          {
            external_test_id: "a",
            scenario_id: caseId,
            scenario_version: 1,
            title: "A",
          },
          { external_test_id: "b", raw_result: "ok", title: "B" },
        ],
      }),
    });
    expect(session.reviewState).toBe("Unreviewed");
    const listed = await access.sessions(accountId, projectId);
    expect(listed.sessions).toHaveLength(1);
    expect(listed.sessions[0]?.tests.map(({ title }) => title)).toEqual([
      "A",
      "B",
    ]);
    expect(listed.sessions[0]?.tests[0]).toMatchObject({
      scenarioId: caseId,
      scenarioVersion: 1,
    });
    expect(listed.sessions[0]?.reportedAtText).toBe(
      "2026-08-06T15:30:00+03:00",
    );
  });

  test("a refused report leaves no Test Session or Session Test", async () => {
    const access = createDatabaseTestReports(requireDatabase());
    const refused = access.accept(caller, {
      ingress: "MCP",
      report: report({
        tests: [
          {
            external_test_id: "a",
            scenario_id: caseId,
            scenario_version: 7,
            title: "A",
          },
        ],
      }),
    });
    await expect(refused).rejects.toBeInstanceOf(TestReportRejectedError);
    const db = requireDatabase();
    expect(
      await db
        .select()
        .from(testSession)
        .where(eq(testSession.projectId, projectId)),
    ).toEqual([]);
    expect(
      await db
        .select()
        .from(sessionTest)
        .where(eq(sessionTest.projectId, projectId)),
    ).toEqual([]);
  });

  test("another account's Project is project_not_authorized", async () => {
    const access = createDatabaseTestReports(requireDatabase());
    await expect(
      access.accept(caller, {
        ingress: "MCP",
        report: report({ project_id: otherProjectId }),
      }),
    ).rejects.toMatchObject({ code: "project_not_authorized" });
  });

  test("a retry is a duplicate receipt, a changed body is identity_conflict, and neither adds a row", async () => {
    const access = createDatabaseTestReports(requireDatabase());
    const sent = report();
    const first = await access.accept(caller, { ingress: "MCP", report: sent });
    const again = await access.accept(caller, { ingress: "MCP", report: sent });
    expect(again.outcome).toBe("duplicate");
    expect(again.session.id).toBe(first.session.id);
    await expect(
      access.accept(caller, {
        ingress: "MCP",
        report: { ...sent, tests: [{ external_test_id: "a", title: "A" }] },
      }),
    ).rejects.toMatchObject({ code: "identity_conflict" });
    const db = requireDatabase();
    expect(
      await db
        .select()
        .from(testSession)
        .where(eq(testSession.projectId, projectId)),
    ).toHaveLength(1);
  });

  test("a relation to another Project's Work is reference_scope_mismatch and writes nothing", async () => {
    const access = createDatabaseTestReports(requireDatabase());
    await expect(
      access.accept(caller, {
        ingress: "MCP",
        report: report({
          tests: [
            {
              external_test_id: "a",
              relations: [{ target_id: "missing-work", target_type: "work" }],
              title: "A",
            },
          ],
        }),
      }),
    ).rejects.toMatchObject({ code: "reference_not_found" });
    const db = requireDatabase();
    expect(
      await db
        .select()
        .from(testSession)
        .where(eq(testSession.projectId, projectId)),
    ).toEqual([]);
  });

  test("a new MCP session writes one unreviewed-test-report signal and a retry adds none", async () => {
    const access = createDatabaseTestReports(requireDatabase());
    const sent = report();
    await access.accept(caller, { ingress: "MCP", report: sent });
    await access.accept(caller, { ingress: "MCP", report: sent });
    const rows = await requireDatabase()
      .select()
      .from(testReportAttentionSignal)
      .where(eq(testReportAttentionSignal.projectId, projectId));
    expect(rows.map(({ signalType }) => signalType)).toEqual([
      "unreviewed-test-report",
    ]);
  });

  test("a known token is sensitive_data_detected and writes nothing", async () => {
    const access = createDatabaseTestReports(requireDatabase());
    await expect(
      access.accept(caller, {
        ingress: "MCP",
        report: report({ raw_report: `ghp_${"a1B2c3D4e5".repeat(4)}` }),
      }),
    ).rejects.toMatchObject({
      code: "sensitive_data_detected",
      fieldPath: "raw_report",
    });
    expect(
      await requireDatabase()
        .select()
        .from(testSession)
        .where(eq(testSession.projectId, projectId)),
    ).toEqual([]);
  });
});
