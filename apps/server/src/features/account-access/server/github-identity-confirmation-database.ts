import type { Database } from "@cantiara/db";
import {
  account,
  auditRecord,
  rateLimit,
  verification,
} from "@cantiara/db/schema/auth";
import { and, eq, gt, sql } from "drizzle-orm";

import {
  createGitHubIdentityConfirmation,
  type GitHubIdentityConfirmation,
  type GitHubIdentityConfirmationAuditRecord,
  type GitHubIdentityConfirmationGrant,
  type GitHubIdentityConfirmationHandoff,
  type GitHubIdentityConfirmationRateLimit,
  type GitHubIdentityConfirmationState,
  type GitHubIdentityConfirmationStore,
  isConfirmGitHubIdentityOperationId,
} from "./github-identity-confirmation";
import {
  createGitHubIdentityConfirmationOAuth,
  type GitHubIdentityConfirmationOAuthAvailability,
  type GitHubOAuthFetchInit,
  type GitHubOAuthFetchResponse,
} from "./github-identity-confirmation-oauth";

const CONFIRMATION_RATE_LIMIT_MAX = 5;
const CONFIRMATION_RATE_LIMIT_WINDOW_MS = 60_000;
const BASE64_URL_VALUE_PATTERN = /^[A-Za-z0-9_-]{43}$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseState(value: string): GitHubIdentityConfirmationState | null {
  try {
    const parsed: unknown = JSON.parse(value);
    if (
      !isRecord(parsed) ||
      typeof parsed.accountId !== "string" ||
      parsed.accountId.length === 0 ||
      typeof parsed.codeVerifier !== "string" ||
      !BASE64_URL_VALUE_PATTERN.test(parsed.codeVerifier) ||
      typeof parsed.operationId !== "string" ||
      !isConfirmGitHubIdentityOperationId(parsed.operationId) ||
      typeof parsed.sessionId !== "string" ||
      parsed.sessionId.length === 0 ||
      (parsed.clientPlatform !== undefined &&
        parsed.clientPlatform !== "web" &&
        parsed.clientPlatform !== "tauri")
    ) {
      return null;
    }

    return {
      accountId: parsed.accountId,
      codeVerifier: parsed.codeVerifier,
      clientPlatform: parsed.clientPlatform === "tauri" ? "tauri" : "web",
      operationId: parsed.operationId,
      sessionId: parsed.sessionId,
    };
  } catch {
    return null;
  }
}

function parseHandoff(value: string): GitHubIdentityConfirmationHandoff | null {
  try {
    const parsed: unknown = JSON.parse(value);
    if (
      !isRecord(parsed) ||
      typeof parsed.accountId !== "string" ||
      parsed.accountId.length === 0 ||
      typeof parsed.grant !== "string" ||
      !BASE64_URL_VALUE_PATTERN.test(parsed.grant) ||
      typeof parsed.grantIdentifier !== "string" ||
      parsed.grantIdentifier.length === 0 ||
      typeof parsed.operationId !== "string" ||
      !isConfirmGitHubIdentityOperationId(parsed.operationId) ||
      typeof parsed.sessionId !== "string" ||
      parsed.sessionId.length === 0
    ) {
      return null;
    }

    return {
      accountId: parsed.accountId,
      grant: parsed.grant,
      grantIdentifier: parsed.grantIdentifier,
      operationId: parsed.operationId,
      sessionId: parsed.sessionId,
    };
  } catch {
    return null;
  }
}

function grantValue(grant: GitHubIdentityConfirmationGrant) {
  return JSON.stringify({
    accountId: grant.accountId,
    operationId: grant.operationId,
  });
}

export function createDatabaseGitHubIdentityConfirmation(
  database: Database,
  options: {
    authorizeSession?: Parameters<
      typeof createGitHubIdentityConfirmation
    >[0]["authorizeSession"];
    callbackURL: string;
    clientId: string;
    clientSecret: string;
    fetch?: (
      input: string | URL,
      init?: GitHubOAuthFetchInit,
    ) => Promise<GitHubOAuthFetchResponse>;
    githubAvailability?: GitHubIdentityConfirmationOAuthAvailability;
    now?: () => Date;
  },
): GitHubIdentityConfirmation {
  const currentTime = options.now ?? (() => new Date());

  const store: GitHubIdentityConfirmationStore = {
    async consumeGrant(identifier, grant, now) {
      const [record] = await database
        .delete(verification)
        .where(
          and(
            eq(verification.identifier, identifier),
            eq(verification.value, grantValue(grant)),
            gt(verification.expiresAt, now),
          ),
        )
        .returning({ id: verification.id });
      return Boolean(record);
    },
    consumeHandoff(identifier, principal, now) {
      return database.transaction(async (transaction) => {
        const [record] = await transaction
          .select({ id: verification.id, value: verification.value })
          .from(verification)
          .where(
            and(
              eq(verification.identifier, identifier),
              gt(verification.expiresAt, now),
            ),
          )
          .limit(1);
        const handoff = record ? parseHandoff(record.value) : null;
        if (
          !(
            record &&
            handoff &&
            handoff.accountId === principal.accountId &&
            handoff.sessionId === principal.sessionId
          )
        ) {
          return null;
        }

        const [deletedHandoff] = await transaction
          .delete(verification)
          .where(eq(verification.id, record.id))
          .returning({ id: verification.id });
        if (!deletedHandoff) {
          return null;
        }

        return handoff;
      });
    },
    async consumeState(identifier, now) {
      const [record] = await database
        .delete(verification)
        .where(
          and(
            eq(verification.identifier, identifier),
            gt(verification.expiresAt, now),
          ),
        )
        .returning({ value: verification.value });
      return record ? parseState(record.value) : null;
    },
    async findState(identifier, now) {
      const [record] = await database
        .select({ value: verification.value })
        .from(verification)
        .where(
          and(
            eq(verification.identifier, identifier),
            gt(verification.expiresAt, now),
          ),
        )
        .limit(1);
      return record ? parseState(record.value) : null;
    },
    async createGrant(identifier, grant, expiresAt) {
      await database.insert(verification).values({
        expiresAt,
        id: crypto.randomUUID(),
        identifier,
        value: grantValue(grant),
      });
    },
    async createHandoff(identifier, handoff, expiresAt) {
      await database.insert(verification).values({
        expiresAt,
        id: crypto.randomUUID(),
        identifier,
        value: JSON.stringify(handoff),
      });
    },
    async createState(identifier, state, expiresAt) {
      await database.insert(verification).values({
        expiresAt,
        id: crypto.randomUUID(),
        identifier,
        value: JSON.stringify(state),
      });
    },
  };

  const rateLimiter: GitHubIdentityConfirmationRateLimit = {
    async consume({ accountId, clientKey, stage }) {
      const requestedAt = currentTime().getTime();
      const windowStart = requestedAt - CONFIRMATION_RATE_LIMIT_WINDOW_MS;

      async function consumeBucket(key: string) {
        const [limit] = await database
          .insert(rateLimit)
          .values({
            id: crypto.randomUUID(),
            key,
            count: 1,
            lastRequest: requestedAt,
          })
          .onConflictDoUpdate({
            target: rateLimit.key,
            set: {
              count: sql<number>`case when ${rateLimit.lastRequest} < ${windowStart} then 1 else ${rateLimit.count} + 1 end`,
              lastRequest: sql<number>`case when ${rateLimit.lastRequest} < ${windowStart} then ${requestedAt} else ${rateLimit.lastRequest} end`,
            },
          })
          .returning({ count: rateLimit.count });
        return Boolean(limit && limit.count <= CONFIRMATION_RATE_LIMIT_MAX);
      }

      const boundedClientKey = clientKey.slice(0, 128) || "unknown";
      const [ipAllowed, accountAllowed] = await Promise.all([
        consumeBucket(`confirm-github:${stage}:ip:${boundedClientKey}`),
        consumeBucket(`confirm-github:${stage}:account:${accountId}`),
      ]);
      return ipAllowed && accountAllowed;
    },
  };

  return createGitHubIdentityConfirmation({
    accountIdentities: {
      async findGitHubIdentityId(accountId) {
        const existing = await database.query.account.findFirst({
          columns: { accountId: true },
          where: and(
            eq(account.userId, accountId),
            eq(account.providerId, "github"),
          ),
        });
        return existing?.accountId ?? null;
      },
    },
    auditRecords: {
      async append(record: GitHubIdentityConfirmationAuditRecord) {
        await database
          .insert(auditRecord)
          .values({
            actorAlias: record.actorAlias,
            id: record.id,
            occurredAt: new Date(record.occurredAt),
            targetSessionAlias: record.targetSessionAlias,
            type: record.type,
          })
          .onConflictDoNothing({ target: auditRecord.id });
      },
    },
    authorizeSession: options.authorizeSession,
    githubAvailability: options.githubAvailability?.getStatus
      ? { getStatus: options.githubAvailability.getStatus }
      : undefined,
    issueGrant: async ({
      auditRecord: record,
      expiresAt,
      grant,
      handoff,
      handoffIdentifier,
      identifier,
    }) => {
      await database.transaction(async (transaction) => {
        await transaction.insert(verification).values({
          expiresAt,
          id: crypto.randomUUID(),
          identifier,
          value: grantValue(grant),
        });
        await transaction.insert(verification).values({
          expiresAt,
          id: crypto.randomUUID(),
          identifier: handoffIdentifier,
          value: JSON.stringify(handoff),
        });
        await transaction
          .insert(auditRecord)
          .values({
            actorAlias: record.actorAlias,
            id: record.id,
            occurredAt: new Date(record.occurredAt),
            targetSessionAlias: record.targetSessionAlias,
            type: record.type,
          })
          .onConflictDoNothing({ target: auditRecord.id });
      });
    },
    githubOAuth: createGitHubIdentityConfirmationOAuth({
      callbackURL: options.callbackURL,
      clientId: options.clientId,
      clientSecret: options.clientSecret,
      fetch: options.fetch,
      githubAvailability: options.githubAvailability,
    }),
    now: currentTime,
    rateLimit: rateLimiter,
    store,
  });
}
