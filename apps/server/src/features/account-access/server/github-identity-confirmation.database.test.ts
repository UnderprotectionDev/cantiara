import { DEFAULT_ACCOUNT_PREFERENCES } from "@cantiara/api/account-preferences";
import { createDb } from "@cantiara/db";
import {
  account,
  auditRecord,
  rateLimit,
  user,
  verification,
} from "@cantiara/db/schema/auth";
import { eq, like } from "drizzle-orm";
import { afterAll, describe, expect, test } from "vitest";

import type { AppDependencies } from "../../../app";
import { createApp } from "../../../app";
import { createGitHubAvailability } from "./github-availability";
import { createDatabaseGitHubIdentityConfirmation } from "./github-identity-confirmation-database";

const databaseUrl = process.env.ACCOUNT_ACCESS_DATABASE_URL;
const describeDatabase = databaseUrl ? describe : describe.skip;

const WEB_ORIGIN = "https://cantiara.example";
const API_ORIGIN = "https://api.cantiara.example";
const BASE64_URL_VALUE_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const HANDOFF_CODE_PATTERN = /"code":"([A-Za-z0-9_-]{43})"/;

describeDatabase("Confirm GitHub Identity PostgreSQL boundary", () => {
  const database = databaseUrl
    ? createDb({ DATABASE_URL: databaseUrl })
    : undefined;

  afterAll(async () => {
    await database?.$client.end();
  });

  test("completes callback handoff and consumes the real database grant through public HTTP", async () => {
    if (!database) {
      throw new Error("ACCOUNT_ACCESS_DATABASE_URL is required");
    }

    const accountId = `confirm-${crypto.randomUUID()}`;
    const identityId = `${Math.floor(Math.random() * 1_000_000_000)}`;
    const sessionId = `session-${crypto.randomUUID()}`;
    const sessionCookie = "__Secure-better-auth.session_token=integration";
    const email = `${accountId}@example.invalid`;
    const now = new Date("2026-09-16T09:00:00.000Z");
    const githubAvailability = createGitHubAvailability();
    const githubFetch = (input: string | URL) => {
      const url = String(input);
      if (url === "https://github.com/login/oauth/access_token") {
        return Promise.resolve(
          Response.json({ access_token: "provider-token" }),
        );
      }
      if (url === "https://api.github.com/user") {
        return Promise.resolve(Response.json({ id: identityId }));
      }
      throw new Error(`Unexpected GitHub request: ${url}`);
    };

    await database.insert(user).values({
      email,
      emailVerified: true,
      id: accountId,
      name: "Integration Founder",
    });
    await database.insert(account).values({
      accountId: identityId,
      id: crypto.randomUUID(),
      providerId: "github",
      userId: accountId,
    });

    const accountSessionAccess = {
      authorizeWrite: (candidate: { accountId: string; sessionId: string }) =>
        Promise.resolve(
          candidate.accountId === accountId &&
            candidate.sessionId === sessionId,
        ),
      listSessions: async () => [],
      replaySessionRevocations: async () => undefined,
      revokeGitHubLoginOAuth: async () => undefined,
      revokeOtherSessions: async () => undefined,
      revokeSession: async () => undefined,
    } satisfies AppDependencies["accountSessionAccess"];
    const auth = {
      api: {
        getSession: async ({ headers }: { headers: Headers }) =>
          headers.get("cookie") === sessionCookie
            ? {
                session: { id: sessionId },
                user: { id: accountId },
              }
            : null,
      },
      handler: async () => Response.json({ status: true }),
    } as unknown as AppDependencies["auth"];
    const confirmation = createDatabaseGitHubIdentityConfirmation(database, {
      authorizeSession: (candidate) =>
        accountSessionAccess.authorizeWrite(candidate),
      callbackURL: `${API_ORIGIN}/api/auth/confirm-github-identity/callback`,
      clientId: "integration-client",
      clientSecret: "integration-secret",
      fetch: githubFetch,
      githubAvailability,
      now: () => now,
    });
    const app = createApp({
      accountSessionAccess,
      accountPreferences: {
        get: async () => ({
          ...DEFAULT_ACCOUNT_PREFERENCES,
          isSaved: false,
          savedAt: null,
        }),
        save: async (_accountId, preferences) => ({
          ...preferences,
          isSaved: true,
          savedAt: "2026-09-16T09:00:00.000Z",
        }),
        saveAppearance: async (_accountId, appearance) => ({
          ...DEFAULT_ACCOUNT_PREFERENCES,
          appearance,
          isSaved: true,
          savedAt: "2026-09-16T09:00:00.000Z",
        }),
      },
      auth,
      corsOrigin: WEB_ORIGIN,
      database,
      desktopOrigins: [],
      githubAvailability,
      githubIdentityConfirmation: confirmation,
      nodeEnv: "test",
      redactSecrets: (value) => value,
      trustedProxyIps: [],
    });

    try {
      const start = await app.fetch(
        new Request(`${API_ORIGIN}/api/auth/confirm-github-identity/start`, {
          body: JSON.stringify({ operationId: "account-closure-start" }),
          headers: {
            cookie: sessionCookie,
            "content-type": "application/json",
            origin: WEB_ORIGIN,
          },
          method: "POST",
        }),
      );
      expect(start.status).toBe(200);
      const startBody = (await start.json()) as { authorizationUrl: string };
      const state = new URL(startBody.authorizationUrl).searchParams.get(
        "state",
      );
      expect(state).toMatch(BASE64_URL_VALUE_PATTERN);

      const callback = await app.fetch(
        new Request(
          `${API_ORIGIN}/api/auth/confirm-github-identity/callback?code=provider-code&state=${state}`,
        ),
      );
      const callbackBody = await callback.text();
      const handoffCode = callbackBody.match(HANDOFF_CODE_PATTERN)?.[1];
      expect(callback.status).toBe(200);
      expect(callback.headers.get("location")).toBeNull();
      expect(handoffCode).toMatch(BASE64_URL_VALUE_PATTERN);

      const exchange = await app.fetch(
        new Request(`${API_ORIGIN}/api/auth/confirm-github-identity/exchange`, {
          body: JSON.stringify({ code: handoffCode }),
          headers: {
            cookie: sessionCookie,
            "content-type": "application/json",
            origin: WEB_ORIGIN,
          },
          method: "POST",
        }),
      );
      const exchangeBody = (await exchange.json()) as { grant: string };
      expect(exchange.status).toBe(200);
      expect(exchangeBody.grant).toMatch(BASE64_URL_VALUE_PATTERN);

      const consumeRequest = () =>
        app.fetch(
          new Request(`${API_ORIGIN}/rpc/consumeGitHubIdentityGrant`, {
            body: JSON.stringify({
              json: {
                grant: exchangeBody.grant,
                operationId: "account-closure-start",
              },
            }),
            headers: {
              cookie: sessionCookie,
              "content-type": "application/json",
              origin: WEB_ORIGIN,
            },
            method: "POST",
          }),
        );

      const consumed = await consumeRequest();
      expect(consumed.status).toBe(200);
      await expect(consumed.json()).resolves.toEqual({
        json: { consumed: true },
      });

      const replayed = await consumeRequest();
      expect(replayed.status).toBe(200);
      await expect(replayed.json()).resolves.toEqual({
        json: { consumed: false },
      });
    } finally {
      const actorDigest = await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(accountId),
      );
      const actorAlias = `account:${Array.from(
        new Uint8Array(actorDigest),
        (byte) => byte.toString(16).padStart(2, "0"),
      ).join("")}`;
      await database
        .delete(verification)
        .where(like(verification.value, `%${accountId}%`));
      await database
        .delete(rateLimit)
        .where(like(rateLimit.key, `confirm-github:%${accountId}`));
      await database
        .delete(rateLimit)
        .where(eq(rateLimit.key, "confirm-github:start:ip:unknown"));
      await database
        .delete(rateLimit)
        .where(eq(rateLimit.key, "confirm-github:callback:ip:unknown"));
      await database
        .delete(rateLimit)
        .where(eq(rateLimit.key, "confirm-github:consume:ip:unknown"));
      await database
        .delete(auditRecord)
        .where(eq(auditRecord.actorAlias, actorAlias));
      await database.delete(user).where(eq(user.id, accountId));
    }
  });
});
