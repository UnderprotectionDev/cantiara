import { createDb } from "@cantiara/db";
import { user, workspace } from "@cantiara/db/schema/auth";
import { project } from "@cantiara/db/schema/project";
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
      {
        id: `${workIdPrefix}-trashed`,
        key: "BKL-5",
        number: 5,
        projectId: projectProfile.id,
        status: "Not Started",
        title: "Trashed Work",
        trashedAt: new Date("2026-01-02T00:00:00.000Z"),
        type: "Task",
      },
    ] as const;
    await database.insert(work).values([...initialWorks]);

    const access = createBacklogAccess(createDatabaseBacklog(database));
    const expectMembershipParity = async () => {
      const [order, prepared] = await Promise.all([
        access.list(accountId, projectProfile.id),
        access.listPrepared(accountId, projectProfile.id),
      ]);

      expect(order?.workIds).toEqual(prepared?.map(({ id }) => id));
    };
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
    const projectBefore = await database
      .select({
        configuration: project.configuration,
        revision: project.revision,
        status: project.status,
      })
      .from(project)
      .where(eq(project.id, projectProfile.id));

    await expect(
      access.listPrepared(accountId, projectProfile.id),
    ).resolves.toEqual([
      {
        id: `${workIdPrefix}-unplanned`,
        key: "BKL-1",
        number: 1,
        plannedStartDate: null,
        status: "Not Started",
        targetDate: null,
        title: "Unplanned Work",
      },
      {
        id: `${workIdPrefix}-planned`,
        key: "BKL-2",
        number: 2,
        plannedStartDate: "2026-10-01",
        status: "In Progress",
        targetDate: null,
        title: "Planned Work",
      },
    ]);
    await expectMembershipParity();
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
    await expect(
      database
        .select({
          configuration: project.configuration,
          revision: project.revision,
          status: project.status,
        })
        .from(project)
        .where(eq(project.id, projectProfile.id)),
    ).resolves.toEqual(projectBefore);

    await database.insert(work).values({
      id: `${workIdPrefix}-added-later`,
      key: "BKL-6",
      number: 6,
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
        plannedStartDate: null,
        status: "Not Started",
        targetDate: null,
        title: "Unplanned Work",
      },
      {
        id: `${workIdPrefix}-planned`,
        key: "BKL-2",
        number: 2,
        plannedStartDate: "2026-10-01",
        status: "In Progress",
        targetDate: null,
        title: "Planned Work",
      },
      {
        id: `${workIdPrefix}-added-later`,
        key: "BKL-6",
        number: 6,
        plannedStartDate: null,
        status: "Blocked",
        targetDate: null,
        title: "Added after the first read",
      },
    ]);
    await expectMembershipParity();
  });
});
