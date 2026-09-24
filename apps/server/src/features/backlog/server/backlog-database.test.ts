import { createDb } from "@cantiara/db";
import { user, workspace } from "@cantiara/db/schema/auth";
import { work } from "@cantiara/db/schema/work";
import { asc, eq, inArray } from "drizzle-orm";
import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  test,
} from "vitest";
import { createDatabaseProjectShell } from "../../project-shell/server/project-shell-database";
import { createBacklogAccess } from "./backlog";
import { createDatabaseBacklog } from "./backlog-database";

const databaseUrl = process.env.ACCOUNT_ACCESS_DATABASE_URL;
const describeDatabase = databaseUrl ? describe : describe.skip;

describeDatabase("Backlog prepared membership PostgreSQL integration", () => {
  const database = databaseUrl
    ? createDb({ DATABASE_URL: databaseUrl })
    : undefined;
  const accountId = `backlog-${crypto.randomUUID()}`;
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
    await database?.delete(user).where(eq(user.id, accountId));
  });

  afterAll(async () => {
    await database?.$client.end();
  });

  test("dynamically lists active Work without writing status or closure", async () => {
    if (!database) {
      throw new Error("ACCOUNT_ACCESS_DATABASE_URL is required");
    }

    const projectProfile = await createDatabaseProjectShell(database).create(
      accountId,
      {
        name: "Backlog Project",
        shortCode: "BKL",
        starterConfiguration: "Blank Project",
      },
    );
    const workIdPrefix = `backlog-work-${crypto.randomUUID()}`;

    const initialWorks = [
      {
        id: `${workIdPrefix}-unplanned`,
        key: "BKL-1",
        number: 1,
        plannedStartDate: null,
        projectId: projectProfile.id,
        status: "Not Started",
        title: "Unplanned Work",
        type: "Task",
      },
      {
        id: `${workIdPrefix}-planned`,
        key: "BKL-2",
        number: 2,
        plannedStartDate: "2026-10-01",
        projectId: projectProfile.id,
        status: "In Progress",
        title: "Planned Work",
        type: "Task",
      },
      {
        archivedAt: new Date("2026-01-01T00:00:00.000Z"),
        id: `${workIdPrefix}-archived`,
        key: "BKL-3",
        number: 3,
        projectId: projectProfile.id,
        status: "Blocked",
        title: "Archived Work",
        type: "Task",
      },
      {
        closureResult: "Completed",
        id: `${workIdPrefix}-closed`,
        key: "BKL-4",
        number: 4,
        projectId: projectProfile.id,
        status: "Closed",
        title: "Closed Work",
        type: "Task",
      },
    ] as const;
    await database.insert(work).values([...initialWorks]);

    const access = createBacklogAccess(createDatabaseBacklog(database));
    const before = await database
      .select({
        closureResult: work.closureResult,
        id: work.id,
        revision: work.revision,
        status: work.status,
      })
      .from(work)
      .where(
        inArray(
          work.id,
          initialWorks.map((item) => item.id),
        ),
      )
      .orderBy(asc(work.number));

    await expect(
      access.listPrepared(accountId, projectProfile.id),
    ).resolves.toEqual([
      {
        id: `${workIdPrefix}-unplanned`,
        key: "BKL-1",
        number: 1,
        status: "Not Started",
        title: "Unplanned Work",
      },
      {
        id: `${workIdPrefix}-planned`,
        key: "BKL-2",
        number: 2,
        status: "In Progress",
        title: "Planned Work",
      },
    ]);
    await expect(
      database
        .select({
          closureResult: work.closureResult,
          id: work.id,
          revision: work.revision,
          status: work.status,
        })
        .from(work)
        .where(
          inArray(
            work.id,
            initialWorks.map((item) => item.id),
          ),
        )
        .orderBy(asc(work.number)),
    ).resolves.toEqual(before);

    await database.insert(work).values({
      id: `${workIdPrefix}-added-later`,
      key: "BKL-5",
      number: 5,
      plannedStartDate: null,
      projectId: projectProfile.id,
      status: "Blocked",
      title: "Added after the first read",
      type: "Task",
    });

    await expect(
      access.listPrepared(accountId, projectProfile.id),
    ).resolves.toEqual([
      {
        id: `${workIdPrefix}-unplanned`,
        key: "BKL-1",
        number: 1,
        status: "Not Started",
        title: "Unplanned Work",
      },
      {
        id: `${workIdPrefix}-planned`,
        key: "BKL-2",
        number: 2,
        status: "In Progress",
        title: "Planned Work",
      },
      {
        id: `${workIdPrefix}-added-later`,
        key: "BKL-5",
        number: 5,
        status: "Blocked",
        title: "Added after the first read",
      },
    ]);
  });
});
