import type { CreateCustomFieldInput } from "@cantiara/api/custom-fields";
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
import { CustomFieldNameConflictError } from "./custom-fields";
import { createDatabaseCustomFields } from "./custom-fields-database";

const databaseUrl = process.env.ACCOUNT_ACCESS_DATABASE_URL;
const describeDatabase = databaseUrl ? describe : describe.skip;

describeDatabase("Project Custom Fields PostgreSQL integration", () => {
  const database = databaseUrl
    ? createDb({ DATABASE_URL: databaseUrl })
    : undefined;
  const accountId = `custom-fields-${crypto.randomUUID()}`;
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

  test("keeps same-named definitions independent per Project", async () => {
    if (!database) {
      throw new Error("ACCOUNT_ACCESS_DATABASE_URL is required");
    }

    const firstProjectId = `project-${crypto.randomUUID()}`;
    const secondProjectId = `project-${crypto.randomUUID()}`;
    await database.insert(project).values([
      {
        id: firstProjectId,
        name: "First Project",
        shortCode: `FIRST-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
        starterConfiguration: "Blank Project",
        workspaceId,
      },
      {
        id: secondProjectId,
        name: "Second Project",
        shortCode: `SECOND-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
        starterConfiguration: "Blank Project",
        workspaceId,
      },
    ]);

    const customFields = createDatabaseCustomFields(database);
    const input: CreateCustomFieldInput = {
      name: "Audience",
      projectId: firstProjectId,
      recordTypes: ["Work"],
      type: "Text" as const,
    };
    const first = await customFields.create(accountId, input);
    const second = await customFields.create(accountId, {
      ...input,
      projectId: secondProjectId,
    });

    expect(first.id).not.toBe(second.id);
    await expect(
      customFields.list(accountId, firstProjectId),
    ).resolves.toMatchObject([{ name: "Audience", projectId: firstProjectId }]);
    await expect(
      customFields.list(accountId, secondProjectId),
    ).resolves.toMatchObject([
      { name: "Audience", projectId: secondProjectId },
    ]);
  });

  test("rejects a duplicate name inside one Project", async () => {
    if (!database) {
      throw new Error("ACCOUNT_ACCESS_DATABASE_URL is required");
    }

    const projectId = `project-${crypto.randomUUID()}`;
    await database.insert(project).values({
      id: projectId,
      name: "One Project",
      shortCode: `ONE-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
      starterConfiguration: "Blank Project",
      workspaceId,
    });

    const customFields = createDatabaseCustomFields(database);
    await customFields.create(accountId, {
      name: "Audience",
      projectId,
      recordTypes: ["Work"],
      type: "Text",
    });

    await expect(
      customFields.create(accountId, {
        name: " audience ",
        projectId,
        recordTypes: ["Work"],
        type: "Number",
      }),
    ).rejects.toBeInstanceOf(CustomFieldNameConflictError);
  });
});
