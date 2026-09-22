import { createDb } from "@cantiara/db";
import { user, workspace } from "@cantiara/db/schema/auth";
import {
  customFieldDefinition,
  customFieldValue,
} from "@cantiara/db/schema/custom-fields";
import { work } from "@cantiara/db/schema/index";
import { project } from "@cantiara/db/schema/project";
import { workRelation } from "@cantiara/db/schema/relation";
import { eq } from "drizzle-orm";
import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  test,
} from "vitest";
import { createDatabaseCustomFields } from "../../custom-fields/server/custom-fields-database";
import { createDatabaseCustomFieldFinalizationWriter } from "../../custom-fields/server/custom-fields-mutation-database";
import { createDatabaseRelations } from "../../relations/server/relations";
import { createDatabaseWorkLifecycle } from "../../work-lifecycle/server/work-lifecycle-database";
import {
  createDatabaseWorkTemplates,
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

  test("previews and confirms an independent one-off copy without lifecycle fields or a template", async () => {
    if (!database) {
      throw new Error("DATABASE_URL is required");
    }
    const workLifecycle = createDatabaseWorkLifecycle(database, {
      customFieldValueWriter: createDatabaseCustomFieldFinalizationWriter(),
    });
    const workTemplates = createDatabaseWorkTemplates(database, {
      workLifecycle,
    });
    const source = await workLifecycle.create(accountId, {
      baseRevision: 0,
      checklist: [
        { completed: true, id: "source-check-1", text: "Keep context" },
      ],
      clientIdempotencyKey: "duplicate-source",
      description: "Source description",
      projectId,
      targetDate: "2026-10-10",
      title: "Prepare launch",
      type: "Improvement",
    });
    await database
      .update(work)
      .set({
        archivedAt: new Date("2026-09-20T09:00:00.000Z"),
        closureReason: "Already shipped",
        closureResult: "Completed",
        effort: "Large",
        featureHealthHistory: [
          {
            health: "On Track",
            id: "health-1",
            reason: "Ready",
            recordedAt: "2026-09-19T09:00:00.000Z",
            recordedByAccountId: accountId,
          },
        ],
        status: "Closed",
      })
      .where(eq(work.id, source.id));
    const related = await workLifecycle.create(accountId, {
      baseRevision: 0,
      clientIdempotencyKey: "duplicate-related",
      projectId,
      title: "Related Work",
      type: "Task",
    });
    await database.insert(workRelation).values({
      id: `relation-${crypto.randomUUID()}`,
      kind: "Related",
      sourceWorkId: source.id,
      targetLabel: related.key,
      targetProjectId: projectId,
      targetRecordId: related.id,
    });
    await database.insert(customFieldDefinition).values([
      {
        id: "duplicate-text-field",
        name: "Release audience",
        nameKey: "release audience",
        projectId,
        recordTypes: ["Work"],
        type: "Text",
      },
      {
        id: "duplicate-date-field",
        name: "Release day",
        nameKey: "release day",
        projectId,
        recordTypes: ["Work"],
        type: "Date",
      },
    ]);
    await database.insert(customFieldValue).values([
      {
        definitionId: "duplicate-text-field",
        id: crypto.randomUUID(),
        recordId: source.id,
        recordType: "Work",
        value: { kind: "text", text: "Founders" },
      },
      {
        definitionId: "duplicate-date-field",
        id: crypto.randomUUID(),
        recordId: source.id,
        recordType: "Work",
        value: { date: "2026-10-10", kind: "date" },
      },
    ]);

    const preview = await workTemplates.previewDuplicate(accountId, source.id);
    expect(preview).toMatchObject({
      customFields: [
        {
          definitionId: "duplicate-text-field",
          label: "Release audience",
          value: { kind: "text", text: "Founders" },
        },
      ],
      sourceWork: { id: source.id, key: source.key },
    });
    expect(preview?.fields.map((field) => field.label)).toEqual([
      "Title",
      "Type",
      "Description",
      "Checklist",
    ]);
    if (!preview) {
      throw new Error("Expected a Duplicate Work preview.");
    }

    const duplicate = await workTemplates.duplicate(accountId, {
      baseRevision: 0,
      clientIdempotencyKey: "duplicate-confirm",
      previewId: preview.previewId,
      selectedCustomFieldIds: ["duplicate-text-field"],
      selectedFields: ["title", "type", "description", "checklist"],
      sourceWorkId: source.id,
    });

    expect(duplicate).toMatchObject({
      archivedAt: null,
      closureReason: null,
      closureResult: null,
      description: "Source description",
      effort: null,
      featureHealthHistory: [],
      primaryFeatureId: null,
      primarySpecId: null,
      projectId,
      recreatedFrom: null,
      status: "Not Started",
      targetDate: null,
      title: "Prepare launch",
      type: "Improvement",
    });
    expect(duplicate.id).not.toBe(source.id);
    expect(duplicate.key).not.toBe(source.key);
    expect(duplicate.checklist).toEqual([
      expect.objectContaining({ completed: true, text: "Keep context" }),
    ]);
    expect(duplicate.checklist[0]?.id).not.toBe("source-check-1");
    await expect(workTemplates.list(accountId, projectId)).resolves.toEqual([]);
    await expect(
      createDatabaseRelations(database).list(accountId, {
        recordId: duplicate.id,
        recordType: "Work",
      }),
    ).resolves.toEqual([]);
    const duplicatedCustomFields = await createDatabaseCustomFields(
      database,
    ).values(accountId, {
      projectId,
      recordId: duplicate.id,
      recordType: "Work",
    });
    expect(
      duplicatedCustomFields
        ?.filter((field) => field.value !== null)
        .map((field) => field.definition.id),
    ).toEqual(["duplicate-text-field"]);
  }, 15_000);
});
