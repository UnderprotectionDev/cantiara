import type { Context } from "@cantiara/api/context";
import { appRouter } from "@cantiara/api/routers/index";
import { createDb } from "@cantiara/db";
import { user, workspace } from "@cantiara/db/schema/auth";
import {
  mutationHistory,
  mutationReceipt,
  mutationStaging,
  mutationTarget,
} from "@cantiara/db/schema/mutation";
import { createRouterClient } from "@orpc/server";
import { eq } from "drizzle-orm";
import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  test,
} from "vitest";
import { createDatabaseProjectShellMutationContracts } from "../../project-shell/server/project-shell-mutation-database";
import { createPriorityMetricsAccess } from "./priority-metrics";
import { createDatabasePriorityMetrics } from "./priority-metrics-database";

const databaseUrl = process.env.ACCOUNT_ACCESS_DATABASE_URL;
const describeDatabase = databaseUrl ? describe : describe.skip;

describeDatabase("Priority metrics project creation integration", () => {
  const database = databaseUrl
    ? createDb({ DATABASE_URL: databaseUrl })
    : undefined;
  const accountId = `project-shell-mutation-${crypto.randomUUID()}`;
  const workspaceId = `workspace-${crypto.randomUUID()}`;
  const mutationTargetId = `project-shell-create-${crypto.randomUUID()}`;

  beforeEach(async () => {
    if (!database) {
      throw new Error("ACCOUNT_ACCESS_DATABASE_URL is required");
    }
    await database.insert(user).values({
      email: `${accountId}@example.invalid`,
      id: accountId,
      name: "Project Shell mutation founder",
    });
    await database.insert(workspace).values({
      id: workspaceId,
      ownerAccountId: accountId,
    });
  });

  afterEach(async () => {
    await database
      ?.delete(mutationStaging)
      .where(eq(mutationStaging.targetId, mutationTargetId));
    await database
      ?.delete(mutationHistory)
      .where(eq(mutationHistory.targetId, mutationTargetId));
    await database
      ?.delete(mutationReceipt)
      .where(eq(mutationReceipt.targetId, mutationTargetId));
    await database
      ?.delete(mutationTarget)
      .where(eq(mutationTarget.id, mutationTargetId));
    await database?.delete(user).where(eq(user.id, accountId));
  });

  afterAll(async () => {
    await database?.$client.end();
  });

  test("exposes default-off Evidence strength after creating a Solo SaaS Project", async () => {
    if (!database) {
      throw new Error("ACCOUNT_ACCESS_DATABASE_URL is required");
    }

    const context = {
      accountAccess: {
        listSessions: async () => [],
        revokeOtherSessions: async () => undefined,
        revokeSession: async () => undefined,
      },
      accountPreferences: {
        get: () => Promise.reject(new Error("Not part of this test.")),
      },
      auth: null,
      db: database,
      githubAvailability: { getStatus: () => "available" },
      priorityMetrics: createPriorityMetricsAccess(
        createDatabasePriorityMetrics(database),
      ),
      projectShellMutationContracts:
        createDatabaseProjectShellMutationContracts(database),
      session: {
        session: { id: "session-1" },
        user: { id: accountId },
      } as Context["session"],
    } satisfies Context;
    const client = createRouterClient(appRouter, { context });
    const project = await client.createProject({
      baseRevision: 0,
      clientIdempotencyKey: mutationTargetId,
      name: "Evidence Seed Test",
      starterConfiguration: "Solo SaaS",
    });
    if (!project) {
      throw new Error("Project creation did not return the created Project.");
    }

    expect(project.starterConfiguration).toBe("Solo SaaS");
    await expect(
      client.priorityMetrics({ projectId: project.id }),
    ).resolves.toMatchObject([
      {
        enabled: false,
        name: "Evidence strength",
        projectId: project.id,
      },
    ]);
  });
});
