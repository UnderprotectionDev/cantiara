import { createAuth } from "@cantiara/auth";
import { createDb } from "@cantiara/db";
import { user } from "@cantiara/db/schema/auth";
import { eq } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, describe, expect, test } from "vitest";

import { createDatabaseAccountAdmission } from "./account-admission";

const databaseUrl = process.env.ACCOUNT_ACCESS_DATABASE_URL;
const describeDatabase = databaseUrl ? describe : describe.skip;

const authConfig = {
  BETTER_AUTH_URL: "https://api.cantiara.example",
  BETTER_AUTH_SECRET: "test-secret-that-is-long-enough-123456",
  CORS_ORIGIN: "https://cantiara.example",
  GITHUB_CLIENT_ID: "github-client-id",
  GITHUB_CLIENT_SECRET: "github-client-secret",
  TRUSTED_PROXY_IPS: ["203.0.113.10"],
} as const;

const SESSION_COOKIE_PATTERN = /(?:__Secure-)?better-auth\.session_token=[^;]+/;
const originalFetch = globalThis.fetch;

function requestUrl(input: string | URL | Request) {
  if (input instanceof Request) {
    return input.url;
  }
  if (input instanceof URL) {
    return input.href;
  }
  return input;
}

function installGitHubOAuthTestDouble(identityId: string, email: string) {
  function githubFetch(input: string | URL | Request, _init?: RequestInit) {
    const url = requestUrl(input);
    if (url === "https://github.com/login/oauth/access_token") {
      return Promise.resolve(
        Response.json({
          access_token: "github-test-token",
          scope: "read:user,user:email",
          token_type: "bearer",
        }),
      );
    }
    if (url === "https://api.github.com/user") {
      return Promise.resolve(
        Response.json({
          avatar_url: null,
          email,
          id: identityId,
          login: "founder",
          name: "Founder",
        }),
      );
    }
    if (url === "https://api.github.com/user/emails") {
      return Promise.resolve(
        Response.json([
          {
            email,
            primary: true,
            verified: true,
            visibility: "private",
          },
        ]),
      );
    }
    return Promise.reject(new Error(`Unexpected GitHub request: ${url}`));
  }
  githubFetch.preconnect = originalFetch.preconnect;
  globalThis.fetch = githubFetch;
}

describeDatabase("Account Access PostgreSQL integration", () => {
  const database = databaseUrl
    ? createDb({ DATABASE_URL: databaseUrl })
    : undefined;

  beforeAll(() => {
    if (!database) {
      throw new Error("ACCOUNT_ACCESS_DATABASE_URL is required");
    }
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  afterAll(async () => {
    await database?.$client.end();
  });

  test("a migrated database creates the Workspace on the first GitHub callback", async () => {
    if (!database) {
      throw new Error("ACCOUNT_ACCESS_DATABASE_URL is required");
    }

    const identityId = `github-${crypto.randomUUID()}`;
    const email = `${identityId}@example.invalid`;
    let userId: string | undefined;
    installGitHubOAuthTestDouble(identityId, email);

    try {
      const accountAdmission = createDatabaseAccountAdmission(database);
      const auth = createAuth(authConfig, database, accountAdmission);
      const start = await auth.handler(
        new Request("https://api.cantiara.example/api/auth/sign-in/social", {
          body: JSON.stringify({
            callbackURL: "https://cantiara.example/dashboard",
            provider: "github",
          }),
          headers: {
            "content-type": "application/json",
            origin: "https://cantiara.example",
          },
          method: "POST",
        }),
      );
      const startBody = (await start.json()) as { url: string };
      const state = new URL(startBody.url).searchParams.get("state");
      const stateCookie = start.headers.get("set-cookie")?.split(";", 1)[0];
      if (!(state && stateCookie)) {
        throw new Error("OAuth state was not created");
      }

      const callback = await auth.handler(
        new Request(
          `https://api.cantiara.example/api/auth/callback/github?code=test-code&state=${state}`,
          { headers: { cookie: stateCookie } },
        ),
      );
      expect(callback.status).toBe(302);
      expect(callback.headers.get("location")).toBe(
        "https://cantiara.example/dashboard",
      );

      const sessionCookie = callback.headers
        .get("set-cookie")
        ?.match(SESSION_COOKIE_PATTERN)?.[0];
      expect(sessionCookie).toBeDefined();

      const sessionResponse = await auth.handler(
        new Request("https://api.cantiara.example/api/auth/get-session", {
          headers: { cookie: sessionCookie ?? "" },
        }),
      );
      expect(sessionResponse.status).toBe(200);
      const sessionBody = (await sessionResponse.json()) as {
        user?: { id: string };
      };
      userId = sessionBody.user?.id;
      expect(userId).toEqual(expect.any(String));

      await expect(
        accountAdmission.admitAccount(userId as string),
      ).resolves.toEqual({
        accountId: userId,
        workspaceId: expect.any(String),
      });
    } finally {
      const cleanupUser =
        userId ??
        (
          await database.query.user.findFirst({
            columns: { id: true },
            where: eq(user.email, email),
          })
        )?.id;
      if (cleanupUser) {
        await database.delete(user).where(eq(user.id, cleanupUser));
      }
    }
  });
});
