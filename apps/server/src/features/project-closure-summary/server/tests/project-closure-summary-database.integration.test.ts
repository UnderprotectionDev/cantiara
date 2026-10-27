import { createDb } from "@cantiara/db";
import { accountPreferences, user, workspace } from "@cantiara/db/schema/auth";
import { mutationHistory } from "@cantiara/db/schema/mutation";
import { project } from "@cantiara/db/schema/project";
import { work } from "@cantiara/db/schema/work";
import { eq, inArray } from "drizzle-orm";
import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  test,
} from "vitest";
import { createDatabaseProjectClosureSummary } from "../project-closure-summary-database";

const databaseUrl = process.env.ACCOUNT_ACCESS_DATABASE_URL;
const describeDatabase = databaseUrl ? describe : describe.skip;

describeDatabase("Project Closure Summary database reads", () => {
  const database = databaseUrl
    ? createDb({ DATABASE_URL: databaseUrl })
    : undefined;
  const accountId = `closure-summary-${crypto.randomUUID()}`;
  const foreignAccountId = `closure-summary-${crypto.randomUUID()}`;
  const workspaceId = `workspace-${crypto.randomUUID()}`;
  const foreignWorkspaceId = `workspace-${crypto.randomUUID()}`;
  const completedProjectId = `project-${crypto.randomUUID()}`;
  const activeProjectId = `project-${crypto.randomUUID()}`;
  const foreignProjectId = `project-${crypto.randomUUID()}`;
  const movedWorkId = `work-${crypto.randomUUID()}`;
  const clearedWorkId = `work-${crypto.randomUUID()}`;
  const openWorkId = `work-${crypto.randomUUID()}`;
  const archivedWorkId = `work-${crypto.randomUUID()}`;
  const foreignMovedWorkId = `work-${crypto.randomUUID()}`;
  // 02:00Z closes on the 11th in Los Angeles and on the 12th in Istanbul.
  const closedAt = new Date("2026-10-12T02:00:00.000Z");

  const historyRows = (
    workId: string,
    accountIdForActor: string,
    revisions: {
      nextValue: unknown;
      occurredAt: string;
      previousValue: unknown;
    }[],
  ) =>
    revisions.map((revision, index) => ({
      actorId: accountIdForActor,
      actorType: "User",
      authorizingUserId: accountIdForActor,
      id: `history-${crypto.randomUUID()}`,
      nextValue: revision.nextValue,
      occurredAt: new Date(revision.occurredAt),
      originKind: "human",
      payloadFingerprint: "a".repeat(64),
      previousValue: revision.previousValue,
      revision: index + 1,
      targetId: workId,
    }));

  const seedClosedWork = (input: {
    closedAt: Date;
    key: string;
    number: number;
    projectId: string;
    targetDate: string | null;
    workId: string;
  }) => [
    {
      closureResult: "Completed",
      id: input.workId,
      key: input.key,
      number: input.number,
      projectId: input.projectId,
      status: "Closed",
      statusChangedAt: input.closedAt,
      targetDate: input.targetDate,
      title: "P-1 Ship",
      type: "Task",
    },
  ];

  beforeEach(async () => {
    if (!database) {
      throw new Error("ACCOUNT_ACCESS_DATABASE_URL is required");
    }
    await database.insert(user).values([
      {
        id: accountId,
        email: `${accountId}@example.invalid`,
        name: "Founder",
      },
      {
        id: foreignAccountId,
        email: `${foreignAccountId}@example.invalid`,
        name: "Other",
      },
    ]);
    await database.insert(workspace).values([
      { id: workspaceId, ownerAccountId: accountId },
      { id: foreignWorkspaceId, ownerAccountId: foreignAccountId },
    ]);
    // The stored Account time zone must be read, not the schema default.
    await database.insert(accountPreferences).values({
      accountId,
      timeZone: "America/Los_Angeles",
    });
    await database.insert(project).values([
      {
        id: completedProjectId,
        name: "Closing",
        shortCode: "CLOSA",
        starterConfiguration: "Blank Project",
        status: "Completed",
        workspaceId,
      },
      {
        id: activeProjectId,
        name: "Running",
        shortCode: "CLOSB",
        starterConfiguration: "Blank Project",
        workspaceId,
      },
      {
        id: foreignProjectId,
        name: "Foreign closing",
        shortCode: "CLOC",
        starterConfiguration: "Blank Project",
        status: "Completed",
        workspaceId: foreignWorkspaceId,
      },
    ]);
    await database.insert(work).values([
      ...seedClosedWork({
        closedAt,
        key: "CLOSA-1",
        number: 1,
        projectId: completedProjectId,
        targetDate: "2026-10-12",
        workId: movedWorkId,
      }),
      ...seedClosedWork({
        closedAt,
        key: "CLOSA-2",
        number: 2,
        projectId: completedProjectId,
        targetDate: null,
        workId: clearedWorkId,
      }),
      {
        id: openWorkId,
        key: "CLOSA-3",
        number: 3,
        projectId: completedProjectId,
        status: "In Progress",
        title: "Open follow-up",
        type: "Task",
      },
      {
        archivedAt: closedAt,
        closureResult: "Completed",
        id: archivedWorkId,
        key: "CLOSA-4",
        number: 4,
        projectId: completedProjectId,
        status: "Closed",
        title: "Archived work",
        type: "Task",
      },
      ...seedClosedWork({
        closedAt,
        key: "CLOC-1",
        number: 1,
        projectId: foreignProjectId,
        targetDate: "2026-10-12",
        workId: foreignMovedWorkId,
      }),
    ]);
    await database.insert(mutationHistory).values([
      ...historyRows(movedWorkId, accountId, [
        {
          nextValue: {
            work: { status: "Not Started", targetDate: "2026-10-01" },
          },
          occurredAt: "2026-10-01T09:00:00.000Z",
          // Creation history: the contract writes the empty work target.
          previousValue: { work: null },
        },
        // A status-only change carries no target date on either side.
        {
          nextValue: { work: { status: "Blocked" } },
          occurredAt: "2026-10-02T09:00:00.000Z",
          previousValue: { work: { status: "Not Started" } },
        },
        {
          nextValue: {
            work: { status: "In Progress", targetDate: "2026-10-12" },
          },
          occurredAt: "2026-10-05T09:00:00.000Z",
          previousValue: {
            work: { status: "Blocked", targetDate: "2026-10-01" },
          },
        },
      ]),
      ...historyRows(clearedWorkId, accountId, [
        {
          nextValue: {
            work: { status: "Not Started", targetDate: "2026-10-01" },
          },
          occurredAt: "2026-10-01T09:00:00.000Z",
          previousValue: { work: null },
        },
        {
          nextValue: { work: { status: "Not Started", targetDate: null } },
          occurredAt: "2026-10-03T09:00:00.000Z",
          previousValue: {
            work: { status: "Not Started", targetDate: "2026-10-01" },
          },
        },
      ]),
      ...historyRows(foreignMovedWorkId, foreignAccountId, [
        {
          nextValue: {
            work: { status: "Not Started", targetDate: "2026-10-01" },
          },
          occurredAt: "2026-10-01T09:00:00.000Z",
          previousValue: { work: null },
        },
        {
          nextValue: {
            work: { status: "In Progress", targetDate: "2026-10-12" },
          },
          occurredAt: "2026-10-05T09:00:00.000Z",
          previousValue: {
            work: { status: "Not Started", targetDate: "2026-10-01" },
          },
        },
      ]),
    ]);
  });

  afterEach(async () => {
    await database
      ?.delete(mutationHistory)
      .where(inArray(mutationHistory.actorId, [accountId, foreignAccountId]));
    await database?.delete(user).where(eq(user.id, accountId));
    await database?.delete(user).where(eq(user.id, foreignAccountId));
  });

  afterAll(async () => {
    await database?.$client.end();
  });

  test("reads the Work's own planned date history and closure event in the stored Account time zone", async () => {
    if (!database) {
      throw new Error("ACCOUNT_ACCESS_DATABASE_URL is required");
    }
    const access = createDatabaseProjectClosureSummary(database);
    const comparison = await access.dateComparison(accountId, {
      projectId: completedProjectId,
      sources: [
        { recordId: movedWorkId, recordType: "Work" },
        { recordId: clearedWorkId, recordType: "Work" },
      ],
    });
    // Los Angeles reads the 11th; the schema default Istanbul would read the 12th.
    expect(comparison.rows).toEqual([
      {
        closedOn: "2026-10-11",
        label: "CLOSA-1 P-1 Ship",
        moved: true,
        plannedDates: ["2026-10-01", "2026-10-12"],
        reading: "Before target",
        recordId: movedWorkId,
        recordType: "Work",
      },
    ]);
  });

  test("a cleared planned date is omitted; history never substitutes for it", async () => {
    if (!database) {
      throw new Error("ACCOUNT_ACCESS_DATABASE_URL is required");
    }
    const access = createDatabaseProjectClosureSummary(database);
    const comparison = await access.dateComparison(accountId, {
      projectId: completedProjectId,
      sources: [{ recordId: clearedWorkId, recordType: "Work" }],
    });
    expect(comparison.rows).toEqual([]);
  });

  test("an Account without a preferences row reads the default time zone", async () => {
    if (!database) {
      throw new Error("ACCOUNT_ACCESS_DATABASE_URL is required");
    }
    const access = createDatabaseProjectClosureSummary(database);
    const comparison = await access.dateComparison(foreignAccountId, {
      projectId: foreignProjectId,
      sources: [{ recordId: foreignMovedWorkId, recordType: "Work" }],
    });
    expect(comparison.rows).toEqual([
      {
        closedOn: "2026-10-12",
        label: "CLOC-1 P-1 Ship",
        moved: true,
        plannedDates: ["2026-10-01", "2026-10-12"],
        reading: "On target",
        recordId: foreignMovedWorkId,
        recordType: "Work",
      },
    ]);
  });

  test("sources list only live same-Project candidates: open and archived Work stay out", async () => {
    if (!database) {
      throw new Error("ACCOUNT_ACCESS_DATABASE_URL is required");
    }
    const access = createDatabaseProjectClosureSummary(database);
    const sources = await access.sources(accountId, {
      projectId: completedProjectId,
    });
    const workGroup = sources.groups.find(
      (group) => group.recordType === "Work",
    );
    expect(workGroup?.candidates.map((candidate) => candidate.label)).toEqual([
      "CLOSA-1 P-1 Ship",
      "CLOSA-2 P-1 Ship",
    ]);
  });

  test("refuses a foreign or unknown Project, an open Project and a non-candidate source", async () => {
    if (!database) {
      throw new Error("ACCOUNT_ACCESS_DATABASE_URL is required");
    }
    const access = createDatabaseProjectClosureSummary(database);
    await expect(
      access.dateComparison(foreignAccountId, {
        projectId: completedProjectId,
        sources: [],
      }),
    ).rejects.toMatchObject({
      code: "PROJECT_CLOSURE_SUMMARY_PROJECT_NOT_FOUND",
    });
    await expect(
      access.dateComparison(accountId, {
        projectId: foreignProjectId,
        sources: [],
      }),
    ).rejects.toMatchObject({
      code: "PROJECT_CLOSURE_SUMMARY_PROJECT_NOT_FOUND",
    });
    await expect(
      access.dateComparison(accountId, {
        projectId: activeProjectId,
        sources: [],
      }),
    ).rejects.toMatchObject({
      code: "PROJECT_CLOSURE_SUMMARY_PROJECT_NOT_CLOSED",
    });
    await expect(
      access.dateComparison(accountId, {
        projectId: completedProjectId,
        sources: [{ recordId: openWorkId, recordType: "Work" }],
      }),
    ).rejects.toMatchObject({
      code: "PROJECT_CLOSURE_SUMMARY_SOURCE_NOT_FOUND",
    });
  });
});
