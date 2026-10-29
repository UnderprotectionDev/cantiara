import { createDb } from "@cantiara/db";
import { user, workspace } from "@cantiara/db/schema/auth";
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
import { createDatabaseProjectShell } from "../../../project-shell/server/project-shell-database";
import { createDatabaseBuildInPublic } from "../build-in-public-database";

const databaseUrl = process.env.ACCOUNT_ACCESS_DATABASE_URL;
const describeDatabase = databaseUrl ? describe : describe.skip;

describeDatabase("Build in Public PostgreSQL", () => {
  const database = databaseUrl
    ? createDb({ DATABASE_URL: databaseUrl })
    : undefined;
  const accountId = `bip-${crypto.randomUUID()}`;

  beforeEach(async () => {
    await database?.insert(user).values({
      email: `${accountId}@example.invalid`,
      id: accountId,
      name: "Founder",
    });
    await database?.insert(workspace).values({
      id: `workspace-${crypto.randomUUID()}`,
      ownerAccountId: accountId,
    });
  });
  afterEach(async () => {
    await database?.delete(user).where(eq(user.id, accountId));
  });
  afterAll(async () => {
    await database?.$client.end();
  });

  test("maps a Roadmap Work, keeps the internal status and appends an immutable revision", async () => {
    if (!database) {
      throw new Error("ACCOUNT_ACCESS_DATABASE_URL is required");
    }
    const profile = await createDatabaseProjectShell(database).create(
      accountId,
      {
        name: "Public",
        shortCode: "PUB",
        starterConfiguration: "Blank Project",
      },
    );
    const workId = `work-${crypto.randomUUID()}`;
    await database.insert(work).values({
      id: workId,
      key: "PUB-1",
      number: 1,
      projectId: profile.id,
      roadmapHorizon: "Now",
      status: "Blocked",
      title: "Internal codename",
      type: "Task",
    });
    const access = createDatabaseBuildInPublic(database);

    expect(await access.settings("someone-else", profile.id)).toBeNull();
    expect((await access.settings(accountId, profile.id))?.enabled).toBe(false);
    await access.setEnabled(accountId, {
      enabled: true,
      projectId: profile.id,
    });

    const blocked = await access.preview(accountId, { projectId: profile.id });
    expect(blocked?.items[0]).toMatchObject({
      internalStatus: "Blocked",
      publicStatusLabel: null,
    });

    await access.setWorkCopy(accountId, {
      projectId: profile.id,
      publicStatusLabel: "On hold",
      publicSummary: null,
      publicTitle: "Board",
      workId,
    });
    const preview = await access.preview(accountId, { projectId: profile.id });
    const approved = await access.approve(accountId, {
      approval: {
        approvedItemIds: [`work:${workId}`],
        fingerprint: preview?.fingerprint ?? "",
        publishAnyway: false,
      },
      projectId: profile.id,
    });
    expect(approved?.revision).toBe(1);

    const [row] = await database.select().from(work).where(eq(work.id, workId));
    expect(row?.status).toBe("Blocked");
    expect((await access.settings(accountId, profile.id))?.revision).toBe(1);
  });
});
