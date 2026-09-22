import { priorityMetricNameKey } from "@cantiara/api/priority-metrics";
import { createDb } from "@cantiara/db";
import { user, workspace } from "@cantiara/db/schema/auth";
import { priorityMetricDefinition } from "@cantiara/db/schema/priority-metrics";
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

import { createDatabaseProjectShell } from "../../project-shell/server/project-shell-database";
import { createDatabasePriorityMetrics } from "./priority-metrics-database";
import {
  createDatabasePriorityMetricMutationContracts,
  PriorityMetricTrashedError,
} from "./priority-metrics-mutation-database";

const databaseUrl = process.env.ACCOUNT_ACCESS_DATABASE_URL;
const describeDatabase = databaseUrl ? describe : describe.skip;

describeDatabase("Priority metrics PostgreSQL boundary", () => {
  const database = databaseUrl
    ? createDb({ DATABASE_URL: databaseUrl })
    : undefined;
  const accountId = `priority-metrics-${crypto.randomUUID()}`;
  const workspaceId = `workspace-${crypto.randomUUID()}`;

  beforeEach(async () => {
    if (!database) {
      throw new Error("ACCOUNT_ACCESS_DATABASE_URL is required");
    }
    await database.insert(user).values({
      email: `${accountId}@example.invalid`,
      id: accountId,
      name: "Priority metrics founder",
    });
    await database.insert(workspace).values({
      id: workspaceId,
      ownerAccountId: accountId,
    });
  });

  afterEach(async () => {
    await database?.delete(user).where(eq(user.id, accountId));
  });

  afterAll(async () => {
    await database?.$client.end();
  });

  test("makes a trashed criterion ineffective for reads and value writes", async () => {
    if (!database) {
      throw new Error("ACCOUNT_ACCESS_DATABASE_URL is required");
    }

    const projectShell = createDatabaseProjectShell(database);
    const project = await projectShell.create(accountId, {
      name: "Priority metrics trash test",
      starterConfiguration: "Blank Project",
    });
    const workId = `work-${crypto.randomUUID()}`;
    const metricId = `metric-${crypto.randomUUID()}`;
    const rankDescriptions = {
      High: "Repeated direct evidence.",
      Low: "Limited evidence.",
      Medium: "Some evidence.",
      "Very high": "Strong validated evidence.",
      "Very low": "No supporting evidence.",
    };

    await database.insert(work).values({
      id: workId,
      key: `${project.shortCode}-1`,
      number: 1,
      projectId: project.id,
      title: "Interview five customers",
      type: "Task",
    });
    await database.insert(priorityMetricDefinition).values({
      enabled: true,
      id: metricId,
      name: "Evidence strength",
      nameKey: priorityMetricNameKey("Evidence strength"),
      projectId: project.id,
      rankDescriptions,
      shortDescription: "How strongly evidence supports this Work.",
    });

    const metrics = createDatabasePriorityMetrics(database);
    await expect(metrics.list(workspaceId, project.id)).resolves.toHaveLength(
      1,
    );
    await expect(metrics.values(workspaceId, workId)).resolves.toMatchObject([
      { definition: { id: metricId }, value: null },
    ]);

    await database
      .update(priorityMetricDefinition)
      .set({ enabled: false, trashedAt: new Date() })
      .where(eq(priorityMetricDefinition.id, metricId));

    await expect(metrics.list(workspaceId, project.id)).resolves.toEqual([]);
    await expect(
      metrics.projectValues(workspaceId, project.id),
    ).resolves.toEqual({
      definitions: [],
      values: [],
    });
    await expect(metrics.values(workspaceId, workId)).resolves.toEqual([]);

    const setValue =
      createDatabasePriorityMetricMutationContracts(database).setValue(
        accountId,
      );
    await expect(
      setValue.mutate(
        {
          actor: { actorId: accountId, type: "User" },
          baseRevision: 0,
          clientIdempotencyKey: crypto.randomUUID(),
          kind: "human",
          payload: {
            metricId,
            projectId: project.id,
            rank: "High",
            workId,
          },
          targetId: `${workId}:${metricId}`,
        },
        ({ currentValue }) => currentValue,
      ),
    ).rejects.toBeInstanceOf(PriorityMetricTrashedError);
  });
});
