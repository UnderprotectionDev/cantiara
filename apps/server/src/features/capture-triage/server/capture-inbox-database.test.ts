import { createDb } from "@cantiara/db";
import { user } from "@cantiara/db/schema/auth";
import {
  captureInboxItem,
  captureInboxOperation,
} from "@cantiara/db/schema/capture-triage";
import {
  mutationHistory,
  mutationReceipt,
  mutationTarget,
} from "@cantiara/db/schema/mutation";
import { eq, inArray } from "drizzle-orm";
import { afterAll, describe, expect, test } from "vitest";
import { createDatabaseMutationContract } from "../../mutation-and-undo/server/mutation-contract-database";
import {
  captureInboxMutationTarget,
  createDatabaseCaptureInbox,
} from "./capture-inbox-database";
import { createDevelopmentCaptureInboxTriageAdapter } from "./capture-inbox-development-adapter";

const databaseUrl = process.env.CAPTURE_TRIAGE_DATABASE_URL;
const describeDatabase = databaseUrl ? describe : describe.skip;

describeDatabase("Capture Inbox PostgreSQL integration", () => {
  const database = databaseUrl
    ? createDb({ DATABASE_URL: databaseUrl })
    : undefined;
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

  afterAll(async () => {
    if (!database) {
      return;
    }

    await database
      .delete(captureInboxOperation)
      .where(eq(captureInboxOperation.accountId, accountId));
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
    await database.$client.end();
  });

  test("converts and attaches Workspace captures through the database mutation boundary", async () => {
    if (!database) {
      throw new Error("CAPTURE_TRIAGE_DATABASE_URL is required");
    }

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
  }, 20_000);
});
