import { createDb } from "@cantiara/db";
import { accountPreferences, user, workspace } from "@cantiara/db/schema/auth";
import { projectBacklogOrder } from "@cantiara/db/schema/backlog";
import { mutationHistory } from "@cantiara/db/schema/mutation";
import {
  priorityMetricDefinition,
  workPriorityMetricValue,
} from "@cantiara/db/schema/priority-metrics";
import { project } from "@cantiara/db/schema/project";
import { work } from "@cantiara/db/schema/work";
import { asc, eq, inArray } from "drizzle-orm";
import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  test,
} from "vitest";
import { createDatabaseDailyFocus } from "./daily-focus-database";

const databaseUrl = process.env.ACCOUNT_ACCESS_DATABASE_URL;
const describeDatabase = databaseUrl ? describe : describe.skip;

describeDatabase("Daily Focus personal day membership", () => {
  const database = databaseUrl
    ? createDb({ DATABASE_URL: databaseUrl })
    : undefined;
  const firstAccountId = `daily-focus-${crypto.randomUUID()}`;
  const secondAccountId = `daily-focus-${crypto.randomUUID()}`;
  const firstWorkspaceId = `workspace-${crypto.randomUUID()}`;
  const secondWorkspaceId = `workspace-${crypto.randomUUID()}`;
  const firstProjectId = `project-${crypto.randomUUID()}`;
  const secondProjectId = `project-${crypto.randomUUID()}`;
  const firstWorkId = `work-${crypto.randomUUID()}`;
  const secondWorkId = `work-${crypto.randomUUID()}`;
  const metricId = `metric-${crypto.randomUUID()}`;
  const secondMetricId = `metric-${crypto.randomUUID()}`;
  const priorityDescriptions = {
    "Very low": "Very low impact",
    Low: "Low impact",
    Medium: "Medium impact",
    High: "High impact",
    "Very high": "Very high impact",
  };

  beforeEach(async () => {
    if (!database) {
      throw new Error("ACCOUNT_ACCESS_DATABASE_URL is required");
    }
    await database.insert(user).values([
      {
        id: firstAccountId,
        email: `${firstAccountId}@example.invalid`,
        name: "Founder",
      },
      {
        id: secondAccountId,
        email: `${secondAccountId}@example.invalid`,
        name: "Other",
      },
    ]);
    await database.insert(workspace).values([
      { id: firstWorkspaceId, ownerAccountId: firstAccountId },
      { id: secondWorkspaceId, ownerAccountId: secondAccountId },
    ]);
    await database.insert(project).values([
      {
        id: firstProjectId,
        workspaceId: firstWorkspaceId,
        name: "Alpha",
        shortCode: "ALPHA",
        starterConfiguration: "Blank Project",
      },
      {
        id: secondProjectId,
        workspaceId: firstWorkspaceId,
        name: "Beta",
        shortCode: "BETA",
        starterConfiguration: "Blank Project",
      },
    ]);
    await database.insert(work).values([
      {
        id: firstWorkId,
        projectId: firstProjectId,
        key: "ALPHA-1",
        number: 1,
        title: "First Work",
        type: "Task",
        status: "Blocked",
      },
      {
        id: secondWorkId,
        projectId: secondProjectId,
        key: "BETA-1",
        number: 1,
        title: "Second Work",
        type: "Task",
        status: "In Progress",
      },
    ]);
    await database.insert(projectBacklogOrder).values([
      { projectId: firstProjectId, workIds: [firstWorkId], revision: 1 },
      { projectId: secondProjectId, workIds: [secondWorkId], revision: 2 },
    ]);
    await database.insert(priorityMetricDefinition).values([
      {
        id: metricId,
        projectId: firstProjectId,
        name: "Impact",
        nameKey: "impact",
        shortDescription: "Expected impact",
        rankDescriptions: priorityDescriptions,
      },
      {
        id: secondMetricId,
        projectId: secondProjectId,
        name: "Impact",
        nameKey: "impact",
        shortDescription: "Expected impact",
        rankDescriptions: priorityDescriptions,
      },
    ]);
    await database.insert(workPriorityMetricValue).values([
      {
        id: `value-${crypto.randomUUID()}`,
        metricId,
        projectId: firstProjectId,
        rank: "High",
        workId: firstWorkId,
      },
      {
        id: `value-${crypto.randomUUID()}`,
        metricId: secondMetricId,
        projectId: secondProjectId,
        rank: "Low",
        workId: secondWorkId,
      },
    ]);
  });

  afterEach(async () => {
    await database?.delete(user).where(eq(user.id, firstAccountId));
    await database?.delete(user).where(eq(user.id, secondAccountId));
    await database
      ?.delete(mutationHistory)
      .where(eq(mutationHistory.actorId, firstAccountId));
  });

  afterAll(async () => {
    await database?.$client.end();
  });

  test("selects Work across Projects for one day without workflow writes or rollover", async () => {
    if (!database) {
      throw new Error("ACCOUNT_ACCESS_DATABASE_URL is required");
    }
    const focus = createDatabaseDailyFocus(database);
    const workIds = [firstWorkId, secondWorkId];
    const projectIds = [firstProjectId, secondProjectId];
    const readWorks = () =>
      database
        .select()
        .from(work)
        .where(inArray(work.id, workIds))
        .orderBy(asc(work.id));
    const readProjects = () =>
      database
        .select()
        .from(project)
        .where(inArray(project.id, projectIds))
        .orderBy(asc(project.id));
    const readOrders = () =>
      database
        .select()
        .from(projectBacklogOrder)
        .where(inArray(projectBacklogOrder.projectId, projectIds))
        .orderBy(asc(projectBacklogOrder.projectId));
    const readPriorities = () =>
      database
        .select()
        .from(workPriorityMetricValue)
        .where(inArray(workPriorityMetricValue.workId, workIds))
        .orderBy(asc(workPriorityMetricValue.workId));
    const [beforeWork, beforeProject, beforeOrder, beforePriority] =
      await Promise.all([
        readWorks(),
        readProjects(),
        readOrders(),
        readPriorities(),
      ]);

    await focus.add(firstAccountId, "2026-09-27", firstWorkId);
    await focus.add(firstAccountId, "2026-09-27", secondWorkId);
    await focus.add(firstAccountId, "2026-09-27", firstWorkId);
    expect(
      (await focus.list(firstAccountId, "2026-09-27")).members.map(
        ({ id }) => id,
      ),
    ).toEqual([firstWorkId, secondWorkId]);
    expect((await focus.list(firstAccountId, "2026-09-28")).members).toEqual(
      [],
    );
    expect((await focus.list(secondAccountId, "2026-09-27")).members).toEqual(
      [],
    );
    expect((await focus.list(secondAccountId, "2026-09-27")).available).toEqual(
      [],
    );
    await expect(
      focus.add(secondAccountId, "2026-09-27", firstWorkId),
    ).rejects.toThrow();

    await focus.remove(firstAccountId, "2026-09-27", firstWorkId);
    expect(
      (await focus.list(firstAccountId, "2026-09-27")).members.map(
        ({ id }) => id,
      ),
    ).toEqual([secondWorkId]);
    expect(await readWorks()).toEqual(beforeWork);
    expect(await readProjects()).toEqual(beforeProject);
    expect(await readOrders()).toEqual(beforeOrder);
    expect(await readPriorities()).toEqual(beforePriority);
  });

  test("hides archived Work and rejects new membership while allowing removal", async () => {
    if (!database) {
      throw new Error("ACCOUNT_ACCESS_DATABASE_URL is required");
    }
    const focus = createDatabaseDailyFocus(database);
    const focusDate = "2026-09-27";

    await focus.add(firstAccountId, focusDate, firstWorkId);
    await database
      .update(work)
      .set({ archivedAt: new Date("2026-09-27T12:00:00.000Z") })
      .where(eq(work.id, firstWorkId));

    const archivedDay = await focus.list(firstAccountId, focusDate);
    expect(archivedDay.members.map(({ id }) => id)).not.toContain(firstWorkId);
    expect(archivedDay.available.map(({ id }) => id)).not.toContain(
      firstWorkId,
    );
    await expect(
      focus.add(firstAccountId, focusDate, firstWorkId),
    ).rejects.toThrow();
    await expect(
      focus.remove(firstAccountId, focusDate, firstWorkId),
    ).resolves.toBeUndefined();
  });

  test("derives Work lifecycle events from the profile day without changing their timestamps", async () => {
    if (!database) {
      throw new Error("ACCOUNT_ACCESS_DATABASE_URL is required");
    }
    const focus = createDatabaseDailyFocus(database);
    const focusDate = "2026-03-08";
    const beforeDayId = `history-${crypto.randomUUID()}`;
    const reopenedId = `history-${crypto.randomUUID()}`;
    const abandonedId = `history-${crypto.randomUUID()}`;
    const completedId = `history-${crypto.randomUUID()}`;
    const afterDayId = `history-${crypto.randomUUID()}`;
    const unchangedStatusId = `history-${crypto.randomUUID()}`;
    const workValue = (status: string, closureResult: string | null) => ({
      work: { closureResult, status },
    });

    await database.insert(accountPreferences).values({
      accountId: firstAccountId,
      timeZone: "America/New_York",
    });
    await database.insert(mutationHistory).values([
      {
        actorId: firstAccountId,
        actorType: "User",
        id: beforeDayId,
        nextValue: workValue("Closed", "Completed"),
        occurredAt: new Date("2026-03-08T04:59:00.000Z"),
        originKind: "human",
        payloadFingerprint: "a".repeat(64),
        previousValue: workValue("In Progress", null),
        revision: 1,
        targetId: firstWorkId,
      },
      {
        actorId: firstAccountId,
        actorType: "User",
        id: reopenedId,
        nextValue: workValue("In Progress", null),
        occurredAt: new Date("2026-03-08T05:00:00.000Z"),
        originKind: "human",
        payloadFingerprint: "b".repeat(64),
        previousValue: workValue("Closed", "Completed"),
        revision: 2,
        targetId: firstWorkId,
      },
      {
        actorId: firstAccountId,
        actorType: "User",
        id: abandonedId,
        nextValue: workValue("Closed", "Abandoned"),
        occurredAt: new Date("2026-03-08T13:00:00.000Z"),
        originKind: "human",
        payloadFingerprint: "f".repeat(64),
        previousValue: workValue("In Progress", null),
        revision: 1,
        targetId: secondWorkId,
      },
      {
        actorId: firstAccountId,
        actorType: "User",
        id: completedId,
        nextValue: workValue("Closed", "Completed"),
        occurredAt: new Date("2026-03-09T03:59:00.000Z"),
        originKind: "human",
        payloadFingerprint: "c".repeat(64),
        previousValue: workValue("In Progress", null),
        revision: 3,
        targetId: firstWorkId,
      },
      {
        actorId: firstAccountId,
        actorType: "User",
        id: afterDayId,
        nextValue: workValue("In Progress", null),
        occurredAt: new Date("2026-03-09T04:00:00.000Z"),
        originKind: "human",
        payloadFingerprint: "d".repeat(64),
        previousValue: workValue("Closed", "Completed"),
        revision: 4,
        targetId: firstWorkId,
      },
      {
        actorId: firstAccountId,
        actorType: "User",
        id: unchangedStatusId,
        nextValue: workValue("In Progress", null),
        occurredAt: new Date("2026-03-08T12:00:00.000Z"),
        originKind: "human",
        payloadFingerprint: "e".repeat(64),
        previousValue: workValue("In Progress", null),
        revision: 5,
        targetId: firstWorkId,
      },
    ]);

    const historyBeforeRead = await database
      .select()
      .from(mutationHistory)
      .where(eq(mutationHistory.actorId, firstAccountId))
      .orderBy(asc(mutationHistory.occurredAt), asc(mutationHistory.id));
    const newYorkDay = await focus.list(firstAccountId, focusDate);

    expect(newYorkDay.events.map(({ id, kind }) => [id, kind])).toEqual([
      [reopenedId, "Reopened"],
      [abandonedId, "Abandoned"],
      [completedId, "Completed"],
    ]);
    expect(newYorkDay.events[0]).toMatchObject({
      projectId: firstProjectId,
      projectName: "Alpha",
      workId: firstWorkId,
      workKey: "ALPHA-1",
      workTitle: "First Work",
    });

    await database
      .update(accountPreferences)
      .set({ timeZone: "UTC" })
      .where(eq(accountPreferences.accountId, firstAccountId));
    const utcDay = await focus.list(firstAccountId, focusDate);

    expect(utcDay.events.map(({ id, kind }) => [id, kind])).toEqual([
      [beforeDayId, "Completed"],
      [reopenedId, "Reopened"],
      [abandonedId, "Abandoned"],
    ]);
    expect(
      (
        await database
          .select()
          .from(mutationHistory)
          .where(eq(mutationHistory.actorId, firstAccountId))
          .orderBy(asc(mutationHistory.occurredAt), asc(mutationHistory.id))
      ).map(({ occurredAt }) => occurredAt.toISOString()),
    ).toEqual(
      historyBeforeRead.map(({ occurredAt }) => occurredAt.toISOString()),
    );
  });
});
