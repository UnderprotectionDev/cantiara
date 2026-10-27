import { createDb } from "@cantiara/db";
import { user, workspace } from "@cantiara/db/schema/auth";
import { projectUpdate } from "@cantiara/db/schema/project-update";
import { eq } from "drizzle-orm";
import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  test,
} from "vitest";
import { createDatabasePersonalReminders } from "./features/personal-reminders/server/personal-reminders-database";
import { createDatabaseProjectShell } from "./features/project-shell/server/project-shell-database";
import { createProjectUpdatesService } from "./project-updates-wiring";

const databaseUrl = process.env.ACCOUNT_ACCESS_DATABASE_URL;
const describeDatabase = databaseUrl ? describe : describe.skip;

describeDatabase("Project Update reminder through Personal Reminders", () => {
  const database = databaseUrl
    ? createDb({ DATABASE_URL: databaseUrl })
    : undefined;
  const accountId = `update-reminder-${crypto.randomUUID()}`;

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

  test("a due reminder is a personal-reminder signal that opens the form; skip writes no update", async () => {
    if (!database) {
      throw new Error("ACCOUNT_ACCESS_DATABASE_URL is required");
    }
    const profile = await createDatabaseProjectShell(database).create(
      accountId,
      {
        name: "Reminded",
        shortCode: "REM",
        starterConfiguration: "Blank Project",
      },
    );
    const reminders = createDatabasePersonalReminders(database);
    const access = createProjectUpdatesService(database, reminders);
    const configured = await access.configureReminder(accountId, {
      intervalDays: 7,
      projectId: profile.id,
      question: "What changed?",
      state: "Enabled",
    });
    expect(configured).toMatchObject({ due: false, state: "Enabled" });

    await reminders.fireDuePersonalReminders(
      new Date(Date.now() + 8 * 86_400_000),
    );
    const signals = await reminders.listSignals(accountId);
    expect(signals).toHaveLength(1);
    expect(signals[0]).toMatchObject({
      signalType: "personal-reminder",
      sourcePath: `/projects/${profile.id}#project-updates`,
    });
    expect((await access.reminder(accountId, profile.id))?.due).toBe(true);

    await access.skipReminder(accountId, profile.id);
    expect((await access.reminder(accountId, profile.id))?.due).toBe(false);
    expect(
      await database
        .select()
        .from(projectUpdate)
        .where(eq(projectUpdate.projectId, profile.id)),
    ).toEqual([]);

    const paused = await access.configureReminder(accountId, {
      intervalDays: 7,
      projectId: profile.id,
      question: "What changed?",
      state: "Paused",
    });
    expect(paused).toMatchObject({ nextDueAt: null, state: "Paused" });
  });
});
