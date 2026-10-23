import { GITHUB_DELIVERY_RESULT_RETENTION_MS } from "@cantiara/api/github-integration";
import type { Database } from "@cantiara/db";
import {
  githubWebhookDelivery,
  githubWebhookPayload,
  githubWebhookSecret,
} from "@cantiara/db/schema/github-integration";
import { and, asc, eq, lte } from "drizzle-orm";

import type {
  GitHubDeliveryStatus,
  GitHubInboxStore,
  StoredDelivery,
} from "./github-webhook-inbox";

const iso = (value: Date) => value.toISOString();

function toDelivery(
  row: typeof githubWebhookDelivery.$inferSelect,
): StoredDelivery {
  return {
    attempts: row.attempts,
    deliveryId: row.deliveryId,
    event: row.event,
    installationId: row.installationId,
    lastError: row.lastError,
    payloadHash: row.payloadHash,
    processedAt: row.processedAt ? iso(row.processedAt) : null,
    receivedAt: iso(row.receivedAt),
    result: row.result,
    status: row.status as GitHubDeliveryStatus,
  };
}

export function createDatabaseInboxStore(database: Database): GitHubInboxStore {
  return {
    async deliveryById(deliveryId) {
      const [row] = await database
        .select()
        .from(githubWebhookDelivery)
        .where(eq(githubWebhookDelivery.deliveryId, deliveryId));
      return row ? toDelivery(row) : null;
    },

    async insertDelivery(delivery, payload) {
      return await database.transaction(async (executor) => {
        const inserted = await executor
          .insert(githubWebhookDelivery)
          .values({
            attempts: delivery.attempts,
            deliveryId: delivery.deliveryId,
            event: delivery.event,
            installationId: delivery.installationId,
            payloadHash: delivery.payloadHash,
            receivedAt: new Date(delivery.receivedAt),
            status: delivery.status,
          })
          .onConflictDoNothing()
          .returning({ deliveryId: githubWebhookDelivery.deliveryId });
        if (inserted.length === 0) {
          return false;
        }
        await executor.insert(githubWebhookPayload).values({
          ciphertext: payload.sealed.ciphertext,
          deliveryId: delivery.deliveryId,
          expiresAt: new Date(payload.expiresAt),
          keyVersion: payload.sealed.keyVersion,
          wrappedDataKey: payload.sealed.wrappedDataKey,
        });
        return true;
      });
    },

    async insertSecret(secret) {
      await database.insert(githubWebhookSecret).values({
        activatedAt: new Date(secret.activatedAt),
        ciphertext: secret.sealed.ciphertext,
        id: secret.id,
        keyVersion: secret.sealed.keyVersion,
        retiredAt: secret.retiredAt ? new Date(secret.retiredAt) : null,
        wrappedDataKey: secret.sealed.wrappedDataKey,
      });
    },

    async loadPayload(deliveryId) {
      const [row] = await database
        .select()
        .from(githubWebhookPayload)
        .where(eq(githubWebhookPayload.deliveryId, deliveryId));
      return row
        ? {
            expiresAt: iso(row.expiresAt),
            sealed: {
              ciphertext: row.ciphertext,
              keyVersion: row.keyVersion,
              wrappedDataKey: row.wrappedDataKey,
            },
          }
        : null;
    },

    async pendingBefore(receivedBefore) {
      return (
        await database
          .select({ deliveryId: githubWebhookDelivery.deliveryId })
          .from(githubWebhookDelivery)
          .where(
            and(
              eq(githubWebhookDelivery.status, "received"),
              lte(githubWebhookDelivery.receivedAt, new Date(receivedBefore)),
            ),
          )
      ).map((row) => row.deliveryId);
    },

    async retireSecret(id, at) {
      await database
        .update(githubWebhookSecret)
        .set({ retiredAt: new Date(at) })
        .where(eq(githubWebhookSecret.id, id));
    },

    async secrets() {
      return (
        await database
          .select()
          .from(githubWebhookSecret)
          .orderBy(asc(githubWebhookSecret.activatedAt))
      ).map((row) => ({
        activatedAt: iso(row.activatedAt),
        id: row.id,
        retiredAt: row.retiredAt ? iso(row.retiredAt) : null,
        sealed: {
          ciphertext: row.ciphertext,
          keyVersion: row.keyVersion,
          wrappedDataKey: row.wrappedDataKey,
        },
      }));
    },

    async setPayloadExpiry(deliveryId, expiresAt) {
      await database
        .update(githubWebhookPayload)
        .set({ expiresAt: new Date(expiresAt) })
        .where(eq(githubWebhookPayload.deliveryId, deliveryId));
    },

    async sweep(now) {
      const at = new Date(now);
      const payloads = await database
        .delete(githubWebhookPayload)
        .where(lte(githubWebhookPayload.expiresAt, at))
        .returning({ deliveryId: githubWebhookPayload.deliveryId });
      const deliveries = await database
        .delete(githubWebhookDelivery)
        .where(
          lte(
            githubWebhookDelivery.receivedAt,
            new Date(at.getTime() - GITHUB_DELIVERY_RESULT_RETENTION_MS),
          ),
        )
        .returning({ deliveryId: githubWebhookDelivery.deliveryId });
      return { deliveries: deliveries.length, payloads: payloads.length };
    },

    async updateDelivery(deliveryId, patch) {
      await database
        .update(githubWebhookDelivery)
        .set({
          ...(patch.attempts === undefined ? {} : { attempts: patch.attempts }),
          ...(patch.lastError === undefined
            ? {}
            : { lastError: patch.lastError }),
          ...(patch.processedAt === undefined
            ? {}
            : {
                processedAt: patch.processedAt
                  ? new Date(patch.processedAt)
                  : null,
              }),
          ...(patch.result === undefined ? {} : { result: patch.result }),
          ...(patch.status === undefined ? {} : { status: patch.status }),
        })
        .where(eq(githubWebhookDelivery.deliveryId, deliveryId));
    },
  };
}
