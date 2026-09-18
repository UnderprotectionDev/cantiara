import type { MutationPayload } from "@cantiara/api/mutation-and-undo";
import { createDb } from "@cantiara/db";
import { user } from "@cantiara/db/schema/auth";
import {
  captureInboxBulkView,
  captureInboxItem,
} from "@cantiara/db/schema/capture-triage";
import {
  mutationHistory,
  mutationReceipt,
  mutationStaging,
  mutationTarget,
} from "@cantiara/db/schema/mutation";
import { and, eq, inArray } from "drizzle-orm";
import { afterAll, describe, expect, test } from "vitest";

import { createDatabaseMutationContract } from "../../mutation-and-undo/server/mutation-contract-database";
import { createDatabaseCaptureInbox } from "./capture-inbox-database";

const databaseUrl = process.env.ACCOUNT_ACCESS_DATABASE_URL;
const describeDatabase = databaseUrl ? describe : describe.skip;

describeDatabase("Capture Inbox PostgreSQL integration", () => {
  const database = databaseUrl
    ? createDb({ DATABASE_URL: databaseUrl })
    : undefined;

  afterAll(async () => {
    await database?.$client.end();
  });

  test("keeps the Inbox item when Bulk cleanup fails", async () => {
    if (!database) {
      throw new Error("ACCOUNT_ACCESS_DATABASE_URL is required");
    }

    const accountId = `capture-atomic-${crypto.randomUUID()}`;
    const itemId = `capture-${crypto.randomUUID()}`;
    const captureInbox = createDatabaseCaptureInbox(
      database,
      { createBug: async () => ({ workId: "unused" }) },
      createDatabaseMutationContract<MutationPayload>(database),
    );

    await database.insert(user).values({
      email: `${accountId}@example.invalid`,
      id: accountId,
      name: "Capture Inbox test",
    });
    await database.insert(captureInboxItem).values({
      accountId,
      content: "Retry this consume",
      createdAt: new Date("2026-09-16T09:00:00.000Z"),
      fields: {},
      id: itemId,
      projectId: null,
      template: null,
    });
    await database.insert(captureInboxBulkView).values({
      accountId,
      clusters: { invalid: true },
      placements: [{ clusterId: null, itemId, position: 0 }],
      revision: 1,
    });

    try {
      await expect(
        captureInbox.delete(accountId, {
          clientIdempotencyKey: "atomic-delete-fails",
          itemId,
        }),
      ).rejects.toThrow();

      const afterFailedConsume = await database
        .select()
        .from(captureInboxItem)
        .where(
          and(
            eq(captureInboxItem.accountId, accountId),
            eq(captureInboxItem.id, itemId),
          ),
        );
      expect(afterFailedConsume).toHaveLength(1);

      await database
        .update(captureInboxBulkView)
        .set({ clusters: [], placements: [] })
        .where(eq(captureInboxBulkView.accountId, accountId));

      await expect(
        captureInbox.delete(accountId, {
          clientIdempotencyKey: "atomic-delete-retry",
          itemId,
        }),
      ).resolves.toMatchObject({
        consumed: true,
        exit: "delete",
        itemId,
      });
      await expect(captureInbox.list(accountId)).resolves.toMatchObject({
        bulkSenseMaking: { placements: [] },
        items: [],
      });
    } finally {
      const triageTargetIds = [
        `capture-triage:${accountId}:delete:atomic-delete-fails`,
        `capture-triage:${accountId}:delete:atomic-delete-retry`,
      ];
      await database
        .delete(mutationStaging)
        .where(inArray(mutationStaging.targetId, triageTargetIds));
      await database
        .delete(mutationHistory)
        .where(inArray(mutationHistory.targetId, triageTargetIds));
      await database
        .delete(mutationReceipt)
        .where(inArray(mutationReceipt.targetId, triageTargetIds));
      await database
        .delete(mutationTarget)
        .where(inArray(mutationTarget.id, triageTargetIds));
      await database.delete(user).where(eq(user.id, accountId));
    }
  });
});
