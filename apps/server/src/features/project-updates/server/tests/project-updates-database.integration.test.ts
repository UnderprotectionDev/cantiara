import type { PersonalRemindersAccess } from "@cantiara/api/personal-reminders";
import { createDb } from "@cantiara/db";
import { user, workspace } from "@cantiara/db/schema/auth";
import { project } from "@cantiara/db/schema/project";
import { projectUpdate } from "@cantiara/db/schema/project-update";
import { risk } from "@cantiara/db/schema/risk";
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
import { createDatabaseProjectUpdates } from "../project-updates-database";

const databaseUrl = process.env.ACCOUNT_ACCESS_DATABASE_URL;
const describeDatabase = databaseUrl ? describe : describe.skip;

const snapshot = {
  blocks: [],
  lifecycle: "Active",
  purpose: null,
  targetDate: null,
};

const personalReminders = {} as PersonalRemindersAccess;

describeDatabase("Manual Project Updates PostgreSQL", () => {
  const database = databaseUrl
    ? createDb({ DATABASE_URL: databaseUrl })
    : undefined;
  const accountId = `updates-${crypto.randomUUID()}`;

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

  test("appends dated entries with live links and never rewrites one", async () => {
    if (!database) {
      throw new Error("ACCOUNT_ACCESS_DATABASE_URL is required");
    }
    const profile = await createDatabaseProjectShell(database).create(
      accountId,
      {
        name: "Updates",
        shortCode: "UPD",
        starterConfiguration: "Blank Project",
      },
    );
    const riskId = `risk-${crypto.randomUUID()}`;
    await database
      .insert(risk)
      .values({ id: riskId, projectId: profile.id, title: "Slip" });
    const access = createDatabaseProjectUpdates(database, personalReminders);
    const base = {
      links: [{ targetId: riskId, targetType: "Risk" as const }],
      narrative: "Scope grew.",
      projectId: profile.id,
      snapshot,
    };
    const first = await access.create(accountId, {
      ...base,
      mark: "At Risk",
      updateId: `u-${crypto.randomUUID()}`,
    });
    await access.create(accountId, {
      ...base,
      links: [],
      mark: "On Track",
      updateId: `u-${crypto.randomUUID()}`,
    });
    // A rewrite of the first id is a conflict and leaves the row unchanged.
    await expect(
      access.create(accountId, {
        ...base,
        mark: "Off Track",
        updateId: first?.id ?? "",
      }),
    ).rejects.toMatchObject({ code: "PROJECT_UPDATE_CONFLICT" });

    const overview = await access.overview(accountId, profile.id);
    expect(overview?.updates.map((update) => update.mark)).toEqual([
      "On Track",
      "At Risk",
    ]);
    expect(overview?.updates[1]?.links[0]).toMatchObject({
      label: "Slip",
      unavailable: false,
    });

    // The linked record stays live: its change shows, the snapshot does not.
    await database
      .update(risk)
      .set({ title: "Slip, renamed" })
      .where(eq(risk.id, riskId));
    const later = await access.overview(accountId, profile.id);
    expect(later?.updates[1]?.links[0]?.label).toBe("Slip, renamed");
    expect(later?.updates[1]?.snapshot).toEqual(snapshot);
  });

  test("keeps updates readable and takes none in an archived Project", async () => {
    if (!database) {
      throw new Error("ACCOUNT_ACCESS_DATABASE_URL is required");
    }
    const profile = await createDatabaseProjectShell(database).create(
      accountId,
      {
        name: "Archived",
        shortCode: "ARC",
        starterConfiguration: "Blank Project",
      },
    );
    const access = createDatabaseProjectUpdates(database, personalReminders);
    await access.create(accountId, {
      links: [],
      mark: "On Track",
      narrative: "Before archive.",
      projectId: profile.id,
      snapshot,
      updateId: `u-${crypto.randomUUID()}`,
    });
    await database
      .update(project)
      .set({ archivedAt: new Date() })
      .where(eq(project.id, profile.id));
    await expect(
      access.create(accountId, {
        links: [],
        mark: "At Risk",
        narrative: "After archive.",
        projectId: profile.id,
        snapshot,
        updateId: `u-${crypto.randomUUID()}`,
      }),
    ).rejects.toMatchObject({ code: "PROJECT_UPDATE_READ_ONLY" });
    const overview = await access.overview(accountId, profile.id);
    expect(overview?.readOnly).toBe(true);
    expect(overview?.updates).toHaveLength(1);
    const rows = await database
      .select({ id: projectUpdate.id })
      .from(projectUpdate)
      .where(eq(projectUpdate.projectId, profile.id));
    expect(rows).toHaveLength(1);
  });
});
