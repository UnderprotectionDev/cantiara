import { createDb } from "@cantiara/db";
import { user, workspace } from "@cantiara/db/schema/auth";
import { project } from "@cantiara/db/schema/project";
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

import {
  createDatabaseReleaseFacts,
  createDatabaseReleaseStore,
} from "../release-communication-database";

const databaseUrl =
  process.env.ACCOUNT_ACCESS_DATABASE_URL ?? process.env.DATABASE_URL;
const describeDatabase = databaseUrl ? describe : describe.skip;

describeDatabase("Release Communication PostgreSQL integration", () => {
  const database = databaseUrl
    ? createDb({ DATABASE_URL: databaseUrl })
    : undefined;
  const accountId = `release-communication-${crypto.randomUUID()}`;
  const workspaceId = `workspace-${crypto.randomUUID()}`;
  const projectId = `project-${crypto.randomUUID()}`;
  const releaseId = `release-${crypto.randomUUID()}`;

  function requireDatabase() {
    if (!database) {
      throw new Error("DATABASE_URL is required");
    }
    return database;
  }

  beforeEach(async () => {
    const db = requireDatabase();
    await db.insert(user).values({
      email: `${accountId}@example.invalid`,
      id: accountId,
      name: "Founder",
    });
    await db
      .insert(workspace)
      .values({ id: workspaceId, ownerAccountId: accountId });
    await db.insert(project).values({
      id: projectId,
      name: "Release Communication Project",
      shortCode: `RC-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
      starterConfiguration: "Blank Project",
      workspaceId,
    });
    await db.insert(projectRelease).values({
      id: releaseId,
      name: "v1",
      projectId,
      status: "Published",
    });
  });

  afterEach(async () => {
    await database?.delete(user).where(eq(user.id, accountId));
  });

  afterAll(async () => {
    await database?.$client.end();
  });

  const draft = (
    baseRevision: number,
    noteId: string | null,
    body: string,
  ) => ({
    authorId: accountId,
    baseRevision,
    body,
    noteId,
    projectId,
    releaseId,
    savedAt: "2026-10-23T09:00:00.000Z",
    scopeWorkIds: ["work-1"],
    tagIds: [],
    whyTrail: [],
  });

  test("owns the Release through the Workspace owner only", async () => {
    const facts = createDatabaseReleaseFacts(requireDatabase());
    expect(await facts.release(accountId, releaseId)).toMatchObject({
      id: releaseId,
      projectId,
      status: "Published",
    });
    expect(await facts.release("someone-else", releaseId)).toBeNull();
    expect(await facts.projectOwned("someone-else", projectId)).toBe(false);
  });

  test("a note saves with optimistic revisions and publishes one frozen snapshot", async () => {
    const store = createDatabaseReleaseStore(requireDatabase());
    const created = await store.saveNote(draft(0, null, "First"));
    expect(created.revision).toBe(1);
    await expect(
      store.saveNote(draft(0, created.id, "Stale")),
    ).rejects.toMatchObject({ code: "RELEASE_COMMUNICATION_STALE_REVISION" });
    expect(await store.changelog(projectId)).toEqual([]);

    const entry = await store.publish({
      approvedAt: "2026-10-23T10:00:00.000Z",
      body: "First",
      buildInPublicEventIds: [],
      changelogLinks: [],
      noteId: created.id,
      publicLabels: [{ label: "Released", workId: "work-1" }],
      releaseId,
      tagIds: [],
      whyTrail: [],
    });

    expect(entry.revision).toBe(1);
    expect((await store.changelog(projectId))[0]?.body).toBe("First");
    expect((await store.findNote(created.id))?.status).toBe("Published");
    await expect(
      store.publish({ ...entry, approvedAt: "2026-10-23T11:00:00.000Z" }),
    ).rejects.toMatchObject({
      code: "RELEASE_COMMUNICATION_ALREADY_PUBLISHED",
    });
    await expect(
      store.saveNote(draft(1, created.id, "After publish")),
    ).rejects.toMatchObject({ code: "RELEASE_COMMUNICATION_STALE_REVISION" });
  });

  test("rounds keep their own observations and corrections keep the previous value", async () => {
    const store = createDatabaseReleaseStore(requireDatabase());
    const first = await store.createRound({
      projectId,
      releaseId,
      startedAt: "2026-10-23T09:00:00.000Z",
    });
    const second = await store.createRound({
      projectId,
      releaseId,
      startedAt: "2026-11-23T09:00:00.000Z",
    });
    expect([first.sequence, second.sequence]).toEqual([1, 2]);

    const write = (baseRevision: number, text: string) => ({
      assessment: "Observed" as const,
      authorId: accountId,
      baseRevision,
      evidence: [],
      kind: "access" as const,
      observedAt: "2026-10-23T09:00:00.000Z",
      roundId: first.id,
      savedAt: "2026-10-23T09:30:00.000Z",
      text,
    });
    await store.saveObservation(write(0, "one"));
    const corrected = await store.saveObservation(write(1, "two"));
    await expect(
      store.saveObservation(write(1, "three")),
    ).rejects.toMatchObject({
      code: "RELEASE_COMMUNICATION_STALE_REVISION",
    });

    expect(corrected.access).toMatchObject({
      previous: [{ revision: 1, text: "one" }],
      revision: 2,
      text: "two",
    });
    const rounds = await store.listRounds(releaseId);
    expect(rounds[1]?.access).toBeNull();
    expect(rounds[0]?.outcome).toBeNull();
  });

  test("Close assessment closes only that round and open rounds list per Project", async () => {
    const store = createDatabaseReleaseStore(requireDatabase());
    const round = await store.createRound({
      projectId,
      releaseId,
      startedAt: "2026-10-23T09:00:00.000Z",
    });
    expect(await store.openRounds(projectId)).toHaveLength(1);

    const closed = await store.closeRound(round.id, "2026-10-24T09:00:00.000Z");

    expect(closed.closeReason).toBe("Close assessment");
    expect(await store.openRounds(projectId)).toEqual([]);
  });
});
