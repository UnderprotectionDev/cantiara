import { GITHUB_DELIVERY_RESULT_RETENTION_MS } from "@cantiara/api/github-integration";

import type {
  GitHubInboxStore,
  StoredDelivery,
  StoredPayload,
  StoredWebhookSecret,
} from "../github-webhook-inbox";

/** In-memory inbox harness; mirrors the PostgreSQL store's retention and uniqueness. */
export function createMemoryInboxStore() {
  const deliveries = new Map<string, StoredDelivery>();
  const payloads = new Map<string, StoredPayload>();
  const secretRows: StoredWebhookSecret[] = [];

  const store: GitHubInboxStore = {
    deliveryById: (deliveryId) =>
      Promise.resolve(deliveries.get(deliveryId) ?? null),
    insertDelivery: (delivery, payload) => {
      if (deliveries.has(delivery.deliveryId)) {
        return Promise.resolve(false);
      }
      deliveries.set(delivery.deliveryId, { ...delivery });
      payloads.set(delivery.deliveryId, payload);
      return Promise.resolve(true);
    },
    insertSecret: (secret) => {
      secretRows.push({ ...secret });
      return Promise.resolve();
    },
    loadPayload: (deliveryId) =>
      Promise.resolve(payloads.get(deliveryId) ?? null),
    pendingBefore: (receivedBefore) =>
      Promise.resolve(
        [...deliveries.values()]
          .filter(
            (delivery) =>
              delivery.status === "received" &&
              delivery.receivedAt <= receivedBefore,
          )
          .map((delivery) => delivery.deliveryId),
      ),
    retireSecret: (id, at) => {
      const row = secretRows.find((secret) => secret.id === id);
      if (row) {
        row.retiredAt = at;
      }
      return Promise.resolve();
    },
    secrets: () => Promise.resolve(secretRows.map((row) => ({ ...row }))),
    setPayloadExpiry: (deliveryId, expiresAt) => {
      const payload = payloads.get(deliveryId);
      if (payload) {
        payloads.set(deliveryId, { ...payload, expiresAt });
      }
      return Promise.resolve();
    },
    sweep: (now) => {
      let payloadCount = 0;
      for (const [id, payload] of payloads) {
        if (payload.expiresAt <= now) {
          payloads.delete(id);
          payloadCount += 1;
        }
      }
      let deliveryCount = 0;
      const cutoff = new Date(
        Date.parse(now) - GITHUB_DELIVERY_RESULT_RETENTION_MS,
      ).toISOString();
      for (const [id, delivery] of deliveries) {
        if (delivery.receivedAt <= cutoff) {
          deliveries.delete(id);
          payloads.delete(id);
          deliveryCount += 1;
        }
      }
      return Promise.resolve({
        deliveries: deliveryCount,
        payloads: payloadCount,
      });
    },
    updateDelivery: (deliveryId, patch) => {
      const row = deliveries.get(deliveryId);
      if (row) {
        Object.assign(row, patch);
      }
      return Promise.resolve();
    },
  };

  return {
    /** Raw rows, for asserting what persists and what is physically gone. */
    deliveries,
    payloads,
    secretRows,
    store,
  };
}
