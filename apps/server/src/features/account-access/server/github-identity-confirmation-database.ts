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
  type GitHubIdentityConfirmationRateLimit,
  type GitHubIdentityConfirmationState,
  type GitHubIdentityConfirmationStore,
  isConfirmGitHubIdentityOperationId,
} from "./github-identity-confirmation";
import {
  createGitHubIdentityConfirmationOAuth,
  type GitHubIdentityConfirmationOAuthAvailability,
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
      parsed.sessionId.length === 0
    ) {
      return null;
    }

    return {
      accountId: parsed.accountId,
      codeVerifier: parsed.codeVerifier,
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
    async createGrant(identifier, grant, expiresAt) {
      await database.insert(verification).values({
        expiresAt,
        id: crypto.randomUUID(),
        identifier,
        value: grantValue(grant),
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
    issueGrant: async ({
      auditRecord: record,
      expiresAt,
      grant,
      identifier,
    }) => {
      await database.transaction(async (transaction) => {
        await transaction.insert(verification).values({
          expiresAt,
          id: crypto.randomUUID(),
          identifier,
          value: grantValue(grant),
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
      githubAvailability: options.githubAvailability,
    }),
    now: currentTime,
    rateLimit: rateLimiter,
    store,
  });
}
