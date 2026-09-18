import type { CaptureInboxAccess } from "@cantiara/api/capture-triage";
import type {
  WebCaptureLinkSummary,
  WebCaptureSendReceipt,
} from "@cantiara/api/web-capture";
import type { Database } from "@cantiara/db";
import {
  captureExtensionLink,
  captureExtensionPairingCode,
  captureInboxOperation,
} from "@cantiara/db/schema/capture-triage";
import { and, eq, gt, isNull } from "drizzle-orm";
import type {
  WebCaptureLinkRecord,
  WebCaptureProjects,
  WebCaptureStagingStore,
  WebCaptureStore,
} from "./web-capture";
import { createWebCapture } from "./web-capture";

const WEB_CAPTURE_OPERATION_PREFIX = "web-capture:";

function toLinkRecord(
  record: typeof captureExtensionLink.$inferSelect,
): WebCaptureLinkRecord {
  return {
    accountId: record.accountId,
    browser: record.browser as WebCaptureLinkSummary["browser"],
    createdAt: record.createdAt.toISOString(),
    device: record.device,
    id: record.id,
    lastUse: record.lastUse?.toISOString() ?? null,
    revokedAt: record.revokedAt,
    tokenHash: record.tokenHash,
  };
}

export function createDatabaseWebCapture({
  captureInbox,
  database,
  projects,
  staging,
}: {
  captureInbox: Pick<CaptureInboxAccess, "create">;
  database: Database;
  projects: {
    find: WebCaptureProjects["find"];
    list: WebCaptureProjects["list"];
  };
  staging?: WebCaptureStagingStore;
}) {
  const store: WebCaptureStore = {
    async consumePairingCode(codeHash, now) {
      return await database.transaction(async (transaction) => {
        const [record] = await transaction
          .select()
          .from(captureExtensionPairingCode)
          .where(
            and(
              eq(captureExtensionPairingCode.codeHash, codeHash),
              gt(captureExtensionPairingCode.expiresAt, now),
              isNull(captureExtensionPairingCode.consumedAt),
            ),
          )
          .limit(1)
          .for("update");
        if (!record) {
          return null;
        }
        const [consumed] = await transaction
          .update(captureExtensionPairingCode)
          .set({ consumedAt: now })
          .where(
            and(
              eq(captureExtensionPairingCode.id, record.id),
              isNull(captureExtensionPairingCode.consumedAt),
            ),
          )
          .returning({ accountId: captureExtensionPairingCode.accountId });
        return consumed?.accountId ?? null;
      });
    },

    async createLink(input) {
      const [record] = await database
        .insert(captureExtensionLink)
        .values({
          accountId: input.accountId,
          browser: input.browser,
          createdAt: input.createdAt,
          device: input.device,
          id: crypto.randomUUID(),
          tokenHash: input.tokenHash,
        })
        .returning();
      if (!record) {
        throw new Error("Web Capture link could not be created.");
      }
      return toLinkRecord(record);
    },

    async createPairingCode(input) {
      await database.insert(captureExtensionPairingCode).values({
        accountId: input.accountId,
        codeHash: input.codeHash,
        createdAt: input.createdAt,
        expiresAt: input.expiresAt,
        id: crypto.randomUUID(),
      });
    },

    async findCompleted(accountId, clientIdempotencyKey) {
      const [record] = await database
        .select({
          fingerprint: captureInboxOperation.fingerprint,
          value: captureInboxOperation.value,
        })
        .from(captureInboxOperation)
        .where(
          and(
            eq(captureInboxOperation.accountId, accountId),
            eq(
              captureInboxOperation.operationKey,
              `${WEB_CAPTURE_OPERATION_PREFIX}${clientIdempotencyKey}`,
            ),
            eq(captureInboxOperation.kind, "completed"),
          ),
        )
        .limit(1);
      if (!record) {
        return null;
      }
      return {
        fingerprint: record.fingerprint,
        receipt: (record.value as { receipt: WebCaptureSendReceipt }).receipt,
      };
    },

    async findLinkByToken(tokenHash) {
      const [record] = await database
        .select()
        .from(captureExtensionLink)
        .where(eq(captureExtensionLink.tokenHash, tokenHash))
        .limit(1);
      return record ? toLinkRecord(record) : null;
    },

    async listLinks(accountId) {
      const records = await database
        .select()
        .from(captureExtensionLink)
        .where(
          and(
            eq(captureExtensionLink.accountId, accountId),
            isNull(captureExtensionLink.revokedAt),
          ),
        );
      return records.map(toLinkRecord);
    },

    async markCompleted(accountId, clientIdempotencyKey, value) {
      await database
        .insert(captureInboxOperation)
        .values({
          accountId,
          fingerprint: value.fingerprint,
          id: `capture-inbox-operation:${accountId}:completed:${WEB_CAPTURE_OPERATION_PREFIX}${clientIdempotencyKey}`,
          kind: "completed",
          operationKey: `${WEB_CAPTURE_OPERATION_PREFIX}${clientIdempotencyKey}`,
          value,
        })
        .onConflictDoNothing({
          target: [
            captureInboxOperation.accountId,
            captureInboxOperation.kind,
            captureInboxOperation.operationKey,
          ],
        });
    },

    async revokeLink(accountId, linkId, now) {
      await database
        .update(captureExtensionLink)
        .set({ revokedAt: now })
        .where(
          and(
            eq(captureExtensionLink.accountId, accountId),
            eq(captureExtensionLink.id, linkId),
            isNull(captureExtensionLink.revokedAt),
          ),
        );
    },

    async touchLink(linkId, now) {
      await database
        .update(captureExtensionLink)
        .set({ lastUse: now })
        .where(
          and(
            eq(captureExtensionLink.id, linkId),
            isNull(captureExtensionLink.revokedAt),
          ),
        );
    },
  };

  return createWebCapture({
    captureInbox,
    projects,
    staging,
    store,
  });
}
