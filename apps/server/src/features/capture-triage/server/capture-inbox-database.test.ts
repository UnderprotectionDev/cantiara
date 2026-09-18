import type { MutationPayload } from "@cantiara/api/mutation-and-undo";
import { createDb } from "@cantiara/db";
import { user } from "@cantiara/db/schema/auth";
import {
  captureInboxBulkView,
  captureInboxItem,
  captureInboxOperation,
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
import {
  captureInboxMutationTarget,
  createDatabaseCaptureInbox,
} from "./capture-inbox-database";
import { createDevelopmentCaptureInboxTriageAdapter } from "./capture-inbox-development-adapter";

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
    const failedDeleteTargetId = `capture-triage:${accountId}:delete:atomic-delete-fails`;
    const retryDeleteTargetId = `capture-triage:${accountId}:delete:atomic-delete-retry`;
    const captureInbox = createDatabaseCaptureInbox(
      database,
      { createBug: async () => ({ workId: "unused" }) },
      createDatabaseMutationContract<MutationPayload>(database, {
        target: captureInboxMutationTarget,
      }),
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
      const triageTargetIds = [failedDeleteTargetId, retryDeleteTargetId];
      await database
        .delete(captureInboxOperation)
        .where(eq(captureInboxOperation.accountId, accountId));
      await database
        .delete(captureInboxBulkView)
        .where(eq(captureInboxBulkView.accountId, accountId));
      await database
        .delete(captureInboxItem)
        .where(eq(captureInboxItem.accountId, accountId));
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

  test("converts and attaches Workspace captures through the database mutation boundary", async () => {
    if (!database) {
      throw new Error("ACCOUNT_ACCESS_DATABASE_URL is required");
    }

    const accountId = `capture-triage-${crypto.randomUUID()}`;
    const captureClientIdempotencyKey = `capture-${crypto.randomUUID()}`;
    const convertClientIdempotencyKey = `convert-${crypto.randomUUID()}`;
    const attachCaptureClientIdempotencyKey = `capture-${crypto.randomUUID()}`;
    const attachClientIdempotencyKey = `attach-${crypto.randomUUID()}`;
    const captureTargetId = `capture-inbox:${accountId}:${captureClientIdempotencyKey}`;
    const convertTargetId = `capture-triage:${accountId}:convert:${convertClientIdempotencyKey}`;
    const attachCaptureTargetId = `capture-inbox:${accountId}:${attachCaptureClientIdempotencyKey}`;
    const attachTargetId = `capture-triage:${accountId}:attach:${attachClientIdempotencyKey}`;
    const targetIds = [
      captureTargetId,
      convertTargetId,
      attachCaptureTargetId,
      attachTargetId,
    ];

    await database.insert(user).values({
      email: `${accountId}@example.invalid`,
      id: accountId,
      name: "Capture triage test account",
    });

    const captureInbox = createDatabaseCaptureInbox(
      database,
      { createBug: async () => ({ workId: "unused" }) },
      createDatabaseMutationContract(database, {
        target: captureInboxMutationTarget,
      }),
      createDevelopmentCaptureInboxTriageAdapter(),
    );

    try {
      const item = await captureInbox.create(accountId, {
        clientIdempotencyKey: captureClientIdempotencyKey,
        content: "A database-backed conversion capture",
        fields: {},
        projectId: null,
        template: null,
      });
      const preview = await captureInbox.previewConvert(accountId, {
        itemId: item.id,
        recordType: "Work",
      });

      await expect(
        captureInbox.convert(accountId, {
          clientIdempotencyKey: convertClientIdempotencyKey,
          itemId: item.id,
          previewId: preview.previewId,
        }),
      ).resolves.toMatchObject({
        consumed: true,
        recordType: "Work",
      });
      await expect(captureInbox.list(accountId)).resolves.toMatchObject({
        items: [],
      });

      const attachedItem = await captureInbox.create(accountId, {
        clientIdempotencyKey: attachCaptureClientIdempotencyKey,
        content: "A database-backed attachment capture",
        fields: {},
        projectId: null,
        template: null,
      });
      const attachmentPreview = await captureInbox.previewAttachToExisting(
        accountId,
        {
          itemId: attachedItem.id,
          relation: "Origin",
          targetId: "target-1",
        },
      );

      await expect(
        captureInbox.attachToExisting(accountId, {
          clientIdempotencyKey: attachClientIdempotencyKey,
          itemId: attachedItem.id,
          previewId: attachmentPreview.previewId,
          relation: "Origin",
          targetId: "target-1",
        }),
      ).resolves.toMatchObject({
        consumed: true,
        exit: "attach",
      });
      await expect(captureInbox.list(accountId)).resolves.toMatchObject({
        items: [],
      });
    } finally {
      await database
        .delete(captureInboxOperation)
        .where(eq(captureInboxOperation.accountId, accountId));
      await database
        .delete(captureInboxBulkView)
        .where(eq(captureInboxBulkView.accountId, accountId));
      await database
        .delete(captureInboxItem)
        .where(eq(captureInboxItem.accountId, accountId));
      await database
        .delete(mutationHistory)
        .where(inArray(mutationHistory.targetId, targetIds));
      await database
        .delete(mutationReceipt)
        .where(inArray(mutationReceipt.targetId, targetIds));
      await database
        .delete(mutationTarget)
        .where(inArray(mutationTarget.id, targetIds));
      await database.delete(user).where(eq(user.id, accountId));
    }
  }, 20_000);
});
