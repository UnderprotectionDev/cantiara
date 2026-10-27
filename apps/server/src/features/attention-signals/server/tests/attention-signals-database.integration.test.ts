import { createDb } from "@cantiara/db";
import { attentionSignal } from "@cantiara/db/schema/attention-signals";
import { user } from "@cantiara/db/schema/auth";
import { eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, test } from "vitest";
import { createDatabaseAttentionSignals } from "../attention-signals-database";

const databaseUrl = process.env.ACCOUNT_ACCESS_DATABASE_URL;
const describeDatabase = databaseUrl ? describe : describe.skip;

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
    const access = createDatabaseAttentionSignals(database);
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
    const access = createDatabaseAttentionSignals(database);
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
});
