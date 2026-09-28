import { createDb } from "@cantiara/db";
import { user, workspace } from "@cantiara/db/schema/auth";
import { project } from "@cantiara/db/schema/project";
import { work } from "@cantiara/db/schema/work";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
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
    ]);
  });

  afterAll(async () => {
    await database?.delete(user).where(eq(user.id, accountId));
    await database?.$client.end();
  });

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
  });

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
  });

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
    ).rejects.toThrow("already in an Active Focus Period");
    clock = new Date("2026-10-30T12:00:00.000Z");
    expect((await periods.find(accountId, first.id))?.status).toBe("Active");
    expect((await periods.find(accountId, second.id))?.status).toBe("Active");
  });

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
  });
});
