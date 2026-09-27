import { createDb } from "@cantiara/db";
import { user, workspace } from "@cantiara/db/schema/auth";
import { projectBacklogOrder } from "@cantiara/db/schema/backlog";
import { mutationHistory, mutationReceipt } from "@cantiara/db/schema/mutation";
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
import { createDatabaseBacklog } from "../../backlog/server/backlog-database";
import { createDatabaseProjectShell } from "../../project-shell/server/project-shell-database";
import { createDatabaseWorkLifecycle } from "../../work-lifecycle/server/work-lifecycle-database";
import {
  createDatabaseWorkNotNow,
  WorkNotNowConflictError,
} from "./not-now-database";

const databaseUrl = process.env.ACCOUNT_ACCESS_DATABASE_URL;
const describeDatabase = databaseUrl ? describe : describe.skip;

describeDatabase("Roadmap Horizon Not now PostgreSQL contract", () => {
  const database = databaseUrl
    ? createDb({ DATABASE_URL: databaseUrl })
    : undefined;
  const accountId = `not-now-${crypto.randomUUID()}`;
  const workspaceId = `workspace-${crypto.randomUUID()}`;

  beforeEach(async () => {
    if (!database) {
      throw new Error("ACCOUNT_ACCESS_DATABASE_URL is required");
    }
    await database.insert(user).values({
      email: `${accountId}@example.invalid`,
      id: accountId,
      name: "Founder",
    });
    await database
      .insert(workspace)
      .values({ id: workspaceId, ownerAccountId: accountId });
  });

  afterEach(async () => {
    await database
      ?.delete(mutationHistory)
      .where(eq(mutationHistory.actorId, accountId));
    await database
      ?.delete(mutationReceipt)
      .where(eq(mutationReceipt.actorId, accountId));
    await database?.delete(user).where(eq(user.id, accountId));
  });

  afterAll(async () => {
    await database?.$client.end();
  });

  test("records, replaces, and reconsiders a trail without changing Work or Backlog", async () => {
    if (!database) {
      throw new Error("ACCOUNT_ACCESS_DATABASE_URL is required");
    }
    const profile = await createDatabaseProjectShell(database).create(
      accountId,
      {
        name: "Not now Project",
        shortCode: "NNW",
        starterConfiguration: "Blank Project",
      },
    );
    const workId = `work-${crypto.randomUUID()}`;
    await database.insert(work).values({
      id: workId,
      key: "NNW-1",
      number: 1,
      plannedStartDate: "2026-10-01",
      projectId: profile.id,
      roadmapHorizon: "Next",
      status: "Blocked",
      targetDate: "2026-10-31",
      title: "Validate the customer problem",
      type: "Research",
    });
    await database.insert(projectBacklogOrder).values({
      projectId: profile.id,
      revision: 1,
      workIds: [workId],
    });

    const notNow = createDatabaseWorkNotNow(database);
    const lifecycle = createDatabaseWorkLifecycle(database);
    const backlog = createDatabaseBacklog(database);
    const before = await lifecycle.find(accountId, workId);
    if (!before) {
      throw new Error("Expected Work");
    }

    const firstTrail = await notNow.record(accountId, {
      baseRevision: 0,
      clientIdempotencyKey: "not-now-first",
      condition: "After the next customer interview.",
      groundRelationIds: [],
      reason: "The problem needs more evidence.",
      workId,
    });
    expect(firstTrail).toMatchObject({
      condition: "After the next customer interview.",
      reason: "The problem needs more evidence.",
      revision: 1,
      status: "Active",
    });
    if (!firstTrail) {
      throw new Error("Expected first Not now trail");
    }
    expect(
      await notNow.record(accountId, {
        baseRevision: 0,
        clientIdempotencyKey: "not-now-first",
        condition: "After the next customer interview.",
        groundRelationIds: [],
        reason: "The problem needs more evidence.",
        workId,
      }),
    ).toMatchObject({ id: firstTrail?.id, status: "Active" });

    const secondTrail = await notNow.record(accountId, {
      baseRevision: 1,
      clientIdempotencyKey: "not-now-replacement",
      condition: null,
      groundRelationIds: [],
      reason: "The project needs a different prerequisite.",
      workId,
    });
    expect(secondTrail).toMatchObject({ revision: 3, status: "Active" });
    if (!secondTrail) {
      throw new Error("Expected replacement Not now trail");
    }
    const historyAfterReplacement = await notNow.history(accountId, workId);
    expect(historyAfterReplacement).toHaveLength(2);
    expect(historyAfterReplacement).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          condition: "After the next customer interview.",
          createdByAccountId: accountId,
          reason: "The problem needs more evidence.",
          status: "Replaced",
        }),
        expect.objectContaining({
          reason: "The project needs a different prerequisite.",
          status: "Active",
        }),
      ]),
    );
    expect((await backlog.list(workspaceId, profile.id))?.workIds).toEqual([
      workId,
    ]);
    await expect(
      notNow.record(accountId, {
        baseRevision: 1,
        clientIdempotencyKey: "not-now-stale",
        condition: null,
        groundRelationIds: [],
        reason: "Stale decision.",
        workId,
      }),
    ).rejects.toBeInstanceOf(WorkNotNowConflictError);

    const closedWork = await lifecycle.close(
      accountId,
      {
        baseRevision: before.revision,
        clientIdempotencyKey: "close-work",
        closureResult: "Completed",
        workId,
      },
      { kind: "Visible user" },
    );
    expect(closedWork.status).toBe("Closed");
    const activeWhileWorkIsClosed = await notNow.history(accountId, workId);
    expect(activeWhileWorkIsClosed?.[0]).toMatchObject({
      id: secondTrail?.id,
      status: "Active",
    });

    const reconsidered = await notNow.reconsider(accountId, {
      baseRevision: 3,
      clientIdempotencyKey: "not-now-reconsider",
      trailId: secondTrail.id,
      workId,
    });
    expect(reconsidered).toMatchObject({
      id: secondTrail?.id,
      reason: "The project needs a different prerequisite.",
      status: "Reconsidered",
    });

    const listedWork = (await lifecycle.list(accountId, profile.id)).find(
      (item) => item.id === workId,
    );
    expect(listedWork).toMatchObject({
      notNow: { activeTrail: null, revision: 4 },
      plannedStartDate: "2026-10-01",
      roadmapHorizon: "Next",
      status: "Closed",
      targetDate: "2026-10-31",
    });
  });
});
