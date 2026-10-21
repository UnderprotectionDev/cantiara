import { createDb } from "@cantiara/db";
import { user, workspace } from "@cantiara/db/schema/auth";
import { sessionTest, testSession } from "@cantiara/db/schema/planned-test";
import { project } from "@cantiara/db/schema/project";
import { testReviewEvent } from "@cantiara/db/schema/test-review";
import { work } from "@cantiara/db/schema/work";
import { eq } from "drizzle-orm";
import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  test,
} from "vitest";

import { createDatabaseTestReview } from "../test-review-database";

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

  test("a Correction, Withdrawal and redaction are additive and the reported result stays", async () => {
    const access = createDatabaseTestReview(requireDatabase());
    await access.setSessionReviewState(accountId, {
      projectId,
      sessionId,
      state: "Closed",
    });
    const corrected = await access.recordCorrection(accountId, {
      correctedResult: "passed",
      note: "secret-note",
      projectId,
      reason: "Wrong build.",
      sessionId,
      sessionTestId: itemA,
    });
    await access.recordWithdrawal(accountId, {
      projectId,
      reason: "Duplicate.",
      sessionId,
      sessionTestId: itemB,
    });
    await access.recordRedaction(accountId, {
      eventId: corrected.event.id,
      projectId,
      reason: "Secret in the note.",
      sessionId,
    });
    const list = await access.list(accountId, projectId);
    const [session] = list.sessions;
    expect(session?.reviewState).toBe("Closed");
    expect(session?.newContextAfterClose).toBe(true);
    expect(session?.items.map((item) => item.rawResult)).toEqual([
      "FAIL",
      "pass",
    ]);
    expect(session?.items.map((item) => item.current.usable)).toEqual([
      false,
      false,
    ]);
    expect(JSON.stringify(list)).not.toContain("secret-note");
    expect(list.resultEvents).toHaveLength(3);
  });

  test("Supersedes is acyclic, follow-up work carries the exact origin and no result is written", async () => {
    const access = createDatabaseTestReview(requireDatabase());
    const receipt = await access.supersede(accountId, {
      newerSessionTestId: itemB,
      olderSessionTestId: itemA,
      projectId,
    });
    expect(receipt.supersession.older.rawResult).toBe("FAIL");
    await expect(
      access.supersede(accountId, {
        newerSessionTestId: itemA,
        olderSessionTestId: itemB,
        projectId,
      }),
    ).rejects.toMatchObject({ code: "TEST_REVIEW_SUPERSEDE_CYCLE" });

    const target = { mode: "new" as const, workType: "Bug" as const };
    const preview = await access.previewFollowUp(accountId, {
      projectId,
      sessionTestIds: [itemA],
      target,
    });
    const workId = `work-${suffix}`;
    const created = await access.commitFollowUp(accountId, {
      previewFingerprint: preview.fingerprint,
      projectId,
      sessionTestIds: [itemA],
      target,
      workId,
    });
    expect(created.links[0]?.workKey?.endsWith("-1")).toBe(true);
    const [row] = await requireDatabase()
      .select({
        component: work.originComponentId,
        owner: work.originOwnerRecordId,
      })
      .from(work)
      .where(eq(work.id, workId));
    expect(row).toEqual({ component: itemA, owner: sessionId });

    const attached = await access.commitFollowUp(accountId, {
      projectId,
      sessionTestIds: [itemB],
      previewFingerprint: (
        await access.previewFollowUp(accountId, {
          projectId,
          sessionTestIds: [itemB],
          // The founder may name the target İş by its visible key too.
          target: { mode: "existing", workId: created.links[0]?.workKey ?? "" },
        })
      ).fingerprint,
      target: { mode: "existing", workId: created.links[0]?.workKey ?? "" },
      workId: "ignored",
    });
    expect(attached.links[0]?.mode).toBe("Attached");
    const list = await access.list(accountId, projectId);
    expect(list.followUps).toHaveLength(2);
    expect(
      list.sessions[0]?.items.map((item) => item.normalizedResult),
    ).toEqual(["Failed", "Passed"]);
  });

  test("New context after close survives more than 500 later review events", async () => {
    const access = createDatabaseTestReview(requireDatabase());
    await access.setSessionReviewState(accountId, {
      projectId,
      sessionId,
      state: "Closed",
    });
    const listed = await access.list(accountId, projectId);
    const close = listed.events.find((event) => event.toState === "Closed");
    if (!close) {
      throw new Error("No close event");
    }
    const closeAt = Date.parse(close.recordedAt);
    // Synthetic fixture history written strictly after the close, larger than
    // any display cap: the derivation must read the whole review history.
    const fillers = 600;
    await requireDatabase()
      .insert(testReviewEvent)
      .values(
        Array.from({ length: fillers }, (_, index) => ({
          action: "Review state set",
          actorAccountId: accountId,
          batchId: null,
          fromState: "Reviewed",
          id: `filler-${index}-${suffix}`,
          projectId,
          reason: null,
          recordedAt: new Date(closeAt + index + 1),
          remaining: null,
          sessionId,
          sessionTestId: itemA,
          toState: "Reviewed",
        })),
      );
    await access.recordCorrection(accountId, {
      correctedResult: "passed",
      note: null,
      projectId,
      reason: "After the close.",
      sessionId,
      sessionTestId: itemB,
    });
    const after = await access.list(accountId, projectId);
    const [session] = after.sessions;
    expect(session?.reviewState).toBe("Closed");
    expect(session?.newContextAfterClose).toBe(true);
    // The seam lists the full review history, never a capped slice.
    expect(after.events.length).toBeGreaterThan(fillers);
  });

  test("the bulk commit is atomic and idempotent", async () => {
    const access = createDatabaseTestReview(requireDatabase());
    const selection = { projectId, sessionId, sessionTestIds: [itemA] };
    const preview = await access.previewBulkReview(accountId, selection);
    expect(preview.changes).toHaveLength(2);
    const first = await access.commitBulkReview(accountId, {
      ...selection,
      previewFingerprint: preview.fingerprint,
    });
    expect(first.outcome).toBe("applied");
    const again = await access.commitBulkReview(accountId, {
      ...selection,
      previewFingerprint: preview.fingerprint,
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
