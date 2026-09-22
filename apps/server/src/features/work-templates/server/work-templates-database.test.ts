import { createDb } from "@cantiara/db";
import { user, workspace } from "@cantiara/db/schema/auth";
import {
  customFieldDefinition,
  customFieldValue,
} from "@cantiara/db/schema/custom-fields";
import { project } from "@cantiara/db/schema/project";
import { workTemplate } from "@cantiara/db/schema/work-template";
import { eq } from "drizzle-orm";
import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  test,
} from "vitest";

import { createDatabaseCustomFieldFinalizationWriter } from "../../custom-fields/server/custom-fields-mutation-database";
import { WorkCreationConflictError } from "../../work-lifecycle/server/work-lifecycle";
import { createDatabaseWorkLifecycle } from "../../work-lifecycle/server/work-lifecycle-database";
import {
  createDatabaseWorkTemplates,
  WorkDuplicateSourceStaleError,
  WorkTemplateNameConflictError,
  WorkTemplateStaleRevisionError,
} from "./work-templates-database";

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

  test("refuses a rename that collides with another template in the Project", async () => {
    if (!database) {
      throw new Error("DATABASE_URL is required");
    }
    const workTemplates = createDatabaseWorkTemplates(database);
    const definition = {
      checklist: [],
      customFieldDefaults: [],
      descriptionSkeleton: null,
      projectId,
      relativeDates: {},
      type: "Task" as const,
    };
    const first = await workTemplates.create(accountId, {
      ...definition,
      name: "Release preparation",
    });
    await workTemplates.create(accountId, {
      ...definition,
      name: "Launch preparation",
    });

    await expect(
      workTemplates.update(accountId, first.id, first.revision, {
        checklist: first.checklist,
        customFieldDefaults: [],
        descriptionSkeleton: first.descriptionSkeleton,
        name: "launch preparation",
        relativeDates: first.relativeDates,
        type: first.type,
      }),
    ).rejects.toBeInstanceOf(WorkTemplateNameConflictError);
  });

  test("reports stale base revisions instead of the template being unavailable", async () => {
    if (!database) {
      throw new Error("DATABASE_URL is required");
    }
    const workTemplates = createDatabaseWorkTemplates(database);
    const created = await workTemplates.create(accountId, {
      checklist: [],
      customFieldDefaults: [],
      descriptionSkeleton: null,
      name: "Release preparation",
      projectId,
      relativeDates: {},
      type: "Task",
    });

    await expect(
      workTemplates.update(accountId, created.id, created.revision + 5, {
        checklist: created.checklist,
        customFieldDefaults: [],
        descriptionSkeleton: created.descriptionSkeleton,
        name: "Launch preparation",
        relativeDates: created.relativeDates,
        type: created.type,
      }),
    ).rejects.toBeInstanceOf(WorkTemplateStaleRevisionError);
    await expect(
      workTemplates.trash(accountId, created.id, created.revision + 5),
    ).rejects.toBeInstanceOf(WorkTemplateStaleRevisionError);
    await expect(
      workTemplates.list(accountId, projectId),
    ).resolves.toHaveLength(1);
  });

  test("creates independent idempotent Work from the template snapshot", async () => {
    if (!database) {
      throw new Error("DATABASE_URL is required");
    }
    const workLifecycle = createDatabaseWorkLifecycle(database, {
      customFieldValueWriter: createDatabaseCustomFieldFinalizationWriter(),
    });
    const definitionId = `field-${crypto.randomUUID()}`;
    await database.insert(customFieldDefinition).values({
      id: definitionId,
      name: "Release audience",
      nameKey: "release audience",
      options: [],
      projectId,
      recordTypes: ["Work"],
      type: "Text",
    });
    const workTemplates = createDatabaseWorkTemplates(database, workLifecycle);
    const created = await workTemplates.create(accountId, {
      checklist: [{ id: "check-1", text: "Draft release notes" }],
      customFieldDefaults: [
        {
          definitionId,
          value: { kind: "text", text: "Founders" },
        },
      ],
      descriptionSkeleton: "## Outcome",
      name: "Release preparation",
      projectId,
      relativeDates: {
        plannedStart: { offsetDays: 2 },
        target: { offsetDays: 10 },
      },
      type: "Task",
    });
    const command = {
      baseRevision: created.revision,
      clientIdempotencyKey: "instantiate-release-1",
      createDate: "2026-09-22",
      templateId: created.id,
      title: "Prepare the October release",
    };

    const instantiated = await workTemplates.instantiate(accountId, command);
    const replayed = await workTemplates.instantiate(accountId, command);

    expect(replayed).toEqual(instantiated);
    expect(instantiated).toMatchObject({
      checklist: [
        { completed: false, id: "check-1", text: "Draft release notes" },
      ],
      closureResult: null,
      description: "## Outcome",
      plannedStartDate: "2026-09-24",
      projectId,
      recreatedFrom: null,
      status: "Not Started",
      targetDate: "2026-10-02",
      title: "Prepare the October release",
      type: "Task",
    });
    expect(instantiated?.id).not.toBe(created.id);
    await expect(
      database
        .select({ value: customFieldValue.value })
        .from(customFieldValue)
        .where(eq(customFieldValue.recordId, instantiated?.id ?? "")),
    ).resolves.toEqual([{ value: { kind: "text", text: "Founders" } }]);

    const updated = await workTemplates.update(
      accountId,
      created.id,
      created.revision,
      {
        checklist: [],
        customFieldDefaults: [],
        descriptionSkeleton: "Edited after creation",
        name: created.name,
        relativeDates: {},
        type: "Bug",
      },
    );

    await expect(
      workTemplates.instantiate(accountId, command),
    ).resolves.toEqual(instantiated);
    await expect(
      workTemplates.instantiate(accountId, {
        ...command,
        title: "A conflicting retry",
      }),
    ).rejects.toBeInstanceOf(WorkCreationConflictError);

    await workTemplates.trash(
      accountId,
      created.id,
      updated?.revision ?? created.revision + 1,
    );
    await expect(
      workTemplates.instantiate(accountId, command),
    ).resolves.toEqual(instantiated);
  });

  test("rejects a template revision that changes before Work finalization", async () => {
    if (!database) {
      throw new Error("DATABASE_URL is required");
    }
    const created = await createDatabaseWorkTemplates(database).create(
      accountId,
      {
        checklist: [],
        customFieldDefaults: [],
        descriptionSkeleton: null,
        name: "Race-sensitive template",
        projectId,
        relativeDates: {},
        type: "Task",
      },
    );
    const lifecycle = createDatabaseWorkLifecycle(database, {
      customFieldValueWriter: createDatabaseCustomFieldFinalizationWriter(),
    });
    const { createWithCustomFieldValues } = lifecycle;
    if (!createWithCustomFieldValues) {
      throw new Error("Custom field finalization is required");
    }
    const racingLifecycle = {
      ...lifecycle,
      async createWithCustomFieldValues(
        ...args: Parameters<typeof createWithCustomFieldValues>
      ) {
        await database
          .update(workTemplate)
          .set({ revision: created.revision + 1, updatedAt: new Date() })
          .where(eq(workTemplate.id, created.id));
        return createWithCustomFieldValues(...args);
      },
    };

    await expect(
      createDatabaseWorkTemplates(database, racingLifecycle).instantiate(
        accountId,
        {
          baseRevision: created.revision,
          clientIdempotencyKey: "revision-race",
          createDate: "2026-09-22",
          templateId: created.id,
          title: "Must not be created",
        },
      ),
    ).rejects.toBeInstanceOf(WorkTemplateStaleRevisionError);
  });

  test("one-off copy duplicates selected non-date start context in the same Project", async () => {
    if (!database) {
      throw new Error("DATABASE_URL is required");
    }
    const workLifecycle = createDatabaseWorkLifecycle(database, {
      customFieldValueWriter: createDatabaseCustomFieldFinalizationWriter(),
    });
    const audienceId = `field-${crypto.randomUUID()}`;
    const channelId = `field-${crypto.randomUUID()}`;
    const retiredId = `field-${crypto.randomUUID()}`;
    const dateOnlyId = `field-${crypto.randomUUID()}`;
    await database.insert(customFieldDefinition).values([
      {
        id: audienceId,
        name: "Release audience",
        nameKey: "release audience",
        options: [],
        projectId,
        recordTypes: ["Work"],
        type: "Text",
      },
      {
        id: channelId,
        name: "Release channel",
        nameKey: "release channel",
        options: [],
        projectId,
        recordTypes: ["Work"],
        type: "Text",
      },
      {
        id: retiredId,
        name: "Legacy note",
        nameKey: "legacy note",
        options: [],
        projectId,
        recordTypes: ["Work"],
        type: "Text",
      },
      {
        id: dateOnlyId,
        name: "Release day",
        nameKey: "release day",
        options: [],
        projectId,
        recordTypes: ["Work"],
        type: "Date",
      },
    ]);
    const { createWithCustomFieldValues } = workLifecycle;
    if (!createWithCustomFieldValues) {
      throw new Error("Custom field finalization is required");
    }
    const workTemplates = createDatabaseWorkTemplates(database, workLifecycle);
    const source = await createWithCustomFieldValues(
      accountId,
      {
        baseRevision: 0,
        checklist: [
          { completed: false, id: "check-1", text: "Draft release notes" },
        ],
        clientIdempotencyKey: "duplicate-source",
        description: "## Outcome",
        plannedStartDate: "2026-09-24",
        projectId,
        targetDate: "2026-10-02",
        title: "Prepare the October release",
        type: "Task",
      },
      [
        {
          definitionId: audienceId,
          payload: { kind: "text", text: "Founders" },
        },
        { definitionId: channelId, payload: { kind: "text", text: "Beta" } },
      ],
    );
    await database.insert(customFieldValue).values([
      {
        definitionId: retiredId,
        id: `value-${crypto.randomUUID()}`,
        recordId: source.id,
        recordType: "Work",
        value: { kind: "text", text: "Old" },
      },
      {
        definitionId: dateOnlyId,
        id: `value-${crypto.randomUUID()}`,
        recordId: source.id,
        recordType: "Work",
        value: { date: "2026-10-02", kind: "date" },
      },
    ]);
    await database
      .update(customFieldDefinition)
      .set({ trashedAt: new Date() })
      .where(eq(customFieldDefinition.id, retiredId));

    const preview = await workTemplates.previewDuplicate(accountId, source.id);
    expect(preview).toMatchObject({
      checklist: [{ id: "check-1", text: "Draft release notes" }],
      description: "## Outcome",
      sourceRevision: source.revision,
      title: "Prepare the October release",
      type: "Task",
    });
    expect(preview?.customFields).toEqual([
      {
        definitionId: audienceId,
        name: "Release audience",
        value: { kind: "text", text: "Founders" },
      },
      {
        definitionId: channelId,
        name: "Release channel",
        value: { kind: "text", text: "Beta" },
      },
    ]);

    const command = {
      baseRevision: source.revision,
      clientIdempotencyKey: "duplicate-once",
      customFieldDefinitionIds: [audienceId],
      sourceWorkId: source.id,
    };
    const duplicated = await workTemplates.duplicate(accountId, command);
    const replayed = await workTemplates.duplicate(accountId, command);
    expect(replayed).toEqual(duplicated);
    expect(duplicated).toMatchObject({
      checklist: [{ completed: false, text: "Draft release notes" }],
      closureResult: null,
      description: "## Outcome",
      plannedStartDate: null,
      recreatedFrom: null,
      status: "Not Started",
      targetDate: null,
      title: "Prepare the October release",
      type: "Task",
    });
    expect(duplicated?.id).not.toBe(source.id);
    expect(duplicated?.key).not.toBe(source.key);
    await expect(
      database
        .select({ value: customFieldValue.value })
        .from(customFieldValue)
        .where(eq(customFieldValue.recordId, duplicated?.id ?? "")),
    ).resolves.toEqual([{ value: { kind: "text", text: "Founders" } }]);

    await expect(
      workTemplates.duplicate(accountId, {
        ...command,
        baseRevision: source.revision + 5,
        clientIdempotencyKey: "duplicate-stale-source",
      }),
    ).rejects.toBeInstanceOf(WorkDuplicateSourceStaleError);
    await expect(
      workTemplates.duplicate(accountId, {
        ...command,
        clientIdempotencyKey: "duplicate-missing-source",
        sourceWorkId: "missing-work",
      }),
    ).resolves.toBeNull();
  });
});
