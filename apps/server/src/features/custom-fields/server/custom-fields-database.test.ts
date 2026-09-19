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
import { createDatabaseCustomFieldMutationContracts } from "./custom-fields-mutation-database";

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

  test("round-trips a value and keeps empty distinct from Boolean false", async () => {
    if (!database) {
      throw new Error("ACCOUNT_ACCESS_DATABASE_URL is required");
    }

    const projectId = `project-${crypto.randomUUID()}`;
    await database.insert(project).values({
      id: projectId,
      name: "Round Trip Project",
      shortCode: `ROUND-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
      starterConfiguration: "Blank Project",
      workspaceId,
    });

    const customFields = createDatabaseCustomFields(database);
    const contracts = createDatabaseCustomFieldMutationContracts(database);
    const booleanField = await customFields.create(accountId, {
      name: "Shipped",
      projectId,
      recordTypes: ["Work"],
      type: "Boolean",
    });

    const setReceipt = await contracts.setValue(accountId).mutate(
      {
        actor: { actorId: accountId, type: "User" },
        baseRevision: 0,
        clientIdempotencyKey: `set-${booleanField.id}`,
        kind: "human",
        payload: {
          definitionId: booleanField.id,
          payload: { boolean: false, kind: "boolean" },
          recordId: "work-1",
          recordType: "Work",
        },
        targetId: `${booleanField.id}:work-1`,
      },
      ({ currentValue, currentRevision }) => {
        const timestamp = new Date().toISOString();
        return {
          value: {
            createdAt: currentValue.value?.createdAt ?? timestamp,
            definitionId: booleanField.id,
            id: currentValue.value?.id ?? crypto.randomUUID(),
            recordId: "work-1",
            recordType: "Work" as const,
            revision: currentRevision + 1,
            updatedAt: timestamp,
            value: { boolean: false, kind: "boolean" as const },
          },
        };
      },
    );

    const storedItems = await customFields.values(accountId, {
      projectId,
      recordId: "work-1",
      recordType: "Work",
    });
    expect(storedItems).not.toBeNull();
    const [stored] = storedItems ?? [];
    expect(stored?.definition.id).toBe(booleanField.id);
    expect(stored?.value?.value).toEqual({ boolean: false, kind: "boolean" });

    await contracts.clearValue(accountId).mutate(
      {
        actor: { actorId: accountId, type: "User" },
        baseRevision: setReceipt.revision,
        clientIdempotencyKey: `clear-${booleanField.id}`,
        kind: "human",
        payload: {
          definitionId: booleanField.id,
          recordId: "work-1",
          recordType: "Work",
        },
        targetId: `${booleanField.id}:work-1`,
      },
      () => ({ value: null }),
    );

    const clearedItems = await customFields.values(accountId, {
      projectId,
      recordId: "work-1",
      recordType: "Work",
    });
    expect(clearedItems).not.toBeNull();
    const [cleared] = clearedItems ?? [];
    expect(cleared?.value).toBeNull();
  });

  test("trash hides a definition from record surfaces and permanent delete removes its values", async () => {
    if (!database) {
      throw new Error("ACCOUNT_ACCESS_DATABASE_URL is required");
    }

    const projectId = `project-${crypto.randomUUID()}`;
    await database.insert(project).values({
      id: projectId,
      name: "Trash Project",
      shortCode: `TRASH-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
      starterConfiguration: "Blank Project",
      workspaceId,
    });

    const customFields = createDatabaseCustomFields(database);
    const contracts = createDatabaseCustomFieldMutationContracts(database);
    const definition = await customFields.create(accountId, {
      name: "Audience",
      projectId,
      recordTypes: ["Work"],
      type: "Text",
    });

    await contracts.setValue(accountId).mutate(
      {
        actor: { actorId: accountId, type: "User" },
        baseRevision: 0,
        clientIdempotencyKey: `set-${definition.id}`,
        kind: "human",
        payload: {
          definitionId: definition.id,
          payload: { kind: "text", text: "Founders" },
          recordId: "work-1",
          recordType: "Work",
        },
        targetId: `${definition.id}:work-1`,
      },
      ({ currentValue, currentRevision }) => {
        const timestamp = new Date().toISOString();
        return {
          value: {
            createdAt: currentValue.value?.createdAt ?? timestamp,
            definitionId: definition.id,
            id: currentValue.value?.id ?? crypto.randomUUID(),
            recordId: "work-1",
            recordType: "Work" as const,
            revision: currentRevision + 1,
            updatedAt: timestamp,
            value: { kind: "text" as const, text: "Founders" },
          },
        };
      },
    );

    const trashed = await contracts.trash(accountId).mutate(
      {
        actor: { actorId: accountId, type: "User" },
        baseRevision: definition.revision,
        clientIdempotencyKey: `trash-${definition.id}`,
        kind: "human",
        payload: {},
        targetId: definition.id,
      },
      ({ currentValue, currentRevision }) => {
        const timestamp = new Date().toISOString();
        const current = currentValue.field;
        if (!current) {
          throw new Error("Custom field was not found.");
        }
        return {
          field: {
            ...current,
            revision: currentRevision + 1,
            trashedAt: timestamp,
            updatedAt: timestamp,
          },
        };
      },
    );

    await expect(
      customFields.values(accountId, {
        projectId,
        recordId: "work-1",
        recordType: "Work",
      }),
    ).resolves.toEqual([]);

    const restored = await contracts.restore(accountId).mutate(
      {
        actor: { actorId: accountId, type: "User" },
        baseRevision: trashed.revision,
        clientIdempotencyKey: `restore-${definition.id}`,
        kind: "human",
        payload: {},
        targetId: definition.id,
      },
      ({ currentValue, currentRevision }) => {
        const timestamp = new Date().toISOString();
        const current = currentValue.field;
        if (!current) {
          throw new Error("Custom field was not found.");
        }
        return {
          field: {
            ...current,
            revision: currentRevision + 1,
            trashedAt: null,
            updatedAt: timestamp,
          },
        };
      },
    );

    const restoredItems = await customFields.values(accountId, {
      projectId,
      recordId: "work-1",
      recordType: "Work",
    });
    expect(restoredItems).not.toBeNull();
    const [restoredItem] = restoredItems ?? [];
    expect(restoredItem?.value?.value).toEqual({
      kind: "text",
      text: "Founders",
    });

    await contracts.delete(accountId).mutate(
      {
        actor: { actorId: accountId, type: "User" },
        baseRevision: restored.revision,
        clientIdempotencyKey: `delete-${definition.id}`,
        kind: "human",
        payload: {},
        targetId: definition.id,
      },
      () => ({ field: null }),
    );

    await expect(
      customFields.values(accountId, {
        projectId,
        recordId: "work-1",
        recordType: "Work",
      }),
    ).resolves.toEqual([]);
    await expect(customFields.list(accountId, projectId)).resolves.toEqual([]);
  });
});
