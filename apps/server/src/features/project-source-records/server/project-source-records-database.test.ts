import { createDb } from "@cantiara/db";
import { user, workspace } from "@cantiara/db/schema/auth";
import {
  mutationHistory,
  mutationReceipt,
  mutationStaging,
  mutationTarget,
} from "@cantiara/db/schema/mutation";
import { project } from "@cantiara/db/schema/project";
import { eq, inArray } from "drizzle-orm";
import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  test,
} from "vitest";
import { createDatabaseProjectSourceRecords } from "./project-source-records-database";

const databaseUrl = process.env.ACCOUNT_ACCESS_DATABASE_URL;
const describeDatabase = databaseUrl ? describe : describe.skip;

describeDatabase(
  "Project source record lifecycle PostgreSQL integration",
  () => {
    const database = databaseUrl
      ? createDb({ DATABASE_URL: databaseUrl })
      : undefined;
    const accountId = `project-source-records-${crypto.randomUUID()}`;
    const workspaceId = `workspace-${crypto.randomUUID()}`;
    const projectId = `project-${crypto.randomUUID()}`;
    const sourceIds = [
      `decision-${crypto.randomUUID()}`,
      `milestone-${crypto.randomUUID()}`,
      `abandoned-milestone-${crypto.randomUUID()}`,
      `release-${crypto.randomUUID()}`,
      `incident-${crypto.randomUUID()}`,
    ] as const;

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
      await database.insert(project).values({
        id: projectId,
        name: "Source Records",
        shortCode: `SR-${crypto.randomUUID().slice(0, 6).toUpperCase()}`,
        starterConfiguration: "Blank Project",
        workspaceId,
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
      await database
        .delete(mutationTarget)
        .where(inArray(mutationTarget.id, sourceIds));
      await database.delete(user).where(eq(user.id, accountId));
    });

    afterAll(async () => {
      await database?.$client.end();
    });

    test("records source creation and explicit lifecycle transitions in mutation history", async () => {
      if (!database) {
        throw new Error("ACCOUNT_ACCESS_DATABASE_URL is required");
      }
      const records = createDatabaseProjectSourceRecords(database);
      const [
        decisionId,
        milestoneId,
        abandonedMilestoneId,
        releaseId,
        incidentId,
      ] = sourceIds;
      const [
        decisionRecord,
        milestoneRecord,
        releaseRecord,
        incidentRecord,
        abandonedMilestone,
      ] = await Promise.all([
        records.create(accountId, {
          baseRevision: 0,
          clientIdempotencyKey: "decision-create",
          decision: "Ship a focused first release.",
          id: decisionId,
          projectId,
          rationale: "Keep the initial scope inspectable.",
          sourceType: "Decision",
          title: "First release scope",
        }),
        records.create(accountId, {
          baseRevision: 0,
          clientIdempotencyKey: "milestone-create",
          description: "A small invited beta.",
          id: milestoneId,
          projectId,
          sourceType: "Milestone",
          targetDate: "2026-10-01",
          title: "Private beta",
        }),
        records.create(accountId, {
          baseRevision: 0,
          clientIdempotencyKey: "release-create",
          description: null,
          id: releaseId,
          name: "First release",
          projectId,
          sourceType: "Project Release",
          versionLabel: "1.0.0",
        }),
        records.create(accountId, {
          baseRevision: 0,
          clientIdempotencyKey: "incident-create",
          detectedHow: "Support reports.",
          id: incidentId,
          impact: "Requests were delayed.",
          learning: null,
          occurredAt: "2026-09-27T10:00:00.000Z",
          projectId,
          resolution: null,
          rootCause: null,
          sourceType: "Production Incident",
          title: "Queue delay",
        }),
        records.create(accountId, {
          baseRevision: 0,
          clientIdempotencyKey: "milestone-abandon-create",
          description: null,
          id: abandonedMilestoneId,
          projectId,
          sourceType: "Milestone",
          targetDate: null,
          title: "Deferred launch",
        }),
      ]);

      expect(decisionRecord).toMatchObject({ life: "Valid", revision: 1 });
      expect(milestoneRecord).toMatchObject({ status: "Planned", revision: 1 });
      expect(releaseRecord).toMatchObject({ status: "Draft", revision: 1 });
      expect(incidentRecord).toMatchObject({ status: "Open", revision: 1 });
      expect(abandonedMilestone).toMatchObject({
        status: "Planned",
        revision: 1,
      });
      if (
        !(
          decisionRecord &&
          milestoneRecord &&
          releaseRecord &&
          incidentRecord &&
          abandonedMilestone
        )
      ) {
        throw new Error("Project source record creation failed");
      }

      const updatedDecision = await records.update(accountId, {
        baseRevision: decisionRecord.revision,
        clientIdempotencyKey: "decision-update",
        decision: "Ship a focused first release.",
        projectId,
        rationale: "The current scope is small enough to verify.",
        sourceId: decisionId,
        sourceType: "Decision",
        title: "First release scope clarified",
      });
      if (!updatedDecision) {
        throw new Error("Decision update failed");
      }
      await records.transition(accountId, {
        baseRevision: updatedDecision.revision,
        clientIdempotencyKey: "decision-withdraw",
        life: "Withdrawn",
        projectId,
        sourceId: decisionId,
        sourceType: "Decision",
      });
      await records.transition(accountId, {
        baseRevision: milestoneRecord.revision,
        clientIdempotencyKey: "milestone-reached",
        projectId,
        sourceId: milestoneId,
        sourceType: "Milestone",
        status: "Reached",
      });
      await records.transition(accountId, {
        baseRevision: abandonedMilestone.revision,
        clientIdempotencyKey: "milestone-abandon",
        projectId,
        sourceId: abandonedMilestoneId,
        sourceType: "Milestone",
        status: "Abandoned",
      });
      const preparingRelease = await records.transition(accountId, {
        baseRevision: releaseRecord.revision,
        clientIdempotencyKey: "release-preparing",
        projectId,
        sourceId: releaseId,
        sourceType: "Project Release",
        status: "Preparing",
      });
      if (!preparingRelease) {
        throw new Error("Project Release transition failed");
      }
      await records.transition(accountId, {
        baseRevision: preparingRelease.revision,
        clientIdempotencyKey: "release-published",
        projectId,
        sourceId: releaseId,
        sourceType: "Project Release",
        status: "Published",
      });
      const watchingIncident = await records.transition(accountId, {
        baseRevision: incidentRecord.revision,
        clientIdempotencyKey: "incident-watching",
        projectId,
        sourceId: incidentId,
        sourceType: "Production Incident",
        status: "Watching",
      });
      if (!watchingIncident) {
        throw new Error("Production Incident transition failed");
      }
      await records.transition(accountId, {
        baseRevision: watchingIncident.revision,
        clientIdempotencyKey: "incident-resolved",
        projectId,
        sourceId: incidentId,
        sourceType: "Production Incident",
        status: "Resolved",
      });

      const listed = await records.list(accountId, projectId);
      const history = await database
        .select()
        .from(mutationHistory)
        .where(eq(mutationHistory.actorId, accountId));
      expect(listed?.map(({ sourceType }) => sourceType).sort()).toEqual([
        "Decision",
        "Milestone",
        "Milestone",
        "Production Incident",
        "Project Release",
      ]);
      expect(
        history
          .filter(({ targetId }) => new Set<string>(sourceIds).has(targetId))
          .map(({ nextValue }) => nextValue),
      ).toHaveLength(13);
      await expect(
        records.find(accountId, "Project Release", releaseId),
      ).resolves.toMatchObject({ status: "Published", versionLabel: "1.0.0" });
      await expect(
        records.find(`${accountId}-other`, "Project Release", releaseId),
      ).resolves.toBeNull();
      await expect(
        records.list(`${accountId}-other`, projectId),
      ).resolves.toBeNull();
      await expect(
        records.transition(accountId, {
          baseRevision: 3,
          clientIdempotencyKey: "release-cancel-after-publish",
          projectId,
          sourceId: releaseId,
          sourceType: "Project Release",
          status: "Cancelled",
        }),
      ).rejects.toMatchObject({ code: "CONFLICT" });
    });
  },
);
