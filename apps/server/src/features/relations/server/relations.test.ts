import {
  projectWorkDependencies,
  type RelationEndpointView,
  type RelationRecordType,
  type RelationView,
} from "@cantiara/api/relations";
import { createDb } from "@cantiara/db";
import { user, workspace } from "@cantiara/db/schema/auth";
import {
  mutationHistory,
  mutationReceipt,
  mutationStaging,
} from "@cantiara/db/schema/mutation";
import { usageLink, workRelation } from "@cantiara/db/schema/relation";
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
import { assertAcyclicSupersedes, createDatabaseRelations } from "./relations";

function dependencyEndpoint(
  recordId: string,
  recordType: RelationRecordType = "Work",
): RelationEndpointView {
  return {
    broken: null,
    key: null,
    label: recordId,
    originPosition: null,
    projectId: "project-1",
    recordId,
    recordType,
    status: null,
    title: recordId,
    workType: null,
  };
}

function dependencyRelation(
  id: string,
  blocker: RelationEndpointView,
  blocked: RelationEndpointView,
  blockingStatus: RelationView["blockingStatus"] = "Active",
  kind: RelationView["kind"] = "Blocks",
): RelationView {
  return {
    blockingHistory: [],
    blockingResolutionNote: null,
    blockingResolvedAt: null,
    blockingStatus,
    createdAt: "2026-09-23T00:00:00.000Z",
    direction: "incoming",
    id,
    inverseLabel: "Blocked by",
    kind,
    label: "Blocked by",
    revision: 1,
    source: blocker,
    target: blocked,
  };
}

describe("Work Blockers Dependencies projection", () => {
  test("derives existing Active and Resolved relations in blocker-to-blocked direction", () => {
    const blocker = dependencyEndpoint("work-blocker");
    const blocked = dependencyEndpoint("work-blocked");
    const resolved = dependencyRelation(
      "relation-resolved",
      blocked,
      dependencyEndpoint("work-next"),
      "Resolved",
    );
    const active = dependencyRelation("relation-active", blocker, blocked);
    const relations = [
      active,
      { ...active, direction: "outgoing" as const },
      resolved,
      dependencyRelation(
        "relation-unrelated",
        blocker,
        dependencyEndpoint("work-next"),
        null,
        "Related",
      ),
    ];
    const originalRelations = structuredClone(relations);

    const projection = projectWorkDependencies(relations);

    expect(projection.edges).toMatchObject([
      {
        blocked: { recordId: "work-blocked", recordType: "Work" },
        blocker: { recordId: "work-blocker", recordType: "Work" },
        relationId: "relation-active",
        status: "Active",
      },
      {
        blocked: { recordId: "work-next", recordType: "Work" },
        blocker: { recordId: "work-blocked", recordType: "Work" },
        relationId: "relation-resolved",
        status: "Resolved",
      },
    ]);
    expect(projection.nodes.map(({ recordId }) => recordId)).toEqual([
      "work-blocked",
      "work-blocker",
      "work-next",
    ]);
    expect(projection.cycles).toEqual([]);
    expect(projection).not.toHaveProperty("mermaidSource");
    expect(projection).not.toHaveProperty("manualPositions");
    expect(relations).toEqual(originalRelations);
  });

  test("explains cycles from Active and Resolved relations with their statuses", () => {
    const first = dependencyEndpoint("work-first");
    const second = dependencyEndpoint("work-second");
    const projection = projectWorkDependencies([
      dependencyRelation("relation-first-to-second", first, second),
      dependencyRelation("relation-second-to-first", second, first, "Resolved"),
    ]);
    expect(projection.cycles).toHaveLength(1);
    expect(
      projection.cycles[0]?.records.map(({ recordId }) => recordId),
    ).toEqual(["work-first", "work-second"]);
    expect(
      projection.cycles[0]?.edges.map(({ relationId, status }) => ({
        relationId,
        status,
      })),
    ).toEqual([
      { relationId: "relation-first-to-second", status: "Active" },
      { relationId: "relation-second-to-first", status: "Resolved" },
    ]);
    expect(projection).not.toHaveProperty("signals");
  });
});

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
      target: {
        key: target.key,
        status: target.status,
        title: target.title,
        workType: target.type,
      },
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

  test("creates one Active blocker, retries idempotently, and removes it without resolving", async () => {
    if (!database) {
      throw new Error("ACCOUNT_ACCESS_DATABASE_URL is required");
    }
    const { lifecycle, source, target } = await createWorks();
    const relations = createDatabaseRelations(database);
    const input = {
      kind: "Blocks" as const,
      source: { recordId: source.id, recordType: "Work" as const },
      target: { recordId: target.id, recordType: "Work" as const },
    };
    const sourceStatus = source.status;
    const targetStatus = target.status;
    const preview = await relations.previewCreate(accountId, input);
    const command = {
      baseRevision: preview.baseRevision,
      clientIdempotencyKey: "active-blocker-create",
      kind: preview.kind,
      previewId: preview.previewId,
      source: input.source,
      target: input.target,
    };
    const created = await relations.create(accountId, command);

    expect(preview.blockingStatus).toBe("Active");
    expect(created.relation).toMatchObject({
      blockingHistory: [
        {
          note: null,
          occurredAt: created.relation?.createdAt,
          status: "Active",
        },
      ],
      blockingStatus: "Active",
      direction: "outgoing",
      kind: "Blocks",
      label: "Blocks",
    });
    expect(created.signals).toHaveLength(1);
    expect(created.signals[0]).toMatchObject({
      blockedWork: { recordId: target.id, recordType: "Work" },
      kind: "work-blocked",
      relationId: preview.previewId,
      source: { recordId: source.id, recordType: "Work" },
    });
    expect(created.signals[0]?.eventId).toBe(created.receiptId);
    expect(created.signals[0]?.occurredAt).toBe(created.relation?.createdAt);
    expect(created.relation).toMatchObject({
      blockingResolvedAt: null,
      blockingResolutionNote: null,
    });

    const replayed = await relations.create(accountId, command);
    expect(replayed.receiptId).toBe(created.receiptId);
    expect(replayed.signals).toEqual(created.signals);
    await expect(
      relations.create(accountId, {
        ...command,
        clientIdempotencyKey: "active-blocker-second-submit",
      }),
    ).rejects.toMatchObject({ code: "RELATION_DUPLICATE" });

    await expect(
      relations.list(accountId, { recordId: target.id, recordType: "Work" }),
    ).resolves.toEqual([
      expect.objectContaining({
        blockingStatus: "Active",
        direction: "incoming",
        kind: "Blocks",
        label: "Blocked by",
      }),
    ]);
    await expect(lifecycle.find(accountId, source.id)).resolves.toMatchObject({
      status: sourceStatus,
    });
    await expect(lifecycle.find(accountId, target.id)).resolves.toMatchObject({
      status: targetStatus,
    });

    if (!created.relation) {
      throw new Error("Expected the Active blocker to be returned");
    }
    const removed = await relations.remove(accountId, {
      baseRevision: created.relation.revision,
      clientIdempotencyKey: "active-blocker-remove",
      relationId: created.relation.id,
    });
    expect(removed.signals).toEqual([]);
    await expect(
      relations.list(accountId, { recordId: target.id, recordType: "Work" }),
    ).resolves.toEqual([]);
    await expect(lifecycle.find(accountId, source.id)).resolves.toMatchObject({
      status: sourceStatus,
    });
    await expect(lifecycle.find(accountId, target.id)).resolves.toMatchObject({
      status: targetStatus,
    });

    const restored = await relations.undo(accountId, {
      baseRevision: created.relation.revision + 1,
      clientIdempotencyKey: "active-blocker-undo-remove",
      receiptId: removed.receiptId,
      relationId: created.relation.id,
    });
    expect(restored.relation?.id).toBe(created.relation.id);
    expect(restored.signals).toHaveLength(1);
    expect(restored.signals[0]).toMatchObject({
      blockedWork: { recordId: target.id, recordType: "Work" },
      kind: "work-blocked",
      relationId: created.relation.id,
      source: { recordId: source.id, recordType: "Work" },
    });
  }, 30_000);

  test("resolves and reactivates the same blocker with history and signal events", async () => {
    if (!database) {
      throw new Error("ACCOUNT_ACCESS_DATABASE_URL is required");
    }
    const { lifecycle, source, target } = await createWorks();
    const relations = createDatabaseRelations(database);
    const input = {
      kind: "Blocks" as const,
      source: { recordId: source.id, recordType: "Work" as const },
      target: { recordId: target.id, recordType: "Work" as const },
    };
    const preview = await relations.previewCreate(accountId, input);
    const created = await relations.create(accountId, {
      baseRevision: preview.baseRevision,
      clientIdempotencyKey: "blocker-life-create",
      kind: preview.kind,
      previewId: preview.previewId,
      source: input.source,
      target: input.target,
    });
    if (!created.relation) {
      throw new Error("Expected an Active blocker");
    }

    const resolved = await relations.resolveBlocker(accountId, {
      baseRevision: created.relation.revision,
      clientIdempotencyKey: "blocker-life-resolve",
      note: "Provider access is available",
      relationId: created.relation.id,
    });
    expect(resolved.relation).toMatchObject({
      blockingResolutionNote: "Provider access is available",
      blockingStatus: "Resolved",
      id: created.relation.id,
    });
    expect(resolved.relation?.blockingResolvedAt).toEqual(expect.any(String));
    expect(resolved.signals).toEqual([]);
    expect(resolved.relation?.blockingHistory).toMatchObject([
      {
        note: null,
        occurredAt: created.relation.createdAt,
        status: "Active",
      },
      {
        note: "Provider access is available",
        occurredAt: resolved.relation?.blockingResolvedAt,
        status: "Resolved",
      },
    ]);

    const resolvedReplay = await relations.resolveBlocker(accountId, {
      baseRevision: created.relation.revision,
      clientIdempotencyKey: "blocker-life-resolve",
      note: "Provider access is available",
      relationId: created.relation.id,
    });
    expect(resolvedReplay.receiptId).toBe(resolved.receiptId);
    expect(resolvedReplay.signals).toEqual([]);
    expect(resolvedReplay.relation?.blockingResolvedAt).toBe(
      resolved.relation?.blockingResolvedAt,
    );

    const reactivated = await relations.reactivateBlocker(accountId, {
      baseRevision: resolved.relation?.revision ?? 0,
      clientIdempotencyKey: "blocker-life-reactivate",
      relationId: created.relation.id,
    });
    expect(reactivated.relation).toMatchObject({
      blockingResolutionNote: null,
      blockingResolvedAt: null,
      blockingStatus: "Active",
      id: created.relation.id,
    });
    expect(reactivated.signals).toHaveLength(1);
    expect(reactivated.signals[0]).toMatchObject({
      blockedWork: { recordId: target.id, recordType: "Work" },
      kind: "work-blocked",
      relationId: created.relation.id,
      source: { recordId: source.id, recordType: "Work" },
    });
    expect(reactivated.signals[0]?.eventId).toBe(reactivated.receiptId);
    expect(reactivated.signals[0]?.occurredAt).toBe(
      reactivated.relation?.blockingHistory.at(-1)?.occurredAt,
    );
    expect(reactivated.signals[0]?.eventId).not.toBe(
      created.signals[0]?.eventId,
    );
    expect(
      reactivated.relation?.blockingHistory.map(({ status }) => status),
    ).toEqual(["Active", "Resolved", "Active"]);
    expect(reactivated.relation?.blockingHistory[1]).toMatchObject({
      note: "Provider access is available",
      status: "Resolved",
    });

    const resolvedAgain = await relations.resolveBlocker(accountId, {
      baseRevision: reactivated.relation?.revision ?? 0,
      clientIdempotencyKey: "blocker-life-resolve-again",
      note: "Provider access regressed",
      relationId: created.relation.id,
    });
    expect(resolvedAgain.signals).toEqual([]);
    expect(
      resolvedAgain.relation?.blockingHistory.map(({ status }) => status),
    ).toEqual(["Active", "Resolved", "Active", "Resolved"]);
    expect(resolvedAgain.relation?.blockingHistory[1]?.note).toBe(
      "Provider access is available",
    );
    expect(resolvedAgain.relation?.blockingHistory[3]).toMatchObject({
      note: "Provider access regressed",
      status: "Resolved",
    });

    const undoneResolution = await relations.undo(accountId, {
      baseRevision: resolvedAgain.relation?.revision ?? 0,
      clientIdempotencyKey: "blocker-life-undo-resolve-again",
      receiptId: resolvedAgain.receiptId,
      relationId: created.relation.id,
    });
    expect(undoneResolution.signals).toHaveLength(1);
    expect(undoneResolution.signals[0]?.occurredAt).toBe(
      undoneResolution.relation?.blockingHistory.at(-1)?.occurredAt,
    );
    expect(
      undoneResolution.relation?.blockingHistory.map(({ status }) => status),
    ).toEqual(["Active", "Resolved", "Active", "Resolved", "Active"]);
    expect(undoneResolution.relation?.blockingHistory[4]).toMatchObject({
      isUndo: true,
      resolutionAt: null,
      status: "Active",
    });
    expect(undoneResolution.relation?.blockingHistory[1]?.note).toBe(
      "Provider access is available",
    );
    expect(undoneResolution.relation?.blockingHistory[3]?.note).toBe(
      "Provider access regressed",
    );

    const resolutionForUndo = await relations.resolveBlocker(accountId, {
      baseRevision: undoneResolution.relation?.revision ?? 0,
      clientIdempotencyKey: "blocker-life-resolve-before-undo-reactivate",
      note: "Provider access is verified",
      relationId: created.relation.id,
    });
    const reactivationForUndo = await relations.reactivateBlocker(accountId, {
      baseRevision: resolutionForUndo.relation?.revision ?? 0,
      clientIdempotencyKey: "blocker-life-reactivate-before-undo",
      relationId: created.relation.id,
    });
    const undoneReactivation = await relations.undo(accountId, {
      baseRevision: reactivationForUndo.relation?.revision ?? 0,
      clientIdempotencyKey: "blocker-life-undo-reactivate",
      receiptId: reactivationForUndo.receiptId,
      relationId: created.relation.id,
    });
    expect(undoneReactivation.signals).toEqual([]);
    expect(undoneReactivation.relation).toMatchObject({
      blockingResolutionNote: "Provider access is verified",
      blockingResolvedAt: resolutionForUndo.relation?.blockingResolvedAt,
      blockingStatus: "Resolved",
    });
    expect(undoneReactivation.relation?.blockingHistory.at(-1)).toMatchObject({
      isUndo: true,
      note: "Provider access is verified",
      resolutionAt: resolutionForUndo.relation?.blockingResolvedAt,
      status: "Resolved",
    });
    expect(
      undoneReactivation.relation?.blockingHistory.at(-1)?.occurredAt,
    ).not.toBe(resolutionForUndo.relation?.blockingResolvedAt);
    await expect(lifecycle.find(accountId, source.id)).resolves.toMatchObject({
      status: source.status,
    });
    await expect(lifecycle.find(accountId, target.id)).resolves.toMatchObject({
      status: target.status,
    });
  }, 30_000);

  test("keeps an Active blocker when its source Work is closed", async () => {
    if (!database) {
      throw new Error("ACCOUNT_ACCESS_DATABASE_URL is required");
    }
    const { lifecycle, source, target } = await createWorks();
    const relations = createDatabaseRelations(database);
    const input = {
      kind: "Blocks" as const,
      source: { recordId: source.id, recordType: "Work" as const },
      target: { recordId: target.id, recordType: "Work" as const },
    };
    const preview = await relations.previewCreate(accountId, input);
    await relations.create(accountId, {
      baseRevision: preview.baseRevision,
      clientIdempotencyKey: "blocker-close-source-create",
      kind: preview.kind,
      previewId: preview.previewId,
      source: input.source,
      target: input.target,
    });

    await expect(
      lifecycle.close(
        accountId,
        {
          baseRevision: source.revision,
          clientIdempotencyKey: "blocker-close-source",
          closureResult: "Completed",
          workId: source.id,
        },
        { kind: "Visible user" },
      ),
    ).resolves.toMatchObject({ status: "Closed" });

    await expect(
      relations.list(accountId, { recordId: target.id, recordType: "Work" }),
    ).resolves.toEqual([
      expect.objectContaining({
        blockingStatus: "Active",
        kind: "Blocks",
        source: expect.objectContaining({
          recordId: source.id,
          status: "Closed",
        }),
        target: expect.objectContaining({ recordId: target.id }),
      }),
    ]);
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

  test("confirms previews statelessly across store instances", async () => {
    if (!database) {
      throw new Error("ACCOUNT_ACCESS_DATABASE_URL is required");
    }
    const { source, target } = await createWorks();
    const input = {
      kind: "Related" as const,
      source: { recordId: source.id, recordType: "Work" as const },
      target: { recordId: target.id, recordType: "Work" as const },
    };
    const preview = await createDatabaseRelations(database).previewCreate(
      accountId,
      input,
    );
    // A fresh store instance, as after a server restart, accepts the same
    // deterministic preview id without any process-local state.
    const created = await createDatabaseRelations(database).create(accountId, {
      baseRevision: preview.baseRevision,
      clientIdempotencyKey: "stateless-preview",
      kind: preview.kind,
      previewId: preview.previewId,
      source: input.source,
      target: input.target,
    });
    expect(created.relation).toMatchObject({ kind: "Related" });
  }, 30_000);

  test("resurrects the same relation row and refuses stale removal undo", async () => {
    if (!database) {
      throw new Error("ACCOUNT_ACCESS_DATABASE_URL is required");
    }
    const { source, target } = await createWorks();
    const relations = createDatabaseRelations(database);
    const input = {
      kind: "Related" as const,
      source: { recordId: source.id, recordType: "Work" as const },
      target: { recordId: target.id, recordType: "Work" as const },
    };
    const preview = await relations.previewCreate(accountId, input);
    const created = await relations.create(accountId, {
      baseRevision: preview.baseRevision,
      clientIdempotencyKey: "recreate-first",
      kind: preview.kind,
      previewId: preview.previewId,
      source: input.source,
      target: input.target,
    });
    if (!created.relation) {
      throw new Error("Expected a created relation");
    }
    const removed = await relations.remove(accountId, {
      baseRevision: created.relation.revision,
      clientIdempotencyKey: "recreate-remove",
      relationId: created.relation.id,
    });

    const rePreview = await relations.previewCreate(accountId, input);
    expect(rePreview.previewId).toBe(preview.previewId);
    expect(rePreview.baseRevision).toBe(created.relation.revision + 1);
    await relations.create(accountId, {
      baseRevision: rePreview.baseRevision,
      clientIdempotencyKey: "recreate-second",
      kind: rePreview.kind,
      previewId: rePreview.previewId,
      source: input.source,
      target: input.target,
    });

    await expect(
      relations.undo(accountId, {
        baseRevision: rePreview.baseRevision + 1,
        clientIdempotencyKey: "recreate-undo",
        receiptId: removed.receiptId,
        relationId: created.relation.id,
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
  }, 30_000);

  test("enforces at-most-one live relations with partial unique indexes", async () => {
    if (!database) {
      throw new Error("ACCOUNT_ACCESS_DATABASE_URL is required");
    }
    const { project, source, target } = await createWorks();
    const primarySpec = {
      kind: "Primary spec",
      sourceRecordType: "Work",
      sourceWorkId: source.id,
      targetLabel: "SPEC",
      targetProjectId: project.id,
      targetRecordId: target.id,
      targetRecordType: "Document version",
    };
    await database
      .insert(workRelation)
      .values({ id: "primary-spec-live", ...primarySpec });
    await expect(
      database
        .insert(workRelation)
        .values({ id: "primary-spec-conflict", ...primarySpec }),
    ).rejects.toThrow();
    await database
      .update(workRelation)
      .set({ deletedAt: new Date() })
      .where(eq(workRelation.id, "primary-spec-live"));
    await expect(
      database
        .insert(workRelation)
        .values({ id: "primary-spec-again", ...primarySpec }),
    ).resolves.toBeDefined();
  }, 30_000);

  test("rejects Supersedes cycles before they are written", async () => {
    if (!database) {
      throw new Error("ACCOUNT_ACCESS_DATABASE_URL is required");
    }
    const { project } = await createWorks();
    const lifecycle = createDatabaseWorkLifecycle(database);
    const supersededTitles = ["Alpha", "Beta", "Gamma", "Delta"];
    const records: Array<{ id: string; key: string }> = [];
    for (const title of supersededTitles) {
      // biome-ignore lint/performance/noAwaitInLoops: Work creation must remain sequential because each mutation uses the current revision.
      const record = await lifecycle.create(accountId, {
        baseRevision: 0,
        clientIdempotencyKey: `supersede-${title}`,
        projectId: project.id,
        title,
        type: "Task",
      });
      records.push({ id: record.id, key: record.key });
    }
    const [recordA, recordB, recordC, recordD] = records;
    if (!(recordA && recordB && recordC && recordD)) {
      throw new Error("Expected four Work records for the supersede chain");
    }
    await database.insert(workRelation).values([
      {
        id: "supersede-a-b",
        kind: "Supersedes",
        sourceRecordType: "Decision",
        sourceWorkId: recordA.id,
        targetLabel: recordB.key,
        targetProjectId: project.id,
        targetRecordId: recordB.id,
        targetRecordType: "Decision",
      },
      {
        id: "supersede-b-c",
        kind: "Supersedes",
        sourceRecordType: "Decision",
        sourceWorkId: recordB.id,
        targetLabel: recordC.key,
        targetProjectId: project.id,
        targetRecordId: recordC.id,
        targetRecordType: "Decision",
      },
    ]);

    await expect(
      assertAcyclicSupersedes(database, {
        kind: "Supersedes",
        sourceId: recordC.id,
        sourceType: "Decision",
        targetId: recordA.id,
        targetType: "Decision",
      }),
    ).rejects.toMatchObject({ code: "RELATION_CYCLE" });
    await expect(
      assertAcyclicSupersedes(database, {
        kind: "Supersedes",
        sourceId: recordC.id,
        sourceType: "Decision",
        targetId: recordD.id,
        targetType: "Decision",
      }),
    ).resolves.toBeUndefined();
  }, 30_000);

  test("tracks usage links separately from relation backlinks", async () => {
    if (!database) {
      throw new Error("ACCOUNT_ACCESS_DATABASE_URL is required");
    }
    const { source, target } = await createWorks();
    const relations = createDatabaseRelations(database);
    const usageInput = {
      kind: "Live block" as const,
      source: { recordId: source.id, recordType: "Work" as const },
      surface: {
        context: "block-1",
        recordId: target.id,
        recordType: "Work" as const,
      },
    };
    const usage = await relations.createUsageLink(accountId, usageInput);
    expect(usage.kind).toBe("Live block");
    expect(usage.source).toEqual({
      recordId: source.id,
      recordType: "Work",
    });
    expect(usage.surface).toMatchObject({
      broken: null,
      key: target.key,
      title: target.title,
    });

    // Usage links never enter the typed-relation graph and never count as
    // backlinks.
    await expect(
      relations.list(accountId, { recordId: source.id, recordType: "Work" }),
    ).resolves.toEqual([]);
    await expect(
      relations.listUsageLinks(accountId, {
        recordId: source.id,
        recordType: "Work",
      }),
    ).resolves.toHaveLength(1);

    await expect(
      relations.createUsageLink(accountId, usageInput),
    ).rejects.toMatchObject({ code: "RELATION_DUPLICATE" });

    await relations.removeUsageLink(accountId, {
      usageLinkId: usage.id,
    });
    await expect(
      relations.listUsageLinks(accountId, {
        recordId: source.id,
        recordType: "Work",
      }),
    ).resolves.toEqual([]);
    // Unlink keeps the source record.
    await expect(
      createDatabaseWorkLifecycle(database).find(accountId, source.id),
    ).resolves.toMatchObject({ id: source.id });
  }, 30_000);

  test("derives Used in as separate relation backlinks and usage links without access leaks", async () => {
    if (!database) {
      throw new Error("ACCOUNT_ACCESS_DATABASE_URL is required");
    }
    const { project, source, target } = await createWorks();
    const relations = createDatabaseRelations(database);
    const sourceProject = await createDatabaseProjectShell(database).create(
      accountId,
      {
        name: "Relation Source Project",
        shortCode: "SRC",
        starterConfiguration: "Blank Project",
      },
    );
    const crossProjectSource = await createDatabaseWorkLifecycle(
      database,
    ).create(accountId, {
      baseRevision: 0,
      clientIdempotencyKey: "used-in-cross-project-source",
      projectId: sourceProject.id,
      title: "Cross-project Source Work",
      type: "Task",
    });
    const relationPreview = await relations.previewCreate(accountId, {
      kind: "Related",
      source: { recordId: crossProjectSource.id, recordType: "Work" },
      target: { recordId: target.id, recordType: "Work" },
    });
    await relations.create(accountId, {
      baseRevision: relationPreview.baseRevision,
      clientIdempotencyKey: "used-in-relation",
      kind: relationPreview.kind,
      previewId: relationPreview.previewId,
      source: {
        recordId: relationPreview.source.recordId,
        recordType: relationPreview.source.recordType,
      },
      target: {
        recordId: relationPreview.target.recordId,
        recordType: relationPreview.target.recordType,
      },
    });
    const usage = await relations.createUsageLink(accountId, {
      kind: "Live block",
      source: { recordId: target.id, recordType: "Work" },
      surface: {
        context: "target-used-in-source",
        recordId: crossProjectSource.id,
        recordType: "Work",
      },
    });
    const relationsBeforeUsedIn = await relations.list(accountId, {
      recordId: target.id,
      recordType: "Work",
    });
    const usageLinksBeforeUsedIn = await relations.listUsageLinks(accountId, {
      recordId: target.id,
      recordType: "Work",
    });

    await expect(
      relations.listUsedIn(accountId, {
        recordId: target.id,
        recordType: "Work",
      }),
    ).resolves.toEqual({
      relationBacklinks: [
        expect.objectContaining({
          direction: "incoming",
          kind: "Related",
          source: expect.objectContaining({
            projectId: sourceProject.id,
            recordId: crossProjectSource.id,
            recordType: "Work",
            title: crossProjectSource.title,
          }),
        }),
      ],
      usageLinks: [
        expect.objectContaining({
          id: usage.id,
          kind: "Live block",
          surface: expect.objectContaining({
            projectId: sourceProject.id,
            recordId: crossProjectSource.id,
            recordType: "Work",
            title: crossProjectSource.title,
          }),
        }),
      ],
    });
    await expect(
      relations.list(accountId, {
        recordId: target.id,
        recordType: "Work",
      }),
    ).resolves.toEqual(relationsBeforeUsedIn);
    await expect(
      relations.listUsageLinks(accountId, {
        recordId: target.id,
        recordType: "Work",
      }),
    ).resolves.toEqual(usageLinksBeforeUsedIn);

    const otherAccountId = `used-in-other-${crypto.randomUUID()}`;
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
        clientIdempotencyKey: "used-in-other-work",
        projectId: otherProject.id,
        title: "Private Used In",
        type: "Task",
      },
    );
    await database.insert(workRelation).values({
      id: `used-in-inaccessible-relation-${crypto.randomUUID()}`,
      kind: "Related",
      sourceWorkId: source.id,
      targetLabel: "Private Used In must not leak",
      targetProjectId: otherProject.id,
      targetRecordId: otherWork.id,
    });
    await database.insert(workRelation).values({
      id: `used-in-inaccessible-source-relation-${crypto.randomUUID()}`,
      kind: "Related",
      sourceWorkId: otherWork.id,
      targetLabel: "Private source must not leak",
      targetProjectId: project.id,
      targetRecordId: target.id,
      targetRecordType: "Work",
    });
    await database.insert(usageLink).values({
      id: `used-in-inaccessible-usage-${crypto.randomUUID()}`,
      kind: "Live block",
      location: { context: "private-surface" },
      revision: 1,
      sourceRecordId: target.id,
      sourceRecordType: "Work",
      surfaceRecordId: otherWork.id,
      surfaceRecordType: "Work",
      workspaceId,
    });

    await expect(
      relations.listUsedIn(accountId, {
        recordId: otherWork.id,
        recordType: "Work",
      }),
    ).resolves.toEqual({ relationBacklinks: [], usageLinks: [] });
    await expect(
      relations.listUsedIn(accountId, {
        recordId: target.id,
        recordType: "Work",
      }),
    ).resolves.toEqual({
      relationBacklinks: [expect.objectContaining({ kind: "Related" })],
      usageLinks: [expect.objectContaining({ id: usage.id })],
    });

    await database.delete(user).where(eq(user.id, otherAccountId));
  }, 30_000);

  test("exposes the immutable Origin position on the target", async () => {
    if (!database) {
      throw new Error("ACCOUNT_ACCESS_DATABASE_URL is required");
    }
    const { source, target } = await createWorks();
    await database
      .update(work)
      .set({
        originComponentId: "checklist-item-1",
        originOwnerRecordId: source.id,
        originSourceVersion: "v3",
      })
      .where(eq(work.id, target.id));
    const relations = createDatabaseRelations(database);
    const preview = await relations.previewCreate(accountId, {
      kind: "Origin",
      source: { recordId: source.id, recordType: "Work" },
      target: { recordId: target.id, recordType: "Work" },
    });
    await relations.create(accountId, {
      baseRevision: preview.baseRevision,
      clientIdempotencyKey: "origin-position",
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
    const [view] = await relations.list(accountId, {
      recordId: target.id,
      recordType: "Work",
    });
    expect(view?.target?.originPosition).toEqual({
      componentId: "checklist-item-1",
      ownerRecordId: source.id,
      sourceVersion: "v3",
    });
    expect(view?.source?.originPosition).toBeNull();
  }, 30_000);

  test("presents unsupported record types as fail-closed tombstones", async () => {
    if (!database) {
      throw new Error("ACCOUNT_ACCESS_DATABASE_URL is required");
    }
    const { project, source } = await createWorks();
    await database.insert(workRelation).values({
      id: "unsupported-target",
      kind: "Related",
      sourceWorkId: source.id,
      targetLabel: "Document target",
      targetProjectId: project.id,
      targetRecordId: "document-1",
      targetRecordType: "Document",
    });
    const relations = createDatabaseRelations(database);
    const [view] = await relations.list(accountId, {
      recordId: source.id,
      recordType: "Work",
    });
    expect(view?.target).toMatchObject({
      broken: { canOpenSourceRecord: false, reason: "No access" },
      key: null,
      originPosition: null,
      title: null,
    });
  }, 30_000);
});
