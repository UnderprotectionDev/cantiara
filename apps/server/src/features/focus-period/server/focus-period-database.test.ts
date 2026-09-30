import { createDb } from "@cantiara/db";
import { user, workspace } from "@cantiara/db/schema/auth";
import { projectBacklogOrder } from "@cantiara/db/schema/backlog";
import { focusPeriod } from "@cantiara/db/schema/focus-period";
import { project } from "@cantiara/db/schema/project";
import { workRelation } from "@cantiara/db/schema/relation";
import { work } from "@cantiara/db/schema/work";
import { eq, inArray, sql } from "drizzle-orm";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
} from "vitest";
import { createBacklogAccess } from "../../backlog/server/backlog";
import { createDatabaseBacklog } from "../../backlog/server/backlog-database";
import { createDatabaseFocusPeriod } from "./focus-period-database";

const databaseUrl = process.env.ACCOUNT_ACCESS_DATABASE_URL;
const describeDatabase = databaseUrl ? describe : describe.skip;

describeDatabase("Focus Period working window", () => {
  const database = databaseUrl
    ? createDb({ DATABASE_URL: databaseUrl })
    : undefined;
  const accountId = `focus-account-${crypto.randomUUID()}`;
  const workspaceId = `focus-workspace-${crypto.randomUUID()}`;
  const firstProjectId = `focus-project-${crypto.randomUUID()}`;
  const secondProjectId = `focus-project-${crypto.randomUUID()}`;
  const firstWorkId = `focus-work-${crypto.randomUUID()}`;
  const secondWorkId = `focus-work-${crypto.randomUUID()}`;
  const thirdWorkId = `focus-work-${crypto.randomUUID()}`;
  const followUpWorkId = `focus-work-${crypto.randomUUID()}`;
  let clock = new Date("2026-10-01T10:00:00.000Z");

  beforeAll(async () => {
    if (!database) {
      throw new Error("ACCOUNT_ACCESS_DATABASE_URL is required");
    }
    await database.insert(user).values({
      id: accountId,
      email: `${accountId}@example.invalid`,
      name: "Founder",
    });
    await database
      .insert(workspace)
      .values({ id: workspaceId, ownerAccountId: accountId });
    await database.insert(project).values([
      {
        id: firstProjectId,
        workspaceId,
        name: "Alpha",
        shortCode: "ALPHA",
        starterConfiguration: "Blank Project",
        status: "Pending",
        configuration: {
          preparedStages: [
            { id: "stage-1", name: "Discovery", status: "Active" },
          ],
        },
      },
      {
        id: secondProjectId,
        workspaceId,
        name: "Beta",
        shortCode: "BETA",
        starterConfiguration: "Blank Project",
        status: "Active",
      },
    ]);
    await database.insert(work).values([
      {
        id: firstWorkId,
        projectId: firstProjectId,
        key: "ALPHA-1",
        number: 1,
        title: "First Work",
        type: "Task",
        status: "Blocked",
      },
      {
        id: secondWorkId,
        projectId: secondProjectId,
        key: "BETA-1",
        number: 1,
        title: "Second Work",
        type: "Task",
        status: "In Progress",
      },
      {
        id: thirdWorkId,
        projectId: firstProjectId,
        key: "ALPHA-2",
        number: 2,
        title: "Third Work",
        type: "Task",
        status: "In Progress",
      },
      {
        id: followUpWorkId,
        projectId: secondProjectId,
        key: "BETA-2",
        number: 2,
        title: "Follow-up Work",
        type: "Task",
        status: "Not Started",
      },
    ]);
  });

  afterAll(async () => {
    await database?.delete(user).where(eq(user.id, accountId));
    await database?.$client.end();
  });

  beforeEach(async () => {
    if (!database) {
      throw new Error("ACCOUNT_ACCESS_DATABASE_URL is required");
    }
    const fixtureWorkIds = [
      firstWorkId,
      secondWorkId,
      thirdWorkId,
      followUpWorkId,
    ];
    await database
      .delete(focusPeriod)
      .where(eq(focusPeriod.workspaceId, workspaceId));
    await database
      .delete(workRelation)
      .where(inArray(workRelation.sourceWorkId, fixtureWorkIds));
    await database.execute(sql`
      update work
      set status = case id
          when ${firstWorkId} then 'Blocked'
          when ${secondWorkId} then 'In Progress'
          when ${thirdWorkId} then 'In Progress'
          else 'Not Started'
        end,
        title = case id
          when ${firstWorkId} then 'First Work'
          when ${secondWorkId} then 'Second Work'
          when ${thirdWorkId} then 'Third Work'
          else 'Follow-up Work'
        end,
        closure_result = null,
      closure_reason = null,
      archived_at = null,
      trashed_at = null
      where id in (${sql.join(
        fixtureWorkIds.map((id) => sql`${id}`),
        sql`, `,
      )})
    `);
  }, 30_000);

  test("keeps Work status and Project stage while membership crosses Projects", async () => {
    if (!database) {
      throw new Error("ACCOUNT_ACCESS_DATABASE_URL is required");
    }
    const periods = createDatabaseFocusPeriod(database, () => clock);
    const period = await periods.create(accountId, {
      purpose: "Finish beta",
      startDate: "2026-10-05",
      endDate: "2026-10-11",
    });
    expect(period.status).toBe("Planned");
    await periods.add(accountId, period.id, firstWorkId);
    await periods.add(accountId, period.id, secondWorkId);
    expect(
      (await periods.find(accountId, period.id))?.members.map(
        (item) => item.key,
      ),
    ).toEqual(["ALPHA-1", "BETA-1"]);
    expect(
      (
        await database
          .select({ status: work.status })
          .from(work)
          .where(eq(work.id, firstWorkId))
      )[0]?.status,
    ).toBe("Blocked");
    expect(
      (
        await database
          .select({ status: project.status })
          .from(project)
          .where(eq(project.id, firstProjectId))
      )[0]?.status,
    ).toBe("Pending");
    expect(
      (
        await database
          .select({ configuration: project.configuration })
          .from(project)
          .where(eq(project.id, firstProjectId))
      )[0]?.configuration,
    ).toEqual({
      preparedStages: [{ id: "stage-1", name: "Discovery", status: "Active" }],
    });
    await periods.remove(accountId, period.id, secondWorkId);
    expect(
      (
        await database
          .select({ status: work.status })
          .from(work)
          .where(eq(work.id, secondWorkId))
      )[0]?.status,
    ).toBe("In Progress");

    clock = new Date("2026-10-05T00:00:00.000Z");
    const active = await periods.find(accountId, period.id);
    expect(active?.status).toBe("Active");
    expect(active?.startSnapshot?.map((item) => item.key)).toEqual(["ALPHA-1"]);
    await periods.add(accountId, period.id, secondWorkId);
    await periods.close(accountId, period.id);
    const closed = await periods.find(accountId, period.id);
    expect(closed?.status).toBe("Closed");
    expect(closed?.closeSnapshot?.map((item) => item.key)).toEqual([
      "ALPHA-1",
      "BETA-1",
    ]);
    expect(closed?.startSnapshot?.map((item) => item.key)).toEqual(["ALPHA-1"]);
    expect(
      (
        await database
          .select({ status: work.status })
          .from(work)
          .where(eq(work.id, firstWorkId))
      )[0]?.status,
    ).toBe("Blocked");
    expect(
      (
        await database
          .select({ status: project.status })
          .from(project)
          .where(eq(project.id, firstProjectId))
      )[0]?.status,
    ).toBe("Pending");
    expect(
      (
        await database
          .select({ configuration: project.configuration })
          .from(project)
          .where(eq(project.id, firstProjectId))
      )[0]?.configuration,
    ).toEqual({
      preparedStages: [{ id: "stage-1", name: "Discovery", status: "Active" }],
    });
  }, 30_000);

  test("cancel leaves historical membership without a close snapshot or Work transition", async () => {
    if (!database) {
      throw new Error("ACCOUNT_ACCESS_DATABASE_URL is required");
    }
    clock = new Date("2026-10-12T12:00:00.000Z");
    const periods = createDatabaseFocusPeriod(database, () => clock);
    const period = await periods.create(accountId, {
      purpose: "Explore release",
      startDate: "2026-10-12",
      endDate: "2026-10-18",
    });
    await periods.add(accountId, period.id, firstWorkId);
    await periods.cancel(accountId, period.id);
    const canceled = await periods.find(accountId, period.id);
    expect(canceled?.status).toBe("Canceled");
    expect(canceled?.members.map((item) => item.key)).toEqual(["ALPHA-1"]);
    expect(canceled?.startSnapshot).toEqual([]);
    expect(canceled?.closeSnapshot).toBeNull();
    expect(
      (
        await database
          .select({ status: work.status })
          .from(work)
          .where(eq(work.id, firstWorkId))
      )[0]?.status,
    ).toBe("Blocked");
  }, 30_000);

  test("rejects overlapping planned membership before it can block activation", async () => {
    if (!database) {
      throw new Error("ACCOUNT_ACCESS_DATABASE_URL is required");
    }
    clock = new Date("2026-10-20T12:00:00.000Z");
    const periods = createDatabaseFocusPeriod(database, () => clock);
    const first = await periods.create(accountId, {
      purpose: "First window",
      startDate: "2026-10-26",
      endDate: "2026-11-01",
    });
    const second = await periods.create(accountId, {
      purpose: "Overlapping window",
      startDate: "2026-10-30",
      endDate: "2026-11-05",
    });
    await periods.add(accountId, first.id, firstWorkId);
    await expect(
      periods.add(accountId, second.id, firstWorkId),
    ).rejects.toThrow("Work is already in another Focus Period.");
    clock = new Date("2026-10-30T12:00:00.000Z");
    expect((await periods.find(accountId, first.id))?.status).toBe("Active");
    expect((await periods.find(accountId, second.id))?.status).toBe("Active");
    await periods.cancel(accountId, first.id);
    await periods.cancel(accountId, second.id);
  }, 30_000);

  test("requires an explicit move between Active Focus Periods and preserves source history", async () => {
    if (!database) {
      throw new Error("ACCOUNT_ACCESS_DATABASE_URL is required");
    }
    clock = new Date("2026-10-20T12:00:00.000Z");
    const periods = createDatabaseFocusPeriod(database, () => clock);
    const source = await periods.create(accountId, {
      purpose: "Current window",
      startDate: "2026-10-21",
      endDate: "2026-10-27",
    });
    await periods.add(accountId, source.id, firstWorkId);

    clock = new Date("2026-10-21T12:00:00.000Z");
    expect(
      (await periods.find(accountId, source.id))?.startSnapshot?.map(
        (item) => item.id,
      ),
    ).toEqual([firstWorkId]);
    const target = await periods.create(accountId, {
      purpose: "New window",
      startDate: "2026-10-21",
      endDate: "2026-10-27",
    });
    expect(target.status).toBe("Active");

    await expect(
      periods.add(accountId, target.id, firstWorkId),
    ).rejects.toThrow("Work is already in an active Focus Period. Use Move.");
    expect((await periods.find(accountId, target.id))?.members).toEqual([]);

    await periods.move(accountId, target.id, firstWorkId);
    expect((await periods.find(accountId, source.id))?.members).toEqual([]);
    expect(
      (await periods.find(accountId, target.id))?.members.map(
        (item) => item.id,
      ),
    ).toEqual([firstWorkId]);
    expect(
      (await periods.find(accountId, source.id))?.startSnapshot?.map(
        (item) => item.id,
      ),
    ).toEqual([firstWorkId]);
    expect((await periods.find(accountId, target.id))?.startSnapshot).toEqual(
      [],
    );

    await periods.close(accountId, source.id);
    const closedSource = await periods.find(accountId, source.id);
    expect(closedSource?.closeSnapshot).toEqual([]);
    expect(closedSource?.closeComparison).toMatchObject({
      inStartSnapshot: [{ id: firstWorkId }],
      removed: [{ id: firstWorkId }],
    });
    expect(
      (await periods.find(accountId, target.id))?.members.map(
        (item) => item.id,
      ),
    ).toEqual([firstWorkId]);
  }, 30_000);

  test("allows Work in a new Active Focus Period after its prior period is Closed", async () => {
    if (!database) {
      throw new Error("ACCOUNT_ACCESS_DATABASE_URL is required");
    }
    clock = new Date("2026-11-10T12:00:00.000Z");
    const periods = createDatabaseFocusPeriod(database, () => clock);
    const closed = await periods.create(accountId, {
      purpose: "Completed window",
      startDate: "2026-11-10",
      endDate: "2026-11-16",
    });
    await periods.add(accountId, closed.id, firstWorkId);
    await periods.close(accountId, closed.id);

    const active = await periods.create(accountId, {
      purpose: "Current window",
      startDate: "2026-11-10",
      endDate: "2026-11-16",
    });
    await periods.add(accountId, active.id, firstWorkId);

    expect(
      (await periods.find(accountId, closed.id))?.closeSnapshot?.map(
        (item) => item.id,
      ),
    ).toEqual([firstWorkId]);
    expect(
      (await periods.find(accountId, active.id))?.members.map(
        (item) => item.id,
      ),
    ).toEqual([firstWorkId]);
  }, 30_000);

  test("keeps removed Work in the comparison from the historical snapshot", async () => {
    if (!database) {
      throw new Error("ACCOUNT_ACCESS_DATABASE_URL is required");
    }
    clock = new Date("2027-05-01T12:00:00.000Z");
    const periods = createDatabaseFocusPeriod(database, () => clock);
    const period = await periods.create(accountId, {
      purpose: "Historical comparison",
      startDate: "2027-05-02",
      endDate: "2027-05-08",
    });
    await periods.add(accountId, period.id, secondWorkId);
    clock = new Date("2027-05-02T12:00:00.000Z");
    expect((await periods.find(accountId, period.id))?.status).toBe("Active");
    await periods.remove(accountId, period.id, secondWorkId);
    await database
      .update(work)
      .set({ status: "Closed", closureResult: "Completed", title: "Changed" })
      .where(eq(work.id, secondWorkId));
    await periods.close(accountId, period.id);

    const closed = await periods.find(accountId, period.id);
    expect(closed?.closeSnapshot).toEqual([]);
    expect(closed?.closeComparison?.removed).toEqual([
      expect.objectContaining({
        id: secondWorkId,
        status: "In Progress",
        title: "Second Work",
      }),
    ]);
  }, 30_000);

  test("keeps added-later and removed Work stable without exposing close metadata", async () => {
    if (!database) {
      throw new Error("ACCOUNT_ACCESS_DATABASE_URL is required");
    }
    clock = new Date("2027-10-01T12:00:00.000Z");
    const periods = createDatabaseFocusPeriod(database, () => clock);
    const period = await periods.create(accountId, {
      purpose: "Transient comparison",
      startDate: "2027-10-02",
      endDate: "2027-10-08",
    });
    clock = new Date("2027-10-02T12:00:00.000Z");
    expect((await periods.find(accountId, period.id))?.status).toBe("Active");
    clock = new Date("2027-10-02T12:01:00.000Z");
    await periods.add(accountId, period.id, secondWorkId);
    await periods.remove(accountId, period.id, secondWorkId);
    await periods.close(accountId, period.id);

    await database
      .update(work)
      .set({
        status: "Closed",
        closureResult: "Completed",
        title: "Changed after close",
      })
      .where(eq(work.id, secondWorkId));

    const closed = await periods.find(accountId, period.id);
    expect(closed?.closeSnapshot).toEqual([]);
    expect(closed?.leftoverDecisions).toEqual([]);
    expect(closed?.closeComparison).toMatchObject({
      addedLater: [
        expect.objectContaining({
          id: secondWorkId,
          status: "In Progress",
          title: "Second Work",
        }),
      ],
      completed: [],
      removed: [
        expect.objectContaining({
          id: secondWorkId,
          status: "In Progress",
          title: "Second Work",
        }),
      ],
      stillOpen: [],
    });
  }, 30_000);

  test("includes Work added and removed at the activation timestamp in the closing comparison", async () => {
    if (!database) {
      throw new Error("ACCOUNT_ACCESS_DATABASE_URL is required");
    }
    clock = new Date("2027-10-09T12:00:00.000Z");
    const periods = createDatabaseFocusPeriod(database, () => clock);
    const period = await periods.create(accountId, {
      purpose: "Boundary comparison",
      startDate: "2027-10-10",
      endDate: "2027-10-16",
    });

    clock = new Date("2027-10-10T12:00:00.000Z");
    expect((await periods.find(accountId, period.id))?.status).toBe("Active");
    await periods.add(accountId, period.id, secondWorkId);
    await periods.remove(accountId, period.id, secondWorkId);
    await periods.close(accountId, period.id);

    await database
      .update(work)
      .set({
        status: "Closed",
        closureResult: "Completed",
        title: "Changed after close",
      })
      .where(eq(work.id, secondWorkId));

    const closed = await periods.find(accountId, period.id);
    const historicalWork = expect.objectContaining({
      id: secondWorkId,
      status: "In Progress",
      title: "Second Work",
    });
    expect(closed?.closeSnapshot).toEqual([]);
    expect(closed?.closeComparison?.addedLater).toEqual([historicalWork]);
    expect(closed?.closeComparison?.removed).toEqual([historicalWork]);
  }, 30_000);

  test("keeps a conflicting due period Planned and allows recovery operations", async () => {
    if (!database) {
      throw new Error("ACCOUNT_ACCESS_DATABASE_URL is required");
    }
    clock = new Date("2027-02-01T12:00:00.000Z");
    const periods = createDatabaseFocusPeriod(database, () => clock);
    const current = await periods.create(accountId, {
      purpose: "Current window",
      startDate: "2027-02-01",
      endDate: "2027-02-07",
    });
    const next = await periods.create(accountId, {
      purpose: "Next window",
      startDate: "2027-02-08",
      endDate: "2027-02-14",
    });
    await periods.add(accountId, current.id, firstWorkId);
    await periods.add(accountId, next.id, firstWorkId);

    clock = new Date("2027-02-08T12:00:00.000Z");
    await expect(periods.list(accountId)).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: next.id, status: "Planned" }),
      ]),
    );
    await expect(
      periods.remove(accountId, current.id, firstWorkId),
    ).resolves.toBeUndefined();
    expect((await periods.find(accountId, next.id))?.status).toBe("Active");
    await periods.cancel(accountId, next.id);
  }, 30_000);

  test("compares close scope, stores optional learning, and links confirmed follow-up Work", async () => {
    if (!database) {
      throw new Error("ACCOUNT_ACCESS_DATABASE_URL is required");
    }
    clock = new Date("2027-03-01T12:00:00.000Z");
    const periods = createDatabaseFocusPeriod(database, () => clock);
    const period = await periods.create(accountId, {
      purpose: "March scope",
      startDate: "2027-03-02",
      endDate: "2027-03-08",
    });
    await periods.add(accountId, period.id, firstWorkId);
    await periods.add(accountId, period.id, secondWorkId);
    clock = new Date("2027-03-02T12:00:00.000Z");
    expect((await periods.find(accountId, period.id))?.status).toBe("Active");
    clock = new Date("2027-03-02T13:00:00.000Z");
    await periods.remove(accountId, period.id, secondWorkId);
    await periods.add(accountId, period.id, thirdWorkId);
    await database
      .update(work)
      .set({ status: "Closed", closureResult: "Completed" })
      .where(eq(work.id, firstWorkId));
    await periods.close(accountId, period.id);
    await periods.saveEvaluation(accountId, {
      periodId: period.id,
      evaluation: {
        keep: "Pair on API design",
        change: "",
        tryNext: "Split the release",
      },
    });
    await periods.linkFollowUpWork(accountId, {
      periodId: period.id,
      workId: followUpWorkId,
      learning: "Try next",
      learningText: "Split the release",
    });

    const closed = await periods.find(accountId, period.id);
    expect(closed?.closeComparison).toMatchObject({
      inStartSnapshot: [{ id: firstWorkId }, { id: secondWorkId }],
      addedLater: [{ id: thirdWorkId }],
      removed: [{ id: secondWorkId }],
      completed: [{ id: firstWorkId }],
      stillOpen: [{ id: thirdWorkId }],
    });
    expect(closed?.evaluation).toEqual({
      keep: "Pair on API design",
      change: null,
      tryNext: "Split the release",
    });
    expect(closed?.followUpWorks).toEqual([
      expect.objectContaining({
        id: followUpWorkId,
        learning: "Try next",
        learningText: "Split the release",
      }),
    ]);
  }, 30_000);

  test("derives read-only Dependencies only from relations inside period scope", async () => {
    if (!database) {
      throw new Error("ACCOUNT_ACCESS_DATABASE_URL is required");
    }
    const activeRelationId = `focus-relation-${crypto.randomUUID()}`;
    const resolvedRelationId = `focus-relation-${crypto.randomUUID()}`;
    const outsideRelationId = `focus-relation-${crypto.randomUUID()}`;
    const crossingRelationId = `focus-relation-${crypto.randomUUID()}`;
    const deletedRelationId = `focus-relation-${crypto.randomUUID()}`;
    const relatedRelationId = `focus-relation-${crypto.randomUUID()}`;
    await database.insert(workRelation).values([
      {
        id: activeRelationId,
        kind: "Blocks",
        sourceRecordType: "Work",
        sourceWorkId: firstWorkId,
        targetRecordType: "Work",
        targetRecordId: secondWorkId,
        targetLabel: "Second Work",
        targetProjectId: secondProjectId,
        blockingStatus: "Active",
      },
      {
        id: resolvedRelationId,
        kind: "Blocks",
        sourceRecordType: "Work",
        sourceWorkId: secondWorkId,
        targetRecordType: "Work",
        targetRecordId: firstWorkId,
        targetLabel: "First Work",
        targetProjectId: firstProjectId,
        blockingStatus: "Resolved",
      },
      {
        id: outsideRelationId,
        kind: "Blocks",
        sourceRecordType: "Work",
        sourceWorkId: thirdWorkId,
        targetRecordType: "Work",
        targetRecordId: followUpWorkId,
        targetLabel: "Follow-up Work",
        targetProjectId: secondProjectId,
        blockingStatus: "Active",
      },
      {
        id: crossingRelationId,
        kind: "Blocks",
        sourceRecordType: "Work",
        sourceWorkId: firstWorkId,
        targetRecordType: "Work",
        targetRecordId: thirdWorkId,
        targetLabel: "Third Work",
        targetProjectId: firstProjectId,
        blockingStatus: "Active",
      },
      {
        id: deletedRelationId,
        kind: "Blocks",
        sourceRecordType: "Work",
        sourceWorkId: firstWorkId,
        targetRecordType: "Work",
        targetRecordId: secondWorkId,
        targetLabel: "Second Work",
        targetProjectId: secondProjectId,
        blockingStatus: "Active",
        deletedAt: clock,
      },
      {
        id: relatedRelationId,
        kind: "Related",
        sourceRecordType: "Work",
        sourceWorkId: firstWorkId,
        targetRecordType: "Work",
        targetRecordId: secondWorkId,
        targetLabel: "Second Work",
        targetProjectId: secondProjectId,
      },
    ]);
    clock = new Date("2027-04-01T12:00:00.000Z");
    const periods = createDatabaseFocusPeriod(database, () => clock);
    const period = await periods.create(accountId, {
      purpose: "April scope",
      startDate: "2027-04-01",
      endDate: "2027-04-07",
    });
    await periods.add(accountId, period.id, firstWorkId);
    await periods.add(accountId, period.id, secondWorkId);

    const fixtureWorkIds = [
      firstWorkId,
      secondWorkId,
      thirdWorkId,
      followUpWorkId,
    ];
    const relationsBefore = await database
      .select()
      .from(workRelation)
      .where(inArray(workRelation.sourceWorkId, fixtureWorkIds));
    const workBefore = await database
      .select()
      .from(work)
      .where(inArray(work.projectId, [firstProjectId, secondProjectId]));
    const projectsBefore = await database
      .select()
      .from(project)
      .where(eq(project.workspaceId, workspaceId));
    const periodBefore = await periods.find(accountId, period.id);

    const dependencies = (await periods.find(accountId, period.id))
      ?.dependencies;
    expect(dependencies?.edges).toHaveLength(2);
    expect(dependencies?.edges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          blocker: expect.objectContaining({ recordId: firstWorkId }),
          blocked: expect.objectContaining({ recordId: secondWorkId }),
          relationId: activeRelationId,
          status: "Active",
        }),
        expect.objectContaining({
          blocker: expect.objectContaining({ recordId: secondWorkId }),
          blocked: expect.objectContaining({ recordId: firstWorkId }),
          relationId: resolvedRelationId,
          status: "Resolved",
        }),
      ]),
    );
    expect(
      dependencies?.edges.map(({ relationId }) => relationId),
    ).not.toContain(outsideRelationId);
    expect(dependencies?.cycles).toHaveLength(1);
    expect(dependencies?.nodes.map(({ recordId }) => recordId).sort()).toEqual(
      [firstWorkId, secondWorkId].sort(),
    );
    expect(await periods.find(accountId, period.id)).toEqual(periodBefore);
    expect(
      await database
        .select()
        .from(workRelation)
        .where(inArray(workRelation.sourceWorkId, fixtureWorkIds)),
    ).toEqual(relationsBefore);
    expect(
      await database
        .select()
        .from(work)
        .where(inArray(work.projectId, [firstProjectId, secondProjectId])),
    ).toEqual(workBefore);
    expect(
      await database
        .select()
        .from(project)
        .where(eq(project.workspaceId, workspaceId)),
    ).toEqual(projectsBefore);
    await periods.cancel(accountId, period.id);
  }, 30_000);

  test("canceling Planned keeps its membership historical without either snapshot", async () => {
    if (!database) {
      throw new Error("ACCOUNT_ACCESS_DATABASE_URL is required");
    }
    clock = new Date("2026-11-10T12:00:00.000Z");
    const periods = createDatabaseFocusPeriod(database, () => clock);
    const period = await periods.create(accountId, {
      purpose: "Optional research window",
      startDate: "2026-11-20",
      endDate: "2026-11-26",
    });
    await periods.add(accountId, period.id, secondWorkId);
    await periods.cancel(accountId, period.id);
    const canceled = await periods.find(accountId, period.id);
    expect(canceled?.status).toBe("Canceled");
    expect(canceled?.members.map((item) => item.key)).toEqual(["BETA-1"]);
    expect(canceled?.startSnapshot).toBeNull();
    expect(canceled?.closeSnapshot).toBeNull();
    clock = new Date("2026-11-20T12:00:00.000Z");
    expect((await periods.find(accountId, period.id))?.status).toBe("Canceled");
    await database
      .update(work)
      .set({ archivedAt: new Date() })
      .where(eq(work.id, secondWorkId));
    expect(
      (await periods.find(accountId, period.id))?.members.map(
        (item) => item.key,
      ),
    ).toEqual(["BETA-1"]);
    await database
      .update(work)
      .set({ archivedAt: null })
      .where(eq(work.id, secondWorkId));
  }, 30_000);

  test("records explicit bulk decisions after close without automatic rollover", async () => {
    if (!database) {
      throw new Error("ACCOUNT_ACCESS_DATABASE_URL is required");
    }
    clock = new Date("2026-12-01T12:00:00.000Z");
    const periods = createDatabaseFocusPeriod(database, () => clock);
    const source = await periods.create(accountId, {
      purpose: "Finish current scope",
      startDate: "2026-12-01",
      endDate: "2026-12-07",
    });
    const next = await periods.create(accountId, {
      purpose: "Next scope",
      startDate: "2026-12-08",
      endDate: "2026-12-14",
    });
    await periods.add(accountId, source.id, firstWorkId);
    await periods.add(accountId, source.id, secondWorkId);
    await periods.close(accountId, source.id);
    expect((await periods.find(accountId, next.id))?.members).toEqual([]);
    expect(
      (await periods.find(accountId, source.id))?.leftoverDecisions,
    ).toEqual([]);
    await periods.decide(accountId, {
      periodId: source.id,
      workIds: [firstWorkId],
      destination: "Next period",
    });
    await periods.decide(accountId, {
      periodId: source.id,
      workIds: [secondWorkId],
      destination: "Backlog",
    });
    expect(
      (await periods.find(accountId, next.id))?.members.map((item) => item.id),
    ).toEqual([firstWorkId]);
    expect(
      (await periods.find(accountId, source.id))?.leftoverDecisions,
    ).toEqual(
      expect.arrayContaining([
        {
          workId: firstWorkId,
          destination: "Next period",
          targetPeriodId: next.id,
        },
        {
          workId: secondWorkId,
          destination: "Backlog",
          targetPeriodId: null,
        },
      ]),
    );
    await expect(
      periods.decide(accountId, {
        periodId: source.id,
        workIds: [firstWorkId],
        destination: "Backlog",
      }),
    ).rejects.toThrow();
    await periods.cancel(accountId, next.id);
  }, 30_000);

  test("applies a bulk decision atomically when one selected Work conflicts", async () => {
    if (!database) {
      throw new Error("ACCOUNT_ACCESS_DATABASE_URL is required");
    }
    clock = new Date("2027-06-01T12:00:00.000Z");
    const periods = createDatabaseFocusPeriod(database, () => clock);
    const source = await periods.create(accountId, {
      purpose: "Atomic source window",
      startDate: "2027-06-01",
      endDate: "2027-06-07",
    });
    await periods.add(accountId, source.id, firstWorkId);
    await periods.add(accountId, source.id, secondWorkId);
    await periods.close(accountId, source.id);

    const target = await periods.create(accountId, {
      purpose: "Atomic target window",
      startDate: "2027-06-01",
      endDate: "2027-06-07",
    });
    const conflicting = await periods.create(accountId, {
      purpose: "Conflicting target window",
      startDate: "2027-06-01",
      endDate: "2027-06-07",
    });
    await periods.add(accountId, conflicting.id, secondWorkId);

    await expect(
      periods.decide(accountId, {
        periodId: source.id,
        workIds: [firstWorkId, secondWorkId],
        destination: "Another period",
        targetPeriodId: target.id,
      }),
    ).rejects.toThrow("Work is already in an active Focus Period. Use Move.");
    expect((await periods.find(accountId, target.id))?.members).toEqual([]);
    expect(
      (await periods.find(accountId, conflicting.id))?.members.map(
        (item) => item.id,
      ),
    ).toEqual([secondWorkId]);
    expect(
      (await periods.find(accountId, source.id))?.leftoverDecisions,
    ).toEqual([]);
  }, 30_000);

  test("rejects an unavailable Work and rolls back the whole batch", async () => {
    if (!database) {
      throw new Error("ACCOUNT_ACCESS_DATABASE_URL is required");
    }
    clock = new Date("2027-08-01T12:00:00.000Z");
    const periods = createDatabaseFocusPeriod(database, () => clock);
    const source = await periods.create(accountId, {
      purpose: "Unavailable Work source",
      startDate: "2027-08-01",
      endDate: "2027-08-07",
    });
    await periods.add(accountId, source.id, firstWorkId);
    await periods.add(accountId, source.id, secondWorkId);
    await periods.close(accountId, source.id);
    const target = await periods.create(accountId, {
      purpose: "Unavailable Work destination",
      startDate: "2027-08-08",
      endDate: "2027-08-14",
    });
    await database
      .update(work)
      .set({ archivedAt: new Date("2027-08-01T13:00:00.000Z") })
      .where(eq(work.id, firstWorkId));

    await expect(
      periods.decide(accountId, {
        periodId: source.id,
        workIds: [secondWorkId, firstWorkId],
        destination: "Another period",
        targetPeriodId: target.id,
      }),
    ).rejects.toThrow("Work is unavailable.");
    expect((await periods.find(accountId, target.id))?.members).toEqual([]);
    expect(
      (await periods.find(accountId, source.id))?.leftoverDecisions,
    ).toEqual([]);
  }, 30_000);

  test("serializes conflicting planned destinations across closed sources", async () => {
    if (!database) {
      throw new Error("ACCOUNT_ACCESS_DATABASE_URL is required");
    }
    clock = new Date("2027-09-01T12:00:00.000Z");
    const periods = createDatabaseFocusPeriod(database, () => clock);
    const firstSource = await periods.create(accountId, {
      purpose: "First closed source",
      startDate: "2027-09-01",
      endDate: "2027-09-07",
    });
    await periods.add(accountId, firstSource.id, firstWorkId);
    await periods.add(accountId, firstSource.id, secondWorkId);
    await periods.close(accountId, firstSource.id);

    const secondSource = await periods.create(accountId, {
      purpose: "Second closed source",
      startDate: "2027-09-08",
      endDate: "2027-09-14",
    });
    await periods.add(accountId, secondSource.id, firstWorkId);
    await periods.add(accountId, secondSource.id, secondWorkId);
    clock = new Date("2027-09-08T12:00:00.000Z");
    expect((await periods.find(accountId, secondSource.id))?.status).toBe(
      "Active",
    );
    await periods.close(accountId, secondSource.id);

    const firstTarget = await periods.create(accountId, {
      purpose: "First planned destination",
      startDate: "2027-09-15",
      endDate: "2027-09-21",
    });
    const secondTarget = await periods.create(accountId, {
      purpose: "Second planned destination",
      startDate: "2027-09-16",
      endDate: "2027-09-22",
    });
    const firstDecision = createDatabaseFocusPeriod(database, () => clock);
    const secondDecision = createDatabaseFocusPeriod(database, () => clock);
    const results = await Promise.allSettled([
      firstDecision.decide(accountId, {
        periodId: firstSource.id,
        workIds: [firstWorkId, secondWorkId],
        destination: "Another period",
        targetPeriodId: firstTarget.id,
      }),
      secondDecision.decide(accountId, {
        periodId: secondSource.id,
        workIds: [secondWorkId, firstWorkId],
        destination: "Another period",
        targetPeriodId: secondTarget.id,
      }),
    ]);

    expect(
      results.filter((result) => result.status === "fulfilled"),
    ).toHaveLength(1);
    expect(
      results.filter((result) => result.status === "rejected"),
    ).toHaveLength(1);
    const firstTargetMembers = (
      await periods.find(accountId, firstTarget.id)
    )?.members.map((item) => item.id);
    const secondTargetMembers = (
      await periods.find(accountId, secondTarget.id)
    )?.members.map((item) => item.id);
    expect([firstTargetMembers, secondTargetMembers]).toEqual(
      expect.arrayContaining([[firstWorkId, secondWorkId], []]),
    );
  }, 30_000);

  test("records explicit Backlog membership without rewriting manual order", async () => {
    if (!database) {
      throw new Error("ACCOUNT_ACCESS_DATABASE_URL is required");
    }
    clock = new Date("2027-07-01T12:00:00.000Z");
    const periods = createDatabaseFocusPeriod(database, () => clock);
    const source = await periods.create(accountId, {
      purpose: "Backlog handoff",
      startDate: "2027-07-01",
      endDate: "2027-07-07",
    });
    await periods.add(accountId, source.id, firstWorkId);
    await periods.add(accountId, source.id, thirdWorkId);
    await database.insert(projectBacklogOrder).values({
      projectId: firstProjectId,
      revision: 4,
      workIds: [thirdWorkId, firstWorkId],
    });
    await periods.close(accountId, source.id);
    await periods.decide(accountId, {
      periodId: source.id,
      workIds: [firstWorkId, thirdWorkId],
      destination: "Backlog",
    });

    const backlog = createBacklogAccess(createDatabaseBacklog(database));
    await expect(
      backlog.list(accountId, firstProjectId),
    ).resolves.toMatchObject({
      projectId: firstProjectId,
      revision: 4,
      workIds: [thirdWorkId, firstWorkId],
    });
  }, 30_000);

  test("sends to another period and accepts Abandon only after explicit Work closure", async () => {
    if (!database) {
      throw new Error("ACCOUNT_ACCESS_DATABASE_URL is required");
    }
    clock = new Date("2027-01-01T12:00:00.000Z");
    const periods = createDatabaseFocusPeriod(database, () => clock);
    const source = await periods.create(accountId, {
      purpose: "January scope",
      startDate: "2027-01-01",
      endDate: "2027-01-07",
    });
    const another = await periods.create(accountId, {
      purpose: "Later scope",
      startDate: "2027-01-08",
      endDate: "2027-01-14",
    });
    await periods.add(accountId, source.id, firstWorkId);
    await periods.add(accountId, source.id, secondWorkId);
    await periods.close(accountId, source.id);
    await periods.decide(accountId, {
      periodId: source.id,
      workIds: [firstWorkId],
      destination: "Another period",
      targetPeriodId: another.id,
    });
    await expect(
      periods.decide(accountId, {
        periodId: source.id,
        workIds: [secondWorkId],
        destination: "Abandon",
      }),
    ).rejects.toThrow("Work lifecycle does not match");
    await database
      .update(work)
      .set({ status: "Closed", closureResult: "Abandoned" })
      .where(eq(work.id, secondWorkId));
    await periods.decide(accountId, {
      periodId: source.id,
      workIds: [secondWorkId],
      destination: "Abandon",
    });
    expect(
      (await periods.find(accountId, source.id))?.leftoverDecisions,
    ).toEqual(
      expect.arrayContaining([
        {
          workId: firstWorkId,
          destination: "Another period",
          targetPeriodId: another.id,
        },
        {
          workId: secondWorkId,
          destination: "Abandon",
          targetPeriodId: null,
        },
      ]),
    );
  }, 30_000);
});
