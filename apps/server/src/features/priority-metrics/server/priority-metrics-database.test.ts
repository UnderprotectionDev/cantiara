import { priorityMetricNameKey } from "@cantiara/api/priority-metrics";
import { createDb } from "@cantiara/db";
import { auditRecord, user, workspace } from "@cantiara/db/schema/auth";
import { mutationHistory, mutationReceipt } from "@cantiara/db/schema/mutation";
import {
  priorityMetricDefinition,
  workPriorityMetricValue,
} from "@cantiara/db/schema/priority-metrics";
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
import { accountActorAlias } from "../../account-access/server/github-identity-confirmation";
import { MutationConflictError } from "../../mutation-and-undo/server/mutation-contract";
import { createDatabaseProjectShell } from "../../project-shell/server/project-shell-database";
import { PriorityMetricNameConflictError } from "./priority-metrics";
import { createDatabasePriorityMetrics } from "./priority-metrics-database";
import {
  createDatabasePriorityMetricMutationContracts,
  PriorityMetricTrashedError,
} from "./priority-metrics-mutation-database";
import {
  createDatabasePriorityMetricTrashMaintenance,
  PRIORITY_METRIC_PERMANENT_DELETE_EVENT_TYPE,
  PRIORITY_METRIC_TRASH_RETENTION_MS,
  type PriorityMetricPermanentDeleteEvent,
  type PriorityMetricPermanentDeleteEventStore,
} from "./priority-metrics-trash-database";

const databaseUrl = process.env.ACCOUNT_ACCESS_DATABASE_URL;
const describeDatabase = databaseUrl ? describe : describe.skip;

describeDatabase("Priority metrics PostgreSQL boundary", () => {
  const database = databaseUrl
    ? createDb({ DATABASE_URL: databaseUrl })
    : undefined;
  const accountId = `priority-metrics-${crypto.randomUUID()}`;
  const workspaceId = `workspace-${crypto.randomUUID()}`;

  beforeEach(async () => {
    if (!database) {
      throw new Error("ACCOUNT_ACCESS_DATABASE_URL is required");
    }
    await database.insert(user).values({
      email: `${accountId}@example.invalid`,
      id: accountId,
      name: "Priority metrics founder",
    });
    await database.insert(workspace).values({
      id: workspaceId,
      ownerAccountId: accountId,
    });
  });

  afterEach(async () => {
    if (database) {
      await database
        .delete(auditRecord)
        .where(eq(auditRecord.actorAlias, accountId));
      await database
        .delete(auditRecord)
        .where(eq(auditRecord.actorAlias, await accountActorAlias(accountId)));
    }
    await database?.delete(user).where(eq(user.id, accountId));
  });

  afterAll(async () => {
    await database?.$client.end();
  });

  test("copies active criterion definitions as independent Project identities", async () => {
    if (!database) {
      throw new Error("ACCOUNT_ACCESS_DATABASE_URL is required");
    }

    const projectShell = createDatabaseProjectShell(database);
    const source = await projectShell.create(accountId, {
      name: "Priority metrics copy source",
      starterConfiguration: "Blank Project",
    });
    const target = await projectShell.create(accountId, {
      name: "Priority metrics copy target",
      starterConfiguration: "Blank Project",
    });
    const sourceMetricId = `metric-${crypto.randomUUID()}`;
    const trashedMetricId = `metric-${crypto.randomUUID()}`;
    const rankDescriptions = {
      High: "Repeated direct evidence.",
      Low: "Limited evidence.",
      Medium: "Some evidence.",
      "Very high": "Strong validated evidence.",
      "Very low": "No supporting evidence.",
    };

    await database.insert(priorityMetricDefinition).values([
      {
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        enabled: false,
        id: sourceMetricId,
        name: "Evidence strength",
        nameKey: priorityMetricNameKey("Evidence strength"),
        projectId: source.id,
        rankDescriptions,
        shortDescription: "How strongly evidence supports this Work.",
      },
      {
        createdAt: new Date("2026-01-02T00:00:00.000Z"),
        enabled: true,
        id: trashedMetricId,
        name: "Retired criterion",
        nameKey: priorityMetricNameKey("Retired criterion"),
        projectId: source.id,
        rankDescriptions,
        shortDescription: "No longer used.",
        trashedAt: new Date("2026-01-03T00:00:00.000Z"),
      },
    ]);

    const copyInput = {
      sourceProjectId: source.id,
      targetProjectId: target.id,
    };
    const key = crypto.randomUUID();
    const mutation =
      createDatabasePriorityMetricMutationContracts(database).copyDefinitions(
        accountId,
      );
    const command = {
      actor: { actorId: accountId, type: "User" as const },
      baseRevision: 0,
      clientIdempotencyKey: key,
      kind: "human" as const,
      payload: copyInput,
      targetId: `priority-metric-copy:${key}`,
    };
    const apply = ({ payload }: { payload: typeof copyInput }) => ({
      definitions: [],
      sourceProjectId: payload.sourceProjectId,
      targetProjectId: payload.targetProjectId,
    });
    const receipt = await mutation.mutate(command, apply);
    const replay = await mutation.mutate(command, apply);
    const metrics = createDatabasePriorityMetrics(database);
    const copied = await metrics.list(workspaceId, target.id);

    expect(replay).toEqual(receipt);
    expect(receipt.nextValue.definitions).toHaveLength(1);
    expect(receipt.nextValue.definitions[0]).toMatchObject({
      enabled: false,
      name: "Evidence strength",
      projectId: target.id,
      rankDescriptions,
      revision: 0,
      shortDescription: "How strongly evidence supports this Work.",
    });
    await expect(
      mutation.mutate(
        {
          ...command,
          payload: {
            sourceProjectId: target.id,
            targetProjectId: source.id,
          },
        },
        apply,
      ),
    ).rejects.toBeInstanceOf(MutationConflictError);

    expect(copied).toHaveLength(1);
    expect(copied?.[0]).toMatchObject({
      enabled: false,
      name: "Evidence strength",
      projectId: target.id,
      rankDescriptions,
      revision: 0,
      shortDescription: "How strongly evidence supports this Work.",
      trashedAt: null,
    });
    expect(copied?.[0]?.id).not.toBe(sourceMetricId);
    await expect(metrics.list(workspaceId, source.id)).resolves.toHaveLength(2);
    await expect(metrics.list(workspaceId, target.id)).resolves.toEqual(copied);
  }, 20_000);

  test("rolls back Project structure copy when a target criterion name conflicts", async () => {
    if (!database) {
      throw new Error("ACCOUNT_ACCESS_DATABASE_URL is required");
    }

    const projectShell = createDatabaseProjectShell(database);
    const source = await projectShell.create(accountId, {
      name: "Priority metrics conflict source",
      starterConfiguration: "Blank Project",
    });
    const target = await projectShell.create(accountId, {
      name: "Priority metrics conflict target",
      starterConfiguration: "Blank Project",
    });
    const rankDescriptions = {
      High: "Repeated direct evidence.",
      Low: "Limited evidence.",
      Medium: "Some evidence.",
      "Very high": "Strong validated evidence.",
      "Very low": "No supporting evidence.",
    };
    await database.insert(priorityMetricDefinition).values([
      {
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        enabled: true,
        id: `metric-${crypto.randomUUID()}`,
        name: "Audience",
        nameKey: priorityMetricNameKey("Audience"),
        projectId: source.id,
        rankDescriptions,
        shortDescription: "Who needs this Work.",
      },
      {
        createdAt: new Date("2026-01-02T00:00:00.000Z"),
        enabled: true,
        id: `metric-${crypto.randomUUID()}`,
        name: "Urgency",
        nameKey: priorityMetricNameKey("Urgency"),
        projectId: source.id,
        rankDescriptions,
        shortDescription: "How soon this Work is needed.",
      },
      {
        enabled: true,
        id: `metric-${crypto.randomUUID()}`,
        name: "Urgency",
        nameKey: priorityMetricNameKey("Urgency"),
        projectId: target.id,
        rankDescriptions,
        shortDescription: "Target Project's existing criterion.",
      },
    ]);

    const metrics = createDatabasePriorityMetrics(database);
    const copyInput = {
      sourceProjectId: source.id,
      targetProjectId: target.id,
    };
    const key = crypto.randomUUID();
    const mutation =
      createDatabasePriorityMetricMutationContracts(database).copyDefinitions(
        accountId,
      );
    await expect(
      mutation.mutate(
        {
          actor: { actorId: accountId, type: "User" },
          baseRevision: 0,
          clientIdempotencyKey: key,
          kind: "human",
          payload: copyInput,
          targetId: `priority-metric-copy:${key}`,
        },
        ({ payload }) => ({
          definitions: [],
          sourceProjectId: payload.sourceProjectId,
          targetProjectId: payload.targetProjectId,
        }),
      ),
    ).rejects.toBeInstanceOf(PriorityMetricNameConflictError);
    await expect(metrics.list(workspaceId, target.id)).resolves.toHaveLength(1);
  }, 20_000);

  test("makes a trashed criterion ineffective for reads and value writes", async () => {
    if (!database) {
      throw new Error("ACCOUNT_ACCESS_DATABASE_URL is required");
    }

    const projectShell = createDatabaseProjectShell(database);
    const project = await projectShell.create(accountId, {
      name: "Priority metrics trash test",
      starterConfiguration: "Blank Project",
    });
    const workId = `work-${crypto.randomUUID()}`;
    const metricId = `metric-${crypto.randomUUID()}`;
    const rankDescriptions = {
      High: "Repeated direct evidence.",
      Low: "Limited evidence.",
      Medium: "Some evidence.",
      "Very high": "Strong validated evidence.",
      "Very low": "No supporting evidence.",
    };

    await database.insert(work).values({
      id: workId,
      key: `${project.shortCode}-1`,
      number: 1,
      projectId: project.id,
      title: "Interview five customers",
      type: "Task",
    });
    await database.insert(priorityMetricDefinition).values({
      enabled: true,
      id: metricId,
      name: "Evidence strength",
      nameKey: priorityMetricNameKey("Evidence strength"),
      projectId: project.id,
      rankDescriptions,
      shortDescription: "How strongly evidence supports this Work.",
    });

    const metrics = createDatabasePriorityMetrics(database);
    await expect(metrics.list(workspaceId, project.id)).resolves.toHaveLength(
      1,
    );
    await expect(metrics.values(workspaceId, workId)).resolves.toMatchObject([
      { definition: { id: metricId }, value: null },
    ]);
    await expect(
      metrics.trashImpactPreview(workspaceId, metricId),
    ).resolves.toEqual({
      attachedExternalSurfaceCount: 0,
      dependentRuleCount: 0,
      dependentViewCount: 0,
      storedWorkValueCount: 0,
    });

    await database
      .update(priorityMetricDefinition)
      .set({ trashedAt: new Date() })
      .where(eq(priorityMetricDefinition.id, metricId));

    await expect(metrics.list(workspaceId, project.id)).resolves.toMatchObject([
      { enabled: true, id: metricId, trashedAt: expect.any(String) },
    ]);
    await expect(
      metrics.projectValues(workspaceId, project.id),
    ).resolves.toEqual({
      definitions: [],
      values: [],
      valueRevisions: [],
    });
    await expect(metrics.values(workspaceId, workId)).resolves.toEqual([]);

    const setValue =
      createDatabasePriorityMetricMutationContracts(database).setValue(
        accountId,
      );
    await expect(
      setValue.mutate(
        {
          actor: { actorId: accountId, type: "User" },
          baseRevision: 0,
          clientIdempotencyKey: crypto.randomUUID(),
          kind: "human",
          payload: {
            metricId,
            projectId: project.id,
            rank: "High",
            workId,
          },
          targetId: `${workId}:${metricId}`,
        },
        ({ currentValue }) => currentValue,
      ),
    ).rejects.toBeInstanceOf(PriorityMetricTrashedError);
  }, 20_000);

  test("restores the same criterion and deletes it only after Trash", async () => {
    if (!database) {
      throw new Error("ACCOUNT_ACCESS_DATABASE_URL is required");
    }

    const projectShell = createDatabaseProjectShell(database);
    const project = await projectShell.create(accountId, {
      name: "Priority metric recovery test",
      starterConfiguration: "Blank Project",
    });
    const workId = `work-${crypto.randomUUID()}`;
    const metricId = `metric-${crypto.randomUUID()}`;
    await database.insert(work).values({
      id: workId,
      key: `${project.shortCode}-1`,
      number: 1,
      projectId: project.id,
      title: "Interview five customers",
      type: "Task",
    });
    await database.insert(priorityMetricDefinition).values({
      enabled: true,
      id: metricId,
      name: "Evidence strength",
      nameKey: priorityMetricNameKey("Evidence strength"),
      projectId: project.id,
      rankDescriptions: {
        High: "Repeated direct evidence.",
        Low: "Limited evidence.",
        Medium: "Some evidence.",
        "Very high": "Strong validated evidence.",
        "Very low": "No supporting evidence.",
      },
      shortDescription: "How strongly evidence supports this Work.",
    });

    const events = createTestPermanentDeleteEvents();
    const contracts = createDatabasePriorityMetricMutationContracts(
      database,
      events,
    );
    const metricTarget = { targetId: metricId };
    const valueTarget = { targetId: `${workId}:${metricId}` };
    const setValue = contracts.setValue(accountId);
    await setValue.mutate(
      {
        actor: { actorId: accountId, type: "User" },
        baseRevision: 0,
        clientIdempotencyKey: crypto.randomUUID(),
        kind: "human",
        payload: { metricId, projectId: project.id, rank: "High", workId },
        ...valueTarget,
      },
      ({ currentRevision, payload }) => {
        const timestamp = new Date().toISOString();
        return {
          value: {
            createdAt: timestamp,
            id: crypto.randomUUID(),
            metricId: payload.metricId,
            projectId: payload.projectId,
            rank: "High",
            revision: currentRevision + 1,
            updatedAt: timestamp,
            workId: payload.workId,
          },
        };
      },
    );

    const trash = contracts.trash(accountId);
    await trash.mutate(
      {
        actor: { actorId: accountId, type: "User" },
        baseRevision: 0,
        clientIdempotencyKey: crypto.randomUUID(),
        kind: "human",
        payload: {},
        ...metricTarget,
      },
      ({ currentRevision, currentValue }) => ({
        metric: currentValue.metric
          ? {
              ...currentValue.metric,
              revision: currentRevision + 1,
              trashedAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            }
          : null,
      }),
    );
    const metrics = createDatabasePriorityMetrics(database);
    await expect(
      metrics.projectValues(workspaceId, project.id),
    ).resolves.toEqual({
      definitions: [],
      values: [],
      valueRevisions: [],
    });

    const restore = contracts.restore(accountId);
    await restore.mutate(
      {
        actor: { actorId: accountId, type: "User" },
        baseRevision: 1,
        clientIdempotencyKey: crypto.randomUUID(),
        kind: "human",
        payload: {},
        ...metricTarget,
      },
      ({ currentRevision, currentValue }) => ({
        metric: currentValue.metric
          ? {
              ...currentValue.metric,
              revision: currentRevision + 1,
              trashedAt: null,
              updatedAt: new Date().toISOString(),
            }
          : null,
      }),
    );
    await expect(metrics.list(workspaceId, project.id)).resolves.toMatchObject([
      {
        enabled: true,
        id: metricId,
        revision: 2,
        trashedAt: null,
      },
    ]);
    await expect(metrics.values(workspaceId, workId)).resolves.toMatchObject([
      { definition: { id: metricId }, value: { rank: "High" } },
    ]);

    await trash.mutate(
      {
        actor: { actorId: accountId, type: "User" },
        baseRevision: 2,
        clientIdempotencyKey: crypto.randomUUID(),
        kind: "human",
        payload: {},
        ...metricTarget,
      },
      ({ currentRevision, currentValue }) => ({
        metric: currentValue.metric
          ? {
              ...currentValue.metric,
              revision: currentRevision + 1,
              trashedAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            }
          : null,
      }),
    );
    await contracts.delete(accountId).mutate(
      {
        actor: { actorId: accountId, type: "User" },
        baseRevision: 3,
        clientIdempotencyKey: crypto.randomUUID(),
        kind: "human",
        payload: {},
        ...metricTarget,
      },
      () => ({ metric: null }),
    );
    await expect(metrics.list(workspaceId, project.id)).resolves.toEqual([]);
    await expect(
      metrics.projectValues(workspaceId, project.id),
    ).resolves.toEqual({
      definitions: [],
      values: [],
      valueRevisions: [],
    });
  }, 20_000);

  test("keeps the value revision after it is cleared", async () => {
    if (!database) {
      throw new Error("ACCOUNT_ACCESS_DATABASE_URL is required");
    }

    const projectShell = createDatabaseProjectShell(database);
    const project = await projectShell.create(accountId, {
      name: "Priority metric revision test",
      starterConfiguration: "Blank Project",
    });
    const workId = `work-${crypto.randomUUID()}`;
    const metricId = `metric-${crypto.randomUUID()}`;

    await database.insert(work).values({
      id: workId,
      key: `${project.shortCode}-1`,
      number: 1,
      projectId: project.id,
      title: "Interview five customers",
      type: "Task",
    });
    await database.insert(priorityMetricDefinition).values({
      enabled: true,
      id: metricId,
      name: "Evidence strength",
      nameKey: priorityMetricNameKey("Evidence strength"),
      projectId: project.id,
      rankDescriptions: {
        High: "Repeated direct evidence.",
        Low: "Limited evidence.",
        Medium: "Some evidence.",
        "Very high": "Strong validated evidence.",
        "Very low": "No supporting evidence.",
      },
      shortDescription: "How strongly evidence supports this Work.",
    });

    const contracts = createDatabasePriorityMetricMutationContracts(database);
    const targetId = `${workId}:${metricId}`;
    const setValue = contracts.setValue(accountId);
    const clearValue = contracts.clearValue(accountId);
    const set = (baseRevision: number, rank: "High" | "Low", key: string) =>
      setValue.mutate(
        {
          actor: { actorId: accountId, type: "User" },
          baseRevision,
          clientIdempotencyKey: key,
          kind: "human",
          payload: { metricId, projectId: project.id, rank, workId },
          targetId,
        },
        ({ currentRevision, currentValue, payload }) => {
          const timestamp = new Date().toISOString();
          return {
            value: {
              createdAt: currentValue.value?.createdAt ?? timestamp,
              id: currentValue.value?.id ?? crypto.randomUUID(),
              metricId: payload.metricId,
              projectId: payload.projectId,
              rank,
              revision: currentRevision + 1,
              updatedAt: timestamp,
              workId: payload.workId,
            },
          };
        },
      );

    await set(0, "High", crypto.randomUUID());
    await clearValue.mutate(
      {
        actor: { actorId: accountId, type: "User" },
        baseRevision: 1,
        clientIdempotencyKey: crypto.randomUUID(),
        kind: "human",
        payload: { metricId, projectId: project.id, workId },
        targetId,
      },
      () => ({ value: null }),
    );

    await expect(set(0, "Low", crypto.randomUUID())).rejects.toMatchObject({
      code: "STALE_BASE_REVISION",
    });
    await expect(
      createDatabasePriorityMetrics(database).values(workspaceId, workId),
    ).resolves.toMatchObject([
      {
        definition: { id: metricId },
        value: null,
        valueRevision: 2,
      },
    ]);
    await expect(
      createDatabasePriorityMetrics(database).projectValues(
        workspaceId,
        project.id,
      ),
    ).resolves.toMatchObject({
      values: [],
      valueRevisions: [{ metricId, revision: 2, workId }],
    });

    await set(2, "Low", crypto.randomUUID());
    await expect(
      createDatabasePriorityMetrics(database).values(workspaceId, workId),
    ).resolves.toMatchObject([
      {
        definition: { id: metricId },
        value: { rank: "Low", revision: 3 },
        valueRevision: 3,
      },
    ]);
    await expect(
      createDatabasePriorityMetrics(database).projectValues(
        workspaceId,
        project.id,
      ),
    ).resolves.toMatchObject({
      values: [{ metricId, rank: "Low", revision: 3, workId }],
      valueRevisions: [{ metricId, revision: 3, workId }],
    });
  }, 20_000);

  test("permanently deletes trashed criteria with a content-free replay mark", async () => {
    if (!database) {
      throw new Error("ACCOUNT_ACCESS_DATABASE_URL is required");
    }

    const events = createTestPermanentDeleteEvents();
    const project = await createDatabaseProjectShell(database).create(
      accountId,
      {
        name: "Priority metric permanent delete test",
        starterConfiguration: "Blank Project",
      },
    );
    const metricId = `metric-${crypto.randomUUID()}`;
    const workId = `work-${crypto.randomUUID()}`;
    const now = new Date();
    const metricContent = {
      High: "Private high detail",
      Low: "Private low detail",
      Medium: "Private medium detail",
      "Very high": "Private very high detail",
      "Very low": "Private very low detail",
    };
    await database.insert(priorityMetricDefinition).values({
      enabled: true,
      id: metricId,
      name: "Private criterion name",
      nameKey: priorityMetricNameKey("Private criterion name"),
      projectId: project.id,
      rankDescriptions: metricContent,
      shortDescription: "Private criterion description",
    });
    await database.insert(work).values({
      id: workId,
      key: `${project.shortCode}-1`,
      number: 1,
      projectId: project.id,
      title: "Private Work title",
      type: "Task",
    });
    await database.insert(workPriorityMetricValue).values({
      createdAt: now,
      id: crypto.randomUUID(),
      metricId,
      projectId: project.id,
      rank: "High",
      revision: 1,
      updatedAt: now,
      workId,
    });

    const mutations = createDatabasePriorityMetricMutationContracts(
      database,
      events,
    );
    await mutations.trash(accountId).mutate(
      {
        actor: { actorId: accountId, type: "User" },
        baseRevision: 0,
        clientIdempotencyKey: crypto.randomUUID(),
        kind: "human",
        payload: {},
        targetId: metricId,
      },
      ({ currentRevision, currentValue }) => {
        const current = currentValue.metric;
        if (!current) {
          throw new Error("Priority metric was not found during trash setup.");
        }
        return {
          metric: {
            ...current,
            revision: currentRevision + 1,
            trashedAt: now.toISOString(),
            updatedAt: now.toISOString(),
          },
        };
      },
    );

    const deleteContract = mutations.delete(accountId);
    const deleteCommand = {
      actor: { actorId: accountId, type: "User" as const },
      baseRevision: 1,
      clientIdempotencyKey: crypto.randomUUID(),
      kind: "human" as const,
      payload: { projectId: project.id },
      targetId: metricId,
    };
    const receipt = await deleteContract.mutate(deleteCommand, () => ({
      metric: null,
    }));

    expect(receipt.previousValue).toEqual({ metric: null });
    await expect(
      database
        .select()
        .from(priorityMetricDefinition)
        .where(eq(priorityMetricDefinition.id, metricId)),
    ).resolves.toEqual([]);
    await expect(
      database
        .select()
        .from(workPriorityMetricValue)
        .where(eq(workPriorityMetricValue.metricId, metricId)),
    ).resolves.toEqual([]);
    const history = await database
      .select()
      .from(mutationHistory)
      .where(eq(mutationHistory.targetId, metricId));
    expect(history).toHaveLength(1);
    expect(history[0]?.previousValue).toEqual({ metric: null });
    expect(history[0]?.nextValue).toEqual({ metric: null });
    expect(JSON.stringify(history)).not.toContain("Private criterion");
    expect(events.records).toEqual([
      expect.objectContaining({
        actorAlias: await accountActorAlias(accountId),
        targetAlias: metricId,
        type: PRIORITY_METRIC_PERMANENT_DELETE_EVENT_TYPE,
        version: 1,
      }),
    ]);
    const audit = await database
      .select()
      .from(auditRecord)
      .where(eq(auditRecord.targetSessionAlias, metricId));
    expect(audit).toMatchObject([
      {
        actorAlias: await accountActorAlias(accountId),
        targetSessionAlias: metricId,
        type: PRIORITY_METRIC_PERMANENT_DELETE_EVENT_TYPE,
      },
    ]);
    expect(JSON.stringify(audit)).not.toContain("Private criterion");

    await expect(
      deleteContract.mutate(
        {
          ...deleteCommand,
          payload: { projectId: `${project.id}-changed` },
        },
        () => ({ metric: null }),
      ),
    ).rejects.toBeInstanceOf(MutationConflictError);

    await database.insert(priorityMetricDefinition).values({
      enabled: true,
      id: metricId,
      name: "Restored backup criterion",
      nameKey: priorityMetricNameKey("Restored backup criterion"),
      projectId: project.id,
      rankDescriptions: metricContent,
      shortDescription: "Restored backup description",
      trashedAt: now,
    });
    await createDatabasePriorityMetricTrashMaintenance(
      database,
      events,
    ).replayPermanentDeletes();
    await expect(
      database
        .select()
        .from(priorityMetricDefinition)
        .where(eq(priorityMetricDefinition.id, metricId)),
    ).resolves.toEqual([]);
    await expect(
      deleteContract.mutate(deleteCommand, () => ({ metric: null })),
    ).resolves.toEqual(receipt);
  }, 20_000);

  test("returns the durable receipt when the database commit reply is lost", async () => {
    if (!database) {
      throw new Error("ACCOUNT_ACCESS_DATABASE_URL is required");
    }

    const project = await createDatabaseProjectShell(database).create(
      accountId,
      {
        name: "Priority metric commit reply test",
        starterConfiguration: "Blank Project",
      },
    );
    const metricId = `metric-${crypto.randomUUID()}`;
    await database.insert(priorityMetricDefinition).values({
      enabled: true,
      id: metricId,
      name: "Commit reply criterion",
      nameKey: priorityMetricNameKey("Commit reply criterion"),
      projectId: project.id,
      rankDescriptions: {
        High: "High.",
        Low: "Low.",
        Medium: "Medium.",
        "Very high": "Very high.",
        "Very low": "Very low.",
      },
      shortDescription: "A criterion used for commit reply testing.",
      trashedAt: new Date(),
    });

    let loseNextTransactionReply = true;
    let committedReceiptId: string | undefined;
    const lostReplyDatabase = new Proxy(database, {
      get(target, property, receiver) {
        const value = Reflect.get(target, property, receiver);
        if (property === "transaction" && typeof value === "function") {
          return async (...args: unknown[]) => {
            const result = await Reflect.apply(value, target, args);
            if (loseNextTransactionReply) {
              loseNextTransactionReply = false;
              const [receipt] = await database
                .select({ id: mutationReceipt.id })
                .from(mutationReceipt)
                .where(eq(mutationReceipt.targetId, metricId));
              committedReceiptId = receipt?.id;
              throw new Error("The primary commit reply was lost.");
            }
            return result;
          };
        }
        return typeof value === "function" ? value.bind(target) : value;
      },
    });
    const events = createTestPermanentDeleteEvents();
    const deleteContract = createDatabasePriorityMetricMutationContracts(
      lostReplyDatabase,
      events,
    ).delete(accountId);
    const command = {
      actor: { actorId: accountId, type: "User" as const },
      baseRevision: 0,
      clientIdempotencyKey: crypto.randomUUID(),
      kind: "human" as const,
      payload: { projectId: project.id },
      targetId: metricId,
    };

    const firstReceipt = await deleteContract.mutate(command, () => ({
      metric: null,
    }));
    const retryReceipt = await deleteContract.mutate(command, () => ({
      metric: null,
    }));

    expect(committedReceiptId).toBeDefined();
    expect(firstReceipt.id).toBe(committedReceiptId);
    expect(retryReceipt).toEqual(firstReceipt);
  }, 20_000);

  test("reconciles a committed delete event after its database transaction fails", async () => {
    if (!database) {
      throw new Error("ACCOUNT_ACCESS_DATABASE_URL is required");
    }

    const project = await createDatabaseProjectShell(database).create(
      accountId,
      {
        name: "Priority metric delete recovery test",
        starterConfiguration: "Blank Project",
      },
    );
    const metricId = `metric-${crypto.randomUUID()}`;
    const now = new Date();
    await database.insert(priorityMetricDefinition).values({
      enabled: true,
      id: metricId,
      name: "Recoverable criterion",
      nameKey: priorityMetricNameKey("Recoverable criterion"),
      projectId: project.id,
      rankDescriptions: {
        High: "High.",
        Low: "Low.",
        Medium: "Medium.",
        "Very high": "Very high.",
        "Very low": "Very low.",
      },
      revision: 1,
      shortDescription: "A criterion used for recovery testing.",
      trashedAt: now,
    });

    const records: PriorityMetricPermanentDeleteEvent[] = [];
    const events: PriorityMetricPermanentDeleteEventStore = {
      append(event) {
        records.push(event);
        return Promise.reject(
          new Error(
            "The protected append committed before its reply was lost.",
          ),
        );
      },
      list: () => Promise.resolve(records),
    };

    const clientIdempotencyKey = crypto.randomUUID();
    const deleteContract = createDatabasePriorityMetricMutationContracts(
      database,
      events,
    ).delete(accountId);
    const command = {
      actor: { actorId: accountId, type: "User" as const },
      baseRevision: 1,
      clientIdempotencyKey,
      kind: "human" as const,
      payload: { projectId: project.id },
      targetId: metricId,
    };
    const receipt = await deleteContract.mutate(command, () => ({
      metric: null,
    }));

    expect(receipt).toMatchObject({
      nextValue: { metric: null },
      previousValue: { metric: null },
      targetId: metricId,
    });
    expect(records).toEqual([
      expect.objectContaining({
        actorAlias: await accountActorAlias(accountId),
      }),
    ]);
    await expect(
      database
        .select()
        .from(priorityMetricDefinition)
        .where(eq(priorityMetricDefinition.id, metricId)),
    ).resolves.toEqual([]);

    await expect(
      deleteContract.mutate(
        { ...command, payload: { projectId: `${project.id}-changed` } },
        () => ({ metric: null }),
      ),
    ).rejects.toBeInstanceOf(MutationConflictError);
    await expect(
      deleteContract.mutate(
        { ...command, clientIdempotencyKey: crypto.randomUUID() },
        () => ({ metric: null }),
      ),
    ).rejects.toThrow();
  }, 20_000);

  test("expires Configuration Trash at the 30-day boundary and previews its effect", async () => {
    if (!database) {
      throw new Error("ACCOUNT_ACCESS_DATABASE_URL is required");
    }

    const events = createTestPermanentDeleteEvents();
    const project = await createDatabaseProjectShell(database).create(
      accountId,
      {
        name: "Priority metric retention test",
        starterConfiguration: "Blank Project",
      },
    );
    const cutoff = new Date(
      Date.UTC(2026, 9, 31, 9, 0, 0) - PRIORITY_METRIC_TRASH_RETENTION_MS,
    );
    const expiredId = `metric-${crypto.randomUUID()}`;
    const retainedId = `metric-${crypto.randomUUID()}`;
    const insertMetric = (id: string, trashedAt: Date) =>
      database.insert(priorityMetricDefinition).values({
        enabled: true,
        id,
        name: id,
        nameKey: priorityMetricNameKey(id),
        projectId: project.id,
        rankDescriptions: {
          High: "High.",
          Low: "Low.",
          Medium: "Medium.",
          "Very high": "Very high.",
          "Very low": "Very low.",
        },
        shortDescription: "A test criterion.",
        trashedAt,
      });
    await insertMetric(expiredId, cutoff);
    await insertMetric(retainedId, new Date(cutoff.getTime() + 1));

    const workId = `work-${crypto.randomUUID()}`;
    await database.insert(work).values({
      id: workId,
      key: `${project.shortCode}-1`,
      number: 1,
      projectId: project.id,
      title: "Counted work",
      type: "Task",
    });
    await database.insert(workPriorityMetricValue).values({
      createdAt: cutoff,
      id: crypto.randomUUID(),
      metricId: expiredId,
      projectId: project.id,
      rank: "High",
      revision: 1,
      updatedAt: cutoff,
      workId,
    });
    const metrics = createDatabasePriorityMetrics(database);
    await expect(
      metrics.trashImpactPreview(workspaceId, expiredId),
    ).resolves.toEqual({
      attachedExternalSurfaceCount: 0,
      dependentRuleCount: 0,
      dependentViewCount: 0,
      storedWorkValueCount: 1,
    });

    const maintenance = createDatabasePriorityMetricTrashMaintenance(
      database,
      events,
    );
    const now = new Date(cutoff.getTime() + PRIORITY_METRIC_TRASH_RETENTION_MS);
    await expect(maintenance.sweepExpired(now)).resolves.toBe(1);
    await expect(
      database
        .select()
        .from(priorityMetricDefinition)
        .where(eq(priorityMetricDefinition.id, expiredId)),
    ).resolves.toEqual([]);
    await expect(
      database
        .select()
        .from(priorityMetricDefinition)
        .where(eq(priorityMetricDefinition.id, retainedId)),
    ).resolves.toHaveLength(1);
    await expect(
      metrics.trashImpactPreview(workspaceId, expiredId),
    ).resolves.toBeNull();
    expect(events.records).toHaveLength(1);
    await expect(maintenance.sweepExpired(now)).resolves.toBe(0);
  }, 20_000);
});

function createTestPermanentDeleteEvents() {
  const records: PriorityMetricPermanentDeleteEvent[] = [];
  const byId = new Map<string, PriorityMetricPermanentDeleteEvent>();
  const store: PriorityMetricPermanentDeleteEventStore = {
    append(event) {
      if (!byId.has(event.id)) {
        byId.set(event.id, event);
        records.push(event);
      }
      return Promise.resolve();
    },
    list() {
      return Promise.resolve([...records]);
    },
  };
  return Object.assign(store, { records });
}
