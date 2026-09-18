import { createDb } from "@cantiara/db";
import { user, workspace } from "@cantiara/db/schema/auth";
import {
  mutationHistory,
  mutationReceipt,
  mutationStaging,
} from "@cantiara/db/schema/mutation";
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

import { createDatabaseProjectShell } from "../../project-shell/server/project-shell-database";
import {
  WorkRelationNotPortableError,
  WorkTypeImpactPreviewRequiredError,
} from "./work-lifecycle";
import { createDatabaseWorkLifecycle } from "./work-lifecycle-database";

const databaseUrl = process.env.ACCOUNT_ACCESS_DATABASE_URL;
const describeDatabase = databaseUrl ? describe : describe.skip;

describeDatabase("Work Lifecycle PostgreSQL integration", () => {
  const database = databaseUrl
    ? createDb({ DATABASE_URL: databaseUrl })
    : undefined;
  const accountId = `work-lifecycle-${crypto.randomUUID()}`;
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

  test("allocates unique immutable keys under concurrent creation", async () => {
    if (!database) {
      throw new Error("ACCOUNT_ACCESS_DATABASE_URL is required");
    }

    const projectShell = createDatabaseProjectShell(database);
    const project = await projectShell.create(accountId, {
      name: "Payment App",
      shortCode: "PAY",
      starterConfiguration: "Blank Project",
    });
    const workLifecycle = createDatabaseWorkLifecycle(database);

    const created = await Promise.all(
      Array.from({ length: 12 }, (_, index) =>
        workLifecycle.create(accountId, {
          baseRevision: 0,
          clientIdempotencyKey: `concurrent-work-${index}`,
          projectId: project.id,
          title: `Work ${index}`,
          type: index % 2 === 0 ? "Task" : "Research",
        }),
      ),
    );

    expect(created.map((record) => record.id)).toHaveLength(12);
    expect(new Set(created.map((record) => record.key)).size).toBe(12);
    expect(
      created.map((record) => record.number).sort((a, b) => a - b),
    ).toEqual(Array.from({ length: 12 }, (_, index) => index + 1));
    expect(created.every((record) => record.status === "Not Started")).toBe(
      true,
    );
    expect(created.every((record) => record.projectId === project.id)).toBe(
      true,
    );
    await expect(
      projectShell.find(accountId, project.id),
    ).resolves.toMatchObject({
      shortCode: "PAY",
      shortCodeLocked: true,
    });
  });

  test("keeps Work inside its original Project scope", async () => {
    if (!database) {
      throw new Error("ACCOUNT_ACCESS_DATABASE_URL is required");
    }

    const projectShell = createDatabaseProjectShell(database);
    const workLifecycle = createDatabaseWorkLifecycle(database);
    const firstProject = await projectShell.create(accountId, {
      name: "Payment App",
      shortCode: "PAY",
      starterConfiguration: "Blank Project",
    });
    const secondProject = await projectShell.create(accountId, {
      name: "Payment Reports",
      shortCode: "REPORTS",
      starterConfiguration: "Blank Project",
    });
    const created = await workLifecycle.create(accountId, {
      baseRevision: 0,
      clientIdempotencyKey: "scoped-work-1",
      projectId: firstProject.id,
      title: "Scoped Work",
      type: "Task",
    });

    await expect(
      workLifecycle.find(accountId, created.id),
    ).resolves.toMatchObject({ projectId: firstProject.id });
    await expect(
      workLifecycle.list(accountId, secondProject.id),
    ).resolves.toEqual([]);
  });

  test("atomically recreates portable relations and an Origin in the target Project", async () => {
    if (!database) {
      throw new Error("ACCOUNT_ACCESS_DATABASE_URL is required");
    }

    const projectShell = createDatabaseProjectShell(database);
    const sourceProject = await projectShell.create(accountId, {
      name: "Payment App",
      shortCode: "PAY",
      starterConfiguration: "Blank Project",
    });
    const targetProject = await projectShell.create(accountId, {
      name: "Orders",
      shortCode: "ORD",
      starterConfiguration: "Blank Project",
    });
    const workLifecycle = createDatabaseWorkLifecycle(database);
    const source = await workLifecycle.create(accountId, {
      baseRevision: 0,
      checklist: [
        { completed: false, id: "item-1", text: "Confirm the failure" },
      ],
      clientIdempotencyKey: "recreate-source",
      description: "Payment failures are intermittent.",
      projectId: sourceProject.id,
      title: "Investigate payment failures",
      type: "Research",
    });
    await database.insert(workRelation).values([
      {
        id: "portable-related",
        kind: "Related",
        sourceWorkId: source.id,
        targetLabel: "Decision DEC-1",
        targetProjectId: sourceProject.id,
        targetRecordId: "decision-1",
      },
      {
        id: "github-completion",
        kind: "GitHub Completion",
        sourceWorkId: source.id,
        targetLabel: "Pull request #42",
        targetProjectId: sourceProject.id,
        targetRecordId: "github-pr-42",
      },
    ]);
    const sourceBefore = await workLifecycle.find(accountId, source.id);

    const preview = await workLifecycle.previewRecreate(accountId, {
      sourceWorkId: source.id,
      targetProjectId: targetProject.id,
    });
    expect(preview?.relations).toHaveLength(2);
    if (!preview) {
      throw new Error("Expected a recreate preview.");
    }
    await expect(
      workLifecycle.recreate(accountId, {
        baseRevision: 0,
        clientIdempotencyKey: "reject-non-portable",
        previewId: preview.previewId,
        selectedFields: ["title", "type"],
        selectedRelationIds: ["github-completion"],
        sourceWorkId: source.id,
        targetProjectId: targetProject.id,
      }),
    ).rejects.toBeInstanceOf(WorkRelationNotPortableError);

    const recreated = await workLifecycle.recreate(accountId, {
      baseRevision: 0,
      clientIdempotencyKey: "confirm-recreate",
      previewId: preview.previewId,
      selectedFields: ["title", "type", "description", "checklist"],
      selectedRelationIds: ["portable-related"],
      sourceWorkId: source.id,
      targetProjectId: targetProject.id,
    });

    expect(recreated).toMatchObject({
      checklist: source.checklist,
      description: source.description,
      key: "ORD-1",
      recreatedFrom: { id: source.id, key: source.key },
      status: "Not Started",
    });
    const recreatedRelations = await database
      .select()
      .from(workRelation)
      .where(eq(workRelation.sourceWorkId, recreated.id));
    expect(recreatedRelations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "Related",
          targetRecordId: "decision-1",
        }),
        expect.objectContaining({
          kind: "Origin",
          targetRecordId: source.id,
        }),
      ]),
    );
    expect(recreatedRelations).toHaveLength(2);
    await expect(workLifecycle.find(accountId, source.id)).resolves.toEqual(
      sourceBefore,
    );
  });

  test("persists free type changes and protects Feature boundary changes", async () => {
    if (!database) {
      throw new Error("ACCOUNT_ACCESS_DATABASE_URL is required");
    }

    const projectShell = createDatabaseProjectShell(database);
    const project = await projectShell.create(accountId, {
      name: "Payment App",
      shortCode: "PAY",
      starterConfiguration: "Blank Project",
    });
    const workLifecycle = createDatabaseWorkLifecycle(database);
    const created = await workLifecycle.create(accountId, {
      baseRevision: 0,
      clientIdempotencyKey: "type-change-create",
      projectId: project.id,
      title: "Refine payment failure handling",
      type: "Task",
    });

    const bug = await workLifecycle.updateType(accountId, {
      baseRevision: created.revision,
      clientIdempotencyKey: "type-change-bug",
      type: "Bug",
      workId: created.id,
    });
    expect(bug).toMatchObject({ revision: 2, type: "Bug" });

    const preview = await workLifecycle.previewTypeChange(accountId, {
      type: "Feature",
      workId: created.id,
    });
    expect(preview).toMatchObject({ requiresImpactPreview: true });
    if (!preview) {
      throw new Error("Expected a Feature type-change preview.");
    }

    await expect(
      workLifecycle.updateType(accountId, {
        baseRevision: bug.revision,
        clientIdempotencyKey: "type-change-feature-without-preview",
        type: "Feature",
        workId: created.id,
      }),
    ).rejects.toBeInstanceOf(WorkTypeImpactPreviewRequiredError);

    await expect(
      workLifecycle.updateType(accountId, {
        baseRevision: bug.revision,
        clientIdempotencyKey: "type-change-feature",
        impactPreviewId: preview.previewId,
        type: "Feature",
        workId: created.id,
      }),
    ).resolves.toMatchObject({ revision: 3, type: "Feature" });
  });
});
