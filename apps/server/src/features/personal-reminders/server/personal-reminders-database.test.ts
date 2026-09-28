import { createDb } from "@cantiara/db";
import { user, workspace } from "@cantiara/db/schema/auth";
import { project } from "@cantiara/db/schema/project";
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
import { createDatabasePersonalReminders } from "./personal-reminders-database";

const databaseUrl = process.env.ACCOUNT_ACCESS_DATABASE_URL;
const describeDatabase = databaseUrl ? describe : describe.skip;

describeDatabase("Personal Reminders Work Review Later contract", () => {
  const database = databaseUrl
    ? createDb({ DATABASE_URL: databaseUrl })
    : undefined;
  const now = new Date("2026-09-28T10:00:00.000Z");
  let accountId = "";
  let workspaceId = "";
  let projectId = "";
  let workId = "";

  beforeEach(async () => {
    if (!database) {
      throw new Error("ACCOUNT_ACCESS_DATABASE_URL is required");
    }
    const suffix = crypto.randomUUID().replaceAll("-", "").slice(0, 10);
    accountId = `review-later-account-${suffix}`;
    workspaceId = `review-later-workspace-${suffix}`;
    projectId = `review-later-project-${suffix}`;
    workId = `review-later-work-${suffix}`;
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
      name: "Review Later Project",
      shortCode: `RL${suffix.slice(0, 5).toUpperCase()}`,
      starterConfiguration: "Blank Project",
      workspaceId,
    });
    await database.insert(work).values({
      id: workId,
      key: `RL-${suffix.toUpperCase()}`,
      number: 1,
      projectId,
      targetDate: "2026-10-15",
      title: "Return to this Work",
      type: "Task",
    });
  });

  afterEach(async () => {
    if (database && accountId) {
      await database.delete(user).where(eq(user.id, accountId));
    }
  });

  afterAll(async () => {
    await database?.$client.end();
  });

  test("creates, lists, cancels, and safely retries a Review Later request", async () => {
    if (!database) {
      throw new Error("ACCOUNT_ACCESS_DATABASE_URL is required");
    }
    const reminders = createDatabasePersonalReminders(database, {
      newId: () => "contract-reminder-1",
      now: () => now,
    });
    const input = {
      clientIdempotencyKey: "review-later-create-1",
      condition: "In any case" as const,
      fireAt: "2026-09-28T11:00:00.000Z",
      workId,
    };

    const created = await reminders.createWorkReviewLater(accountId, input);
    expect(created).toMatchObject({
      action: "Review Later",
      condition: "In any case",
      fireAt: input.fireAt,
      sourceProjectId: projectId,
      sourceRecordId: workId,
      sourceRecordType: "Work",
      status: "Planned",
    });
    await expect(
      reminders.createWorkReviewLater(accountId, input),
    ).resolves.toEqual(created);
    await expect(
      reminders.createWorkReviewLater(accountId, {
        ...input,
        fireAt: "2026-09-28T12:00:00.000Z",
      }),
    ).rejects.toMatchObject({ code: "WORK_REVIEW_LATER_IDEMPOTENCY_CONFLICT" });
    await expect(
      reminders.listWorkReviewLater(accountId, workId),
    ).resolves.toEqual([created]);

    const cancelled = await reminders.cancelWorkReviewLater(
      accountId,
      created?.id ?? "",
    );
    expect(cancelled).toMatchObject({ status: "Cancelled" });
    await expect(
      reminders.cancelWorkReviewLater(accountId, created?.id ?? ""),
    ).resolves.toEqual(cancelled);
  });

  test("fires exactly one source-linked signal without changing Work planning", async () => {
    if (!database) {
      throw new Error("ACCOUNT_ACCESS_DATABASE_URL is required");
    }
    let reminderNumber = 0;
    const reminders = createDatabasePersonalReminders(database, {
      newId: () => {
        reminderNumber += 1;
        return `contract-reminder-fire-${reminderNumber}`;
      },
      now: () => now,
    });
    const created = await reminders.createWorkReviewLater(accountId, {
      clientIdempotencyKey: "review-later-fire-1",
      condition: "In any case",
      fireAt: "2026-09-28T11:00:00.000Z",
      workId,
    });
    if (!created) {
      throw new Error("Expected Review Later to be created.");
    }
    const second = await reminders.createWorkReviewLater(accountId, {
      clientIdempotencyKey: "review-later-fire-2",
      condition: "In any case",
      fireAt: "2026-09-28T11:00:00.000Z",
      workId,
    });
    if (!second) {
      throw new Error("Expected the second Review Later to be created.");
    }

    await expect(
      reminders.fireDueWorkReviewLater(new Date("2026-09-28T10:59:00.000Z")),
    ).resolves.toEqual({ processedCount: 0, signals: [] });
    const fired = await reminders.fireDueWorkReviewLater(
      new Date("2026-09-28T11:00:00.000Z"),
    );
    expect(fired.processedCount).toBe(2);
    expect(fired.signals).toEqual(
      expect.arrayContaining([
        {
          evaluationNote: null,
          occurredAt: "2026-09-28T11:00:00.000Z",
          signalId: `review-later:${created.id}`,
          signalType: "review-later",
          sourcePath: `/projects/${projectId}#work-${workId}`,
          sourceProjectId: projectId,
          sourceRecordId: workId,
          sourceRecordType: "Work",
        },
        {
          evaluationNote: null,
          occurredAt: "2026-09-28T11:00:00.000Z",
          signalId: `review-later:${second.id}`,
          signalType: "review-later",
          sourcePath: `/projects/${projectId}#work-${workId}`,
          sourceProjectId: projectId,
          sourceRecordId: workId,
          sourceRecordType: "Work",
        },
      ]),
    );
    await expect(
      reminders.fireDueWorkReviewLater(new Date("2026-09-28T11:01:00.000Z")),
    ).resolves.toEqual({ processedCount: 0, signals: [] });
    await expect(
      reminders.listWorkReviewLater(accountId, workId),
    ).resolves.toMatchObject([
      { status: "Triggered", fireNote: null },
      { status: "Triggered", fireNote: null },
    ]);

    const [source] = await database
      .select({
        reappearDate: work.reappearDate,
        roadmapHorizon: work.roadmapHorizon,
        status: work.status,
        targetDate: work.targetDate,
      })
      .from(work)
      .where(eq(work.id, workId));
    expect(source).toEqual({
      reappearDate: null,
      roadmapHorizon: null,
      status: "Not Started",
      targetDate: "2026-10-15",
    });
  });

  test("suppresses Only if still open when Work is closed and explains why", async () => {
    if (!database) {
      throw new Error("ACCOUNT_ACCESS_DATABASE_URL is required");
    }
    const reminders = createDatabasePersonalReminders(database, {
      newId: () => "contract-reminder-closed",
      now: () => now,
    });
    const created = await reminders.createWorkReviewLater(accountId, {
      clientIdempotencyKey: "review-later-closed-1",
      condition: "Only if still open",
      fireAt: "2026-09-28T11:00:00.000Z",
      workId,
    });
    if (!created) {
      throw new Error("Expected Review Later to be created.");
    }
    await database
      .update(work)
      .set({ closureResult: "Completed", status: "Closed" })
      .where(eq(work.id, workId));

    await expect(
      reminders.fireDueWorkReviewLater(new Date("2026-09-28T11:00:00.000Z")),
    ).resolves.toEqual({ processedCount: 1, signals: [] });
    await expect(
      reminders.listWorkReviewLater(accountId, workId),
    ).resolves.toMatchObject([
      {
        fireNote: "Work was Closed; no signal was emitted.",
        status: "Triggered",
      },
    ]);
  });

  test("does not fire reminders toward an archived Project", async () => {
    if (!database) {
      throw new Error("ACCOUNT_ACCESS_DATABASE_URL is required");
    }
    const reminders = createDatabasePersonalReminders(database, {
      newId: () => "contract-reminder-archived-project",
      now: () => now,
    });
    const created = await reminders.createWorkReviewLater(accountId, {
      clientIdempotencyKey: "review-later-archived-project-1",
      condition: "In any case",
      fireAt: "2026-09-28T11:00:00.000Z",
      workId,
    });
    if (!created) {
      throw new Error("Expected Review Later to be created.");
    }
    await database
      .update(project)
      .set({ archivedAt: new Date("2026-09-28T10:30:00.000Z") })
      .where(eq(project.id, projectId));

    await expect(
      reminders.fireDueWorkReviewLater(new Date("2026-09-28T11:00:00.000Z")),
    ).resolves.toEqual({ processedCount: 1, signals: [] });
    await expect(
      reminders.listWorkReviewLater(accountId, workId),
    ).resolves.toMatchObject([
      {
        fireNote: "Project is archived; no signal was emitted.",
        status: "Triggered",
      },
    ]);
  });

  test("emits a source-linked signal when Work life cannot be evaluated", async () => {
    if (!database) {
      throw new Error("ACCOUNT_ACCESS_DATABASE_URL is required");
    }
    const reminders = createDatabasePersonalReminders(database, {
      newId: () => "contract-reminder-unavailable-source",
      now: () => now,
    });
    const created = await reminders.createWorkReviewLater(accountId, {
      clientIdempotencyKey: "review-later-unavailable-source-1",
      condition: "Only if still open",
      fireAt: "2026-09-28T11:00:00.000Z",
      workId,
    });
    if (!created) {
      throw new Error("Expected Review Later to be created.");
    }
    await database.delete(work).where(eq(work.id, workId));

    await expect(
      reminders.fireDueWorkReviewLater(new Date("2026-09-28T11:00:00.000Z")),
    ).resolves.toEqual({
      processedCount: 1,
      signals: [
        {
          evaluationNote:
            "Work is unavailable; the condition could not be evaluated.",
          occurredAt: "2026-09-28T11:00:00.000Z",
          signalId: `review-later:${created.id}`,
          signalType: "review-later",
          sourcePath: `/projects/${projectId}#work-${workId}`,
          sourceProjectId: projectId,
          sourceRecordId: workId,
          sourceRecordType: "Work",
        },
      ],
    });
  });
});
