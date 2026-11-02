import { createDb } from "@cantiara/db";
import { user, workspace } from "@cantiara/db/schema/auth";
import { eq } from "drizzle-orm";
import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  test,
} from "vitest";
import { createDatabaseProjectShell } from "../../../project-shell/server/project-shell-database";
import { createDatabaseProjectShellMutationContracts } from "../../../project-shell/server/project-shell-mutation-database";
import { createDatabaseProjectRetirementStore } from "../project-retirement-database";

const databaseUrl = process.env.ACCOUNT_ACCESS_DATABASE_URL;
const describeDatabase = databaseUrl ? describe : describe.skip;

describeDatabase("Project Retirement PostgreSQL integration", () => {
  const database = databaseUrl
    ? createDb({ DATABASE_URL: databaseUrl })
    : undefined;
  const accountId = `project-retirement-${crypto.randomUUID()}`;
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

  test("archives on the revision barrier, keeps the status, and closes the Project shell write", async () => {
    if (!database) {
      throw new Error("ACCOUNT_ACCESS_DATABASE_URL is required");
    }
    const created = await createDatabaseProjectShell(database).create(
      accountId,
      { name: "Atlas", starterConfiguration: "Blank Project" },
    );
    const store = createDatabaseProjectRetirementStore(database);
    const before = await store.find(accountId, created.id);
    expect(before?.archivedAt).toBeNull();

    const archived = await store.transition(accountId, {
      archived: true,
      baseRevision: before?.revision ?? 0,
      clientIdempotencyKey: "archive-1",
      projectId: created.id,
    });
    expect(archived?.archivedAt).not.toBeNull();
    expect(archived?.status).toBe("Active");
    expect(
      (await store.listArchived(accountId)).map((entry) => entry.id),
    ).toEqual([created.id]);

    await expect(
      store.transition(accountId, {
        archived: false,
        baseRevision: before?.revision ?? 0,
        clientIdempotencyKey: "unarchive-stale",
        projectId: created.id,
      }),
    ).rejects.toThrow();

    const shellWrite =
      createDatabaseProjectShellMutationContracts(database).update(accountId);
    await expect(
      shellWrite.mutate(
        {
          actor: { actorId: accountId, type: "User" },
          baseRevision: archived?.revision ?? 0,
          clientIdempotencyKey: "shell-write-1",
          kind: "human",
          payload: { shortCode: "ATL2" },
          targetId: created.id,
        },
        ({ currentRevision, currentValue }) => ({
          project: currentValue.project
            ? {
                ...currentValue.project,
                revision: currentRevision + 1,
                shortCode: "ATL2",
              }
            : null,
        }),
      ),
    ).rejects.toThrow();
  });
});
