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
import { createDatabaseCustomFields } from "../../custom-fields/server/custom-fields-database";
import { createDatabaseCustomFieldFinalizationWriter } from "../../custom-fields/server/custom-fields-mutation-database";
import { createDatabaseProjectShell } from "../../project-shell/server/project-shell-database";
import { createDatabaseWorkDrafts } from "../../work-drafts/server/work-drafts-database";
import {
  WorkCreationConflictError,
  WorkFeatureExitBlockedError,
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

  test("persists ordered checklist items without changing the parent lifecycle", async () => {
    if (!database) {
      throw new Error("ACCOUNT_ACCESS_DATABASE_URL is required");
    }

    const projectShell = createDatabaseProjectShell(database);
    const project = await projectShell.create(accountId, {
      name: "Checklist Project",
      shortCode: "CHECK",
      starterConfiguration: "Blank Project",
    });
    const workLifecycle = createDatabaseWorkLifecycle(database);
    const created = await workLifecycle.create(accountId, {
      baseRevision: 0,
      clientIdempotencyKey: "checklist-create",
      projectId: project.id,
      title: "Prepare release notes",
      type: "Task",
    });

    const updated = await workLifecycle.updateChecklist(accountId, {
      baseRevision: created.revision,
      checklist: [
        { completed: true, id: "item-2", text: "Publish the page" },
        { completed: false, id: "item-1", text: "Confirm the copy" },
      ],
      clientIdempotencyKey: "checklist-update",
      workId: created.id,
    });

    expect(updated).toMatchObject({
      closureResult: null,
      status: "Not Started",
    });
    await expect(
      workLifecycle.find(accountId, created.id),
    ).resolves.toMatchObject({
      checklist: [
        { completed: true, id: "item-2", text: "Publish the page" },
        { completed: false, id: "item-1", text: "Confirm the copy" },
      ],
      closureResult: null,
      status: "Not Started",
    });
  });

  test("converts a checklist item into a same-Project Work with Origin and replays idempotently", async () => {
    if (!database) {
      throw new Error("ACCOUNT_ACCESS_DATABASE_URL is required");
    }

    const projectShell = createDatabaseProjectShell(database);
    const project = await projectShell.create(accountId, {
      name: "Checklist Conversion Project",
      shortCode: "CONVERT",
      starterConfiguration: "Blank Project",
    });
    const verificationProject = await projectShell.create(accountId, {
      name: "Checklist Conversion Verification",
      shortCode: "VERIFY",
      starterConfiguration: "Blank Project",
    });
    const workLifecycle = createDatabaseWorkLifecycle(database);
    const source = await workLifecycle.create(accountId, {
      baseRevision: 0,
      checklist: [
        { completed: false, id: "item-1", text: "Publish the release" },
      ],
      clientIdempotencyKey: "checklist-convert-source",
      projectId: project.id,
      title: "Prepare the release",
      type: "Task",
    });

    const preview = await workLifecycle.previewChecklistConversion(accountId, {
      itemId: "item-1",
      workId: source.id,
    });
    expect(preview).toMatchObject({
      newWork: {
        projectId: project.id,
        status: "Not Started",
        title: "Publish the release",
        type: "Task",
      },
      originPosition: {
        componentId: "item-1",
        ownerRecordId: source.id,
        sourceVersion: String(source.revision),
      },
      targetProject: { id: project.id, name: "Checklist Conversion Project" },
    });
    await expect(
      workLifecycle.list(accountId, project.id),
    ).resolves.toHaveLength(1);
    if (!preview) {
      throw new Error("Expected a checklist conversion preview.");
    }

    const input = {
      baseRevision: source.revision,
      clientIdempotencyKey: "checklist-convert-confirm",
      itemId: "item-1",
      previewId: preview.previewId,
      workId: source.id,
    } as const;
    const converted = await workLifecycle.convertChecklistItem(
      accountId,
      input,
    );
    expect(converted.work).toMatchObject({
      originPosition: preview.originPosition,
      projectId: project.id,
      status: "Not Started",
      title: "Publish the release",
      type: "Task",
    });
    await expect(
      workLifecycle.find(accountId, source.id),
    ).resolves.toMatchObject({
      checklist: [
        {
          completed: true,
          convertedWork: {
            id: converted.work.id,
            key: converted.work.key,
            title: converted.work.title,
          },
          id: "item-1",
        },
      ],
    });
    const originPreview = await workLifecycle.previewRecreate(accountId, {
      sourceWorkId: converted.work.id,
      targetProjectId: verificationProject.id,
    });
    expect(originPreview?.relations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "Origin",
          targetRecordId: source.id,
        }),
      ]),
    );
    await expect(
      workLifecycle.convertChecklistItem(accountId, input),
    ).resolves.toEqual(converted);
    await expect(
      workLifecycle.list(accountId, project.id),
    ).resolves.toHaveLength(2);
  });

  test("finalizes Draft Custom field values atomically with one Work", async () => {
    if (!database) {
      throw new Error("ACCOUNT_ACCESS_DATABASE_URL is required");
    }

    const projectShell = createDatabaseProjectShell(database);
    const project = await projectShell.create(accountId, {
      name: "Draft Custom Fields Project",
      shortCode: "DRAFTCF",
      starterConfiguration: "Blank Project",
    });
    const customFields = createDatabaseCustomFields(database);
    const readiness = await customFields.create(accountId, {
      name: "Release readiness",
      projectId: project.id,
      recordTypes: ["Work"],
      type: "Boolean",
    });
    const workLifecycle = createDatabaseWorkLifecycle(database, {
      customFieldValueWriter: createDatabaseCustomFieldFinalizationWriter(),
    });
    const workDrafts = createDatabaseWorkDrafts(
      database,
      workLifecycle,
      projectShell,
    );
    const draft = await workDrafts.save(accountId, {
      baseRevision: 0,
      checklist: [],
      clientIdempotencyKey: "draft-custom-field-save",
      customFieldValues: [
        {
          definitionId: readiness.id,
          payload: { boolean: true, kind: "boolean" },
        },
      ],
      description: null,
      draftId: "draft-custom-field-1",
      projectId: project.id,
      title: "Finalize with a Custom field",
      type: "Task",
    });

    const created = await workDrafts.finalize(accountId, {
      baseRevision: draft.revision,
      clientIdempotencyKey: "draft-custom-field-finalize",
      draftId: draft.id,
    });

    expect(created.projectId).toBe(project.id);
    await expect(workDrafts.find(accountId, draft.id)).resolves.toBeNull();
    await expect(
      customFields.values(accountId, {
        projectId: project.id,
        recordId: created.id,
        recordType: "Work",
      }),
    ).resolves.toEqual([
      expect.objectContaining({
        definition: expect.objectContaining({ id: readiness.id }),
        value: expect.objectContaining({
          recordId: created.id,
          recordType: "Work",
          value: { boolean: true, kind: "boolean" },
        }),
      }),
    ]);

    const invalidDraft = await workDrafts.save(accountId, {
      baseRevision: 0,
      checklist: [],
      clientIdempotencyKey: "draft-custom-field-invalid-save",
      customFieldValues: [
        {
          definitionId: "missing-field",
          payload: { boolean: true, kind: "boolean" },
        },
      ],
      description: null,
      draftId: "draft-custom-field-invalid",
      projectId: project.id,
      title: "Do not partially finalize",
      type: "Task",
    });

    await expect(
      workDrafts.finalize(accountId, {
        baseRevision: invalidDraft.revision,
        clientIdempotencyKey: "draft-custom-field-invalid-finalize",
        draftId: invalidDraft.id,
      }),
    ).rejects.toMatchObject({ code: "CUSTOM_FIELD_NOT_FOUND" });
    await expect(
      workDrafts.find(accountId, invalidDraft.id),
    ).resolves.toMatchObject({ id: invalidDraft.id });
    await expect(
      workLifecycle.list(accountId, project.id),
    ).resolves.toHaveLength(1);

    const correctedDraft = await workDrafts.save(accountId, {
      baseRevision: invalidDraft.revision,
      checklist: [],
      clientIdempotencyKey: "draft-custom-field-corrected-save",
      customFieldValues: [
        {
          definitionId: readiness.id,
          payload: { boolean: false, kind: "boolean" },
        },
      ],
      description: null,
      draftId: invalidDraft.id,
      projectId: project.id,
      title: "Finalize after correcting the Custom field",
      type: "Task",
    });
    const corrected = await workDrafts.finalize(accountId, {
      baseRevision: correctedDraft.revision,
      clientIdempotencyKey: "draft-custom-field-invalid-finalize",
      draftId: correctedDraft.id,
    });
    await expect(
      workDrafts.find(accountId, correctedDraft.id),
    ).resolves.toBeNull();
    await expect(
      customFields.values(accountId, {
        projectId: project.id,
        recordId: corrected.id,
        recordType: "Work",
      }),
    ).resolves.toEqual([
      expect.objectContaining({
        definition: expect.objectContaining({ id: readiness.id }),
        value: expect.objectContaining({
          recordId: corrected.id,
          value: { boolean: false, kind: "boolean" },
        }),
      }),
    ]);
    await expect(
      workLifecycle.list(accountId, project.id),
    ).resolves.toHaveLength(2);

    await expect(
      workLifecycle.create(accountId, {
        baseRevision: 0,
        clientIdempotencyKey: "work-draft:draft-custom-field-1",
        projectId: project.id,
        title: "Different payload on the same Work key",
        type: "Task",
      }),
    ).rejects.toBeInstanceOf(WorkCreationConflictError);
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
        blockingStatus: "Active",
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
    const history = await database
      .select()
      .from(mutationHistory)
      .where(eq(mutationHistory.targetId, created.id));
    expect(
      history.find((entry) => entry.revision === closed.revision)?.nextValue,
    ).toMatchObject({
      work: {
        closureReason: "The provider removed this path.",
        closureResult: "Abandoned",
        status: "Closed",
      },
    });
    expect(
      history.find((entry) => entry.revision === reopened.revision)
        ?.previousValue,
    ).toMatchObject({
      work: { closureResult: "Abandoned", status: "Closed" },
    });
  });

  test("merges Work atomically, resolves the retired identity, and undoes only merge-attributed changes", async () => {
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
    const surviving = await workLifecycle.create(accountId, {
      baseRevision: 0,
      clientIdempotencyKey: "merge-surviving",
      description: "Canonical payment failure flow",
      projectId: project.id,
      title: "Investigate payment failures",
      type: "Research",
    });
    const duplicate = await workLifecycle.create(accountId, {
      baseRevision: 0,
      clientIdempotencyKey: "merge-duplicate",
      description: "Captured payment failure flow",
      projectId: project.id,
      title: "Investigate payment failure",
      type: "Research",
    });
    const relationId = `relation-${crypto.randomUUID()}`;
    await database.insert(workRelation).values({
      id: relationId,
      kind: "Related",
      sourceWorkId: duplicate.id,
      targetLabel: "External payment evidence",
      targetProjectId: project.id,
      targetRecordId: "external-payment-evidence",
    });

    const preview = await workLifecycle.previewMerge(accountId, {
      duplicateWorkId: duplicate.id,
      survivingWorkId: surviving.id,
    });
    expect(preview?.relations).toEqual([
      expect.objectContaining({
        action: "Rewrite source",
        id: relationId,
      }),
    ]);
    if (!preview) {
      throw new Error("Expected a Work Merge Preview.");
    }

    const merged = await workLifecycle.merge(accountId, {
      baseRevision: surviving.revision,
      clientIdempotencyKey: "merge-confirm",
      duplicateRevision: duplicate.revision,
      duplicateWorkId: duplicate.id,
      fieldResolutions: {
        description: "surviving",
        title: "duplicate",
      },
      previewId: preview.previewId,
      survivingWorkId: surviving.id,
    });
    expect(merged).toMatchObject({
      retiredIdentity: {
        id: duplicate.id,
        key: duplicate.key,
        origin: { id: duplicate.id, key: duplicate.key },
      },
      work: { id: surviving.id, title: duplicate.title },
    });
    await expect(
      workLifecycle.find(accountId, duplicate.id),
    ).resolves.toBeNull();
    await expect(
      workLifecycle.resolve(accountId, {
        key: duplicate.key,
        projectId: project.id,
      }),
    ).resolves.toMatchObject({
      identity: {
        id: duplicate.id,
        origin: { key: duplicate.key },
        survivingWork: { id: surviving.id, title: duplicate.title },
      },
      kind: "Retired",
    });
    const edited = await workLifecycle.updateType(accountId, {
      baseRevision: merged.work.revision,
      clientIdempotencyKey: "merge-unrelated-edit",
      type: "Bug",
      workId: surviving.id,
    });
    const undone = await workLifecycle.undoMerge(accountId, {
      baseRevision: edited.revision,
      clientIdempotencyKey: "merge-undo",
      mergeId: merged.mergeId,
      survivingWorkId: surviving.id,
    });
    expect(undone).toMatchObject({
      description: surviving.description,
      title: surviving.title,
      type: "Bug",
    });
    await expect(
      workLifecycle.find(accountId, duplicate.id),
    ).resolves.toMatchObject({
      id: duplicate.id,
      key: duplicate.key,
      title: duplicate.title,
    });
    await expect(
      workLifecycle.previewMerge(accountId, {
        duplicateWorkId: duplicate.id,
        survivingWorkId: surviving.id,
      }),
    ).resolves.toMatchObject({
      relations: [
        expect.objectContaining({
          action: "Rewrite source",
          id: relationId,
        }),
      ],
    });
  });

  test("re-points retired identity redirects across chained merges and restores them on Undo", async () => {
    if (!database) {
      throw new Error("ACCOUNT_ACCESS_DATABASE_URL is required");
    }

    const projectShell = createDatabaseProjectShell(database);
    const project = await projectShell.create(accountId, {
      name: "Chained Payment App",
      shortCode: "CHAIN",
      starterConfiguration: "Blank Project",
    });
    const workLifecycle = createDatabaseWorkLifecycle(database);
    const firstSurvivor = await workLifecycle.create(accountId, {
      baseRevision: 0,
      clientIdempotencyKey: "chain-first-survivor",
      projectId: project.id,
      title: "Investigate payment failures",
    });
    const chainedDuplicate = await workLifecycle.create(accountId, {
      baseRevision: 0,
      clientIdempotencyKey: "chain-duplicate",
      projectId: project.id,
      title: "Investigate payment failure",
    });
    const finalSurvivor = await workLifecycle.create(accountId, {
      baseRevision: 0,
      clientIdempotencyKey: "chain-final-survivor",
      projectId: project.id,
      title: "Investigate payment failures",
      type: "Bug",
    });

    const mergeInto = async (
      duplicateId: string,
      duplicateRevision: number,
      survivorId: string,
      survivorRevision: number,
      clientIdempotencyKey: string,
    ) => {
      const preview = await workLifecycle.previewMerge(accountId, {
        duplicateWorkId: duplicateId,
        survivingWorkId: survivorId,
      });
      if (!preview) {
        throw new Error("Expected a Work Merge Preview.");
      }
      return workLifecycle.merge(accountId, {
        baseRevision: survivorRevision,
        clientIdempotencyKey,
        duplicateRevision,
        duplicateWorkId: duplicateId,
        fieldResolutions: Object.fromEntries(
          preview.fields
            .filter((field) => field.conflict)
            .map((field) => [field.key, "surviving"]),
        ),
        previewId: preview.previewId,
        survivingWorkId: survivorId,
      });
    };

    const firstMerge = await mergeInto(
      chainedDuplicate.id,
      chainedDuplicate.revision,
      firstSurvivor.id,
      firstSurvivor.revision,
      "chain-first-merge",
    );
    await expect(
      workLifecycle.resolve(accountId, { workId: chainedDuplicate.id }),
    ).resolves.toMatchObject({
      identity: { survivingWork: { id: firstSurvivor.id } },
      kind: "Retired",
    });

    const secondMerge = await mergeInto(
      firstSurvivor.id,
      firstMerge.work.revision,
      finalSurvivor.id,
      finalSurvivor.revision,
      "chain-second-merge",
    );

    await expect(
      workLifecycle.resolve(accountId, { workId: firstSurvivor.id }),
    ).resolves.toMatchObject({
      identity: { survivingWork: { id: finalSurvivor.id } },
      kind: "Retired",
    });
    await expect(
      workLifecycle.resolve(accountId, { workId: chainedDuplicate.id }),
    ).resolves.toMatchObject({
      identity: { survivingWork: { id: finalSurvivor.id } },
      kind: "Retired",
    });

    await workLifecycle.undoMerge(accountId, {
      baseRevision: secondMerge.work.revision,
      clientIdempotencyKey: "chain-second-undo",
      mergeId: secondMerge.mergeId,
      survivingWorkId: finalSurvivor.id,
    });

    await expect(
      workLifecycle.resolve(accountId, { workId: firstSurvivor.id }),
    ).resolves.toMatchObject({ kind: "Active" });
    await expect(
      workLifecycle.resolve(accountId, { workId: chainedDuplicate.id }),
    ).resolves.toMatchObject({
      identity: { survivingWork: { id: firstSurvivor.id } },
      kind: "Retired",
    });
  });

  test("blocks merge Undo that would leave included Work on a non-Feature survivor", async () => {
    if (!database) {
      throw new Error("ACCOUNT_ACCESS_DATABASE_URL is required");
    }

    const projectShell = createDatabaseProjectShell(database);
    const project = await projectShell.create(accountId, {
      name: "Undo Block Payment App",
      shortCode: "UBLOCK",
      starterConfiguration: "Blank Project",
    });
    const workLifecycle = createDatabaseWorkLifecycle(database);
    const survivor = await workLifecycle.create(accountId, {
      baseRevision: 0,
      clientIdempotencyKey: "undo-block-survivor",
      projectId: project.id,
      title: "Keep this record",
      type: "Task",
    });
    const duplicate = await workLifecycle.create(accountId, {
      baseRevision: 0,
      clientIdempotencyKey: "undo-block-duplicate",
      projectId: project.id,
      title: "Canonical feature",
      type: "Feature",
    });

    const preview = await workLifecycle.previewMerge(accountId, {
      duplicateWorkId: duplicate.id,
      survivingWorkId: survivor.id,
    });
    if (!preview) {
      throw new Error("Expected a Work Merge Preview.");
    }
    const merged = await workLifecycle.merge(accountId, {
      baseRevision: survivor.revision,
      clientIdempotencyKey: "undo-block-merge",
      duplicateRevision: duplicate.revision,
      duplicateWorkId: duplicate.id,
      fieldResolutions: { title: "surviving", type: "duplicate" },
      previewId: preview.previewId,
      survivingWorkId: survivor.id,
    });
    expect(merged.work.type).toBe("Feature");

    const child = await workLifecycle.create(accountId, {
      baseRevision: 0,
      clientIdempotencyKey: "undo-block-child",
      projectId: project.id,
      title: "Included child",
    });
    await workLifecycle.includeWork(accountId, {
      baseRevision: child.revision,
      clientIdempotencyKey: "undo-block-include",
      featureId: merged.work.id,
      workId: child.id,
    });

    let undoError: unknown;
    try {
      await workLifecycle.undoMerge(accountId, {
        baseRevision: merged.work.revision,
        clientIdempotencyKey: "undo-block-undo",
        mergeId: merged.mergeId,
        survivingWorkId: survivor.id,
      });
    } catch (error) {
      undoError = error;
    }
    // The commit path surfaces the apply error unwrapped; staged mutations
    // would wrap it in MutationApplyFailedError instead.
    expect(
      undoError instanceof WorkFeatureExitBlockedError ||
        (undoError as { cause?: unknown }).cause instanceof
          WorkFeatureExitBlockedError,
    ).toBe(true);

    await expect(
      workLifecycle.find(accountId, survivor.id),
    ).resolves.toMatchObject({ type: "Feature" });
    await expect(
      workLifecycle.find(accountId, child.id),
    ).resolves.toMatchObject({ primaryFeatureId: merged.work.id });
    await expect(
      workLifecycle.resolve(accountId, { workId: duplicate.id }),
    ).resolves.toMatchObject({ kind: "Retired" });
  });
});
