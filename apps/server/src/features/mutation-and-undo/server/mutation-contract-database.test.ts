import {
  type AccountPreferences,
  accountPreferencesSchema,
  DEFAULT_ACCOUNT_PREFERENCES,
} from "@cantiara/api/account-preferences";
import { createDb } from "@cantiara/db";
import { accountPreferences, user } from "@cantiara/db/schema/auth";
import { mutationHistory, mutationReceipt } from "@cantiara/db/schema/mutation";
import { eq } from "drizzle-orm";
import { afterAll, describe, expect, test } from "vitest";

import { accountPreferencesMutationTarget } from "../../account-preferences/server/account-preferences-database";
import { createDatabaseMutationContract } from "./mutation-contract-database";

const databaseUrl = process.env.ACCOUNT_ACCESS_DATABASE_URL;
const describeDatabase = databaseUrl ? describe : describe.skip;

describeDatabase("Mutation Contract PostgreSQL boundary", () => {
  const database = databaseUrl
    ? createDb({ DATABASE_URL: databaseUrl })
    : undefined;

  afterAll(async () => {
    await database?.$client.end();
  });

  test("replays one concurrent first insert and rejects another stale write", async () => {
    if (!database) {
      throw new Error("ACCOUNT_ACCESS_DATABASE_URL is required");
    }

    const accountId = `mutation-${crypto.randomUUID()}`;
    const email = `${accountId}@example.invalid`;
    const payload: AccountPreferences = {
      ...DEFAULT_ACCOUNT_PREFERENCES,
      appearance: "Light",
    };
    const apply = ({ payload: nextValue }: { payload: AccountPreferences }) =>
      accountPreferencesSchema.parse(nextValue);
    const contract = createDatabaseMutationContract<AccountPreferences>(
      database,
      {
        now: () => new Date("2026-09-16T09:00:00.000Z"),
        target: accountPreferencesMutationTarget,
      },
    );
    const command = {
      actor: { actorId: accountId, type: "User" as const },
      baseRevision: 0,
      clientIdempotencyKey: "first-insert-key",
      kind: "human" as const,
      payload,
      targetId: accountId,
    };

    await database.insert(user).values({
      email,
      emailVerified: true,
      id: accountId,
      name: "Mutation Contract test",
    });

    try {
      const receipts = await Promise.all([
        contract.mutate(command, apply),
        contract.mutate(command, apply),
      ]);

      expect(receipts[0]).toEqual(receipts[1]);
      await expect(
        contract.mutate(
          {
            ...command,
            clientIdempotencyKey: "stale-key",
            payload: { ...payload, appearance: "Dark" },
          },
          apply,
        ),
      ).rejects.toMatchObject({
        code: "STALE_BASE_REVISION",
        currentRevision: 1,
        currentValue: payload,
      });

      const [savedPreferences] = await database
        .select()
        .from(accountPreferences)
        .where(eq(accountPreferences.accountId, accountId));
      const receiptsInDatabase = await database
        .select()
        .from(mutationReceipt)
        .where(eq(mutationReceipt.targetId, accountId));
      const historyInDatabase = await database
        .select()
        .from(mutationHistory)
        .where(eq(mutationHistory.targetId, accountId));

      expect(savedPreferences).toMatchObject({
        appearance: "Light",
        revision: 1,
      });
      expect(receiptsInDatabase).toHaveLength(1);
      expect(historyInDatabase).toHaveLength(1);
    } finally {
      await database
        .delete(mutationHistory)
        .where(eq(mutationHistory.targetId, accountId));
      await database
        .delete(mutationReceipt)
        .where(eq(mutationReceipt.targetId, accountId));
      await database
        .delete(accountPreferences)
        .where(eq(accountPreferences.accountId, accountId));
      await database.delete(user).where(eq(user.id, accountId));
    }
  });
});
