import {
  type AccountPreferences,
  accountPreferencesSchema,
  DEFAULT_ACCOUNT_PREFERENCES,
} from "@cantiara/api/account-preferences";
import { createDb } from "@cantiara/db";
import { accountPreferences, user } from "@cantiara/db/schema/auth";
import {
  mutationHistory,
  mutationReceipt,
  mutationStaging,
} from "@cantiara/db/schema/mutation";
import { eq } from "drizzle-orm";
import { afterAll, describe, expect, test } from "vitest";

import { accountPreferencesMutationTarget } from "../../account-preferences/server/account-preferences-database";
import { MutationUndoConflictError } from "./mutation-contract";
import { createDatabaseMutationContract } from "./mutation-contract-database";

const databaseUrl = process.env.ACCOUNT_ACCESS_DATABASE_URL;
const describeDatabase = databaseUrl ? describe : describe.skip;
const allowBarrierChecks = {
  authorization: () => true,
  quota: () => true,
  scope: () => true,
};

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
        barrierChecks: allowBarrierChecks,
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

  test("commits staging once and rolls back a failed multi-step target update", async () => {
    if (!database) {
      throw new Error("ACCOUNT_ACCESS_DATABASE_URL is required");
    }

    const accountId = `mutation-atomic-${crypto.randomUUID()}`;
    const email = `${accountId}@example.invalid`;
    const payload: AccountPreferences = {
      ...DEFAULT_ACCOUNT_PREFERENCES,
      appearance: "Light",
    };
    const command = {
      actor: { actorId: accountId, type: "User" as const },
      baseRevision: 0,
      clientIdempotencyKey: "atomic-commit-key",
      kind: "human" as const,
      payload,
      targetId: accountId,
    };
    const contract = createDatabaseMutationContract<AccountPreferences>(
      database,
      {
        barrierChecks: allowBarrierChecks,
        now: () => new Date("2026-09-16T09:00:00.000Z"),
        target: accountPreferencesMutationTarget,
      },
    );

    await database.insert(user).values({
      email,
      emailVerified: true,
      id: accountId,
      name: "Atomic mutation test",
    });

    try {
      const staged = await contract.stage(command, {
        undo: { kind: "field", scope: "appearance" },
      });
      const committed = await contract.finalize(
        staged.id,
        ({ payload: nextValue }) => accountPreferencesSchema.parse(nextValue),
      );
      const retry = await contract.finalize(
        staged.id,
        ({ payload: nextValue }) => accountPreferencesSchema.parse(nextValue),
      );

      expect(retry).toEqual(committed);
      expect(committed).toMatchObject({
        receipt: {
          nextValue: payload,
          previousValue: DEFAULT_ACCOUNT_PREFERENCES,
          revision: 1,
          undo: {
            after: "Light",
            before: DEFAULT_ACCOUNT_PREFERENCES.appearance,
            kind: "field",
            scope: "appearance",
          },
        },
        status: "committed",
      });

      const [savedPreferences] = await database
        .select()
        .from(accountPreferences)
        .where(eq(accountPreferences.accountId, accountId));
      const [savedStaging] = await database
        .select()
        .from(mutationStaging)
        .where(eq(mutationStaging.id, staged.id));
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
      expect(savedStaging).toMatchObject({
        payload: null,
        status: "committed",
        undo: {
          after: "Light",
          before: DEFAULT_ACCOUNT_PREFERENCES.appearance,
          kind: "field",
          scope: "appearance",
        },
      });
      expect(receiptsInDatabase).toHaveLength(1);
      expect(historyInDatabase).toHaveLength(1);

      const failingTarget: typeof accountPreferencesMutationTarget = {
        ...accountPreferencesMutationTarget,
        async update(executor, input) {
          await accountPreferencesMutationTarget.update(executor, input);
          throw new Error("simulated second staged step failure");
        },
      };
      const failingContract =
        createDatabaseMutationContract<AccountPreferences>(database, {
          barrierChecks: allowBarrierChecks,
          now: () => new Date("2026-09-16T09:01:00.000Z"),
          target: failingTarget,
        });
      const failedStaging = await failingContract.stage({
        ...command,
        baseRevision: 1,
        clientIdempotencyKey: "atomic-rollback-key",
        payload: { ...payload, appearance: "Dark" },
      });
      const rolledBack = await failingContract.finalize(
        failedStaging.id,
        ({ payload: nextValue }) => accountPreferencesSchema.parse(nextValue),
      );

      expect(rolledBack).toMatchObject({
        receipt: { reason: "apply-failed", status: "rolled-back" },
        status: "rolled-back",
      });
      const [stillSavedPreferences] = await database
        .select()
        .from(accountPreferences)
        .where(eq(accountPreferences.accountId, accountId));
      const failedReceipts = await database
        .select()
        .from(mutationReceipt)
        .where(eq(mutationReceipt.targetId, accountId));
      const failedHistory = await database
        .select()
        .from(mutationHistory)
        .where(eq(mutationHistory.targetId, accountId));
      const [failedStagingRecord] = await database
        .select()
        .from(mutationStaging)
        .where(eq(mutationStaging.id, failedStaging.id));

      expect(stillSavedPreferences).toMatchObject({
        appearance: "Light",
        revision: 1,
      });
      expect(failedReceipts).toHaveLength(1);
      expect(failedHistory).toHaveLength(1);
      expect(failedStagingRecord).toMatchObject({
        payload: null,
        rollbackReason: "apply-failed",
        status: "rolled-back",
      });
    } finally {
      await database
        .delete(mutationStaging)
        .where(eq(mutationStaging.targetId, accountId));
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

  test("persists safe Undo metadata and protects a newer same-field value", async () => {
    if (!database) {
      throw new Error("ACCOUNT_ACCESS_DATABASE_URL is required");
    }

    const accountId = `mutation-undo-${crypto.randomUUID()}`;
    const email = `${accountId}@example.invalid`;
    const contract = createDatabaseMutationContract<AccountPreferences>(
      database,
      {
        barrierChecks: allowBarrierChecks,
        now: () => new Date("2026-09-16T09:00:00.000Z"),
        target: accountPreferencesMutationTarget,
      },
    );
    await database.insert(user).values({
      email,
      emailVerified: true,
      id: accountId,
      name: "Safe Undo test",
    });

    try {
      const edited = await contract.mutate(
        {
          actor: { actorId: accountId, type: "User" },
          baseRevision: 0,
          clientIdempotencyKey: "undoable-appearance",
          kind: "human",
          payload: { appearance: "Light" },
          targetId: accountId,
        },
        ({ currentValue, payload }) =>
          accountPreferencesSchema.parse({ ...currentValue, ...payload }),
        { undo: { kind: "field", scope: "appearance" } },
      );

      expect(edited.undo).toMatchObject({
        after: "Light",
        before: DEFAULT_ACCOUNT_PREFERENCES.appearance,
        kind: "field",
        scope: "appearance",
      });
      const [receiptRow] = await database
        .select()
        .from(mutationReceipt)
        .where(eq(mutationReceipt.id, edited.id));
      const [historyRow] = await database
        .select()
        .from(mutationHistory)
        .where(eq(mutationHistory.id, edited.id));
      expect(receiptRow?.undo).toEqual(edited.undo);
      expect(historyRow?.undo).toEqual(edited.undo);

      const undone = await contract.undo(edited, {
        actor: { actorId: accountId, type: "User" },
        baseRevision: 1,
        clientIdempotencyKey: "undo-appearance",
        kind: "human",
        payload: { undoOf: edited.id },
        targetId: accountId,
      });
      expect(undone).toMatchObject({
        undoOf: edited.id,
        previousValue: { appearance: "Light" },
        nextValue: { appearance: DEFAULT_ACCOUNT_PREFERENCES.appearance },
      });

      await expect(
        contract.undo(edited, {
          actor: { actorId: accountId, type: "User" },
          baseRevision: 2,
          clientIdempotencyKey: "undo-appearance-again",
          kind: "human",
          payload: { undoOf: edited.id },
          targetId: accountId,
        }),
      ).rejects.toBeInstanceOf(MutationUndoConflictError);
    } finally {
      await database
        .delete(mutationHistory)
        .where(eq(mutationHistory.targetId, accountId));
      await database
        .delete(mutationReceipt)
        .where(eq(mutationReceipt.targetId, accountId));
      await database
        .delete(mutationStaging)
        .where(eq(mutationStaging.targetId, accountId));
      await database
        .delete(accountPreferences)
        .where(eq(accountPreferences.accountId, accountId));
      await database.delete(user).where(eq(user.id, accountId));
    }
  });
});
