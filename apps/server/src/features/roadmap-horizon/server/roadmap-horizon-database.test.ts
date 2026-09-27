import { createDb } from "@cantiara/db";
import { user, workspace } from "@cantiara/db/schema/auth";
import { projectBacklogOrder } from "@cantiara/db/schema/backlog";
import { mutationHistory, mutationReceipt } from "@cantiara/db/schema/mutation";
import { project } from "@cantiara/db/schema/project";
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
import { createDatabaseBacklog } from "../../backlog/server/backlog-database";
import {
  MutationConflictError,
  MutationStaleBaseRevisionError,
  MutationTargetNotFoundError,
} from "../../mutation-and-undo/server/mutation-contract";
import { createDatabaseProjectShell } from "../../project-shell/server/project-shell-database";
import { createDatabaseWorkLifecycle } from "../../work-lifecycle/server/work-lifecycle-database";
import { createDatabaseRoadmapHorizon } from "./roadmap-horizon-database";

const databaseUrl = process.env.ACCOUNT_ACCESS_DATABASE_URL;
const describeDatabase = databaseUrl ? describe : describe.skip;

describeDatabase("Roadmap Horizon PostgreSQL contract", () => {
  const database = databaseUrl
    ? createDb({ DATABASE_URL: databaseUrl })
    : undefined;
  const accountId = `roadmap-${crypto.randomUUID()}`;
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
    await database
      .insert(workspace)
      .values({ id: workspaceId, ownerAccountId: accountId });
  });
  afterEach(async () => {
    await database
      ?.delete(mutationHistory)
      .where(eq(mutationHistory.actorId, accountId));
    await database
      ?.delete(mutationReceipt)
      .where(eq(mutationReceipt.actorId, accountId));
    await database?.delete(user).where(eq(user.id, accountId));
  });
  afterAll(async () => {
    await database?.$client.end();
  });

  test("placing Work on Now preserves status, dates, and Backlog manual order", async () => {
    if (!database) {
      throw new Error("ACCOUNT_ACCESS_DATABASE_URL is required");
    }
    const profile = await createDatabaseProjectShell(database).create(
      accountId,
      {
        name: "Roadmap Project",
        shortCode: "RMP",
        starterConfiguration: "Blank Project",
      },
    );
    const ids = [`work-${crypto.randomUUID()}`, `work-${crypto.randomUUID()}`];
    await database.insert(work).values(
      ids.map((id, index) => ({
        id,
        key: `RMP-${index + 1}`,
        number: index + 1,
        projectId: profile.id,
        status: index === 0 ? "Blocked" : "Not Started",
        targetDate: index === 0 ? "2026-11-01" : null,
        title: `Work ${index + 1}`,
        type: "Research",
      })),
    );
    await database.insert(projectBacklogOrder).values({
      projectId: profile.id,
      revision: 1,
      workIds: [ids[1] ?? "", ids[0] ?? ""],
    });
    const lifecycle = createDatabaseWorkLifecycle(database);
    const backlog = createDatabaseBacklog(database);
    const before = await lifecycle.find(accountId, ids[0] ?? "");
    if (!before) {
      throw new Error("Expected Work");
    }
    const saved = await lifecycle.updateRoadmapHorizon(accountId, {
      baseRevision: before.revision,
      clientIdempotencyKey: crypto.randomUUID(),
      horizon: "Now",
      workId: before.id,
    });
    expect(saved.roadmapHorizon).toBe("Now");
    expect(saved.status).toBe("Blocked");
    expect(saved.statusChangedAt).toBe(before.statusChangedAt);
    expect(saved.plannedStartDate).toBeNull();
    expect(saved.targetDate).toBe("2026-11-01");
    expect((await backlog.list(workspaceId, profile.id))?.workIds).toEqual([
      ids[1],
      ids[0],
    ]);
    const described = await lifecycle.updateResearchDirection(accountId, {
      baseRevision: saved.revision,
      clientIdempotencyKey: crypto.randomUUID(),
      expectedOutcome: "Founders can explain the plan.",
      problemOpportunity: "Planning loses its context.",
      workId: saved.id,
    });
    expect(described.problemOpportunity).toBe("Planning loses its context.");
    expect(described.expectedOutcome).toBe("Founders can explain the plan.");
    expect(described.status).toBe("Blocked");
    expect((await backlog.list(workspaceId, profile.id))?.workIds).toEqual([
      ids[1],
      ids[0],
    ]);
  });

  test("planned-date placement updates one date field and leaves status and horizon alone", async () => {
    if (!database) {
      throw new Error("ACCOUNT_ACCESS_DATABASE_URL is required");
    }
    const profile = await createDatabaseProjectShell(database).create(
      accountId,
      {
        name: "Planned Date Project",
        shortCode: "PDT",
        starterConfiguration: "Blank Project",
      },
    );
    const workId = `work-${crypto.randomUUID()}`;
    await database.insert(work).values({
      id: workId,
      key: "PDT-1",
      number: 1,
      projectId: profile.id,
      status: "Blocked",
      title: "Candidate",
      type: "Task",
    });
    const lifecycle = createDatabaseWorkLifecycle(database);
    const before = await lifecycle.find(accountId, workId);
    if (!before) {
      throw new Error("Expected Work");
    }

    const saved = await lifecycle.updatePlannedDate(accountId, {
      baseRevision: before.revision,
      clientIdempotencyKey: crypto.randomUUID(),
      field: "targetDate",
      value: "2026-10-02",
      workId,
    });

    expect(saved.targetDate).toBe("2026-10-02");
    expect(saved.plannedStartDate).toBeNull();
    expect(saved.roadmapHorizon).toBeNull();
    expect(saved.status).toBe("Blocked");
    expect(saved.statusChangedAt).toBe(before.statusChangedAt);
  });

  test("active blocker projection returns only exact sources for visible Roadmap Work", async () => {
    if (!database) {
      throw new Error("ACCOUNT_ACCESS_DATABASE_URL is required");
    }
    const profile = await createDatabaseProjectShell(database).create(
      accountId,
      {
        name: "Roadmap Project",
        shortCode: "RMP",
        starterConfiguration: "Blank Project",
      },
    );
    const externalProject = await createDatabaseProjectShell(database).create(
      accountId,
      {
        name: "Dependency Project",
        shortCode: "DEP",
        starterConfiguration: "Blank Project",
      },
    );
    const ids = {
      blocked: `work-${crypto.randomUUID()}`,
      blocker: `work-${crypto.randomUUID()}`,
      externalBlocker: `work-${crypto.randomUUID()}`,
      otherTarget: `work-${crypto.randomUUID()}`,
      resolvedBlocker: `work-${crypto.randomUUID()}`,
    };
    await database.insert(work).values([
      {
        id: ids.blocked,
        key: "RMP-1",
        number: 1,
        projectId: profile.id,
        title: "Blocked Work",
        type: "Task",
      },
      {
        id: ids.blocker,
        key: "RMP-2",
        number: 2,
        projectId: profile.id,
        title: "Local source",
        type: "Task",
      },
      {
        id: ids.resolvedBlocker,
        key: "RMP-3",
        number: 3,
        projectId: profile.id,
        title: "Resolved source",
        type: "Task",
      },
      {
        id: ids.otherTarget,
        key: "DEP-1",
        number: 1,
        projectId: externalProject.id,
        title: "Other target",
        type: "Task",
      },
      {
        id: ids.externalBlocker,
        key: "DEP-2",
        number: 2,
        projectId: externalProject.id,
        title: "Cross-project source",
        type: "Task",
      },
    ]);
    await database.insert(workRelation).values([
      {
        id: `relation-${crypto.randomUUID()}`,
        blockingStatus: "Active",
        kind: "Blocks",
        sourceWorkId: ids.blocker,
        targetLabel: "Blocked Work",
        targetProjectId: profile.id,
        targetRecordId: ids.blocked,
        targetRecordType: "Work",
      },
      {
        id: `relation-${crypto.randomUUID()}`,
        blockingStatus: "Active",
        kind: "Blocks",
        sourceWorkId: ids.externalBlocker,
        targetLabel: "Blocked Work",
        targetProjectId: profile.id,
        targetRecordId: ids.blocked,
        targetRecordType: "Work",
      },
      {
        id: `relation-${crypto.randomUUID()}`,
        blockingStatus: "Resolved",
        kind: "Blocks",
        sourceWorkId: ids.resolvedBlocker,
        targetLabel: "Blocked Work",
        targetProjectId: profile.id,
        targetRecordId: ids.blocked,
        targetRecordType: "Work",
      },
      {
        id: `relation-${crypto.randomUUID()}`,
        blockingStatus: "Active",
        kind: "Blocks",
        sourceWorkId: ids.blocker,
        targetLabel: "Other target",
        targetProjectId: externalProject.id,
        targetRecordId: ids.otherTarget,
        targetRecordType: "Work",
      },
    ]);

    const blockers = await createDatabaseRoadmapHorizon(
      database,
    ).listActiveBlockers(accountId, profile.id);

    expect(blockers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          blockedWorkId: ids.blocked,
          blocker: expect.objectContaining({
            id: ids.blocker,
            key: "RMP-2",
            projectId: profile.id,
            title: "Local source",
          }),
        }),
        expect.objectContaining({
          blockedWorkId: ids.blocked,
          blocker: expect.objectContaining({
            id: ids.externalBlocker,
            key: "DEP-2",
            projectId: externalProject.id,
            title: "Cross-project source",
          }),
        }),
      ]),
    );
    expect(blockers).toHaveLength(2);
    for (const blocker of blockers ?? []) {
      expect(Object.keys(blocker.blocker).sort()).toEqual(
        [
          "archivedAt",
          "id",
          "key",
          "projectId",
          "status",
          "title",
          "type",
        ].sort(),
      );
    }
    expect(
      await createDatabaseRoadmapHorizon(database).listActiveBlockers(
        "another-account",
        profile.id,
      ),
    ).toBeNull();
  });

  test("saved view filters remain metadata and cannot create Work membership", async () => {
    if (!database) {
      throw new Error("ACCOUNT_ACCESS_DATABASE_URL is required");
    }
    const profile = await createDatabaseProjectShell(database).create(
      accountId,
      {
        name: "Views Project",
        shortCode: "VWS",
        starterConfiguration: "Blank Project",
      },
    );
    const roadmap = createDatabaseRoadmapHorizon(database);
    const input = {
      baseRevision: 0,
      clientIdempotencyKey: crypto.randomUUID(),
      groupBy: "Horizon",
      horizons: ["Next"],
      id: `view-${crypto.randomUUID()}`,
      markBy: "Type",
      name: "Research direction",
      projectId: profile.id,
      types: ["Research"],
    } satisfies Parameters<typeof roadmap.saveView>[1];
    const saved = await roadmap.saveView(accountId, input);
    expect(saved?.name).toBe("Research direction");
    expect(saved?.revision).toBe(1);
    expect(await roadmap.saveView(accountId, input)).toEqual(saved);
    await expect(
      roadmap.saveView(accountId, {
        ...input,
        name: "Different payload",
      }),
    ).rejects.toBeInstanceOf(MutationConflictError);
    expect(await roadmap.listViews(accountId, profile.id)).toEqual([saved]);
    expect(await roadmap.listViews("another-account", profile.id)).toBeNull();

    await expect(
      roadmap.saveView(accountId, {
        ...input,
        baseRevision: 0,
        clientIdempotencyKey: crypto.randomUUID(),
        name: "Stale edit",
      }),
    ).rejects.toBeInstanceOf(MutationStaleBaseRevisionError);

    const updateKey = crypto.randomUUID();
    const updated = await roadmap.saveView(accountId, {
      ...input,
      baseRevision: saved?.revision ?? 0,
      clientIdempotencyKey: updateKey,
      name: "Updated research direction",
    });
    expect(updated).toMatchObject({
      name: "Updated research direction",
      revision: 2,
    });
    const [updateReceipt] = await database
      .select()
      .from(mutationReceipt)
      .where(eq(mutationReceipt.clientIdempotencyKey, updateKey));
    expect(updateReceipt?.undo).toMatchObject({
      kind: "view-metadata",
      scope: "view",
    });

    await database
      .update(project)
      .set({ archivedAt: new Date() })
      .where(eq(project.id, profile.id));
    await expect(
      roadmap.saveView(accountId, {
        ...input,
        baseRevision: updated?.revision ?? 0,
        clientIdempotencyKey: crypto.randomUUID(),
      }),
    ).resolves.toBeNull();
  });

  test("archived Projects reject horizon and Research direction writes", async () => {
    if (!database) {
      throw new Error("ACCOUNT_ACCESS_DATABASE_URL is required");
    }
    const profile = await createDatabaseProjectShell(database).create(
      accountId,
      {
        name: "Archived Roadmap Project",
        shortCode: "ARP",
        starterConfiguration: "Blank Project",
      },
    );
    const workId = `research-${crypto.randomUUID()}`;
    await database.insert(work).values({
      id: workId,
      key: "ARP-1",
      number: 1,
      projectId: profile.id,
      title: "Archived opportunity",
      type: "Research",
    });
    const lifecycle = createDatabaseWorkLifecycle(database);
    const before = await lifecycle.find(accountId, workId);
    if (!before) {
      throw new Error("Expected Research Work");
    }

    await database
      .update(project)
      .set({ archivedAt: new Date() })
      .where(eq(project.id, profile.id));

    await expect(
      lifecycle.updateRoadmapHorizon(accountId, {
        baseRevision: before.revision,
        clientIdempotencyKey: crypto.randomUUID(),
        horizon: "Now",
        workId,
      }),
    ).rejects.toBeInstanceOf(MutationTargetNotFoundError);
    await expect(
      lifecycle.updateResearchDirection(accountId, {
        baseRevision: before.revision,
        clientIdempotencyKey: crypto.randomUUID(),
        expectedOutcome: "A result",
        problemOpportunity: "An opportunity",
        workId,
      }),
    ).rejects.toBeInstanceOf(MutationTargetNotFoundError);
  });

  test("default direction reads the canonical Origin relation", async () => {
    if (!database) {
      throw new Error("ACCOUNT_ACCESS_DATABASE_URL is required");
    }
    const profile = await createDatabaseProjectShell(database).create(
      accountId,
      {
        name: "Origin Project",
        shortCode: "ORG",
        starterConfiguration: "Blank Project",
      },
    );
    const researchId = `research-${crypto.randomUUID()}`;
    const featureId = `feature-${crypto.randomUUID()}`;
    await database.insert(work).values([
      {
        id: researchId,
        key: "ORG-1",
        number: 1,
        projectId: profile.id,
        title: "Opportunity",
        type: "Research",
      },
      {
        id: featureId,
        key: "ORG-2",
        number: 2,
        projectId: profile.id,
        title: "Solution",
        type: "Feature",
      },
    ]);
    await database.insert(workRelation).values({
      id: `origin-${crypto.randomUUID()}`,
      kind: "Origin",
      sourceWorkId: researchId,
      targetLabel: "Solution",
      targetProjectId: profile.id,
      targetRecordId: featureId,
    });
    const roadmap = createDatabaseRoadmapHorizon(database);
    expect(await roadmap.listOrigins(accountId, profile.id)).toEqual([
      { sourceResearchId: researchId, targetFeatureId: featureId },
    ]);
    expect(await roadmap.listOrigins("another-account", profile.id)).toBeNull();
  });
});
