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
import { WorkTypeImpactPreviewRequiredError } from "./work-lifecycle";
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

  test("persists recreate content and Origin through the public Work Lifecycle seam", async () => {
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
      name: "Payment Reports",
      shortCode: "REPORTS",
      starterConfiguration: "Blank Project",
    });
    const verificationProject = await projectShell.create(accountId, {
      name: "Payment Archive",
      shortCode: "ARCHIVE",
      starterConfiguration: "Blank Project",
    });
    const workLifecycle = createDatabaseWorkLifecycle(database);
    const relatedWork = await workLifecycle.create(accountId, {
      baseRevision: 0,
      clientIdempotencyKey: "recreate-related-work",
      projectId: sourceProject.id,
      title: "Related source Work",
      type: "Task",
    });
    const source = await workLifecycle.create(accountId, {
      baseRevision: 0,
      checklist: [
        { completed: true, id: "check-1", text: "Confirm the problem" },
      ],
      clientIdempotencyKey: "recreate-source-work",
      description: "Keep this context",
      projectId: sourceProject.id,
      title: "Recreate this Work",
      type: "Bug",
    });
    const relationId = `relation-${crypto.randomUUID()}`;
    await database.insert(workRelation).values({
      id: relationId,
      kind: "Related",
      sourceWorkId: source.id,
      targetLabel: relatedWork.key,
      targetProjectId: relatedWork.projectId,
      targetRecordId: relatedWork.id,
    });

    const preview = await workLifecycle.previewRecreate(accountId, {
      sourceWorkId: source.id,
      targetProjectId: targetProject.id,
    });
    expect(preview?.relations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: relationId,
          kind: "Related",
          targetRecordId: relatedWork.id,
        }),
      ]),
    );
    if (!preview) {
      throw new Error("Expected a recreate preview.");
    }

    const recreated = await workLifecycle.recreate(accountId, {
      baseRevision: 0,
      clientIdempotencyKey: "recreate-confirm-work",
      previewId: preview.previewId,
      selectedFields: ["title", "description", "checklist"],
      selectedRelationIds: [relationId],
      sourceWorkId: source.id,
      targetProjectId: targetProject.id,
    });
    expect(recreated).toMatchObject({
      checklist: source.checklist,
      description: source.description,
      projectId: targetProject.id,
      recreatedFrom: { id: source.id, key: source.key },
      title: source.title,
      type: "Task",
    });
    await expect(
      workLifecycle.find(accountId, source.id),
    ).resolves.toMatchObject({
      description: source.description,
      projectId: sourceProject.id,
      revision: source.revision,
      title: source.title,
      type: source.type,
    });

    const recreatedPreview = await workLifecycle.previewRecreate(accountId, {
      sourceWorkId: recreated.id,
      targetProjectId: verificationProject.id,
    });
    expect(recreatedPreview?.relations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "Origin",
          targetRecordId: source.id,
        }),
      ]),
    );
  });

  test("persists the Work archive filter and restores the same identity", async () => {
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
      clientIdempotencyKey: "archive-create",
      projectId: project.id,
      title: "Archive payment research",
      type: "Research",
    });

    const archived = await workLifecycle.archive(accountId, {
      baseRevision: created.revision,
      clientIdempotencyKey: "archive-work",
      workId: created.id,
    });

    expect(archived).toMatchObject({
      closureResult: null,
      id: created.id,
      key: created.key,
      status: "Not Started",
    });
    expect(archived.archivedAt).not.toBeNull();
    await expect(workLifecycle.list(accountId, project.id)).resolves.toEqual(
      [],
    );
    await expect(
      workLifecycle.list(accountId, project.id, { archived: true }),
    ).resolves.toMatchObject([
      {
        archivedAt: archived.archivedAt,
        closureResult: null,
        id: created.id,
        key: created.key,
        status: "Not Started",
      },
    ]);

    await expect(
      workLifecycle.unarchive(accountId, {
        baseRevision: archived.revision,
        clientIdempotencyKey: "unarchive-work",
        workId: created.id,
      }),
    ).resolves.toMatchObject({
      archivedAt: null,
      id: created.id,
      key: created.key,
    });
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

  test("persists Feature inclusion, health, Primary spec, and derived progress independently", async () => {
    if (!database) {
      throw new Error("ACCOUNT_ACCESS_DATABASE_URL is required");
    }

    const projectShell = createDatabaseProjectShell(database);
    const project = await projectShell.create(accountId, {
      name: "Feature Project",
      shortCode: "FEATURE",
      starterConfiguration: "Blank Project",
    });
    const workLifecycle = createDatabaseWorkLifecycle(database, {
      projectDocumentAccess: {
        hasProjectDocument: async (_accountId, projectId, documentId) =>
          projectId === project.id && documentId === "document-1",
      },
    });
    const feature = await workLifecycle.create(accountId, {
      baseRevision: 0,
      clientIdempotencyKey: "database-feature",
      projectId: project.id,
      title: "Feature scope",
      type: "Feature",
    });
    const independentWork = await workLifecycle.create(accountId, {
      baseRevision: 0,
      clientIdempotencyKey: "database-included-work",
      projectId: project.id,
      title: "Independent Bug",
      type: "Bug",
    });
    const blocker = await workLifecycle.create(accountId, {
      baseRevision: 0,
      clientIdempotencyKey: "database-scope-tree-blocker",
      projectId: project.id,
      title: "Provider access",
      type: "Research",
    });

    const included = await workLifecycle.includeWork(accountId, {
      baseRevision: independentWork.revision,
      clientIdempotencyKey: "database-include-work",
      featureId: feature.id,
      workId: independentWork.id,
    });
    const replayedInclusion = await workLifecycle.includeWork(accountId, {
      baseRevision: independentWork.revision,
      clientIdempotencyKey: "database-include-work",
      featureId: feature.id,
      workId: independentWork.id,
    });
    expect(replayedInclusion).toEqual(included);
    await database.insert(workRelation).values([
      {
        id: `database-scope-tree-block-${crypto.randomUUID()}`,
        kind: "Blocks",
        sourceWorkId: blocker.id,
        targetLabel: included.key,
        targetProjectId: project.id,
        targetRecordId: included.id,
      },
      {
        id: `database-scope-tree-milestone-${crypto.randomUUID()}`,
        kind: "Contributes to Milestone",
        sourceWorkId: included.id,
        targetLabel: "Private beta",
        targetProjectId: project.id,
        targetRecordId: "milestone-1",
      },
    ]);
    const withHealth = await workLifecycle.recordFeatureHealth(accountId, {
      baseRevision: feature.revision,
      clientIdempotencyKey: "database-feature-health",
      featureId: feature.id,
      health: "On Track",
      reason: "The acceptance path is clear.",
    });
    const replayedHealth = await workLifecycle.recordFeatureHealth(accountId, {
      baseRevision: feature.revision,
      clientIdempotencyKey: "database-feature-health",
      featureId: feature.id,
      health: "On Track",
      reason: "The acceptance path is clear.",
    });
    expect(replayedHealth).toEqual(withHealth);
    await workLifecycle.updateFeaturePrimarySpec(accountId, {
      baseRevision: withHealth.revision,
      clientIdempotencyKey: "database-primary-spec",
      featureId: feature.id,
      primarySpecId: "document-1",
    });

    await expect(
      workLifecycle.find(accountId, included.id),
    ).resolves.toMatchObject({
      primaryFeatureId: feature.id,
      status: independentWork.status,
      type: "Bug",
    });
    await expect(
      workLifecycle.featureProgress(accountId, feature.id),
    ).resolves.toMatchObject({ includedWorkCount: 1 });
    await expect(
      workLifecycle.find(accountId, feature.id),
    ).resolves.toMatchObject({
      featureHealthHistory: [expect.objectContaining({ health: "On Track" })],
      primarySpecId: "document-1",
      status: "Not Started",
    });
    await expect(
      workLifecycle.scopeTree(accountId, project.id),
    ).resolves.toMatchObject({
      features: [
        {
          includedWork: [
            {
              blockers: [{ id: blocker.id, key: blocker.key }],
              milestones: [{ id: "milestone-1", label: "Private beta" }],
              work: { id: included.id },
            },
          ],
          progress: { includedWorkCount: 1 },
          work: { id: feature.id, status: "Not Started" },
        },
      ],
      project: { id: project.id, name: "Feature Project" },
    });
  });

  test("keeps inclusion valid when include and Feature exit race", async () => {
    if (!database) {
      throw new Error("ACCOUNT_ACCESS_DATABASE_URL is required");
    }

    const projectShell = createDatabaseProjectShell(database);
    const project = await projectShell.create(accountId, {
      name: "Concurrent Feature Project",
      shortCode: "RACE",
      starterConfiguration: "Blank Project",
    });
    const workLifecycle = createDatabaseWorkLifecycle(database);
    const feature = await workLifecycle.create(accountId, {
      baseRevision: 0,
      clientIdempotencyKey: "race-feature",
      projectId: project.id,
      title: "Concurrent Feature",
      type: "Feature",
    });
    const candidate = await workLifecycle.create(accountId, {
      baseRevision: 0,
      clientIdempotencyKey: "race-candidate",
      projectId: project.id,
      title: "Concurrent candidate",
      type: "Task",
    });
    const preview = await workLifecycle.previewTypeChange(accountId, {
      type: "Task",
      workId: feature.id,
    });
    if (!preview) {
      throw new Error("Expected a Feature exit preview.");
    }

    const results = await Promise.allSettled([
      workLifecycle.includeWork(accountId, {
        baseRevision: candidate.revision,
        clientIdempotencyKey: "race-include",
        featureId: feature.id,
        workId: candidate.id,
      }),
      workLifecycle.updateType(accountId, {
        baseRevision: feature.revision,
        clientIdempotencyKey: "race-exit",
        impactPreviewId: preview.previewId,
        type: "Task",
        workId: feature.id,
      }),
    ]);

    expect(
      results.filter((result) => result.status === "fulfilled"),
    ).toHaveLength(1);
    const rejected = results.find((result) => result.status === "rejected");
    expect(rejected).toBeDefined();
    if (rejected?.status === "rejected") {
      expect([
        "APPLY_FAILED",
        "WORK_FEATURE_EXIT_BLOCKED",
        "WORK_INCLUSION_CONFLICT",
      ]).toContain(rejected.reason?.code);
    }
    const [storedFeature, storedCandidate] = await Promise.all([
      workLifecycle.find(accountId, feature.id),
      workLifecycle.find(accountId, candidate.id),
    ]);
    expect(storedFeature).not.toBeNull();
    expect(storedCandidate).not.toBeNull();
    expect(storedFeature?.type === "Feature").toBe(
      storedCandidate?.primaryFeatureId === storedFeature?.id,
    );
  });

  test("persists explicit closure and confirmed reopen separately from status", async () => {
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
      clientIdempotencyKey: "closure-create",
      projectId: project.id,
      title: "Retire the old payment path",
      type: "Improvement",
    });

    const closed = await workLifecycle.close(
      accountId,
      {
        baseRevision: created.revision,
        clientIdempotencyKey: "closure-abandoned",
        closureResult: "Abandoned",
        reason: "The provider removed this path.",
        workId: created.id,
      },
      { kind: "Visible user" },
    );
    expect(closed).toMatchObject({
      closureReason: "The provider removed this path.",
      closureResult: "Abandoned",
      revision: 2,
      status: "Closed",
    });
    await expect(
      workLifecycle.find(accountId, created.id),
    ).resolves.toMatchObject({
      closureReason: "The provider removed this path.",
      closureResult: "Abandoned",
      revision: 2,
      status: "Closed",
    });

    const reopened = await workLifecycle.reopen(
      accountId,
      {
        baseRevision: closed.revision,
        clientIdempotencyKey: "closure-reopen",
        confirmed: true,
        status: "In Progress",
        workId: created.id,
      },
      { kind: "Visible user" },
    );
    expect(reopened).toMatchObject({
      closureReason: null,
      closureResult: null,
      revision: 3,
      status: "In Progress",
    });
    await expect(
      workLifecycle.find(accountId, created.id),
    ).resolves.toMatchObject({
      closureReason: null,
      closureResult: null,
      revision: 3,
      status: "In Progress",
    });
  });
});
