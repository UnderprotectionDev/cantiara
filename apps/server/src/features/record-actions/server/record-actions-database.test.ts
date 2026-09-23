import { createDb } from "@cantiara/db";
import { user, workspace } from "@cantiara/db/schema/auth";
import { customFieldDefinition } from "@cantiara/db/schema/custom-fields";
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

import { CustomFieldOptionInvalidError } from "../../custom-fields/server/custom-fields";
import {
  createDatabaseRecordActions,
  RecordActionNameConflictError,
  RecordActionStaleRevisionError,
  RecordActionStepUnavailableError,
} from "./record-actions-database";

const databaseUrl =
  process.env.ACCOUNT_ACCESS_DATABASE_URL ?? process.env.DATABASE_URL;
const describeDatabase = databaseUrl ? describe : describe.skip;

describeDatabase("Record Actions PostgreSQL integration", () => {
  const database = databaseUrl
    ? createDb({ DATABASE_URL: databaseUrl })
    : undefined;
  const accountId = `record-actions-${crypto.randomUUID()}`;
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
      shortCode: `RA-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
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

  test("stores editable definitions and removes trashed definitions from the active list", async () => {
    if (!database) {
      throw new Error("DATABASE_URL is required");
    }
    const recordActions = createDatabaseRecordActions(database);
    const created = await recordActions.create(accountId, {
      name: "Start Work",
      projectId,
      steps: [
        { kind: "work-status", status: "In Progress" },
        { kind: "daily-focus-membership", operation: "add" },
      ],
    });

    const updated = await recordActions.update(
      accountId,
      created.id,
      created.revision,
      {
        name: "Start Work",
        steps: [
          { kind: "work-status", status: "In Progress" },
          { kind: "daily-focus-membership", operation: "add" },
        ],
      },
    );
    expect(updated).toMatchObject({ name: "Start Work", revision: 2 });
    await expect(
      recordActions.list(accountId, projectId),
    ).resolves.toHaveLength(1);

    const trashed = await recordActions.trash(
      accountId,
      created.id,
      updated?.revision ?? 2,
    );
    expect(trashed?.trashedAt).not.toBeNull();
    await expect(recordActions.list(accountId, projectId)).resolves.toEqual([]);
    await expect(
      recordActions.update(accountId, created.id, 2, {
        name: "Start Work",
        steps: [
          { kind: "work-status", status: "In Progress" },
          { kind: "daily-focus-membership", operation: "add" },
        ],
      }),
    ).resolves.toBeNull();
  });

  test("only accepts active Work Custom fields and values from their catalog", async () => {
    if (!database) {
      throw new Error("DATABASE_URL is required");
    }
    const definitionId = `field-${crypto.randomUUID()}`;
    await database.insert(customFieldDefinition).values({
      id: definitionId,
      name: "Release readiness",
      nameKey: "release readiness",
      options: ["Ready"],
      projectId,
      recordTypes: ["Work"],
      type: "Single select",
    });
    const recordActions = createDatabaseRecordActions(database);
    const fieldStep = {
      definitionId,
      kind: "custom-field-value" as const,
      operation: "set" as const,
      value: { kind: "option" as const, option: "Ready" },
    };
    const input = {
      projectId,
      steps: [fieldStep],
    };

    await expect(
      recordActions.create(accountId, { ...input, name: "Mark ready" }),
    ).resolves.toMatchObject({ name: "Mark ready" });
    await expect(
      recordActions.create(accountId, {
        ...input,
        name: "Use unknown value",
        steps: [{ ...fieldStep, value: { kind: "option", option: "Unknown" } }],
      }),
    ).rejects.toBeInstanceOf(CustomFieldOptionInvalidError);
    await expect(
      recordActions.create(accountId, {
        ...input,
        name: "Use unavailable field",
        steps: [{ ...fieldStep, definitionId: "unavailable-field" }],
      }),
    ).rejects.toBeInstanceOf(RecordActionStepUnavailableError);
  });

  test("enforces project-local names and optimistic revisions", async () => {
    if (!database) {
      throw new Error("DATABASE_URL is required");
    }
    const recordActions = createDatabaseRecordActions(database);
    const first = await recordActions.create(accountId, {
      name: "Start Work",
      projectId,
      steps: [
        { kind: "work-status", status: "In Progress" },
        { kind: "daily-focus-membership", operation: "add" },
      ],
    });
    await expect(
      recordActions.create(accountId, {
        name: "start work",
        projectId,
        steps: [
          { kind: "work-status", status: "In Progress" },
          { kind: "daily-focus-membership", operation: "add" },
        ],
      }),
    ).rejects.toBeInstanceOf(RecordActionNameConflictError);
    await expect(
      recordActions.update(accountId, first.id, first.revision + 1, {
        name: "Start Work",
        steps: [
          { kind: "work-status", status: "In Progress" },
          { kind: "daily-focus-membership", operation: "add" },
        ],
      }),
    ).rejects.toBeInstanceOf(RecordActionStaleRevisionError);
  });
});
