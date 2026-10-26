import { createDb } from "@cantiara/db";
import { user, workspace } from "@cantiara/db/schema/auth";
import { mutationHistory } from "@cantiara/db/schema/mutation";
import { projectMilestone } from "@cantiara/db/schema/project-milestone";
import { projectRelease } from "@cantiara/db/schema/project-release";
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
import { createDatabaseProjectHistory } from "../project-history-database";

const databaseUrl = process.env.ACCOUNT_ACCESS_DATABASE_URL;
const describeDatabase = databaseUrl ? describe : describe.skip;

const REACHED_AT = new Date("2026-05-01T10:00:00.000Z");
const RENAMED_AT = new Date("2026-05-01T12:00:00.000Z");
const PUBLISHED_AT = new Date("2026-05-02T10:00:00.000Z");
const RELEASE_EDITED_AT = new Date("2026-05-02T12:00:00.000Z");
const NEVER_EDITED_AT = new Date("2026-05-03T10:00:00.000Z");

describeDatabase("Project History PostgreSQL story times", () => {
  const database = databaseUrl
    ? createDb({ DATABASE_URL: databaseUrl })
    : undefined;
  const accountId = `history-${crypto.randomUUID()}`;
  const historyRow = (
    id: string,
    targetId: string,
    occurredAt: Date,
    previous: unknown,
    next: unknown,
  ) => ({
    actorId: accountId,
    actorType: "User",
    clientIdempotencyKey: id,
    id,
    nextValue: next,
    occurredAt,
    originKind: "human",
    payloadFingerprint: id,
    previousValue: previous,
    revision: 1,
    targetId,
  });

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
      id: `workspace-${crypto.randomUUID()}`,
      ownerAccountId: accountId,
    });
  });
  afterEach(async () => {
    await database
      ?.delete(mutationHistory)
      .where(eq(mutationHistory.actorId, accountId));
    await database?.delete(user).where(eq(user.id, accountId));
  });
  afterAll(async () => {
    await database?.$client.end();
  });

  test("dates a Milestone and Project Release event from its own status transition, not a later edit", async () => {
    if (!database) {
      throw new Error("ACCOUNT_ACCESS_DATABASE_URL is required");
    }
    const profile = await createDatabaseProjectShell(database).create(
      accountId,
      {
        name: "History Project",
        shortCode: "HIS",
        starterConfiguration: "Blank Project",
      },
    );
    const [reached, neverEdited, published] = [
      `milestone-${crypto.randomUUID()}`,
      `milestone-${crypto.randomUUID()}`,
      `release-${crypto.randomUUID()}`,
    ];
    // updatedAt is later than every transition: the story must not use it.
    await database.insert(projectMilestone).values([
      {
        id: reached,
        projectId: profile.id,
        status: "Reached",
        title: "Alpha",
        updatedAt: RENAMED_AT,
      },
      {
        id: neverEdited,
        projectId: profile.id,
        status: "Reached",
        title: "No history",
        updatedAt: NEVER_EDITED_AT,
      },
    ]);
    await database.insert(projectRelease).values({
      id: published,
      name: "Beta",
      projectId: profile.id,
      status: "Published",
      updatedAt: RELEASE_EDITED_AT,
    });
    await database.insert(mutationHistory).values([
      historyRow(
        `h-${crypto.randomUUID()}`,
        reached,
        REACHED_AT,
        { milestone: { id: reached, status: "Planned", title: "Alpha" } },
        { milestone: { id: reached, status: "Reached", title: "Alpha" } },
      ),
      historyRow(
        `h-${crypto.randomUUID()}`,
        reached,
        RENAMED_AT,
        { milestone: { id: reached, status: "Reached", title: "Alpha" } },
        {
          milestone: { id: reached, status: "Reached", title: "Alpha renamed" },
        },
      ),
      historyRow(
        `h-${crypto.randomUUID()}`,
        published,
        PUBLISHED_AT,
        {
          projectRelease: { id: published, status: "Preparing", name: "Beta" },
        },
        {
          projectRelease: { id: published, status: "Published", name: "Beta" },
        },
      ),
      historyRow(
        `h-${crypto.randomUUID()}`,
        published,
        RELEASE_EDITED_AT,
        {
          projectRelease: { id: published, status: "Published", name: "Beta" },
        },
        {
          projectRelease: {
            id: published,
            status: "Published",
            name: "Beta renamed",
          },
        },
      ),
    ]);

    const timeline = await createDatabaseProjectHistory(database).storyTimeline(
      accountId,
      { projectId: profile.id, scope: "Project" },
    );
    const times = new Map(
      timeline.events.map((event) => [event.source.recordId, event.occurredAt]),
    );
    expect(times.get(reached)).toBe(REACHED_AT.toISOString());
    expect(times.get(published)).toBe(PUBLISHED_AT.toISOString());
    expect(times.get(neverEdited)).toBe(NEVER_EDITED_AT.toISOString());
  });
});
