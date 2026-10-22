// biome-ignore-all lint/performance/noAwaitInLoops: A delivery's events apply in order, one unit of work each.
import { createHash, createHmac, timingSafeEqual } from "node:crypto";

import {
  GITHUB_PAYLOAD_FAILED_RETENTION_MS,
  GITHUB_PAYLOAD_SUCCESS_RETENTION_MS,
  GITHUB_WEBHOOK_SECRET_MAX_AGE_MS,
  GITHUB_WEBHOOK_SECRET_OVERLAP_MS,
  type GitHubIntegrationAccess,
  type SealedSecret,
} from "@cantiara/api/github-integration";

import type { GitHubSecrets } from "./github-credential-envelope";
import { toWebhookEvents } from "./github-webhook-events";

/**
 * GitHub webhook durable inbox (spec 61, PRD 12, ADR-0004 idempotency).
 *
 * `receive` is the whole HTTP side: it verifies the signature, writes one
 * inbox row per GitHub delivery id and answers. It never reads GitHub, never
 * syncs a field and never writes a record; `process` does that in the worker,
 * where a failure is retried and an exhausted one is dead-lettered loudly.
 */

export const GITHUB_DELIVERY_STATUSES = [
  "received",
  "processed",
  "failed",
  "dead-letter",
] as const;
export type GitHubDeliveryStatus = (typeof GITHUB_DELIVERY_STATUSES)[number];

export interface StoredDelivery {
  attempts: number;
  deliveryId: string;
  event: string;
  installationId: number | null;
  lastError: string | null;
  payloadHash: string;
  processedAt: string | null;
  receivedAt: string;
  result: string | null;
  status: GitHubDeliveryStatus;
}

export interface StoredPayload {
  expiresAt: string;
  sealed: SealedSecret;
}

export interface StoredWebhookSecret {
  activatedAt: string;
  id: string;
  retiredAt: string | null;
  sealed: SealedSecret;
}

export interface GitHubInboxStore {
  deliveryById: (deliveryId: string) => Promise<StoredDelivery | null>;
  /** `false` when the delivery id already exists (a concurrent duplicate). */
  insertDelivery: (
    delivery: StoredDelivery,
    payload: StoredPayload,
  ) => Promise<boolean>;
  insertSecret: (secret: StoredWebhookSecret) => Promise<void>;
  loadPayload: (deliveryId: string) => Promise<StoredPayload | null>;
  /** Delivery ids still `received` since before the cutoff (an enqueue was lost). */
  pendingBefore: (receivedBefore: string) => Promise<string[]>;
  retireSecret: (id: string, at: string) => Promise<void>;
  secrets: () => Promise<StoredWebhookSecret[]>;
  setPayloadExpiry: (deliveryId: string, expiresAt: string) => Promise<void>;
  /** Physically deletes expired payloads, then deliveries past 30 days. */
  sweep: (now: string) => Promise<{ deliveries: number; payloads: number }>;
  updateDelivery: (
    deliveryId: string,
    patch: Partial<
      Pick<
        StoredDelivery,
        "attempts" | "lastError" | "processedAt" | "result" | "status"
      >
    >,
  ) => Promise<void>;
}

export interface ReceiveInput {
  deliveryId: string | null;
  event: string | null;
  rawBody: string;
  signature: string | null;
}

export interface ReceiveResult {
  body: {
    deliveryId?: string;
    duplicate?: boolean;
    error?: string;
    result?: string | null;
    status?: GitHubDeliveryStatus;
  };
  /** 202 accepted, 200 duplicate, 400 malformed, 401 bad signature, 503 not configured. */
  status: 200 | 202 | 400 | 401 | 503;
}

export interface OperatorAlarm {
  action: string;
  deliveryId?: string;
  detail: string;
}

export interface GitHubWebhookInboxOptions {
  /** Operator-visible alarm (Evlog in production); a dead-letter must never be silent. */
  alarm: (alarm: OperatorAlarm) => void;
  /** Initial secret from the environment, sealed into the store on first use. */
  bootstrapSecret?: string;
  /** Queues a delivery for the worker; its failure never fails the ACK. */
  enqueue: (deliveryId: string) => Promise<void>;
  integration: Pick<GitHubIntegrationAccess, "applyWebhookEvent">;
  newId?: () => string;
  now?: () => Date;
  secrets: GitHubSecrets;
  store: GitHubInboxStore;
}

const MIN_SECRET_LENGTH = 16;
const SIGNATURE_PREFIX = "sha256=";
const SIGNATURE_FORMAT = /^sha256=[0-9a-f]{64}$/i;
const PENDING_GRACE_MS = 60_000;
const ERROR_TEXT_LIMIT = 300;

export class GitHubWebhookSecretError extends Error {
  readonly code = "GITHUB_WEBHOOK_SECRET_TOO_SHORT" as const;

  constructor() {
    super(`A webhook secret needs at least ${MIN_SECRET_LENGTH} characters.`);
    this.name = "GitHubWebhookSecretError";
  }
}

function matchesSignature(secret: string, rawBody: string, signature: string) {
  if (!signature.startsWith(SIGNATURE_PREFIX)) {
    return false;
  }
  const expected = Buffer.from(
    createHmac("sha256", secret).update(rawBody).digest("hex"),
  );
  const actual = Buffer.from(signature.slice(SIGNATURE_PREFIX.length));
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export function createGitHubWebhookInbox(options: GitHubWebhookInboxOptions) {
  const { alarm, secrets, store } = options;
  const now = options.now ?? (() => new Date());
  const newId = options.newId ?? (() => crypto.randomUUID());
  const after = (ms: number) => new Date(now().getTime() + ms).toISOString();

  async function ensureBootstrapped() {
    if (options.bootstrapSecret && (await store.secrets()).length === 0) {
      const id = newId();
      await store.insertSecret({
        activatedAt: now().toISOString(),
        id,
        retiredAt: null,
        sealed: secrets.seal(options.bootstrapSecret, `webhook-secret:${id}`),
      });
    }
  }

  /** The active secret, plus a retired one for at most 15 minutes after rotation. */
  async function verifyingSecrets() {
    await ensureBootstrapped();
    return (await store.secrets())
      .filter(
        (secret) =>
          secret.retiredAt === null ||
          now().getTime() - Date.parse(secret.retiredAt) <=
            GITHUB_WEBHOOK_SECRET_OVERLAP_MS,
      )
      .map((secret) =>
        secrets.open(secret.sealed, `webhook-secret:${secret.id}`),
      );
  }

  function enqueueQuietly(deliveryId: string) {
    // Fire and forget: the ACK never waits on the queue, and a lost enqueue is redriven.
    options.enqueue(deliveryId).catch((error: unknown) => {
      alarm({
        action: "github.webhook.enqueue-failed",
        deliveryId,
        detail: error instanceof Error ? error.message : "enqueue failed",
      });
    });
  }

  return {
    /** Operator seam: rotates the webhook secret now (<= 90 days, or at once on suspected access). */
    async rotateSecret(newSecret: string) {
      if (newSecret.length < MIN_SECRET_LENGTH) {
        throw new GitHubWebhookSecretError();
      }
      await ensureBootstrapped();
      const at = now().toISOString();
      for (const secret of await store.secrets()) {
        if (secret.retiredAt === null) {
          await store.retireSecret(secret.id, at);
        }
      }
      const id = newId();
      await store.insertSecret({
        activatedAt: at,
        id,
        retiredAt: null,
        sealed: secrets.seal(newSecret, `webhook-secret:${id}`),
      });
      return {
        // The old secret stops verifying here; GitHub must switch before then.
        previousValidUntil: after(GITHUB_WEBHOOK_SECRET_OVERLAP_MS),
      };
    },

    /** Daily check: raises an operator alarm when the active secret is 90 days old. */
    async checkSecretAge() {
      await ensureBootstrapped();
      const active = (await store.secrets()).find(
        (secret) => secret.retiredAt === null,
      );
      if (!active) {
        return { due: false, dueAt: null };
      }
      const dueAt = new Date(
        Date.parse(active.activatedAt) + GITHUB_WEBHOOK_SECRET_MAX_AGE_MS,
      );
      const due = dueAt <= now();
      if (due) {
        alarm({
          action: "github.webhook.secret-rotation-due",
          detail: `The webhook secret is older than 90 days (due ${dueAt.toISOString()}).`,
        });
      }
      return { due, dueAt: dueAt.toISOString() };
    },

    async receive(input: ReceiveInput): Promise<ReceiveResult> {
      // A missing or malformed header costs no store read or decrypt.
      if (!(input.signature && SIGNATURE_FORMAT.test(input.signature))) {
        return { body: { error: "invalid-signature" }, status: 401 };
      }
      const candidates = await verifyingSecrets();
      if (candidates.length === 0) {
        return { body: { error: "not-configured" }, status: 503 };
      }
      // Nothing is written before the signature verifies.
      if (
        !(
          input.signature &&
          candidates.some((secret) =>
            matchesSignature(secret, input.rawBody, input.signature ?? ""),
          )
        )
      ) {
        return { body: { error: "invalid-signature" }, status: 401 };
      }
      if (!(input.deliveryId && input.event)) {
        return { body: { error: "malformed" }, status: 400 };
      }
      const existing = await store.deliveryById(input.deliveryId);
      if (existing) {
        if (existing.status === "received") {
          enqueueQuietly(existing.deliveryId);
        }
        return {
          body: {
            deliveryId: existing.deliveryId,
            duplicate: true,
            result: existing.result,
            status: existing.status,
          },
          status: 200,
        };
      }
      const received = now().toISOString();
      const inserted = await store.insertDelivery(
        {
          attempts: 0,
          deliveryId: input.deliveryId,
          event: input.event,
          installationId: null,
          lastError: null,
          payloadHash: createHash("sha256").update(input.rawBody).digest("hex"),
          processedAt: null,
          receivedAt: received,
          result: null,
          status: "received",
        },
        {
          expiresAt: after(GITHUB_PAYLOAD_FAILED_RETENTION_MS),
          sealed: secrets.seal(
            input.rawBody,
            `webhook-payload:${input.deliveryId}`,
          ),
        },
      );
      if (!inserted) {
        const prior = await store.deliveryById(input.deliveryId);
        return {
          body: {
            deliveryId: input.deliveryId,
            duplicate: true,
            result: prior?.result ?? null,
            status: prior?.status ?? "received",
          },
          status: 200,
        };
      }
      enqueueQuietly(input.deliveryId);
      return {
        body: {
          deliveryId: input.deliveryId,
          duplicate: false,
          status: "received",
        },
        status: 202,
      };
    },

    /**
     * Applies one inbox delivery. Throws on failure so the queue retries; on the
     * final attempt the delivery is dead-lettered with an operator alarm and its
     * payload stays (<= 7 days) so reconcile or a person can still recover it.
     */
    // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: A delivery is loaded, applied, recorded and dead-lettered at one retry boundary.
    async process(deliveryId: string, attempt: { final: boolean }) {
      const delivery = await store.deliveryById(deliveryId);
      if (!delivery) {
        return "missing";
      }
      if (
        delivery.status === "processed" ||
        delivery.status === "dead-letter"
      ) {
        return delivery.result ?? delivery.status;
      }
      try {
        const payload = await store.loadPayload(deliveryId);
        if (!payload) {
          throw new Error("The inbox payload is no longer available.");
        }
        const events = toWebhookEvents(
          delivery.event,
          JSON.parse(
            secrets.open(payload.sealed, `webhook-payload:${deliveryId}`),
          ),
        );
        const results: string[] = [];
        for (const event of events) {
          results.push(await options.integration.applyWebhookEvent(event));
        }
        const result = results.length > 0 ? results.join("; ") : "ignored";
        await store.updateDelivery(deliveryId, {
          attempts: delivery.attempts + 1,
          lastError: null,
          processedAt: now().toISOString(),
          result,
          status: "processed",
        });
        // A processed payload is kept at most 24 hours.
        const successExpiry = after(GITHUB_PAYLOAD_SUCCESS_RETENTION_MS);
        if (successExpiry < payload.expiresAt) {
          await store.setPayloadExpiry(deliveryId, successExpiry);
        }
        return result;
      } catch (error) {
        const message = (
          error instanceof Error ? error.message : "Processing failed."
        ).slice(0, ERROR_TEXT_LIMIT);
        await store.updateDelivery(deliveryId, {
          attempts: delivery.attempts + 1,
          lastError: message,
          status: attempt.final ? "dead-letter" : "failed",
        });
        if (attempt.final) {
          alarm({
            action: "github.webhook.dead-letter",
            deliveryId,
            detail: message,
          });
        }
        throw error;
      }
    },

    /** Re-queues deliveries whose enqueue was lost; reconcile still covers the gap. */
    async redrivePending() {
      const cutoff = new Date(now().getTime() - PENDING_GRACE_MS).toISOString();
      const ids = await store.pendingBefore(cutoff);
      for (const id of ids) {
        enqueueQuietly(id);
      }
      return ids.length;
    },

    /** Retention: payloads past their expiry and deliveries past 30 days are physically deleted. */
    async sweepRetention() {
      return await store.sweep(now().toISOString());
    },
  };
}

export type GitHubWebhookInbox = ReturnType<typeof createGitHubWebhookInbox>;
