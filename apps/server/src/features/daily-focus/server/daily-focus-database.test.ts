import { createDb } from "@cantiara/db";
import { accountPreferences, user, workspace } from "@cantiara/db/schema/auth";
import { projectBacklogOrder } from "@cantiara/db/schema/backlog";
import { decision } from "@cantiara/db/schema/decision";
import { mutationHistory } from "@cantiara/db/schema/mutation";
import {
  priorityMetricDefinition,
  workPriorityMetricValue,
} from "@cantiara/db/schema/priority-metrics";
import { productionIncident } from "@cantiara/db/schema/production-incident";
import { project } from "@cantiara/db/schema/project";
import { projectMilestone } from "@cantiara/db/schema/project-milestone";
import { projectRelease } from "@cantiara/db/schema/project-release";
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
      sourceId: firstWorkId,
      sourceKey: "ALPHA-1",
      sourceTitle: "First Work",
      sourceType: "Work",
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

  test("derives source lifecycle events on the profile day", async () => {
    if (!database) {
      throw new Error("ACCOUNT_ACCESS_DATABASE_URL is required");
    }
    const focus = createDatabaseDailyFocus(database);
    const focusDate = "2026-03-08";
    const decisionId = `decision-${crypto.randomUUID()}`;
    const milestoneId = `milestone-${crypto.randomUUID()}`;
    const releaseId = `release-${crypto.randomUUID()}`;
    const incidentId = `incident-${crypto.randomUUID()}`;
    const nextDayIncidentId = `incident-${crypto.randomUUID()}`;
    const milestoneHistoryId = `history-${crypto.randomUUID()}`;
    const releaseHistoryId = `history-${crypto.randomUUID()}`;
    const incidentHistoryId = `history-${crypto.randomUUID()}`;
    const nextDayIncidentHistoryId = `history-${crypto.randomUUID()}`;

    await database.insert(accountPreferences).values({
      accountId: firstAccountId,
      timeZone: "America/Los_Angeles",
    });
    await database.insert(decision).values({
      createdAt: new Date("2026-03-08T08:00:00.000Z"),
      decision: "Keep the first release small.",
      id: decisionId,
      life: "Valid",
      projectId: firstProjectId,
      rationale: null,
      title: "First release scope",
      updatedAt: new Date("2026-03-08T08:00:00.000Z"),
    });
    await database.insert(projectMilestone).values({
      createdAt: new Date("2026-03-07T12:00:00.000Z"),
      description: null,
      id: milestoneId,
      projectId: firstProjectId,
      status: "Reached",
      targetDate: null,
      title: "Private beta",
      updatedAt: new Date("2026-03-08T08:01:00.000Z"),
    });
    await database.insert(projectRelease).values({
      createdAt: new Date("2026-03-07T12:00:00.000Z"),
      description: null,
      id: releaseId,
      name: "First release",
      projectId: firstProjectId,
      status: "Published",
      updatedAt: new Date("2026-03-09T06:59:59.000Z"),
      versionLabel: "1.0.0",
    });
    await database.insert(productionIncident).values([
      {
        createdAt: new Date("2026-03-07T12:00:00.000Z"),
        detectedHow: null,
        id: incidentId,
        impact: "Requests were delayed.",
        learning: null,
        occurredAt: new Date("2026-03-08T06:30:00.000Z"),
        projectId: firstProjectId,
        resolution: null,
        rootCause: null,
        status: "Resolved",
        title: "Queue delay",
        updatedAt: new Date("2026-03-08T10:00:00.000Z"),
      },
      {
        createdAt: new Date("2026-03-07T12:00:00.000Z"),
        detectedHow: null,
        id: nextDayIncidentId,
        impact: "A separate queue stalled.",
        learning: null,
        occurredAt: new Date("2026-03-09T06:30:00.000Z"),
        projectId: firstProjectId,
        resolution: null,
        rootCause: null,
        status: "Resolved",
        title: "Next-day queue delay",
        updatedAt: new Date("2026-03-09T07:00:00.000Z"),
      },
    ]);
    await database.insert(mutationHistory).values([
      {
        actorId: firstAccountId,
        actorType: "User",
        id: milestoneHistoryId,
        nextValue: { milestone: { status: "Reached" } },
        occurredAt: new Date("2026-03-08T08:01:00.000Z"),
        originKind: "human",
        payloadFingerprint: "1".repeat(64),
        previousValue: { milestone: { status: "Planned" } },
        revision: 2,
        targetId: milestoneId,
      },
      {
        actorId: firstAccountId,
        actorType: "User",
        id: releaseHistoryId,
        nextValue: { projectRelease: { status: "Published" } },
        occurredAt: new Date("2026-03-09T06:59:59.000Z"),
        originKind: "human",
        payloadFingerprint: "2".repeat(64),
        previousValue: { projectRelease: { status: "Preparing" } },
        revision: 2,
        targetId: releaseId,
      },
      {
        actorId: firstAccountId,
        actorType: "User",
        id: incidentHistoryId,
        nextValue: { productionIncident: { status: "Resolved" } },
        occurredAt: new Date("2026-03-09T07:00:00.000Z"),
        originKind: "human",
        payloadFingerprint: "3".repeat(64),
        previousValue: { productionIncident: { status: "Watching" } },
        revision: 2,
        targetId: incidentId,
      },
      {
        actorId: firstAccountId,
        actorType: "User",
        id: nextDayIncidentHistoryId,
        nextValue: { productionIncident: { status: "Resolved" } },
        occurredAt: new Date("2026-03-09T07:00:00.000Z"),
        originKind: "human",
        payloadFingerprint: "4".repeat(64),
        previousValue: { productionIncident: { status: "Watching" } },
        revision: 2,
        targetId: nextDayIncidentId,
      },
    ]);

    const { events } = await focus.list(firstAccountId, focusDate);
    expect(
      events.map(({ kind, sourceId, sourceType }) => ({
        kind,
        sourceId,
        sourceType,
      })),
    ).toEqual([
      { kind: "Recorded", sourceId: decisionId, sourceType: "Decision" },
      { kind: "Reached", sourceId: milestoneId, sourceType: "Milestone" },
      {
        kind: "Resolved",
        sourceId: incidentId,
        sourceType: "Production Incident",
      },
      {
        kind: "Published",
        sourceId: releaseId,
        sourceType: "Project Release",
      },
    ]);
    expect(events.map(({ occurredAt }) => occurredAt)).toEqual([
      "2026-03-08T08:00:00.000Z",
      "2026-03-08T08:01:00.000Z",
      "2026-03-08T10:00:00.000Z",
      "2026-03-09T06:59:59.000Z",
    ]);
    expect(
      events.every(
        ({ projectId, projectName }) =>
          projectId === firstProjectId && projectName === "Alpha",
      ),
    ).toBe(true);
    expect(events.map(({ sourceTitle }) => sourceTitle)).toEqual([
      "First release scope",
      "Private beta",
      "Queue delay",
      "First release",
    ]);
  });
});
