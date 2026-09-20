import { createDb } from "@cantiara/db";
import { user, workspace } from "@cantiara/db/schema/auth";
import {
  mutationHistory,
  mutationReceipt,
  mutationStaging,
} from "@cantiara/db/schema/mutation";
import { workRelation } from "@cantiara/db/schema/relation";
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
import { createDatabaseProjectShell } from "../../project-shell/server/project-shell-database";
import { createDatabaseWorkLifecycle } from "../../work-lifecycle/server/work-lifecycle-database";
import { createDatabaseRelations } from "./relations";

const databaseUrl = process.env.ACCOUNT_ACCESS_DATABASE_URL;
const describeDatabase = databaseUrl ? describe : describe.skip;

describeDatabase("Relations PostgreSQL integration", () => {
  const database = databaseUrl
    ? createDb({ DATABASE_URL: databaseUrl })
    : undefined;
  const accountId = `relations-${crypto.randomUUID()}`;
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
    if (!database) {
      return;
    }
    await database
      .delete(mutationStaging)
      .where(eq(mutationStaging.actorId, accountId));
    await database
      .delete(mutationReceipt)
      .where(eq(mutationReceipt.actorId, accountId));
    await database
      .delete(mutationHistory)
      .where(eq(mutationHistory.actorId, accountId));
    await database.delete(user).where(eq(user.id, accountId));
  });

  afterAll(async () => {
    await database?.$client.end();
  });

  async function createWorks() {
    if (!database) {
      throw new Error("ACCOUNT_ACCESS_DATABASE_URL is required");
    }
    const projectShell = createDatabaseProjectShell(database);
    const lifecycle = createDatabaseWorkLifecycle(database);
    const project = await projectShell.create(accountId, {
      name: "Relation Project",
      shortCode: "REL",
      starterConfiguration: "Blank Project",
    });
    const source = await lifecycle.create(accountId, {
      baseRevision: 0,
      clientIdempotencyKey: "create-source",
      projectId: project.id,
      title: "Source Work",
      type: "Task",
    });
    const target = await lifecycle.create(accountId, {
      baseRevision: 0,
      clientIdempotencyKey: "create-target",
      projectId: project.id,
      title: "Target Work",
      type: "Task",
    });
    return { lifecycle, project, projectShell, source, target };
  }

  test("creates typed Related and Origin relations without changing Work status", async () => {
    if (!database) {
      throw new Error("ACCOUNT_ACCESS_DATABASE_URL is required");
    }
    const { source, target } = await createWorks();
    const relations = createDatabaseRelations(database);
    const sourceStatus = source.status;
    const targetStatus = target.status;

    const relatedPreview = await relations.previewCreate(accountId, {
      kind: "Related",
      source: { recordId: source.id, recordType: "Work" },
      target: { recordId: target.id, recordType: "Work" },
    });
    const related = await relations.create(accountId, {
      baseRevision: relatedPreview.baseRevision,
      clientIdempotencyKey: "create-related",
      kind: relatedPreview.kind,
      previewId: relatedPreview.previewId,
      source: {
        recordId: relatedPreview.source.recordId,
        recordType: relatedPreview.source.recordType,
      },
      target: {
        recordId: relatedPreview.target.recordId,
        recordType: relatedPreview.target.recordType,
      },
    });

    expect(related.relation).toMatchObject({
      direction: "outgoing",
      kind: "Related",
      label: "Related",
      target: { key: target.key, title: target.title },
    });

    const originPreview = await relations.previewCreate(accountId, {
      kind: "Origin",
      source: { recordId: source.id, recordType: "Work" },
      target: { recordId: target.id, recordType: "Work" },
    });
    await relations.create(accountId, {
      baseRevision: originPreview.baseRevision,
      clientIdempotencyKey: "create-origin",
      kind: originPreview.kind,
      previewId: originPreview.previewId,
      source: {
        recordId: originPreview.source.recordId,
        recordType: originPreview.source.recordType,
      },
      target: {
        recordId: originPreview.target.recordId,
        recordType: originPreview.target.recordType,
      },
    });

    await expect(
      relations.list(accountId, {
        recordId: target.id,
        recordType: "Work",
      }),
    ).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: "Origin", label: "Derived" }),
      ]),
    );
    expect(
      (await createDatabaseWorkLifecycle(database).find(accountId, source.id))
        ?.status,
    ).toBe(sourceStatus);
    expect(
      (await createDatabaseWorkLifecycle(database).find(accountId, target.id))
        ?.status,
    ).toBe(targetStatus);
  }, 30_000);

  test("requires a preview and rejects catalog values outside the closed set", async () => {
    if (!database) {
      throw new Error("ACCOUNT_ACCESS_DATABASE_URL is required");
    }
    const { source, target } = await createWorks();
    const relations = createDatabaseRelations(database);
    const endpoints = {
      source: { recordId: source.id, recordType: "Work" as const },
      target: { recordId: target.id, recordType: "Work" as const },
    };

    await expect(
      relations.create(accountId, {
        baseRevision: 0,
        clientIdempotencyKey: "without-preview",
        kind: "Related",
        previewId: "missing-preview",
        ...endpoints,
      }),
    ).rejects.toMatchObject({ code: "RELATION_PREVIEW_REQUIRED" });

    await expect(
      relations.previewCreate(accountId, {
        ...endpoints,
        kind: "Custom relation" as never,
      }),
    ).rejects.toThrow();
  }, 30_000);

  test("presents archived and inaccessible ends without leaking content", async () => {
    if (!database) {
      throw new Error("ACCOUNT_ACCESS_DATABASE_URL is required");
    }
    const { lifecycle, source, target } = await createWorks();
    const relations = createDatabaseRelations(database);
    const preview = await relations.previewCreate(accountId, {
      kind: "Related",
      source: { recordId: source.id, recordType: "Work" },
      target: { recordId: target.id, recordType: "Work" },
    });
    await relations.create(accountId, {
      baseRevision: preview.baseRevision,
      clientIdempotencyKey: "archived-related",
      kind: preview.kind,
      previewId: preview.previewId,
      source: {
        recordId: preview.source.recordId,
        recordType: preview.source.recordType,
      },
      target: {
        recordId: preview.target.recordId,
        recordType: preview.target.recordType,
      },
    });

    await lifecycle.archive(accountId, {
      baseRevision: target.revision,
      clientIdempotencyKey: "archive-target",
      workId: target.id,
    });
    await expect(
      relations.list(accountId, {
        recordId: source.id,
        recordType: "Work",
      }),
    ).resolves.toEqual([
      expect.objectContaining({
        target: expect.objectContaining({
          broken: expect.objectContaining({
            canOpenSourceRecord: true,
            reason: "Archived",
          }),
          key: target.key,
          title: target.title,
        }),
      }),
    ]);

    await database.delete(work).where(eq(work.id, target.id));
    await expect(
      relations.list(accountId, {
        recordId: source.id,
        recordType: "Work",
      }),
    ).resolves.toEqual([
      expect.objectContaining({
        target: expect.objectContaining({
          broken: expect.objectContaining({
            canOpenSourceRecord: false,
            reason: "Permanently deleted",
          }),
          key: null,
          label: null,
          title: null,
        }),
      }),
    ]);

    const otherAccountId = `relations-other-${crypto.randomUUID()}`;
    const otherWorkspaceId = `workspace-other-${crypto.randomUUID()}`;
    await database.insert(user).values({
      email: `${otherAccountId}@example.invalid`,
      id: otherAccountId,
      name: "Other Founder",
    });
    await database.insert(workspace).values({
      id: otherWorkspaceId,
      ownerAccountId: otherAccountId,
    });
    const otherProject = await createDatabaseProjectShell(database).create(
      otherAccountId,
      {
        name: "Other Project",
        shortCode: "OTHER",
        starterConfiguration: "Blank Project",
      },
    );
    const otherWork = await createDatabaseWorkLifecycle(database).create(
      otherAccountId,
      {
        baseRevision: 0,
        clientIdempotencyKey: "other-work",
        projectId: otherProject.id,
        title: "Private Secret",
        type: "Task",
      },
    );
    await database.insert(workRelation).values({
      id: "inaccessible-relation",
      kind: "Related",
      sourceWorkId: source.id,
      targetLabel: "Private Secret must not leak",
      targetProjectId: otherProject.id,
      targetRecordId: otherWork.id,
    });

    await expect(
      relations.list(accountId, {
        recordId: source.id,
        recordType: "Work",
      }),
    ).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          target: expect.objectContaining({
            broken: expect.objectContaining({ reason: "No access" }),
            key: null,
            label: null,
            title: null,
          }),
        }),
      ]),
    );
    await database.delete(user).where(eq(user.id, otherAccountId));
  }, 30_000);

  test("removes and undoes a relation through the Mutation Contract", async () => {
    if (!database) {
      throw new Error("ACCOUNT_ACCESS_DATABASE_URL is required");
    }
    const { source, target } = await createWorks();
    const relations = createDatabaseRelations(database);
    const preview = await relations.previewCreate(accountId, {
      kind: "Related",
      source: { recordId: source.id, recordType: "Work" },
      target: { recordId: target.id, recordType: "Work" },
    });
    const created = await relations.create(accountId, {
      baseRevision: preview.baseRevision,
      clientIdempotencyKey: "undo-related-create",
      kind: preview.kind,
      previewId: preview.previewId,
      source: {
        recordId: preview.source.recordId,
        recordType: preview.source.recordType,
      },
      target: {
        recordId: preview.target.recordId,
        recordType: preview.target.recordType,
      },
    });
    if (!created.relation) {
      throw new Error("Expected a created relation");
    }
    const removed = await relations.remove(accountId, {
      baseRevision: created.relation.revision,
      clientIdempotencyKey: "undo-related-remove",
      relationId: created.relation.id,
    });
    await expect(
      relations.list(accountId, {
        recordId: source.id,
        recordType: "Work",
      }),
    ).resolves.toEqual([]);

    const undone = await relations.undo(accountId, {
      baseRevision: created.relation.revision + 1,
      clientIdempotencyKey: "undo-related-confirm",
      receiptId: removed.receiptId,
      relationId: created.relation.id,
    });
    expect(undone.relation).toMatchObject({ kind: "Related" });
  }, 30_000);
});
