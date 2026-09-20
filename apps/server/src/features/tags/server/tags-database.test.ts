import { createDb } from "@cantiara/db";
import { user, workspace } from "@cantiara/db/schema/auth";
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

import { TagNameConflictError } from "./tags";
import {
  createDatabaseTagMutationContracts,
  createDatabaseTags,
} from "./tags-database";

const databaseUrl = process.env.ACCOUNT_ACCESS_DATABASE_URL;
const describeDatabase = databaseUrl ? describe : describe.skip;

describeDatabase("Tags PostgreSQL integration", () => {
  const database = databaseUrl
    ? createDb({ DATABASE_URL: databaseUrl })
    : undefined;
  const accountId = `tags-${crypto.randomUUID()}`;
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

  test("shares one identity across Projects and ranks current usage", async () => {
    if (!database) {
      throw new Error("ACCOUNT_ACCESS_DATABASE_URL is required");
    }

    const firstProjectId = `project-${crypto.randomUUID()}`;
    const secondProjectId = `project-${crypto.randomUUID()}`;
    const firstProjectCode = `FIRST-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
    const secondProjectCode = `SECOND-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
    const firstWorkId = `work-${crypto.randomUUID()}`;
    const secondWorkId = `work-${crypto.randomUUID()}`;
    const thirdWorkId = `work-${crypto.randomUUID()}`;

    await database.insert(project).values([
      {
        id: firstProjectId,
        name: "First Project",
        shortCode: firstProjectCode,
        starterConfiguration: "Blank Project",
        workspaceId,
      },
      {
        id: secondProjectId,
        name: "Second Project",
        shortCode: secondProjectCode,
        starterConfiguration: "Blank Project",
        workspaceId,
      },
    ]);
    await database.insert(work).values([
      {
        id: firstWorkId,
        key: `${firstProjectCode}-1`,
        number: 1,
        projectId: firstProjectId,
        title: "Prepare launch",
        type: "Task",
      },
      {
        id: secondWorkId,
        key: `${firstProjectCode}-2`,
        number: 2,
        projectId: firstProjectId,
        title: "Review launch",
        type: "Task",
      },
      {
        id: thirdWorkId,
        key: `${secondProjectCode}-1`,
        number: 1,
        projectId: secondProjectId,
        title: "Publish launch",
        type: "Task",
      },
    ]);

    const tags = createDatabaseTags(database);
    const roadmap = await tags.create(accountId, { name: "roadmap/next" });
    const customer = await tags.create(accountId, { name: "customer" });

    await expect(
      tags.create(accountId, { name: " Roadmap/Next " }),
    ).rejects.toBeInstanceOf(TagNameConflictError);

    await tags.apply(accountId, {
      projectId: firstProjectId,
      recordId: firstWorkId,
      recordType: "Work",
      tagId: customer.id,
    });
    await tags.apply(accountId, {
      projectId: firstProjectId,
      recordId: secondWorkId,
      recordType: "Work",
      tagId: customer.id,
    });
    await tags.apply(accountId, {
      projectId: firstProjectId,
      recordId: secondWorkId,
      recordType: "Work",
      tagId: roadmap.id,
    });

    await expect(tags.list(accountId, firstProjectId)).resolves.toMatchObject([
      { projectUsageCount: 2, tag: { id: customer.id, name: "customer" } },
      {
        projectUsageCount: 1,
        tag: { id: roadmap.id, name: "roadmap/next" },
      },
    ]);

    await tags.apply(accountId, {
      projectId: secondProjectId,
      recordId: thirdWorkId,
      recordType: "Work",
      tagId: roadmap.id,
    });

    await expect(
      tags.records(accountId, {
        projectId: secondProjectId,
        tagId: roadmap.id,
      }),
    ).resolves.toMatchObject([
      {
        id: thirdWorkId,
        tags: [{ id: roadmap.id, name: "roadmap/next" }],
      },
    ]);
  });

  test("detaches a Work record without deleting the Workspace identity", async () => {
    if (!database) {
      throw new Error("ACCOUNT_ACCESS_DATABASE_URL is required");
    }

    const projectId = `project-${crypto.randomUUID()}`;
    const shortCode = `DETACH-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
    const workId = `work-${crypto.randomUUID()}`;
    await database.insert(project).values({
      id: projectId,
      name: "Detach Project",
      shortCode,
      starterConfiguration: "Blank Project",
      workspaceId,
    });
    await database.insert(work).values({
      id: workId,
      key: `${shortCode}-1`,
      number: 1,
      projectId,
      title: "Detach launch tag",
      type: "Task",
    });

    const tags = createDatabaseTags(database);
    const tag = await tags.create(accountId, { name: "roadmap/next" });
    await tags.apply(accountId, {
      projectId,
      recordId: workId,
      recordType: "Work",
      tagId: tag.id,
    });

    await tags.remove(accountId, {
      projectId,
      recordId: workId,
      recordType: "Work",
      tagId: tag.id,
    });

    await expect(
      tags.records(accountId, { projectId, tagId: tag.id }),
    ).resolves.toEqual([]);
    await expect(tags.list(accountId, projectId)).resolves.toMatchObject([
      { projectUsageCount: 0, tag: { id: tag.id, name: "roadmap/next" } },
    ]);
  });

  test("renames the Workspace identity without changing structured memberships", async () => {
    if (!database) {
      throw new Error("ACCOUNT_ACCESS_DATABASE_URL is required");
    }

    const projectId = `project-${crypto.randomUUID()}`;
    const shortCode = `RENAME-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
    const firstWorkId = `work-${crypto.randomUUID()}`;
    const secondWorkId = `work-${crypto.randomUUID()}`;
    await database.insert(project).values({
      id: projectId,
      name: "Rename Project",
      shortCode,
      starterConfiguration: "Blank Project",
      workspaceId,
    });
    await database.insert(work).values([
      {
        id: firstWorkId,
        key: `${shortCode}-1`,
        number: 1,
        projectId,
        title: "Rename first record",
        type: "Task",
      },
      {
        id: secondWorkId,
        key: `${shortCode}-2`,
        number: 2,
        projectId,
        title: "Rename second record",
        type: "Task",
      },
    ]);

    const tags = createDatabaseTags(database);
    const tag = await tags.create(accountId, { name: "roadmap/next" });
    await Promise.all(
      [firstWorkId, secondWorkId].map((recordId) =>
        tags.apply(accountId, {
          projectId,
          recordId,
          recordType: "Work",
          tagId: tag.id,
        }),
      ),
    );

    const receipt = await createDatabaseTagMutationContracts(database)
      .rename(accountId)
      .mutate(
        {
          actor: { actorId: accountId, type: "User" },
          baseRevision: tag.revision,
          clientIdempotencyKey: "rename-tag-1",
          kind: "human",
          payload: { name: "launch/next", tagId: tag.id },
          targetId: tag.id,
        },
        ({ currentValue, currentRevision, payload }) => {
          if (!currentValue.tag) {
            throw new Error("Tag is unavailable.");
          }
          return {
            tag: {
              ...currentValue.tag,
              name: payload.name,
              revision: currentRevision + 1,
              updatedAt: new Date().toISOString(),
            },
          };
        },
        {
          undo: {
            kind: "atomic-transform",
            scope: "tag",
          },
        },
      );
    const renamed = receipt.nextValue.tag;

    expect(renamed).toMatchObject({
      id: tag.id,
      name: "launch/next",
      revision: tag.revision + 1,
    });
    await expect(
      tags.records(accountId, { projectId, tagId: tag.id }),
    ).resolves.toMatchObject([
      { id: firstWorkId, tags: [{ id: tag.id, name: "launch/next" }] },
      { id: secondWorkId, tags: [{ id: tag.id, name: "launch/next" }] },
    ]);

    await expect(
      tags.rename(accountId, {
        expectedRevision: tag.revision,
        name: "stale/rename",
        tagId: tag.id,
      }),
    ).rejects.toMatchObject({ code: "TAG_REVISION_CONFLICT" });
    await expect(tags.list(accountId, projectId)).resolves.toMatchObject([
      { tag: { id: tag.id, name: "launch/next", revision: 1 } },
    ]);
  });

  test("rolls back the Tag when the Documents rename participant fails", async () => {
    if (!database) {
      throw new Error("ACCOUNT_ACCESS_DATABASE_URL is required");
    }

    const projectId = `project-${crypto.randomUUID()}`;
    const shortCode = `ROLLBACK-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
    const workId = `work-${crypto.randomUUID()}`;
    await database.insert(project).values({
      id: projectId,
      name: "Rollback Project",
      shortCode,
      starterConfiguration: "Blank Project",
      workspaceId,
    });
    await database.insert(work).values({
      id: workId,
      key: `${shortCode}-1`,
      number: 1,
      projectId,
      title: "Rollback rename",
      type: "Task",
    });

    const setupTags = createDatabaseTags(database);
    const tag = await setupTags.create(accountId, { name: "roadmap/next" });
    await setupTags.apply(accountId, {
      projectId,
      recordId: workId,
      recordType: "Work",
      tagId: tag.id,
    });

    const failingMutations = createDatabaseTagMutationContracts(database, {
      inlineRename: {
        renameInlineUses: () =>
          Promise.reject(new Error("Document version could not be created.")),
      },
    });

    await expect(
      failingMutations.rename(accountId).mutate(
        {
          actor: { actorId: accountId, type: "User" },
          baseRevision: tag.revision,
          clientIdempotencyKey: "rename-rollback-1",
          kind: "human",
          payload: { name: "launch/next", tagId: tag.id },
          targetId: tag.id,
        },
        ({ currentValue, currentRevision, payload }) => {
          if (!currentValue.tag) {
            throw new Error("Tag is unavailable.");
          }
          return {
            tag: {
              ...currentValue.tag,
              name: payload.name,
              revision: currentRevision + 1,
              updatedAt: new Date().toISOString(),
            },
          };
        },
      ),
    ).rejects.toThrow("Document version could not be created.");
    await expect(
      setupTags.records(accountId, { projectId, tagId: tag.id }),
    ).resolves.toMatchObject([
      { id: workId, tags: [{ id: tag.id, name: "roadmap/next" }] },
    ]);
  });
});
