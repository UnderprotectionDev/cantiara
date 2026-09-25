import type { Context } from "@cantiara/api/context";
import { appRouter } from "@cantiara/api/routers/index";
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
import { work } from "@cantiara/db/schema/work";
import { createRouterClient } from "@orpc/server";
import { eq, inArray } from "drizzle-orm";
import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from "vitest";
import { createDatabaseProjectShell } from "../../project-shell/server/project-shell-database";
import { createDatabaseProjectShellMutationContracts } from "../../project-shell/server/project-shell-mutation-database";
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
    const client = createRouterClient(appRouter, {
      context: {
        db: database,
        projectShell: shell,
        projectShellMutationContracts:
          createDatabaseProjectShellMutationContracts(database),
        session: { session: { id: "session-1" }, user: { id: accountId } },
      } as Context,
    });
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-09-25T12:00:00Z"));
    try {
      await client.updateProjectConfiguration({
        baseRevision: on.revision,
        change: { kind: "set-reappear-date-notification", enabled: true },
        clientIdempotencyKey: crypto.randomUUID(),
        projectId: on.id,
      });
    } finally {
      vi.useRealTimers();
    }
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
        presentation: "Action Required",
        projectId: on.id,
        reappearDate: "2026-09-26",
        signalId: `reappear-date:${onWorkId}:2026-09-26`,
        signalType: "reappear-date",
        sourcePath: `/projects/${on.id}#work-${onWorkId}`,
        sourceWorkId: onWorkId,
      },
    ]);
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-09-26T12:00:00Z"));
    try {
      await client.updateProjectConfiguration({
        baseRevision: off.revision,
        change: { kind: "set-reappear-date-notification", enabled: true },
        clientIdempotencyKey: crypto.randomUUID(),
        projectId: off.id,
      });
    } finally {
      vi.useRealTimers();
    }
    expect(
      await sweepDueReappearSignals(database, new Date("2026-09-26T12:01:00Z")),
    ).toBe(0);
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
