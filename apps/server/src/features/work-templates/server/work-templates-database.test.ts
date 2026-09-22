import { createDb } from "@cantiara/db";
import { user, workspace } from "@cantiara/db/schema/auth";
import { project } from "@cantiara/db/schema/project";
import { eq } from "drizzle-orm";
import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  test,
} from "vitest";

import { createDatabaseWorkTemplates } from "./work-templates-database";

const databaseUrl =
  process.env.ACCOUNT_ACCESS_DATABASE_URL ?? process.env.DATABASE_URL;
const describeDatabase = databaseUrl ? describe : describe.skip;

describeDatabase("Work Templates PostgreSQL integration", () => {
  const database = databaseUrl
    ? createDb({ DATABASE_URL: databaseUrl })
    : undefined;
  const accountId = `work-templates-${crypto.randomUUID()}`;
  const workspaceId = `workspace-${crypto.randomUUID()}`;
  const projectId = `project-${crypto.randomUUID()}`;

  beforeEach(async () => {
    if (!database) {
      throw new Error("DATABASE_URL is required");
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
    await database.insert(project).values({
      id: projectId,
      name: "Release Project",
      shortCode: `WT-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
      starterConfiguration: "Blank Project",
      workspaceId,
    });
  });

  afterEach(async () => {
    await database?.delete(user).where(eq(user.id, accountId));
  });

  afterAll(async () => {
    await database?.$client.end();
  });

  test("stores an editable Project definition and removes it from the active seam when trashed", async () => {
    if (!database) {
      throw new Error("DATABASE_URL is required");
    }
    const workTemplates = createDatabaseWorkTemplates(database);
    const created = await workTemplates.create(accountId, {
      checklist: [{ id: "check-1", text: "Draft release notes" }],
      customFieldDefaults: [],
      descriptionSkeleton: "## Outcome",
      name: "Release preparation",
      projectId,
      relativeDates: { target: { offsetDays: 10 } },
      type: "Task",
    });

    const updated = await workTemplates.update(
      accountId,
      created.id,
      created.revision,
      {
        checklist: created.checklist,
        customFieldDefaults: [],
        descriptionSkeleton: created.descriptionSkeleton,
        name: "Launch preparation",
        relativeDates: created.relativeDates,
        type: created.type,
      },
    );
    expect(updated).toMatchObject({ name: "Launch preparation", revision: 2 });
    await expect(
      workTemplates.list(accountId, projectId),
    ).resolves.toHaveLength(1);

    const trashed = await workTemplates.trash(
      accountId,
      created.id,
      updated?.revision ?? 2,
    );
    expect(trashed?.trashedAt).not.toBeNull();
    await expect(workTemplates.list(accountId, projectId)).resolves.toEqual([]);
  });
});
