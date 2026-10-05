import type { PersonalReminderSourceType } from "@cantiara/api/personal-reminders";
import { createDb } from "@cantiara/db";
import { user, workspace } from "@cantiara/db/schema/auth";
import { decision } from "@cantiara/db/schema/decision";
import { document } from "@cantiara/db/schema/document";
import { productionIncident } from "@cantiara/db/schema/production-incident";
import { project } from "@cantiara/db/schema/project";
import { projectMilestone } from "@cantiara/db/schema/project-milestone";
import { projectRelease } from "@cantiara/db/schema/project-release";
import { risk } from "@cantiara/db/schema/risk";
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

  test("reminds on every owned permanent record without writing its life", async () => {
    const db = database;
    if (!db) {
      throw new Error("ACCOUNT_ACCESS_DATABASE_URL is required");
    }
    const sourceDatabase = db;

    const suffix = crypto.randomUUID().replaceAll("-", "").slice(0, 10);
    const documentId = `review-later-document-${suffix}`;
    const decisionId = `review-later-decision-${suffix}`;
    const riskId = `review-later-risk-${suffix}`;
    const milestoneId = `review-later-milestone-${suffix}`;
    const releaseId = `review-later-release-${suffix}`;
    const incidentId = `review-later-incident-${suffix}`;

    await database.insert(document).values({
      body: "Return to this Document.",
      id: documentId,
      projectId,
      title: "Reminder contract Document",
    });
    await database.insert(decision).values({
      decision: "Keep the current scope.",
      id: decisionId,
      projectId,
      title: "Current scope",
    });
    await database.insert(risk).values({
      id: riskId,
      projectId,
      title: "Scope risk",
    });
    await database.insert(projectMilestone).values({
      id: milestoneId,
      projectId,
      targetDate: "2026-10-20",
      title: "First milestone",
    });
    await database.insert(projectRelease).values({
      id: releaseId,
      name: "First release",
      projectId,
    });
    await database.insert(productionIncident).values({
      id: incidentId,
      occurredAt: now,
      projectId,
      title: "Queue delay",
    });

    const sources: Array<{
      sourceRecordId: string;
      sourceRecordType: PersonalReminderSourceType;
    }> = [
      { sourceRecordId: projectId, sourceRecordType: "Project" },
      { sourceRecordId: documentId, sourceRecordType: "Document" },
      { sourceRecordId: workId, sourceRecordType: "Work" },
      { sourceRecordId: decisionId, sourceRecordType: "Decision" },
      { sourceRecordId: riskId, sourceRecordType: "Risk" },
      { sourceRecordId: milestoneId, sourceRecordType: "Milestone" },
      { sourceRecordId: releaseId, sourceRecordType: "Project Release" },
      {
        sourceRecordId: incidentId,
        sourceRecordType: "Production Incident",
      },
    ];

    async function sourceLife() {
      const [
        projects,
        documents,
        works,
        decisions,
        risks,
        milestones,
        releases,
        incidents,
      ] = await Promise.all([
        sourceDatabase
          .select({
            archivedAt: project.archivedAt,
            status: project.status,
            targetDate: project.targetDate,
            updatedAt: project.updatedAt,
          })
          .from(project)
          .where(eq(project.id, projectId)),
        sourceDatabase
          .select({
            archivedAt: document.archivedAt,
            projectId: document.projectId,
            revision: document.revision,
            title: document.title,
            updatedAt: document.updatedAt,
          })
          .from(document)
          .where(eq(document.id, documentId)),
        sourceDatabase
          .select({
            archivedAt: work.archivedAt,
            closureResult: work.closureResult,
            plannedStartDate: work.plannedStartDate,
            reappearDate: work.reappearDate,
            roadmapHorizon: work.roadmapHorizon,
            status: work.status,
            targetDate: work.targetDate,
            trashedAt: work.trashedAt,
            updatedAt: work.updatedAt,
          })
          .from(work)
          .where(eq(work.id, workId)),
        sourceDatabase
          .select({
            life: decision.life,
            revision: decision.revision,
            title: decision.title,
            updatedAt: decision.updatedAt,
          })
          .from(decision)
          .where(eq(decision.id, decisionId)),
        sourceDatabase
          .select({
            life: risk.life,
            revision: risk.revision,
            title: risk.title,
            updatedAt: risk.updatedAt,
          })
          .from(risk)
          .where(eq(risk.id, riskId)),
        sourceDatabase
          .select({
            status: projectMilestone.status,
            targetDate: projectMilestone.targetDate,
            title: projectMilestone.title,
            updatedAt: projectMilestone.updatedAt,
          })
          .from(projectMilestone)
          .where(eq(projectMilestone.id, milestoneId)),
        sourceDatabase
          .select({
            name: projectRelease.name,
            status: projectRelease.status,
            updatedAt: projectRelease.updatedAt,
            versionLabel: projectRelease.versionLabel,
          })
          .from(projectRelease)
          .where(eq(projectRelease.id, releaseId)),
        sourceDatabase
          .select({
            occurredAt: productionIncident.occurredAt,
            status: productionIncident.status,
            title: productionIncident.title,
            updatedAt: productionIncident.updatedAt,
          })
          .from(productionIncident)
          .where(eq(productionIncident.id, incidentId)),
      ]);

      return {
        decisions,
        documents,
        incidents,
        milestones,
        projects,
        releases,
        risks,
        works,
      };
    }

    const before = await sourceLife();
    const reminders = createDatabasePersonalReminders(database, {
      newId: () => `contract-reminder-all-${crypto.randomUUID()}`,
      now: () => now,
    });

    await Promise.all(
      sources.map(async (source) => {
        const key = source.sourceRecordType.toLowerCase().replaceAll(" ", "-");
        const input = {
          action: "Remind me" as const,
          clientIdempotencyKey: `reminder-all-${key}-${suffix}`,
          fireAt: "2026-09-28T11:00:00.000Z",
          ...source,
        };
        const created = await reminders.create(accountId, input);
        expect(created).toMatchObject({
          action: "Remind me",
          sourceProjectId: projectId,
          sourceRecordId: source.sourceRecordId,
          sourceRecordType: source.sourceRecordType,
          status: "Planned",
        });
        if (!created) {
          throw new Error(
            `Expected ${source.sourceRecordType} reminder to be created.`,
          );
        }

        await expect(reminders.list(accountId, source)).resolves.toMatchObject([
          { id: created.id, status: "Planned" },
        ]);
        await expect(
          reminders.create("another-account", input),
        ).resolves.toBeNull();
        await expect(
          reminders.list("another-account", source),
        ).resolves.toBeNull();
        await expect(
          reminders.cancel("another-account", created.id),
        ).resolves.toBeNull();
        await expect(
          reminders.cancel(accountId, created.id),
        ).resolves.toMatchObject({
          action: "Remind me",
          status: "Cancelled",
        });
      }),
    );

    await expect(sourceLife()).resolves.toEqual(before);
  });

  test("rejects conditional reminders outside the closed seam contract", async () => {
    if (!database) {
      throw new Error("ACCOUNT_ACCESS_DATABASE_URL is required");
    }
    const reminders = createDatabasePersonalReminders(database, {
      newId: () => `contract-reminder-guard-${crypto.randomUUID()}`,
      now: () => now,
    });
    const baseInput = {
      clientIdempotencyKey: `reminder-guard-${crypto.randomUUID()}`,
      fireAt: "2026-09-28T11:00:00.000Z",
    };

    await expect(
      reminders.create(accountId, {
        ...baseInput,
        action: "Remind me",
        condition: "Only if still open",
        sourceRecordId: workId,
        sourceRecordType: "Work",
      }),
    ).rejects.toThrow("Only Review Later can be conditional.");
    await expect(
      reminders.create(accountId, {
        ...baseInput,
        action: "Review Later",
        condition: "Only if still open",
        sourceRecordId: projectId,
        sourceRecordType: "Document",
      }),
    ).rejects.toThrow("This source has no open and resolved life condition.");
  });

  test("targets a stable Document section through rename and rejects missing ids", async () => {
    if (!database) {
      throw new Error("ACCOUNT_ACCESS_DATABASE_URL is required");
    }
    const documentId = `review-later-section-document/${crypto.randomUUID()}:source`;
    await database.insert(document).values({
      body: [
        "## Release readiness {#release-gate}",
        "",
        "Confirm the launch.",
        "",
        "## Rollout notes {#rollout-notes}",
        "",
        "Capture the launch window.",
      ].join("\n"),
      id: documentId,
      projectId,
      title: "Release notes",
    });
    const reminders = createDatabasePersonalReminders(database, {
      newId: () => "contract-reminder-section",
      now: () => now,
    });
    const input = {
      action: "Review Later" as const,
      clientIdempotencyKey: "review-later-document-section-1",
      fireAt: "2026-09-28T11:00:00.000Z",
      sectionId: "release-gate",
      sourceRecordId: documentId,
      sourceRecordType: "Document" as const,
    };

    const created = await reminders.create(accountId, input);
    expect(created).toMatchObject({ sectionId: "release-gate" });
    if (!created) {
      throw new Error("Expected the Document section reminder to be created.");
    }
    await expect(
      reminders.create(accountId, { ...input, sectionId: "other-section" }),
    ).rejects.toThrow("already used for different input");
    await expect(
      reminders.create(accountId, {
        ...input,
        clientIdempotencyKey: "review-later-document-section-missing",
        sectionId: "missing-section",
      }),
    ).resolves.toBeNull();

    await database
      .update(document)
      .set({
        body: [
          "## Rollout notes {#rollout-notes}",
          "",
          "Capture the launch window.",
          "",
          "## Launch checklist {#release-gate}",
          "",
          "Confirm the launch.",
        ].join("\n"),
      })
      .where(eq(document.id, documentId));
    const fired = await reminders.fireDuePersonalReminders(
      new Date("2026-09-28T11:00:00.000Z"),
    );
    expect(fired.signals).toContainEqual(
      expect.objectContaining({
        signalType: "review-later",
        sourcePath: `/projects/${encodeURIComponent(projectId)}#document-section:${encodeURIComponent(documentId)}:release-gate`,
      }),
    );
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
