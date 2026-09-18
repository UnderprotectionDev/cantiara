import type { CaptureInboxAccess } from "@cantiara/api/capture-triage";
import type {
  WebCaptureLinkSummary,
  WebCaptureSendReceipt,
} from "@cantiara/api/web-capture";
import { WEB_CAPTURE_STALE_LINK_AFTER_MS } from "@cantiara/api/web-capture";
import type { Database } from "@cantiara/db";
import {
  captureExtensionLink,
  captureExtensionPairingCode,
  captureInboxOperation,
} from "@cantiara/db/schema/capture-triage";
import { securityEvent } from "@cantiara/db/schema/security-event";
import type { SecurityEventDatabase } from "@cantiara/db/security-events";
import { and, asc, eq, gt, isNull, lt, or } from "drizzle-orm";
import type {
  WebCaptureLinkRecord,
  WebCaptureProjects,
  WebCaptureStagingStore,
  WebCaptureStore,
} from "./web-capture";
import { createWebCapture } from "./web-capture";

const WEB_CAPTURE_OPERATION_PREFIX = "web-capture:";
const WEB_CAPTURE_LINK_REVOKED_EVENT_TYPE = "web-capture-link.revoked";
const WEB_CAPTURE_LINK_REVOKED_EVENT_VERSION = 1;

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
  securityEventDatabase,
  staging,
}: {
  captureInbox: Pick<CaptureInboxAccess, "create">;
  database: Database;
  projects: {
    find: WebCaptureProjects["find"];
    list: WebCaptureProjects["list"];
  };
  securityEventDatabase: SecurityEventDatabase;
  staging?: WebCaptureStagingStore;
}) {
  const store: WebCaptureStore = {
    async authorizeFinalization(linkId, now) {
      return await database.transaction(async (transaction) => {
        const [record] = await transaction
          .select()
          .from(captureExtensionLink)
          .where(eq(captureExtensionLink.id, linkId))
          .limit(1)
          .for("update");
        if (!record || record.revokedAt) {
          return false;
        }
        const lastActivity = record.lastUse ?? record.createdAt;
        if (
          now.getTime() - lastActivity.getTime() >=
          WEB_CAPTURE_STALE_LINK_AFTER_MS
        ) {
          return false;
        }
        const [updated] = await transaction
          .update(captureExtensionLink)
          .set({ lastUse: now })
          .where(
            and(
              eq(captureExtensionLink.id, linkId),
              isNull(captureExtensionLink.revokedAt),
            ),
          )
          .returning({ id: captureExtensionLink.id });
        return Boolean(updated);
      });
    },

    async consumePairingCodeAndCreateLink(input) {
      return await database.transaction(async (transaction) => {
        const [record] = await transaction
          .select()
          .from(captureExtensionPairingCode)
          .where(
            and(
              eq(captureExtensionPairingCode.codeHash, input.codeHash),
              gt(captureExtensionPairingCode.expiresAt, input.createdAt),
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
          .set({ consumedAt: input.createdAt })
          .where(
            and(
              eq(captureExtensionPairingCode.id, record.id),
              isNull(captureExtensionPairingCode.consumedAt),
            ),
          )
          .returning({ accountId: captureExtensionPairingCode.accountId });
        if (!consumed) {
          return null;
        }
        const [link] = await transaction
          .insert(captureExtensionLink)
          .values({
            accountId: consumed.accountId,
            browser: input.browser,
            createdAt: input.createdAt,
            device: input.device,
            id: crypto.randomUUID(),
            tokenHash: input.tokenHash,
          })
          .returning();
        if (!link) {
          throw new Error("Web Capture link could not be created.");
        }
        return toLinkRecord(link);
      });
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

    async revokeLink(accountId, linkId, now, actorAlias) {
      const [link] = await database
        .select({ id: captureExtensionLink.id })
        .from(captureExtensionLink)
        .where(
          and(
            eq(captureExtensionLink.accountId, accountId),
            eq(captureExtensionLink.id, linkId),
            isNull(captureExtensionLink.revokedAt),
          ),
        )
        .limit(1);
      if (!link) {
        return;
      }
      await securityEventDatabase.insert(securityEvent).values({
        actorAlias: actorAlias ?? `account:${accountId}`,
        id: crypto.randomUUID(),
        occurredAt: now,
        targetSessionAlias: link.id,
        type: WEB_CAPTURE_LINK_REVOKED_EVENT_TYPE,
        version: WEB_CAPTURE_LINK_REVOKED_EVENT_VERSION,
      });
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

  const access = createWebCapture({
    captureInbox,
    projects,
    staging,
    store,
  });
  return Object.assign(access, {
    async replayRevocations() {
      const events = await securityEventDatabase
        .select()
        .from(securityEvent)
        .where(eq(securityEvent.type, WEB_CAPTURE_LINK_REVOKED_EVENT_TYPE))
        .orderBy(asc(securityEvent.occurredAt));
      await Promise.all(
        events.map(async (event) => {
          if (event.version !== WEB_CAPTURE_LINK_REVOKED_EVENT_VERSION) {
            throw new Error(
              `Unsupported Web Capture link revoke event version: ${event.version}`,
            );
          }
          await database
            .update(captureExtensionLink)
            .set({ revokedAt: event.occurredAt })
            .where(
              and(
                eq(captureExtensionLink.id, event.targetSessionAlias),
                or(
                  isNull(captureExtensionLink.revokedAt),
                  lt(captureExtensionLink.revokedAt, event.occurredAt),
                ),
              ),
            );
        }),
      );
    },
  });
}
