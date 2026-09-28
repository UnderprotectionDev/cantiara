import { priorityMetricNameKey } from "@cantiara/api/priority-metrics";
import { createDb } from "@cantiara/db";
import { user, workspace } from "@cantiara/db/schema/auth";
import { projectBacklogOrder } from "@cantiara/db/schema/backlog";
import { mutationHistory, mutationReceipt } from "@cantiara/db/schema/mutation";
import { personalReminder } from "@cantiara/db/schema/personal-reminders";
import {
  priorityMetricDefinition,
  workPriorityMetricValue,
} from "@cantiara/db/schema/priority-metrics";
import { work } from "@cantiara/db/schema/work";
import { workNotNowTrail } from "@cantiara/db/schema/work-not-now";
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
import { createDatabasePriorityMetrics } from "../../priority-metrics/server/priority-metrics-database";
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

    const metricId = `metric-${crypto.randomUUID()}`;
    const rankDescriptions = {
      High: "Repeated direct evidence.",
      Low: "Limited evidence.",
      Medium: "Some evidence.",
      "Very high": "Strong validated evidence.",
      "Very low": "No supporting evidence.",
    };
    await database.insert(priorityMetricDefinition).values({
      id: metricId,
      name: "Customer evidence",
      nameKey: priorityMetricNameKey("Customer evidence"),
      projectId: profile.id,
      rankDescriptions,
      shortDescription: "Strength of direct customer evidence.",
    });
    await database.insert(workPriorityMetricValue).values({
      id: `value-${crypto.randomUUID()}`,
      metricId,
      projectId: profile.id,
      rank: "High",
      workId,
    });

    const notNow = createDatabaseWorkNotNow(database);
    const priorityMetrics = createDatabasePriorityMetrics(database);
    const lifecycle = createDatabaseWorkLifecycle(database);
    const backlog = createDatabaseBacklog(database);
    const priorityValuesBefore = await priorityMetrics.projectValues(
      workspaceId,
      profile.id,
    );
    expect(priorityValuesBefore).not.toBeNull();
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
    const reviewLaterReminderId = `reminder-${crypto.randomUUID()}`;
    const unrelatedReminderId = `reminder-${crypto.randomUUID()}`;
    const triggeredReviewLaterId = `reminder-${crypto.randomUUID()}`;
    const otherWorkReminderId = `reminder-${crypto.randomUUID()}`;
    await database.insert(personalReminder).values([
      {
        accountId,
        action: "Review Later",
        condition: "In any case",
        fireAt: new Date("2026-12-01T09:00:00.000Z"),
        id: reviewLaterReminderId,
        sourceProjectId: profile.id,
        sourceRecordId: workId,
        sourceRecordType: "Work",
      },
      {
        accountId,
        action: "Remind me",
        condition: "In any case",
        fireAt: new Date("2026-12-02T09:00:00.000Z"),
        id: unrelatedReminderId,
        sourceProjectId: profile.id,
        sourceRecordId: workId,
        sourceRecordType: "Work",
      },
      {
        accountId,
        action: "Review Later",
        condition: "In any case",
        fireAt: new Date("2026-11-30T09:00:00.000Z"),
        id: triggeredReviewLaterId,
        sourceProjectId: profile.id,
        sourceRecordId: workId,
        sourceRecordType: "Work",
        status: "Triggered",
        triggeredAt: new Date("2026-11-30T09:00:00.000Z"),
      },
      {
        accountId,
        action: "Review Later",
        condition: "In any case",
        fireAt: new Date("2026-12-04T09:00:00.000Z"),
        id: otherWorkReminderId,
        sourceProjectId: profile.id,
        sourceRecordId: `work-${crypto.randomUUID()}`,
        sourceRecordType: "Work",
      },
    ]);
    const historicalGround = {
      key: "DEC-17",
      projectId: profile.id,
      recordId: `decision-${crypto.randomUUID()}`,
      recordType: "Decision" as const,
      relationId: `relation-${crypto.randomUUID()}`,
      title: "Confirm the customer problem",
    };
    const historicalCreatedAt = new Date("2026-01-15T12:30:00.000Z");
    await database
      .update(workNotNowTrail)
      .set({ createdAt: historicalCreatedAt, grounds: [historicalGround] })
      .where(eq(workNotNowTrail.id, firstTrail.id));
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
      reviewLaterHandling: "Remove Review later",
      workId,
    });
    expect(secondTrail).toMatchObject({ revision: 3, status: "Active" });
    if (!secondTrail) {
      throw new Error("Expected replacement Not now trail");
    }
    const reconsiderGround = {
      key: null,
      projectId: profile.id,
      recordId: `source-${crypto.randomUUID()}`,
      recordType: "Source" as const,
      relationId: `relation-${crypto.randomUUID()}`,
      title: "Interview notes",
    };
    const reconsiderCreatedAt = new Date("2026-02-16T10:45:00.000Z");
    await database
      .update(workNotNowTrail)
      .set({ createdAt: reconsiderCreatedAt, grounds: [reconsiderGround] })
      .where(eq(workNotNowTrail.id, secondTrail.id));
    const historyAfterReplacement = await notNow.history(accountId, workId);
    expect(historyAfterReplacement).toHaveLength(2);
    expect(historyAfterReplacement).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          condition: "After the next customer interview.",
          createdByAccountId: accountId,
          createdAt: historicalCreatedAt.toISOString(),
          grounds: [historicalGround],
          reason: "The problem needs more evidence.",
          status: "Replaced",
        }),
        expect.objectContaining({
          condition: null,
          createdAt: reconsiderCreatedAt.toISOString(),
          createdByAccountId: accountId,
          grounds: [reconsiderGround],
          reason: "The project needs a different prerequisite.",
          status: "Active",
        }),
      ]),
    );
    expect(
      await priorityMetrics.projectValues(workspaceId, profile.id),
    ).toEqual(priorityValuesBefore);
    const remindersAfterReplacement = await database
      .select()
      .from(personalReminder)
      .where(eq(personalReminder.accountId, accountId));
    expect(remindersAfterReplacement).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          action: "Review Later",
          id: reviewLaterReminderId,
          status: "Cancelled",
        }),
        expect.objectContaining({
          action: "Remind me",
          id: unrelatedReminderId,
          status: "Planned",
        }),
        expect.objectContaining({
          id: triggeredReviewLaterId,
          status: "Triggered",
        }),
        expect.objectContaining({
          id: otherWorkReminderId,
          status: "Planned",
        }),
      ]),
    );
    const workAfterReplacement = await lifecycle.find(accountId, workId);
    expect(workAfterReplacement).toMatchObject({
      plannedStartDate: before.plannedStartDate,
      roadmapHorizon: before.roadmapHorizon,
      status: before.status,
      targetDate: before.targetDate,
    });
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

    const reconsiderReminderId = `reminder-${crypto.randomUUID()}`;
    await database.insert(personalReminder).values({
      accountId,
      action: "Review Later",
      condition: "In any case",
      fireAt: new Date("2026-12-03T09:00:00.000Z"),
      id: reconsiderReminderId,
      sourceProjectId: profile.id,
      sourceRecordId: workId,
      sourceRecordType: "Work",
    });

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
      reviewLaterHandling: "Keep Review later",
      trailId: secondTrail.id,
      workId,
    });
    expect(reconsidered).toMatchObject({
      id: secondTrail?.id,
      reason: "The project needs a different prerequisite.",
      status: "Reconsidered",
    });
    const historyAfterReconsider = await notNow.history(accountId, workId);
    expect(historyAfterReconsider).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          condition: "After the next customer interview.",
          createdAt: historicalCreatedAt.toISOString(),
          createdByAccountId: accountId,
          grounds: [historicalGround],
          reason: "The problem needs more evidence.",
          status: "Replaced",
        }),
        expect.objectContaining({
          createdByAccountId: accountId,
          condition: null,
          createdAt: reconsiderCreatedAt.toISOString(),
          grounds: [reconsiderGround],
          id: secondTrail.id,
          reason: "The project needs a different prerequisite.",
          status: "Reconsidered",
        }),
      ]),
    );
    const remindersAfterReconsider = await database
      .select()
      .from(personalReminder)
      .where(eq(personalReminder.accountId, accountId));
    expect(remindersAfterReconsider).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: reconsiderReminderId,
          status: "Planned",
        }),
        expect.objectContaining({
          id: unrelatedReminderId,
          status: "Planned",
        }),
      ]),
    );
    expect(
      await priorityMetrics.projectValues(workspaceId, profile.id),
    ).toEqual(priorityValuesBefore);

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
