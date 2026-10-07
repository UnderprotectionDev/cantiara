import { createDb } from "@cantiara/db";
import { user, workspace } from "@cantiara/db/schema/auth";
import {
  mutationHistory,
  mutationReceipt,
  mutationStaging,
  mutationTarget,
} from "@cantiara/db/schema/mutation";
import { project } from "@cantiara/db/schema/project";
import { eq, inArray } from "drizzle-orm";
import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  test,
} from "vitest";
import { createDatabaseProjectGoals } from "./project-goals-database";

const url = process.env.ACCOUNT_ACCESS_DATABASE_URL;
const describeDatabase = url ? describe : describe.skip;
describeDatabase("Project Goals record PostgreSQL seam", () => {
  const db = url ? createDb({ DATABASE_URL: url }) : undefined;
  const accountId = crypto.randomUUID();
  const workspaceId = crypto.randomUUID();
  const projectId = crypto.randomUUID();
  const otherProjectId = crypto.randomUUID();
  const goalId = crypto.randomUUID();
  function access() {
    if (!db) {
      throw new Error("ACCOUNT_ACCESS_DATABASE_URL is required");
    }
    return createDatabaseProjectGoals(db);
  }
  beforeEach(async () => {
    if (!db) {
      throw new Error("ACCOUNT_ACCESS_DATABASE_URL is required");
    }
    await db.insert(user).values({
      id: accountId,
      email: `${accountId}@example.invalid`,
      name: "Founder",
    });
    await db
      .insert(workspace)
      .values({ id: workspaceId, ownerAccountId: accountId });
    await db.insert(project).values(
      [projectId, otherProjectId].map((id, index) => ({
        id,
        workspaceId,
        name: "Goal test",
        shortCode: `G${index}-${accountId.slice(0, 6).toUpperCase()}`,
        starterConfiguration: "Blank Project",
      })),
    );
  });
  afterEach(async () => {
    if (!db) {
      return;
    }
    await db
      .delete(mutationStaging)
      .where(eq(mutationStaging.actorId, accountId));
    await db
      .delete(mutationReceipt)
      .where(eq(mutationReceipt.actorId, accountId));
    await db
      .delete(mutationHistory)
      .where(eq(mutationHistory.actorId, accountId));
    await db.delete(mutationTarget).where(inArray(mutationTarget.id, [goalId]));
    await db.delete(user).where(eq(user.id, accountId));
  });
  afterAll(async () => {
    await db?.$client.end();
  });
  function draft() {
    return {
      id: goalId,
      projectId,
      title: "Useful first release",
      description: "Help founders keep context",
      intendedOutcome: null,
      observedOutcomeLearning: null,
      baseRevision: 0 as const,
      clientIdempotencyKey: "goal-create",
    };
  }
  test("opens without Goals and records only founder-written outcomes across reloads", async () => {
    const goals = access();
    expect(await goals.list(accountId, projectId)).toEqual({
      records: [],
      readOnly: false,
    });
    const input = draft();
    const created = await goals.create(accountId, input);
    expect(created).toMatchObject({
      title: input.title,
      description: input.description,
      revision: 1,
      intendedOutcome: null,
      observedOutcomeLearning: null,
    });
    expect(created).not.toHaveProperty("progress");
    expect(created).not.toHaveProperty("status");
    expect(created).not.toHaveProperty("health");
    expect(created).not.toHaveProperty("keyResults");
    expect(await goals.create(accountId, input)).toEqual(created);
    await expect(
      goals.create(accountId, { ...input, title: "Changed payload" }),
    ).rejects.toThrow();
    await expect(
      goals.create(accountId, {
        ...input,
        title: "Changed payload",
        clientIdempotencyKey: "new-key-existing-id",
      }),
    ).rejects.toThrow();
    expect((await goals.list(accountId, projectId))?.records).toHaveLength(1);
    const updated = await goals.update(accountId, {
      ...input,
      baseRevision: 1,
      clientIdempotencyKey: "goal-learn",
      intendedOutcome: "Learn what founders need",
      observedOutcomeLearning: "Small scope helped",
    });
    expect(await access().find(accountId, { projectId, id: goalId })).toEqual(
      updated,
    );
    expect(updated).toMatchObject({
      revision: 2,
      intendedOutcome: "Learn what founders need",
      observedOutcomeLearning: "Small scope helped",
    });
    await expect(
      goals.update(accountId, {
        ...input,
        baseRevision: 1,
        clientIdempotencyKey: "stale",
      }),
    ).rejects.toThrow();
    expect(
      await goals.find("another-account", { projectId, id: goalId }),
    ).toBeNull();
    expect(await goals.list("another-account", projectId)).toBeNull();
    expect(
      await goals.find(accountId, { projectId: otherProjectId, id: goalId }),
    ).toBeNull();
    await expect(
      goals.update(accountId, {
        ...input,
        projectId: otherProjectId,
        baseRevision: 2,
        clientIdempotencyKey: "wrong-project",
      }),
    ).rejects.toThrow();
    expect(await goals.find(accountId, { projectId, id: goalId })).toEqual(
      updated,
    );
  });
  test("rejects writes to archived Projects while keeping the record readable", async () => {
    const goals = access();
    const created = await goals.create(accountId, draft());
    await db
      ?.update(project)
      .set({ archivedAt: new Date() })
      .where(eq(project.id, projectId));
    expect(
      await goals.update(accountId, {
        ...draft(),
        baseRevision: 1,
        clientIdempotencyKey: "archived-edit",
      }),
    ).toBeNull();
    expect(await goals.find(accountId, { projectId, id: goalId })).toEqual(
      created,
    );
    expect(await goals.list(accountId, projectId)).toMatchObject({
      readOnly: true,
    });
    expect(await goals.create("another-account", draft())).toBeNull();
  });
});
