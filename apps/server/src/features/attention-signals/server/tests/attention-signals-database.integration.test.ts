import { createDb } from "@cantiara/db";
import { attentionSignal } from "@cantiara/db/schema/attention-signals";
import { user, workspace } from "@cantiara/db/schema/auth";
import { project } from "@cantiara/db/schema/project";
import { eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, test } from "vitest";
import { createDatabaseAttentionSignals } from "../attention-signals-database";
import { createDatabasePublicRoadmapReview } from "../public-roadmap-review-database";

const databaseUrl = process.env.ACCOUNT_ACCESS_DATABASE_URL;
const describeDatabase = databaseUrl ? describe : describe.skip;

// The Work insertion boundary belongs to the Work owner; these cases never reach it.
const ports = {
  insertWork: () => Promise.reject(new Error("insertWork is not used here.")),
};

describeDatabase("Attention Signals PostgreSQL seam", () => {
  const database = databaseUrl
    ? createDb({ DATABASE_URL: databaseUrl })
    : undefined;
  let accountId = "";

  beforeEach(async () => {
    if (!database) {
      throw new Error("ACCOUNT_ACCESS_DATABASE_URL is required");
    }
    accountId = `attention-${crypto.randomUUID().replaceAll("-", "").slice(0, 12)}`;
    await database.insert(user).values({
      email: `${accountId}@example.invalid`,
      id: accountId,
      name: "Founder",
    });
  });

  afterAll(async () => {
    if (database && accountId) {
      await database.delete(user).where(eq(user.id, accountId));
    }
  });

  const input = (overrides: Record<string, unknown> = {}) =>
    ({
      eventId: "event-1",
      group: { id: "risk-1", kind: "Risk" },
      occurredAt: "2026-10-27T09:00:00.000Z",
      reason: "Open Risk.",
      signalId: "open-risk",
      targetId: "risk-1",
      ...overrides,
    }) as never;

  test("dedupes on the unique identity and keeps one row", async () => {
    if (!database) {
      throw new Error("ACCOUNT_ACCESS_DATABASE_URL is required");
    }
    const access = createDatabaseAttentionSignals(database, ports);
    const first = await access.emit(accountId, input());
    const retry = await access.emit(accountId, input());
    expect(first.outcome).toBe("created");
    expect(retry.outcome).toBe("duplicate");
    expect(retry.signal.id).toBe(first.signal.id);
    const rows = await database
      .select()
      .from(attentionSignal)
      .where(eq(attentionSignal.accountId, accountId));
    expect(rows).toHaveLength(1);
  });

  test("refuses an unregistered id and the database CHECK refuses it too", async () => {
    if (!database) {
      throw new Error("ACCOUNT_ACCESS_DATABASE_URL is required");
    }
    const access = createDatabaseAttentionSignals(database, ports);
    await expect(
      access.emit(accountId, input({ signalId: "free-form" })),
    ).rejects.toMatchObject({ code: "ATTENTION_SIGNAL_NOT_REGISTERED" });
    await expect(
      database.insert(attentionSignal).values({
        accountId,
        eventId: "e",
        groupId: "g",
        groupKind: "k",
        id: "raw-1",
        occurredAt: new Date(),
        reason: "r",
        signalId: "free-form",
        targetId: "t",
      }),
    ).rejects.toThrow();
  });

  test("read and closed marks write only the signal row and reopen cleanly", async () => {
    if (!database) {
      throw new Error("ACCOUNT_ACCESS_DATABASE_URL is required");
    }
    const access = createDatabaseAttentionSignals(database, ports);
    const { signal } = await access.emit(accountId, input());
    const read = await access.mark(accountId, {
      mark: "read",
      signalRowId: signal.id,
    });
    expect(read.readAt).not.toBeNull();
    expect(read.closedAt).toBeNull();
    const closed = await access.mark(accountId, {
      mark: "closed",
      signalRowId: signal.id,
    });
    expect(closed.closedAt).not.toBeNull();
    const reopened = await access.mark(accountId, {
      mark: "reopened",
      signalRowId: signal.id,
    });
    expect(reopened.closedAt).toBeNull();
    await expect(
      access.mark("someone-else", { mark: "read", signalRowId: signal.id }),
    ).rejects.toMatchObject({ code: "ATTENTION_SIGNAL_NOT_FOUND" });
  });

  test("a deleted Work source shows a tombstone without the producer's text", async () => {
    if (!database) {
      throw new Error("ACCOUNT_ACCESS_DATABASE_URL is required");
    }
    const access = createDatabaseAttentionSignals(database, ports);
    await access.emit(
      accountId,
      input({
        group: { id: `missing-work-${accountId}`, kind: "Work" },
        reason: "Private text of a deleted record.",
        signalId: "work-blocked",
        targetId: "t-1",
      }),
    );
    const [action] = (await access.center(accountId)).sections;
    const row = action?.groups[0]?.signals[0];
    expect(row?.tombstone).toBe(true);
    expect(row?.reason).not.toContain("Private text");
  });

  test("the public Roadmap review interval is stored per Project and clears to silence", async () => {
    if (!database) {
      throw new Error("ACCOUNT_ACCESS_DATABASE_URL is required");
    }
    const workspaceId = `ws-${accountId}`;
    const projectId = `pr-${accountId}`;
    await database
      .insert(workspace)
      .values({ id: workspaceId, ownerAccountId: accountId });
    await database.insert(project).values({
      id: projectId,
      name: "Attention Project",
      shortCode: `AT${accountId.slice(-5).toUpperCase()}`,
      starterConfiguration: "Blank Project",
      workspaceId,
    });
    const review = createDatabasePublicRoadmapReview(
      database,
      createDatabaseAttentionSignals(database, ports),
    );
    expect(await review.interval(accountId, { projectId })).toEqual({
      days: null,
      projectId,
    });
    await review.setInterval(accountId, { days: 45, projectId });
    expect((await review.interval(accountId, { projectId })).days).toBe(45);
    await expect(review.refresh(accountId)).resolves.toEqual({ emitted: 0 });
    await review.setInterval(accountId, { days: null, projectId });
    expect((await review.interval(accountId, { projectId })).days).toBeNull();
    await expect(
      review.setInterval("someone-else", { days: 30, projectId }),
    ).rejects.toMatchObject({
      code: "PUBLIC_ROADMAP_REVIEW_PROJECT_NOT_FOUND",
    });
  });
});
