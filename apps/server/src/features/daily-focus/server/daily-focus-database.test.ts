import { createDb } from "@cantiara/db";
import { user, workspace } from "@cantiara/db/schema/auth";
import { projectBacklogOrder } from "@cantiara/db/schema/backlog";
import {
  priorityMetricDefinition,
  workPriorityMetricValue,
} from "@cantiara/db/schema/priority-metrics";
import { project } from "@cantiara/db/schema/project";
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
    await database.insert(projectBacklogOrder).values({
      projectId: firstProjectId,
      workIds: [firstWorkId],
      revision: 1,
    });
    await database.insert(priorityMetricDefinition).values({
      id: metricId,
      projectId: firstProjectId,
      name: "Impact",
      nameKey: "impact",
      shortDescription: "Expected impact",
      rankDescriptions: {
        "Very low": "Very low impact",
        Low: "Low impact",
        Medium: "Medium impact",
        High: "High impact",
        "Very high": "Very high impact",
      },
    });
    await database.insert(workPriorityMetricValue).values({
      id: `value-${crypto.randomUUID()}`,
      metricId,
      projectId: firstProjectId,
      rank: "High",
      workId: firstWorkId,
    });
  });

  afterEach(async () => {
    await database?.delete(user).where(eq(user.id, firstAccountId));
    await database?.delete(user).where(eq(user.id, secondAccountId));
  });

  afterAll(async () => {
    await database?.$client.end();
  });

  test("selects Work across Projects for one day without workflow writes or rollover", async () => {
    if (!database) {
      throw new Error("ACCOUNT_ACCESS_DATABASE_URL is required");
    }
    const focus = createDatabaseDailyFocus(database);
    const beforeWork = await database
      .select()
      .from(work)
      .where(eq(work.id, firstWorkId));
    const beforeProject = await database
      .select()
      .from(project)
      .where(eq(project.id, firstProjectId));
    const beforeOrder = await database
      .select()
      .from(projectBacklogOrder)
      .where(eq(projectBacklogOrder.projectId, firstProjectId));
    const beforePriority = await database
      .select()
      .from(workPriorityMetricValue)
      .where(eq(workPriorityMetricValue.workId, firstWorkId));

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
    expect(
      await database.select().from(work).where(eq(work.id, firstWorkId)),
    ).toEqual(beforeWork);
    expect(
      await database
        .select()
        .from(project)
        .where(eq(project.id, firstProjectId)),
    ).toEqual(beforeProject);
    expect(
      await database
        .select()
        .from(projectBacklogOrder)
        .where(eq(projectBacklogOrder.projectId, firstProjectId)),
    ).toEqual(beforeOrder);
    expect(
      await database
        .select()
        .from(workPriorityMetricValue)
        .where(eq(workPriorityMetricValue.workId, firstWorkId)),
    ).toEqual(beforePriority);
  });
});
