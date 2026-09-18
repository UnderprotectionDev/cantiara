import { createDb } from "@cantiara/db";
import { user, workspace } from "@cantiara/db/schema/auth";
import {
  mutationHistory,
  mutationReceipt,
  mutationStaging,
} from "@cantiara/db/schema/mutation";
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
    const workLifecycle = createDatabaseWorkLifecycle(database);
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
});
