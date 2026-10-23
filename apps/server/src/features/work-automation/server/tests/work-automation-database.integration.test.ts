import { createDb } from "@cantiara/db";
import { user, workspace } from "@cantiara/db/schema/auth";
import { mutationHistory } from "@cantiara/db/schema/mutation";
import { project } from "@cantiara/db/schema/project";
import { work, workKeyAllocation } from "@cantiara/db/schema/work";
import { workAutomationApplication } from "@cantiara/db/schema/work-automation";
import { and, asc, eq } from "drizzle-orm";
import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  test,
} from "vitest";

import {
  createDatabaseWorkAutomation,
  WorkAutomationRuleNameConflictError,
  WorkAutomationStaleRevisionError,
  type WorkAutomationWorkCreator,
} from "../work-automation-database";

const databaseUrl =
  process.env.ACCOUNT_ACCESS_DATABASE_URL ?? process.env.DATABASE_URL;
const describeDatabase = databaseUrl ? describe : describe.skip;

describeDatabase("Work Automation PostgreSQL integration", () => {
  const database = databaseUrl
    ? createDb({ DATABASE_URL: databaseUrl })
    : undefined;
  const accountId = `work-automation-${crypto.randomUUID()}`;
  const workspaceId = `workspace-${crypto.randomUUID()}`;
  const projectId = `project-${crypto.randomUUID()}`;
  const workId = `work-${crypto.randomUUID()}`;

  function requireDatabase() {
    if (!database) {
      throw new Error("DATABASE_URL is required");
    }
    return database;
  }

  function historyStatus(
    row: { previousValue: unknown; nextValue: unknown } | undefined,
    key: "previousValue" | "nextValue",
  ) {
    return (
      (row?.[key] as { work?: { status?: string } } | undefined)?.work
        ?.status ?? null
    );
  }

  beforeEach(async () => {
    const db = requireDatabase();
    await db.insert(user).values({
      email: `${accountId}@example.invalid`,
      id: accountId,
      name: "Founder",
    });
    await db
      .insert(workspace)
      .values({ id: workspaceId, ownerAccountId: accountId });
    await db.insert(project).values({
      id: projectId,
      name: "Automation Project",
      shortCode: `WA-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
      starterConfiguration: "Blank Project",
      workspaceId,
    });
    await db.insert(work).values({
      id: workId,
      key: "WA-1",
      number: 1,
      projectId,
      title: "Ship it",
      type: "Task",
    });
  });

  afterEach(async () => {
    await database?.delete(user).where(eq(user.id, accountId));
  });

  afterAll(async () => {
    await database?.$client.end();
  });

  const definition = {
    actions: [
      { kind: "set-work-status" as const, status: "In Progress" as const },
    ],
    conditions: [],
    trigger: { kind: "work-created" as const },
  };

  test("keeps rules disabled until enabled, versions each definition change, and stops in Trash", async () => {
    const { access, engine } = createDatabaseWorkAutomation(requireDatabase());
    const created = await access.create(accountId, {
      definition,
      name: "Start new Work",
      projectId,
    });
    expect(created).toMatchObject({ enabled: false, revision: 1, version: 1 });
    await expect(
      access.create(accountId, {
        definition,
        name: "start new work",
        projectId,
      }),
    ).rejects.toBeInstanceOf(WorkAutomationRuleNameConflictError);

    const event = {
      id: "event-disabled",
      kind: "work-created" as const,
      occurredAt: "2026-10-22T09:00:00.000Z",
      origin: "user" as const,
      projectId,
      workId,
    };
    expect(await engine.handleEvent(event)).toEqual({ status: "no-match" });

    const enabled = await access.setEnabled(accountId, {
      baseRevision: created.revision,
      enabled: true,
      ruleId: created.id,
    });
    expect(enabled).toMatchObject({ enabled: true, revision: 2, version: 1 });
    await expect(
      access.setEnabled(accountId, {
        baseRevision: 1,
        enabled: false,
        ruleId: created.id,
      }),
    ).rejects.toBeInstanceOf(WorkAutomationStaleRevisionError);

    const updated = await access.update(accountId, created.id, 2, {
      definition: {
        ...definition,
        actions: [{ kind: "set-work-status", status: "Blocked" }],
      },
      name: "Start new Work",
    });
    expect(updated).toMatchObject({ revision: 3, version: 2 });
    const restored = await access.restoreVersion(accountId, {
      baseRevision: 3,
      ruleId: created.id,
      version: 1,
    });
    expect(restored).toMatchObject({ revision: 4, version: 3 });
    expect(restored?.definition.actions).toEqual(definition.actions);
    const versions = await access.versions(accountId, created.id);
    expect(versions?.map(({ version }) => version)).toEqual([3, 2, 1]);

    await access.trash(accountId, created.id, 4);
    expect(await engine.handleEvent({ ...event, id: "event-trashed" })).toEqual(
      { status: "no-match" },
    );
  });

  test("applies a rule once per original event and undoes only unclobbered values", async () => {
    const db = requireDatabase();
    const { access, engine } = createDatabaseWorkAutomation(db, {
      now: () => new Date("2026-10-22T09:00:00.000Z"),
    });
    const rule = await access.create(accountId, {
      definition,
      name: "Start new Work",
      projectId,
    });
    await access.setEnabled(accountId, {
      baseRevision: 1,
      enabled: true,
      ruleId: rule.id,
    });
    const event = {
      id: "event-1",
      kind: "work-created" as const,
      occurredAt: "2026-10-22T09:00:00.000Z",
      origin: "user" as const,
      projectId,
      workId,
    };

    const first = await engine.handleEvent(event);
    const retry = await engine.handleEvent(event);

    expect(first.status).toBe("applied");
    expect(retry.status).toBe("applied");
    if (first.status !== "applied" || retry.status !== "applied") {
      return;
    }
    expect(retry.receipt?.id).toBe(first.receipt?.id);
    const applications = await db
      .select()
      .from(workAutomationApplication)
      .where(eq(workAutomationApplication.projectId, projectId));
    expect(applications).toHaveLength(1);
    const [after] = await db.select().from(work).where(eq(work.id, workId));
    expect(after).toMatchObject({ revision: 1, status: "In Progress" });

    await db.update(work).set({ status: "Blocked" }).where(eq(work.id, workId));
    expect(await access.undo(accountId, first.receipt?.id ?? "")).toEqual({
      fields: [`${workId}:status`],
      status: "conflict",
    });
    await db
      .update(work)
      .set({ status: "In Progress" })
      .where(eq(work.id, workId));
    expect(await access.undo(accountId, first.receipt?.id ?? "")).toEqual({
      status: "undone",
    });
    const [restored] = await db.select().from(work).where(eq(work.id, workId));
    expect(restored?.status).toBe("Not Started");
    expect(await access.undo("someone-else", first.receipt?.id ?? "")).toEqual({
      status: "not-found",
    });
  });

  test("rolls back the whole mutation when a target Work is gone and signals the failure", async () => {
    const db = requireDatabase();
    const { access, engine } = createDatabaseWorkAutomation(db);
    const rule = await access.create(accountId, {
      definition,
      name: "Start new Work",
      projectId,
    });
    await access.setEnabled(accountId, {
      baseRevision: 1,
      enabled: true,
      ruleId: rule.id,
    });
    const result = await engine.handleEvent({
      id: "event-missing",
      kind: "work-created",
      occurredAt: "2026-10-22T09:00:00.000Z",
      origin: "user",
      projectId,
      workId: "missing-work",
    });
    expect(result.status).toBe("failed");
    const applications = await db
      .select()
      .from(workAutomationApplication)
      .where(eq(workAutomationApplication.projectId, projectId));
    expect(applications).toHaveLength(0);
  });

  test("the prepared PR-merge rule closes Work as Completed and undo restores it", async () => {
    const db = requireDatabase();
    const { access, engine } = createDatabaseWorkAutomation(db, {
      requiredPullRequests: () =>
        Promise.resolve([{ id: "pr-1", merged: true }]),
    });
    const rule = await access.createRequiredPrMergeRule(accountId, projectId);
    expect(rule).toMatchObject({
      enabled: false,
      name: "When required PRs merge, mark Work Completed",
    });
    const event = {
      id: "merge-1",
      kind: "pull-request-merged" as const,
      occurredAt: "2026-10-22T09:00:00.000Z",
      origin: "system" as const,
      projectId,
      pullRequestId: "pr-1",
      workId,
    };

    expect(await engine.handleEvent(event)).toEqual({
      status: "suggested",
      suggestion: { label: "Mark as Completed", workId },
    });
    const [untouched] = await db.select().from(work).where(eq(work.id, workId));
    expect(untouched).toMatchObject({
      closureResult: null,
      status: "Not Started",
    });

    await access.setEnabled(accountId, {
      baseRevision: rule.revision,
      enabled: true,
      ruleId: rule.id,
    });
    const result = await engine.handleEvent({ ...event, id: "merge-2" });
    expect(result.status).toBe("applied");
    if (result.status !== "applied") {
      return;
    }
    const [closed] = await db.select().from(work).where(eq(work.id, workId));
    expect(closed).toMatchObject({
      closureResult: "Completed",
      status: "Closed",
    });

    await db
      .update(work)
      .set({ closureResult: "Abandoned" })
      .where(eq(work.id, workId));
    expect(await access.undo(accountId, result.receipt?.id ?? "")).toEqual({
      fields: [`${workId}:closureResult`],
      status: "conflict",
    });
    await db
      .update(work)
      .set({ closureResult: "Completed" })
      .where(eq(work.id, workId));
    expect(await access.undo(accountId, result.receipt?.id ?? "")).toEqual({
      status: "undone",
    });
    const [reopened] = await db.select().from(work).where(eq(work.id, workId));
    expect(reopened).toMatchObject({
      closureResult: null,
      status: "Not Started",
    });
  });

  test("explains applied and undone changes on the Work's mutation history", async () => {
    const db = requireDatabase();
    const { access, engine } = createDatabaseWorkAutomation(db, {
      now: () => new Date("2026-10-22T09:00:00.000Z"),
    });
    const rule = await access.create(accountId, {
      definition,
      name: "Start new Work",
      projectId,
    });
    await access.setEnabled(accountId, {
      baseRevision: 1,
      enabled: true,
      ruleId: rule.id,
    });
    const event = {
      id: "event-1",
      kind: "work-created" as const,
      occurredAt: "2026-10-22T09:00:00.000Z",
      origin: "user" as const,
      projectId,
      workId,
    };
    const applied = await engine.handleEvent(event);
    expect(applied.status).toBe("applied");
    if (applied.status !== "applied" || !applied.receipt) {
      return;
    }
    const [application] = await db
      .select()
      .from(workAutomationApplication)
      .where(eq(workAutomationApplication.projectId, projectId));
    // mutation_history has no foreign key, so scope the assertions to the rows
    // this application wrote; earlier tests in this file share the Work id.
    const history = await db
      .select()
      .from(mutationHistory)
      .where(
        and(
          eq(mutationHistory.targetId, workId),
          eq(mutationHistory.sourceId, application?.id ?? ""),
        ),
      )
      .orderBy(asc(mutationHistory.revision));
    const [appliedRow] = history;
    expect(appliedRow).toMatchObject({
      actorId: "work-automation",
      actorType: "System automation",
      deliveryId: "event-1",
      originKind: "source",
      revision: 1,
      sourceId: application?.id,
      targetId: workId,
    });
    expect(historyStatus(appliedRow, "previousValue")).toBe("Not Started");
    expect(historyStatus(appliedRow, "nextValue")).toBe("In Progress");
    expect(appliedRow?.undo).toMatchObject({
      kind: "atomic-transform",
      scope: "work.status",
    });

    await db.update(work).set({ status: "Blocked" }).where(eq(work.id, workId));
    expect(await access.undo(accountId, applied.receipt.id)).toEqual({
      fields: [`${workId}:status`],
      status: "conflict",
    });
    await db
      .update(work)
      .set({ status: "In Progress" })
      .where(eq(work.id, workId));
    expect(await access.undo(accountId, applied.receipt.id)).toEqual({
      status: "undone",
    });
    const undoneRows = await db
      .select()
      .from(mutationHistory)
      .where(
        and(
          eq(mutationHistory.targetId, workId),
          eq(mutationHistory.sourceId, application?.id ?? ""),
        ),
      )
      .orderBy(asc(mutationHistory.revision));
    const [undoneRow] = undoneRows.slice(-1);
    expect(undoneRows).toHaveLength(2);
    expect(undoneRow).toMatchObject({
      actorType: "System automation",
      deliveryId: "event-1",
      revision: 2,
      sourceId: application?.id,
      undoOf: appliedRow?.id,
    });
    expect(historyStatus(undoneRow, "previousValue")).toBe("In Progress");
    expect(historyStatus(undoneRow, "nextValue")).toBe("Not Started");
  });

  test("the receipt undo stops once the 10-second window has passed", async () => {
    const db = requireDatabase();
    const { access, engine } = createDatabaseWorkAutomation(db);
    const rule = await access.create(accountId, {
      definition,
      name: "Start new Work",
      projectId,
    });
    await access.setEnabled(accountId, {
      baseRevision: 1,
      enabled: true,
      ruleId: rule.id,
    });
    const applied = await engine.handleEvent({
      id: "event-1",
      kind: "work-created",
      occurredAt: "2026-10-22T09:00:00.000Z",
      origin: "user",
      projectId,
      workId,
    });
    expect(applied.status).toBe("applied");
    if (applied.status !== "applied" || !applied.receipt) {
      return;
    }
    await db
      .update(workAutomationApplication)
      .set({ undoUntil: new Date("2000-01-01T00:00:00.000Z") })
      .where(eq(workAutomationApplication.projectId, projectId));
    expect(await access.undo(accountId, applied.receipt.id)).toEqual({
      status: "not-undoable",
    });
    const [stillApplied] = await db
      .select()
      .from(work)
      .where(eq(work.id, workId));
    expect(stillApplied).toMatchObject({ status: "In Progress" });
  });

  test("mints each repeating Work inside the mutation and never reuses a key", async () => {
    const db = requireDatabase();
    /** Test double of the shared key-allocation Work boundary (services wiring). */
    const minted: WorkAutomationWorkCreator = async (transaction, input) => {
      const number = input.project.workCount + 1;
      const key = `${input.project.shortCode}-${number}`;
      await transaction
        .update(project)
        .set({
          revision: input.project.revision + 1,
          updatedAt: input.committedAt,
          workCount: number,
        })
        .where(eq(project.id, input.project.id));
      await transaction.insert(workKeyAllocation).values({
        clientIdempotencyKey: input.idempotencyKey,
        id: crypto.randomUUID(),
        key,
        number,
        payloadFingerprint: input.payloadFingerprint,
        projectId: input.project.id,
        reservedAt: input.committedAt,
        shortCode: input.project.shortCode,
        workId: input.workId,
      });
      await transaction.insert(work).values({
        createdAt: input.committedAt,
        id: input.workId,
        key,
        number,
        projectId: input.project.id,
        revision: 1,
        status: "Not Started",
        statusChangedAt: input.committedAt,
        title: input.title,
        type: input.type,
        updatedAt: input.committedAt,
      });
    };
    const { access, engine } = createDatabaseWorkAutomation(db, {
      createWork: minted,
    });
    const rule = await access.create(accountId, {
      definition: {
        actions: [
          { kind: "create-work", title: "Weekly review", type: "Task" },
        ],
        conditions: [],
        trigger: { everyDays: 7, kind: "recurring-schedule" },
      },
      name: "Weekly review",
      projectId,
    });
    await access.setEnabled(accountId, {
      baseRevision: 1,
      enabled: true,
      ruleId: rule.id,
    });
    // The seeded Work sits at number 1; align the Project count before the rule runs.
    await db
      .update(project)
      .set({ workCount: 1 })
      .where(eq(project.id, projectId));
    const tick = (id: string) => ({
      id,
      kind: "recurring-schedule" as const,
      occurredAt: "2026-10-22T09:00:00.000Z",
      origin: "system" as const,
      projectId,
      ruleId: rule.id,
    });

    expect(await engine.handleEvent(tick("tick-1"))).toEqual(
      expect.objectContaining({ status: "applied" }),
    );
    const [projectRow] = await db
      .select()
      .from(project)
      .where(eq(project.id, projectId));
    const [created] = await db
      .select()
      .from(work)
      .where(and(eq(work.projectId, projectId), eq(work.number, 2)));
    expect(created).toMatchObject({
      projectId,
      revision: 1,
      title: "Weekly review",
      type: "Task",
    });
    expect(created?.key).toBe(`${projectRow?.shortCode}-2`);
    expect(projectRow).toMatchObject({ workCount: 2 });
    const [historyRow] = await db
      .select()
      .from(mutationHistory)
      .where(eq(mutationHistory.targetId, created?.id ?? ""));
    expect(historyRow).toMatchObject({
      actorType: "System automation",
      originKind: "source",
      revision: 1,
    });
    expect(historyRow?.previousValue).toEqual({ work: null });
    expect(
      (historyRow?.nextValue as { work?: { title?: string } } | undefined)?.work
        ?.title ?? null,
    ).toBe("Weekly review");

    const replay = await engine.handleEvent(tick("tick-1"));
    expect(replay.status).toBe("applied");
    expect(
      await db.select().from(work).where(eq(work.projectId, projectId)),
    ).toHaveLength(2);
    expect(
      await db
        .select()
        .from(workAutomationApplication)
        .where(eq(workAutomationApplication.projectId, projectId)),
    ).toHaveLength(1);

    await engine.handleEvent(tick("tick-2"));
    expect(
      await db.select().from(work).where(eq(work.projectId, projectId)),
    ).toHaveLength(3);
    expect(
      await db
        .select({ workCount: project.workCount })
        .from(project)
        .where(eq(project.id, projectId)),
    ).toEqual([{ workCount: 3 }]);
  });
});
