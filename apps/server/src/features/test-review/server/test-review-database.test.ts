import { createDb } from "@cantiara/db";
import { user, workspace } from "@cantiara/db/schema/auth";
import { sessionTest, testSession } from "@cantiara/db/schema/planned-test";
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

import { createDatabaseTestReview } from "./test-review-database";

const databaseUrl = process.env.ACCOUNT_ACCESS_DATABASE_URL;
const describeDatabase = databaseUrl ? describe : describe.skip;

describeDatabase("Test Review PostgreSQL integration", () => {
  const database = databaseUrl
    ? createDb({ DATABASE_URL: databaseUrl })
    : undefined;
  const suffix = crypto.randomUUID().slice(0, 8);
  const accountId = `test-review-${suffix}`;
  const workspaceId = `workspace-${suffix}`;
  const projectId = `project-${suffix}`;
  const sessionId = `session-${suffix}`;
  const itemA = `item-a-${suffix}`;
  const itemB = `item-b-${suffix}`;

  function requireDatabase() {
    if (!database) {
      throw new Error("ACCOUNT_ACCESS_DATABASE_URL is required");
    }
    return database;
  }

  beforeEach(async () => {
    const db = requireDatabase();
    await db.insert(user).values({
      email: `${accountId}@example.invalid`,
      id: accountId,
      name: "Founder",
    });
    await db
      .insert(workspace)
      .values({ id: workspaceId, ownerAccountId: accountId });
    await db.insert(project).values({
      id: projectId,
      name: "Tests",
      shortCode: `TRV-${suffix.toUpperCase()}`,
      starterConfiguration: "Blank Project",
      workspaceId,
    });
    await db.insert(testSession).values({
      executorName: "Codex",
      executorType: "ai_agent",
      externalSessionId: `run-${suffix}`,
      id: sessionId,
      ingress: "MCP",
      projectId,
      reportedAt: new Date("2026-10-01T09:00:00Z"),
      reportedAtText: "2026-10-01T09:00:00Z",
      reporterId: accountId,
      reporterKind: "user",
      schemaVersion: "test-report/1",
    });
    await db.insert(sessionTest).values([
      {
        externalTestId: "a",
        id: itemA,
        normalizedResult: "Failed",
        position: 0,
        projectId,
        purpose: "A",
        expectedBehavior: "",
        rawResult: "FAIL",
        sessionId,
        title: "A",
        bindOrigin: null,
      },
      {
        externalTestId: "b",
        id: itemB,
        normalizedResult: "Passed",
        position: 1,
        projectId,
        purpose: "B",
        expectedBehavior: "",
        rawResult: "pass",
        sessionId,
        title: "B",
      },
    ]);
  });

  afterEach(async () => {
    await requireDatabase().delete(user).where(eq(user.id, accountId));
  });

  afterAll(async () => {
    await database?.$client.end();
  });

  test("item and session states are independent and the reported result stays", async () => {
    const access = createDatabaseTestReview(requireDatabase());
    await access.setItemReviewState(accountId, {
      projectId,
      sessionId,
      sessionTestId: itemA,
      state: "Follow-up needed",
    });
    await access.setSessionReviewState(accountId, {
      projectId,
      reason: "Rest next time.",
      sessionId,
      state: "Closed",
    });
    const { events, sessions } = await access.list(accountId, projectId);
    const [session] = sessions;
    expect(session?.reviewState).toBe("Closed");
    expect(session?.items.map((item) => item.reviewState)).toEqual([
      "Follow-up needed",
      "Unreviewed",
    ]);
    expect(session?.items.map((item) => item.rawResult)).toEqual([
      "FAIL",
      "pass",
    ]);
    expect(session?.items.map((item) => item.normalizedResult)).toEqual([
      "Failed",
      "Passed",
    ]);
    const close = events.find((event) => event.toState === "Closed");
    expect(close?.reason).toBe("Rest next time.");
    expect(close?.remaining?.map((record) => record.id)).toEqual([
      itemA,
      itemB,
    ]);
  });

  test("the bulk commit is atomic and idempotent", async () => {
    const access = createDatabaseTestReview(requireDatabase());
    const selection = { projectId, sessionId, sessionTestIds: [itemA] };
    const preview = await access.previewBulkReview(accountId, selection);
    expect(preview.changes).toHaveLength(2);
    const first = await access.commitBulkReview(accountId, {
      ...selection,
      previewed: preview.changes,
    });
    expect(first.outcome).toBe("applied");
    const again = await access.commitBulkReview(accountId, {
      ...selection,
      previewed: preview.changes,
    });
    expect(again).toEqual({ changed: [], outcome: "unchanged" });
    const { events, sessions } = await access.list(accountId, projectId);
    expect(events).toHaveLength(2);
    expect(sessions[0]?.reviewState).toBe("Reviewed");
    expect(sessions[0]?.items.map((item) => item.reviewState)).toEqual([
      "Reviewed",
      "Unreviewed",
    ]);
  });
});
