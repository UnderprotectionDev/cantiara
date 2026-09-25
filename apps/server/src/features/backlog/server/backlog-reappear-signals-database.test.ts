import { getProjectShellConfiguration } from "@cantiara/api/project-shell";
import { createDb } from "@cantiara/db";
import { accountPreferences, user, workspace } from "@cantiara/db/schema/auth";
import {
  projectBacklogOrder,
  projectBacklogReappearAttentionSignal,
} from "@cantiara/db/schema/backlog";
import {
  priorityMetricDefinition,
  workPriorityMetricValue,
} from "@cantiara/db/schema/priority-metrics";
import { project } from "@cantiara/db/schema/project";
import { work } from "@cantiara/db/schema/work";
import { eq, inArray } from "drizzle-orm";
import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  test,
} from "vitest";
import { createDatabaseProjectShell } from "../../project-shell/server/project-shell-database";
import { sweepDueReappearSignals } from "./backlog-reappear-signals";

const databaseUrl = process.env.ACCOUNT_ACCESS_DATABASE_URL;
const describeDatabase = databaseUrl ? describe : describe.skip;

describeDatabase("Backlog reappear-date signal PostgreSQL integration", () => {
  const database = databaseUrl
    ? createDb({ DATABASE_URL: databaseUrl })
    : undefined;
  const accountId = `reappear-${crypto.randomUUID()}`;
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
    await database
      .insert(accountPreferences)
      .values({ accountId, timeZone: "Pacific/Auckland" });
  });

  afterEach(async () => {
    await database?.delete(user).where(eq(user.id, accountId));
  });

  afterAll(async () => {
    await database?.$client.end();
  });

  test("default-off and Project opt-in produce one source-linked signal without writing Work or Backlog", async () => {
    if (!database) {
      throw new Error("ACCOUNT_ACCESS_DATABASE_URL is required");
    }
    const shell = createDatabaseProjectShell(database);
    const off = await shell.create(accountId, {
      name: "Off Project",
      shortCode: "OFF",
      starterConfiguration: "Blank Project",
    });
    const on = await shell.create(accountId, {
      name: "On Project",
      shortCode: "ONN",
      starterConfiguration: "Blank Project",
    });
    await database
      .update(project)
      .set({
        configuration: {
          ...getProjectShellConfiguration("Blank Project"),
          notifyOnReappearDate: true,
        },
      })
      .where(eq(project.id, on.id));
    const offWorkId = `work-${crypto.randomUUID()}`;
    const onWorkId = `work-${crypto.randomUUID()}`;
    await database.insert(work).values([
      {
        id: offWorkId,
        key: "OFF-1",
        number: 1,
        projectId: off.id,
        reappearDate: "2026-09-26",
        status: "Blocked",
        title: "Off Work",
        type: "Task",
      },
      {
        id: onWorkId,
        key: "ONN-1",
        number: 1,
        projectId: on.id,
        reappearDate: "2026-09-26",
        status: "Blocked",
        title: "On Work",
        type: "Task",
      },
    ]);
    await database
      .insert(projectBacklogOrder)
      .values({ projectId: on.id, workIds: [onWorkId] });
    const metricId = `metric-${crypto.randomUUID()}`;
    await database.insert(priorityMetricDefinition).values({
      id: metricId,
      name: "Importance",
      nameKey: "importance",
      projectId: on.id,
      rankDescriptions: {
        "Very low": "",
        Low: "",
        Medium: "",
        High: "",
        "Very high": "",
      },
      shortDescription: "Importance of Work",
    });
    await database.insert(workPriorityMetricValue).values({
      id: `value-${crypto.randomUUID()}`,
      metricId,
      projectId: on.id,
      rank: "High",
      workId: onWorkId,
    });
    const before = await database
      .select({
        id: work.id,
        status: work.status,
        revision: work.revision,
        reappearDate: work.reappearDate,
      })
      .from(work)
      .where(inArray(work.id, [offWorkId, onWorkId]));
    const orderBefore = await database
      .select()
      .from(projectBacklogOrder)
      .where(eq(projectBacklogOrder.projectId, on.id));
    const priorityBefore = await database
      .select()
      .from(workPriorityMetricValue)
      .where(eq(workPriorityMetricValue.workId, onWorkId));

    expect(
      await sweepDueReappearSignals(database, new Date("2026-09-25T11:59:00Z")),
    ).toBe(0);
    expect(
      await sweepDueReappearSignals(database, new Date("2026-09-25T12:00:00Z")),
    ).toBe(1);
    expect(
      await sweepDueReappearSignals(database, new Date("2026-09-25T12:01:00Z")),
    ).toBe(0);
    const signals = await database
      .select()
      .from(projectBacklogReappearAttentionSignal)
      .where(
        eq(projectBacklogReappearAttentionSignal.ownerAccountId, accountId),
      );
    expect(signals).toMatchObject([
      {
        presentation: "Action needed",
        projectId: on.id,
        reappearDate: "2026-09-26",
        signalId: `reappear-date:${onWorkId}:2026-09-26`,
        signalType: "reappear-date",
        sourcePath: `/projects/${on.id}#work-${onWorkId}`,
        sourceWorkId: onWorkId,
      },
    ]);
    expect(
      await database
        .select({
          id: work.id,
          status: work.status,
          revision: work.revision,
          reappearDate: work.reappearDate,
        })
        .from(work)
        .where(inArray(work.id, [offWorkId, onWorkId])),
    ).toEqual(before);
    expect(
      await database
        .select()
        .from(projectBacklogOrder)
        .where(eq(projectBacklogOrder.projectId, on.id)),
    ).toEqual(orderBefore);
    expect(
      await database
        .select()
        .from(workPriorityMetricValue)
        .where(eq(workPriorityMetricValue.workId, onWorkId)),
    ).toEqual(priorityBefore);
  });
});
