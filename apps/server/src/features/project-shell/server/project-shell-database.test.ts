import { createDb } from "@cantiara/db";
import { user, workspace } from "@cantiara/db/schema/auth";
import { priorityMetricDefinition } from "@cantiara/db/schema/priority-metrics";
import { project as projectTable } from "@cantiara/db/schema/project";
import { eq } from "drizzle-orm";
import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  test,
} from "vitest";
import {
  ProjectShortCodeConflictError,
  ProjectShortCodeLockedError,
} from "./project-shell";
import { createDatabaseProjectShell } from "./project-shell-database";

const databaseUrl = process.env.ACCOUNT_ACCESS_DATABASE_URL;
const describeDatabase = databaseUrl ? describe : describe.skip;

describeDatabase("Project Shell PostgreSQL integration", () => {
  const database = databaseUrl
    ? createDb({ DATABASE_URL: databaseUrl })
    : undefined;
  const accountId = `project-shell-${crypto.randomUUID()}`;
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

  test("keeps every assigned Short code reserved after a Project is deleted", async () => {
    if (!database) {
      throw new Error("ACCOUNT_ACCESS_DATABASE_URL is required");
    }

    const projectShell = createDatabaseProjectShell(database);
    const first = await projectShell.create(accountId, {
      name: "Payment App",
      starterConfiguration: "Blank Project",
    });
    await projectShell.updateShortCode(accountId, first.id, "PAYS");
    await expect(
      projectShell.updateShortCode(accountId, first.id, "PAY"),
    ).resolves.toMatchObject({ shortCode: "PAY" });
    await projectShell.recordFirstWork(accountId, first.id);

    await expect(
      projectShell.updateShortCode(accountId, first.id, "PAYMENTS"),
    ).rejects.toBeInstanceOf(ProjectShortCodeLockedError);

    await database.delete(projectTable).where(eq(projectTable.id, first.id));

    await expect(
      projectShell.create(accountId, {
        name: "Payment Reports",
        starterConfiguration: "Blank Project",
      }),
    ).resolves.toMatchObject({ shortCode: "PAY-2" });
  });

  test("rejects an explicitly reused code in the same Workspace", async () => {
    if (!database) {
      throw new Error("ACCOUNT_ACCESS_DATABASE_URL is required");
    }

    const projectShell = createDatabaseProjectShell(database);
    await projectShell.create(accountId, {
      name: "Payment App",
      shortCode: "PAY",
      starterConfiguration: "Blank Project",
    });

    await expect(
      projectShell.create(accountId, {
        name: "Payment Reports",
        shortCode: "PAY",
        starterConfiguration: "Blank Project",
      }),
    ).rejects.toBeInstanceOf(ProjectShortCodeConflictError);
  });

  test("allows the same Short code in a different Workspace", async () => {
    if (!database) {
      throw new Error("ACCOUNT_ACCESS_DATABASE_URL is required");
    }

    const otherAccountId = `project-shell-${crypto.randomUUID()}`;
    const otherWorkspaceId = `workspace-${crypto.randomUUID()}`;
    await database.insert(user).values({
      email: `${otherAccountId}@example.invalid`,
      id: otherAccountId,
      name: "Other Founder",
    });
    await database.insert(workspace).values({
      id: otherWorkspaceId,
      ownerAccountId: otherAccountId,
    });

    try {
      const projectShell = createDatabaseProjectShell(database);
      await projectShell.create(accountId, {
        name: "Payment App",
        shortCode: "PAY",
        starterConfiguration: "Blank Project",
      });
      await expect(
        projectShell.create(otherAccountId, {
          name: "Payment App",
          shortCode: "PAY",
          starterConfiguration: "Blank Project",
        }),
      ).resolves.toMatchObject({ shortCode: "PAY" });
    } finally {
      await database.delete(user).where(eq(user.id, otherAccountId));
    }
  });

  test("prepares an independent default-off Evidence strength per opinionated Project", async () => {
    if (!database) {
      throw new Error("ACCOUNT_ACCESS_DATABASE_URL is required");
    }

    const projectShell = createDatabaseProjectShell(database);
    const first = await projectShell.create(accountId, {
      name: "Payment App",
      starterConfiguration: "Solo SaaS",
    });
    const second = await projectShell.create(accountId, {
      name: "Payment Reports",
      starterConfiguration: "Mobile Application",
    });
    const blank = await projectShell.create(accountId, {
      name: "Blank Project",
      starterConfiguration: "Blank Project",
    });
    const firstMetrics = await database
      .select()
      .from(priorityMetricDefinition)
      .where(eq(priorityMetricDefinition.projectId, first.id));
    const secondMetrics = await database
      .select()
      .from(priorityMetricDefinition)
      .where(eq(priorityMetricDefinition.projectId, second.id));
    const blankMetrics = await database
      .select()
      .from(priorityMetricDefinition)
      .where(eq(priorityMetricDefinition.projectId, blank.id));

    expect(firstMetrics).toHaveLength(1);
    expect(secondMetrics).toHaveLength(1);
    expect(firstMetrics[0]).toMatchObject({
      enabled: false,
      name: "Evidence strength",
      projectId: first.id,
    });
    expect(secondMetrics[0]).toMatchObject({
      enabled: false,
      name: "Evidence strength",
      projectId: second.id,
    });
    expect(firstMetrics[0]?.id).not.toBe(secondMetrics[0]?.id);
    expect(blankMetrics).toEqual([]);
  });
});
